/**
 * src/services/queue/migrate.ts
 *
 * One-time (idempotent) migration from config/publish-queue.json → SQLite.
 *
 * Safe to run on every CI boot: jobs already in the DB are silently skipped
 * via INSERT OR IGNORE (idempotency key = job PK).
 *
 * Usage:
 *   npx tsx src/services/queue/migrate.ts
 *   npx tsx src/services/queue/migrate.ts --db data/queue.db --json config/publish-queue.json
 */

import { readFileSync, existsSync } from 'fs';
import { QueueDb } from './index';

// ─── Types matching the legacy JSON shape ────────────────────────────────────

interface LegacyQueueEntry {
  episodeNumber: number;
  scheduledDate: string;
  languages: string[];
  status: 'pending' | 'uploading' | 'published' | 'failed';
}

interface LegacyQueue {
  queue: LegacyQueueEntry[];
  schedule: {
    days: string[];
    time: string;
    timezone: string;
  };
}

// ─── CLI argument parsing ─────────────────────────────────────────────────────

function parseArgs(): { dbPath: string; jsonPath: string } {
  const args = process.argv.slice(2);
  let dbPath = 'data/queue.db';
  let jsonPath = 'config/publish-queue.json';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) dbPath = args[++i];
    if (args[i] === '--json' && args[i + 1]) jsonPath = args[++i];
  }
  return { dbPath, jsonPath };
}

// ─── Map legacy status → canonical status ────────────────────────────────────

function mapStatus(
  legacy: LegacyQueueEntry['status'],
): 'pending' | 'claimed' | 'published' | 'failed' {
  if (legacy === 'uploading') return 'claimed'; // in-flight at crash time → treat as claimed
  return legacy;
}

// ─── Migration ───────────────────────────────────────────────────────────────

export function migrate(dbPath: string, jsonPath: string): { inserted: number; skipped: number } {
  if (!existsSync(jsonPath)) {
    console.log(`ℹ️  ${jsonPath} not found — nothing to migrate.`);
    return { inserted: 0, skipped: 0 };
  }

  const raw = readFileSync(jsonPath, 'utf-8');
  const legacy = JSON.parse(raw) as LegacyQueue;

  const db = QueueDb.open(dbPath);

  let inserted = 0;
  let skipped = 0;

  // Migrate schedule configuration.
  db.setSchedule({
    days: legacy.schedule.days,
    publishTime: legacy.schedule.time,
    timezone: legacy.schedule.timezone,
  });

  for (const entry of legacy.queue) {
    const key = `ep-${entry.episodeNumber}`;
    const existing = db.get(key);

    if (existing) {
      skipped++;
      continue;
    }

    // enqueue() uses INSERT OR IGNORE, so the status will be 'pending' by default.
    // For entries that were already published/failed, we enqueue then immediately
    // update the status so history is preserved.
    db.enqueue({
      idempotencyKey: key,
      episodeNumber: entry.episodeNumber,
      languages: entry.languages,
      scheduledDate: entry.scheduledDate,
    });

    const targetStatus = mapStatus(entry.status);
    if (targetStatus !== 'pending') {
      // Directly set the status without going through claim/complete/fail so we
      // don't generate spurious attempt records for historical entries.
      // This uses the internal DB via a raw prepare; acceptable for a migration script.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any).db
        .prepare(
          `UPDATE jobs SET status = @status, updated_at = @now WHERE id = @id`,
        )
        .run({
          status: targetStatus,
          now: new Date().toISOString(),
          id: key,
        });
    }

    inserted++;
  }

  db.close();

  return { inserted, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const { dbPath, jsonPath } = parseArgs();
  console.log(`🔄 Migrating ${jsonPath} → ${dbPath}`);

  const { inserted, skipped } = migrate(dbPath, jsonPath);

  console.log(`✅ Done — ${inserted} jobs inserted, ${skipped} skipped (already present).`);
  process.exit(0);
}
