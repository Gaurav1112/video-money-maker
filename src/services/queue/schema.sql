-- queue/schema.sql
-- Run via: better-sqlite3 data/queue.db < src/services/queue/schema.sql
-- Or applied automatically by QueueDb.open() in index.ts

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- ─── Jobs ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id             TEXT    PRIMARY KEY,   -- idempotency key: "ep-{N}" or custom
  episode_number INTEGER NOT NULL,
  languages      TEXT    NOT NULL,      -- JSON array: '["hindi","english"]'
  scheduled_date TEXT    NOT NULL,      -- ISO 8601 date: "YYYY-MM-DD"
  status         TEXT    NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','claimed','published','failed','dead_letter')),
  claimed_at     TEXT,                  -- ISO 8601 timestamp; NULL if unclaimed
  claimed_by     TEXT,                  -- worker id (GHA run_id, hostname, etc.)
  attempt_count  INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ─── Attempts (append-only audit log) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attempts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id         TEXT    NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  worker_id      TEXT,
  started_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  completed_at   TEXT,
  outcome        TEXT    CHECK (outcome IN ('success','failure','timeout')),
  error_message  TEXT
);

-- ─── Dead Letter ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dead_letter (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id                TEXT    NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reason                TEXT    NOT NULL,
  moved_at              TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  original_attempt_count INTEGER NOT NULL
);

-- ─── Idempotency Keys ────────────────────────────────────────────────────────
-- Allows callers to supply arbitrary business keys that map to a job id.
-- INSERT OR IGNORE prevents duplicate enqueues across crash-retry loops.
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key        TEXT PRIMARY KEY,
  job_id     TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ─── Schedule Configuration (replaces JSON "schedule" block) ─────────────────
CREATE TABLE IF NOT EXISTS schedule_config (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  days         TEXT NOT NULL DEFAULT '["monday","wednesday","friday"]',
  publish_time TEXT NOT NULL DEFAULT '18:15',
  timezone     TEXT NOT NULL DEFAULT 'Asia/Kolkata'
);

INSERT OR IGNORE INTO schedule_config (id) VALUES (1);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_status          ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_date  ON jobs(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_jobs_status_sched    ON jobs(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_attempts_job_id      ON attempts(job_id);
CREATE INDEX IF NOT EXISTS idx_dead_letter_job_id   ON dead_letter(job_id);
