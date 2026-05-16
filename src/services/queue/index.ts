/**
 * src/services/queue/index.ts
 *
 * SQLite-backed publish queue.  Replaces config/publish-queue.json.
 *
 * Requires:  npm install better-sqlite3 && npm install -D @types/better-sqlite3
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── Constants ───────────────────────────────────────────────────────────────

export const MAX_ATTEMPTS = 3;
const SCHEMA_PATH = join(__dirname, 'schema.sql');

// ─── Types ───────────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'claimed' | 'published' | 'failed' | 'dead_letter';

export interface EnqueueOptions {
  /** Stable business key — duplicate calls with the same key are no-ops. */
  idempotencyKey: string;
  episodeNumber: number;
  languages: string[];
  /** ISO 8601 date string: "YYYY-MM-DD" */
  scheduledDate: string;
  /** Optional worker/process identifier for observability. */
  workerId?: string;
}

export interface Job {
  id: string;
  episodeNumber: number;
  languages: string[];
  scheduledDate: string;
  status: JobStatus;
  claimedAt: string | null;
  claimedBy: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Attempt {
  id: number;
  jobId: string;
  attemptNumber: number;
  workerId: string | null;
  startedAt: string;
  completedAt: string | null;
  outcome: 'success' | 'failure' | 'timeout' | null;
  errorMessage: string | null;
}

export interface DeadLetterEntry {
  id: number;
  jobId: string;
  reason: string;
  movedAt: string;
  originalAttemptCount: number;
}

export interface ScheduleConfig {
  days: string[];
  publishTime: string;
  timezone: string;
}

// ─── Internal row shapes returned by better-sqlite3 ─────────────────────────

interface JobRow {
  id: string;
  episode_number: number;
  languages: string;
  scheduled_date: string;
  status: JobStatus;
  claimed_at: string | null;
  claimed_by: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
}

interface DeadLetterRow {
  id: number;
  job_id: string;
  reason: string;
  moved_at: string;
  original_attempt_count: number;
}

interface AttemptRow {
  id: number;
  job_id: string;
  attempt_number: number;
  worker_id: string | null;
  started_at: string;
  completed_at: string | null;
  outcome: 'success' | 'failure' | 'timeout' | null;
  error_message: string | null;
}

// ─── Row → domain mappers ────────────────────────────────────────────────────

function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    episodeNumber: row.episode_number,
    languages: JSON.parse(row.languages) as string[],
    scheduledDate: row.scheduled_date,
    status: row.status,
    claimedAt: row.claimed_at,
    claimedBy: row.claimed_by,
    attemptCount: row.attempt_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAttempt(row: AttemptRow): Attempt {
  return {
    id: row.id,
    jobId: row.job_id,
    attemptNumber: row.attempt_number,
    workerId: row.worker_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    outcome: row.outcome,
    errorMessage: row.error_message,
  };
}

function rowToDeadLetter(row: DeadLetterRow): DeadLetterEntry {
  return {
    id: row.id,
    jobId: row.job_id,
    reason: row.reason,
    movedAt: row.moved_at,
    originalAttemptCount: row.original_attempt_count,
  };
}

// ─── QueueDb ─────────────────────────────────────────────────────────────────

export class QueueDb {
  private db: Database.Database;

  private constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Open (or create) the queue database.
   *
   * @param dbPath  Path to the SQLite file.  Pass `:memory:` for tests.
   */
  static open(dbPath: string): QueueDb {
    const db = new Database(dbPath);

    // Apply schema (idempotent — all statements use IF NOT EXISTS / INSERT OR IGNORE)
    const schema = readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);

    return new QueueDb(db);
  }

  // ─── enqueue ──────────────────────────────────────────────────────────────

  /**
   * Add a job to the queue.  Safe to call multiple times with the same
   * `idempotencyKey`; subsequent calls are silently ignored.
   *
   * @returns The job that was inserted, or the existing job if already present.
   */
  enqueue(opts: EnqueueOptions): Job {
    const now = new Date().toISOString();

    const insert = this.db.transaction(() => {
      // Use the idempotency key as the job PK so INSERT OR IGNORE is atomic.
      this.db
        .prepare(
          `INSERT OR IGNORE INTO jobs
             (id, episode_number, languages, scheduled_date, status, created_at, updated_at)
           VALUES
             (@id, @episode_number, @languages, @scheduled_date, 'pending', @now, @now)`,
        )
        .run({
          id: opts.idempotencyKey,
          episode_number: opts.episodeNumber,
          languages: JSON.stringify(opts.languages),
          scheduled_date: opts.scheduledDate,
          now,
        });

      // Mirror into idempotency_keys for cross-key lookups (no-op if already exists).
      this.db
        .prepare(
          `INSERT OR IGNORE INTO idempotency_keys (key, job_id, created_at)
           VALUES (@key, @job_id, @now)`,
        )
        .run({ key: opts.idempotencyKey, job_id: opts.idempotencyKey, now });

      return this.db
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .get(opts.idempotencyKey) as JobRow;
    });

    return rowToJob(insert());
  }

  // ─── claim ────────────────────────────────────────────────────────────────

  /**
   * Atomically claim the next pending job.
   *
   * Uses `BEGIN IMMEDIATE` to prevent two concurrent workers from claiming
   * the same job (TOCTOU elimination).  Timed-out claims (claimed longer than
   * `timeoutMs` ago) are returned to `pending` before a new claim is issued.
   *
   * @param timeoutMs   Reclaim jobs claimed longer than this.  Default: 10 min.
   * @param workerId    Identifier for the claiming worker.
   * @returns The claimed job, or `null` if the queue is empty.
   */
  claim(timeoutMs = 10 * 60 * 1000, workerId = 'unknown'): Job | null {
    const now = new Date();
    const cutoff = new Date(now.getTime() - timeoutMs).toISOString();
    const nowIso = now.toISOString();

    // .immediate() issues BEGIN IMMEDIATE, serializing concurrent claim() callers.
    // Two workers racing: the first acquires the write lock; the second waits,
    // then finds the job already claimed and returns null.
    return this.db
      .transaction((): Job | null => {
        // Step 1: Return timed-out claims to pending.
        this.db
          .prepare(
            `UPDATE jobs
             SET status = 'pending', claimed_at = NULL, claimed_by = NULL,
                 updated_at = @now
             WHERE status = 'claimed' AND claimed_at <= @cutoff`,
          )
          .run({ now: nowIso, cutoff });

        // Step 2: Claim the earliest pending job for today-or-earlier.
        const result = this.db
          .prepare(
            `UPDATE jobs
             SET status = 'claimed', claimed_at = @now, claimed_by = @worker,
                 attempt_count = attempt_count + 1, updated_at = @now
             WHERE id = (
               SELECT id FROM jobs
               WHERE status = 'pending'
                 AND scheduled_date <= @today
               ORDER BY scheduled_date ASC
               LIMIT 1
             )
             RETURNING *`,
          )
          .get({ now: nowIso, worker: workerId, today: now.toISOString().slice(0, 10) }) as
          | JobRow
          | undefined;

        if (!result) return null;

        // Record attempt.
        this.db
          .prepare(
            `INSERT INTO attempts (job_id, attempt_number, worker_id, started_at)
             VALUES (@job_id, @attempt_number, @worker_id, @now)`,
          )
          .run({
            job_id: result.id,
            attempt_number: result.attempt_count,
            worker_id: workerId,
            now: nowIso,
          });

        return rowToJob(result);
      })
      .immediate();
  }

  // ─── complete ─────────────────────────────────────────────────────────────

  /**
   * Mark a job as successfully published.  Records the attempt outcome.
   */
  complete(jobId: string): void {
    const now = new Date().toISOString();

    this.db.transaction(() => {
      const job = this.db
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .get(jobId) as JobRow | undefined;
      if (!job) throw new Error(`Job not found: ${jobId}`);

      this.db
        .prepare(
          `UPDATE jobs SET status = 'published', updated_at = @now WHERE id = @id`,
        )
        .run({ now, id: jobId });

      this.db
        .prepare(
          `UPDATE attempts
           SET outcome = 'success', completed_at = @now
           WHERE job_id = @job_id AND attempt_number = @attempt`,
        )
        .run({ now, job_id: jobId, attempt: job.attempt_count });
    })();
  }

  // ─── fail ─────────────────────────────────────────────────────────────────

  /**
   * Record a failure for a job.
   *
   * - If `attemptCount < MAX_ATTEMPTS`: resets status to `pending` for retry.
   * - If `attemptCount >= MAX_ATTEMPTS`: moves job to `dead_letter`.
   */
  fail(jobId: string, reason: string): void {
    const now = new Date().toISOString();

    this.db.transaction(() => {
      const job = this.db
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .get(jobId) as JobRow | undefined;
      if (!job) throw new Error(`Job not found: ${jobId}`);

      // Close the attempt record.
      this.db
        .prepare(
          `UPDATE attempts
           SET outcome = 'failure', completed_at = @now, error_message = @reason
           WHERE job_id = @job_id AND attempt_number = @attempt`,
        )
        .run({ now, job_id: jobId, reason, attempt: job.attempt_count });

      if (job.attempt_count >= MAX_ATTEMPTS) {
        this.db
          .prepare(
            `UPDATE jobs SET status = 'dead_letter', updated_at = @now WHERE id = @id`,
          )
          .run({ now, id: jobId });

        this.db
          .prepare(
            `INSERT INTO dead_letter (job_id, reason, moved_at, original_attempt_count)
             VALUES (@job_id, @reason, @now, @attempts)`,
          )
          .run({ job_id: jobId, reason, now, attempts: job.attempt_count });
      } else {
        // Return to pending for retry.
        this.db
          .prepare(
            `UPDATE jobs
             SET status = 'pending', claimed_at = NULL, claimed_by = NULL,
                 updated_at = @now
             WHERE id = @id`,
          )
          .run({ now, id: jobId });
      }
    })();
  }

  // ─── deadLetter ──────────────────────────────────────────────────────────

  /** Return all entries in the dead-letter table. */
  deadLetter(): DeadLetterEntry[] {
    return (
      this.db.prepare('SELECT * FROM dead_letter ORDER BY moved_at DESC').all() as DeadLetterRow[]
    ).map(rowToDeadLetter);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** All pending jobs, ordered by scheduled_date ascending. */
  pending(): Job[] {
    return (
      this.db
        .prepare("SELECT * FROM jobs WHERE status = 'pending' ORDER BY scheduled_date ASC")
        .all() as JobRow[]
    ).map(rowToJob);
  }

  /** Single job by id, or null. */
  get(jobId: string): Job | null {
    const row = this.db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as
      | JobRow
      | undefined;
    return row ? rowToJob(row) : null;
  }

  /** Attempt history for a job. */
  attempts(jobId: string): Attempt[] {
    return (
      this.db
        .prepare('SELECT * FROM attempts WHERE job_id = ? ORDER BY attempt_number ASC')
        .all(jobId) as AttemptRow[]
    ).map(rowToAttempt);
  }

  /** Read the schedule configuration. */
  getSchedule(): ScheduleConfig {
    const row = this.db
      .prepare('SELECT * FROM schedule_config WHERE id = 1')
      .get() as { days: string; publish_time: string; timezone: string } | undefined;

    if (!row) throw new Error('schedule_config is missing — was schema applied?');
    return {
      days: JSON.parse(row.days) as string[],
      publishTime: row.publish_time,
      timezone: row.timezone,
    };
  }

  /** Overwrite the schedule configuration. */
  setSchedule(cfg: ScheduleConfig): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO schedule_config (id, days, publish_time, timezone)
         VALUES (1, @days, @time, @tz)`,
      )
      .run({ days: JSON.stringify(cfg.days), time: cfg.publishTime, tz: cfg.timezone });
  }

  /** Stats snapshot for dashboards. */
  stats(): Record<JobStatus, number> {
    const rows = this.db
      .prepare('SELECT status, COUNT(*) AS n FROM jobs GROUP BY status')
      .all() as { status: JobStatus; n: number }[];
    const out: Record<string, number> = {
      pending: 0,
      claimed: 0,
      published: 0,
      failed: 0,
      dead_letter: 0,
    };
    for (const r of rows) out[r.status] = r.n;
    return out as Record<JobStatus, number>;
  }

  close(): void {
    this.db.close();
  }
}

// ─── Module-level singleton (optional convenience) ──────────────────────────

let _instance: QueueDb | null = null;

/**
 * Get (or create) the process-level singleton connected to `data/queue.db`.
 * Prefer `QueueDb.open(path)` in tests to keep them isolated.
 */
export function getQueue(dbPath = 'data/queue.db'): QueueDb {
  if (!_instance) {
    _instance = QueueDb.open(dbPath);
  }
  return _instance;
}
