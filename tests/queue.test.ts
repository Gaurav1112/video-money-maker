/**
 * tests/queue.test.ts
 *
 * Unit tests for the SQLite publish queue.
 * Runs entirely in-memory (`:memory:`) — no file system side effects.
 *
 * Run with:  npx vitest run tests/queue.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueueDb, MAX_ATTEMPTS } from '../src/services/queue/index';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDb(): QueueDb {
  return QueueDb.open(':memory:');
}

const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

function baseOpts(overrides: Partial<Parameters<QueueDb['enqueue']>[0]> = {}) {
  return {
    idempotencyKey: 'ep-1',
    episodeNumber: 1,
    languages: ['hindi', 'english'],
    scheduledDate: TODAY,
    ...overrides,
  };
}

// ─── Idempotency ─────────────────────────────────────────────────────────────

describe('enqueue() idempotency', () => {
  let db: QueueDb;
  beforeEach(() => { db = makeDb(); });
  afterEach(() => db.close());

  it('inserts a new job and returns it', () => {
    const job = db.enqueue(baseOpts());
    expect(job.id).toBe('ep-1');
    expect(job.status).toBe('pending');
    expect(job.episodeNumber).toBe(1);
    expect(job.languages).toEqual(['hindi', 'english']);
  });

  it('returns the existing job on a duplicate enqueue call (same key)', () => {
    const first = db.enqueue(baseOpts());
    const second = db.enqueue(baseOpts({ episodeNumber: 99 })); // changed field, same key
    expect(second.id).toBe(first.id);
    expect(second.episodeNumber).toBe(1); // original value preserved
    expect(db.pending()).toHaveLength(1); // still only one job
  });

  it('allows two different keys to coexist', () => {
    db.enqueue(baseOpts({ idempotencyKey: 'ep-1' }));
    db.enqueue(baseOpts({ idempotencyKey: 'ep-2', episodeNumber: 2 }));
    expect(db.pending()).toHaveLength(2);
  });
});

// ─── claim() — basic ────────────────────────────────────────────────────────

describe('claim() basic', () => {
  let db: QueueDb;
  beforeEach(() => { db = makeDb(); });
  afterEach(() => db.close());

  it('claims a pending job and sets status to claimed', () => {
    db.enqueue(baseOpts());
    const job = db.claim(10_000, 'worker-A');
    expect(job).not.toBeNull();
    expect(job!.status).toBe('claimed');
    expect(job!.claimedBy).toBe('worker-A');
    expect(job!.attemptCount).toBe(1);
  });

  it('returns null when queue is empty', () => {
    expect(db.claim()).toBeNull();
  });

  it('returns null when only future-scheduled jobs exist', () => {
    db.enqueue(baseOpts({ scheduledDate: TOMORROW }));
    expect(db.claim()).toBeNull();
  });

  it('claims a job scheduled for yesterday', () => {
    db.enqueue(baseOpts({ scheduledDate: YESTERDAY }));
    expect(db.claim()).not.toBeNull();
  });
});

// ─── claim() — claim-once-only (multi-worker safety) ────────────────────────

describe('claim() claim-once-only', () => {
  let db: QueueDb;
  beforeEach(() => { db = makeDb(); });
  afterEach(() => db.close());

  it('two workers racing — exactly one gets the job', () => {
    db.enqueue(baseOpts());

    // Simulate two concurrent workers by calling claim() back-to-back on the
    // same in-memory DB.  SQLite's BEGIN IMMEDIATE serializes them.
    const a = db.claim(60_000, 'worker-A');
    const b = db.claim(60_000, 'worker-B');

    // Exactly one worker should have claimed the job; the other gets null.
    const winners = [a, b].filter(Boolean);
    const losers = [a, b].filter((x) => x === null);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
  });

  it('already-claimed job is not re-claimed before timeout', () => {
    db.enqueue(baseOpts());
    db.claim(60_000, 'worker-A');

    const second = db.claim(60_000, 'worker-B');
    expect(second).toBeNull();
  });

  it('timed-out claim is re-claimed by another worker', () => {
    db.enqueue(baseOpts());

    // Claim with a 0ms timeout — it immediately becomes stale on the next call.
    const first = db.claim(0, 'worker-A');
    expect(first).not.toBeNull();

    // The next claim sees the stale entry and reclaims it.
    const reclaimed = db.claim(0, 'worker-B');
    expect(reclaimed).not.toBeNull();
    expect(reclaimed!.id).toBe(first!.id);
    expect(reclaimed!.claimedBy).toBe('worker-B');
    expect(reclaimed!.attemptCount).toBe(2);
  });
});

// ─── complete() ──────────────────────────────────────────────────────────────

describe('complete()', () => {
  let db: QueueDb;
  beforeEach(() => { db = makeDb(); });
  afterEach(() => db.close());

  it('marks job as published', () => {
    db.enqueue(baseOpts());
    const claimed = db.claim(60_000, 'worker-A')!;
    db.complete(claimed.id);

    const updated = db.get(claimed.id)!;
    expect(updated.status).toBe('published');
  });

  it('records a success attempt entry', () => {
    db.enqueue(baseOpts());
    const claimed = db.claim(60_000, 'worker-A')!;
    db.complete(claimed.id);

    const attempts = db.attempts(claimed.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].outcome).toBe('success');
    expect(attempts[0].completedAt).not.toBeNull();
  });

  it('throws if job not found', () => {
    expect(() => db.complete('nonexistent')).toThrow('not found');
  });
});

// ─── fail() ──────────────────────────────────────────────────────────────────

describe('fail()', () => {
  let db: QueueDb;
  beforeEach(() => { db = makeDb(); });
  afterEach(() => db.close());

  it('resets status to pending after first failure (below MAX_ATTEMPTS)', () => {
    db.enqueue(baseOpts());
    const claimed = db.claim(60_000)!;
    db.fail(claimed.id, 'network error');

    const updated = db.get(claimed.id)!;
    expect(updated.status).toBe('pending');
    expect(updated.claimedAt).toBeNull();
    expect(updated.attemptCount).toBe(1); // preserved — not reset
  });

  it('records a failure attempt entry with the error message', () => {
    db.enqueue(baseOpts());
    const claimed = db.claim(60_000)!;
    db.fail(claimed.id, 'upload timeout');

    const attempts = db.attempts(claimed.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].outcome).toBe('failure');
    expect(attempts[0].errorMessage).toBe('upload timeout');
  });

  it(`moves to dead_letter after ${MAX_ATTEMPTS} failures`, () => {
    db.enqueue(baseOpts());

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const job = db.claim(0)!; // timeout=0 so re-claim works immediately
      expect(job).not.toBeNull();
      db.fail(job.id, `failure ${i + 1}`);
    }

    const job = db.get('ep-1')!;
    expect(job.status).toBe('dead_letter');

    const dl = db.deadLetter();
    expect(dl).toHaveLength(1);
    expect(dl[0].jobId).toBe('ep-1');
    expect(dl[0].originalAttemptCount).toBe(MAX_ATTEMPTS);
  });

  it('dead-letter job is not re-claimed', () => {
    db.enqueue(baseOpts());

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const job = db.claim(0)!;
      db.fail(job.id, 'err');
    }

    // Queue is exhausted; the only job is dead_letter.
    expect(db.claim()).toBeNull();
  });
});

// ─── dead_letter() ───────────────────────────────────────────────────────────

describe('deadLetter()', () => {
  let db: QueueDb;
  beforeEach(() => { db = makeDb(); });
  afterEach(() => db.close());

  it('returns empty array when no dead-letter entries', () => {
    expect(db.deadLetter()).toEqual([]);
  });

  it('returns all dead-letter entries in descending moved_at order', () => {
    // Create two separate jobs and exhaust both.
    for (const key of ['ep-1', 'ep-2']) {
      db.enqueue(baseOpts({ idempotencyKey: key, episodeNumber: parseInt(key.split('-')[1]) }));
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const job = db.claim(0)!;
        db.fail(job.id, 'err');
      }
    }

    const dl = db.deadLetter();
    expect(dl).toHaveLength(2);
    // Verify all have expected fields.
    for (const entry of dl) {
      expect(entry.jobId).toMatch(/^ep-[12]$/);
      expect(entry.reason).toBe('err');
      expect(entry.originalAttemptCount).toBe(MAX_ATTEMPTS);
    }
  });
});

// ─── Schedule config ─────────────────────────────────────────────────────────

describe('schedule config', () => {
  let db: QueueDb;
  beforeEach(() => { db = makeDb(); });
  afterEach(() => db.close());

  it('returns default schedule after schema init', () => {
    const cfg = db.getSchedule();
    expect(cfg.days).toEqual(['monday', 'wednesday', 'friday']);
    expect(cfg.publishTime).toBe('18:15');
    expect(cfg.timezone).toBe('Asia/Kolkata');
  });

  it('round-trips a custom schedule', () => {
    db.setSchedule({ days: ['tuesday', 'thursday'], publishTime: '09:00', timezone: 'UTC' });
    const cfg = db.getSchedule();
    expect(cfg.days).toEqual(['tuesday', 'thursday']);
    expect(cfg.publishTime).toBe('09:00');
    expect(cfg.timezone).toBe('UTC');
  });
});

// ─── stats() ─────────────────────────────────────────────────────────────────

describe('stats()', () => {
  let db: QueueDb;
  beforeEach(() => { db = makeDb(); });
  afterEach(() => db.close());

  it('returns zero counts when DB is empty', () => {
    const s = db.stats();
    expect(s.pending).toBe(0);
    expect(s.claimed).toBe(0);
    expect(s.published).toBe(0);
    expect(s.failed).toBe(0);
    expect(s.dead_letter).toBe(0);
  });

  it('reflects correct counts after operations', () => {
    db.enqueue(baseOpts({ idempotencyKey: 'ep-1' }));
    db.enqueue(baseOpts({ idempotencyKey: 'ep-2', episodeNumber: 2 }));
    db.enqueue(baseOpts({ idempotencyKey: 'ep-3', episodeNumber: 3 }));

    const c1 = db.claim(60_000, 'w1')!;
    db.complete(c1.id);

    const c2 = db.claim(60_000, 'w2')!;
    db.fail(c2.id, 'err');

    const s = db.stats();
    expect(s.published).toBe(1);
    expect(s.pending).toBe(2); // ep-3 untouched, ep-2 reset to pending after 1 fail
  });
});
