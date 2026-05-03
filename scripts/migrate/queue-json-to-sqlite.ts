#!/usr/bin/env npx tsx
/**
 * scripts/migrate/queue-json-to-sqlite.ts — One-time migration
 *
 * Reads config/publish-queue.json (1.4 MB, 3× entries per topic/session)
 * and writes every entry into data/queue.db as queue_items + platform_publishes rows.
 *
 * Safe to run multiple times: uses INSERT OR IGNORE to skip already-migrated rows.
 *
 * Usage:
 *   npx tsx scripts/migrate/queue-json-to-sqlite.ts [--dry-run] [--verbose]
 *
 * After migration:
 *   1. Verify:  npx tsx scripts/migrate/queue-json-to-sqlite.ts --verify
 *   2. Delete:  git rm config/publish-queue.json
 *   3. Commit:  git commit -m "chore: migrate publish queue to SQLite"
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { openDb, DB_PATH } from '../queue/init-db.js';

// ─── Types (mirrors config/publish-queue.json schema) ───────────────────────

type PublishStatus = 'pending' | 'published' | 'failed' | 'skipped';
type SlotType      = 'long' | 'vertical-1' | 'vertical-23';

interface PublishEntry {
  id: string;
  topic: string;
  topicName: string;
  session: number;
  slotType: SlotType;
  dayOfWeek: 'Tuesday' | 'Thursday' | 'Saturday';
  scheduledDate: string;
  status: PublishStatus;
  attempts: number;
  youtubeVideoId: string | null;
  instagramMediaId: string | null;
  lastUpdated: string | null;
  errorMessage: string | null;
  files: {
    video: string;
    additionalVideos?: string[];
    metadata: string;
    thumbnail?: string;
  };
}

interface PublishQueue {
  version: number;
  lastUpdated: string;
  entries: PublishEntry[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const QUEUE_JSON_PATH = path.resolve(
  process.cwd(),
  'config',
  'publish-queue.json'
);

function mapStatus(jsonStatus: PublishStatus): string {
  switch (jsonStatus) {
    case 'published': return 'published';
    case 'failed':    return 'failed';
    case 'skipped':   return 'dead_letter'; // treat old skips as dead-letter for review
    default:          return 'pending';
  }
}

function platformStatus(
  jsonStatus: PublishStatus,
  platformId: string | null,
): string {
  if (platformId && platformId !== 'pending') return 'published';
  if (jsonStatus === 'skipped') return 'dead_letter';
  if (jsonStatus === 'failed')  return 'failed';
  return 'pending';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const argv    = process.argv.slice(2);
  const dryRun  = argv.includes('--dry-run');
  const verbose = argv.includes('--verbose');
  const verify  = argv.includes('--verify');

  // ── Verify mode ──────────────────────────────────────────────────────────
  if (verify) {
    runVerify();
    return;
  }

  // ── Load source ───────────────────────────────────────────────────────────
  if (!fs.existsSync(QUEUE_JSON_PATH)) {
    console.error(`❌ Source file not found: ${QUEUE_JSON_PATH}`);
    console.error('   Run from the repo root (where config/ directory exists).');
    process.exit(1);
  }

  console.log(`📂 Reading ${QUEUE_JSON_PATH} …`);
  const raw   = fs.readFileSync(QUEUE_JSON_PATH, 'utf-8');
  const queue = JSON.parse(raw) as PublishQueue;
  console.log(`   Found ${queue.entries.length} entries (version ${queue.version})`);

  if (dryRun) {
    console.log('🔍 DRY RUN — no writes to DB');
  }

  // ── Open DB ───────────────────────────────────────────────────────────────
  const db = openDb();
  console.log(`🗃  Target DB: ${DB_PATH}`);

  // ── Migrate ───────────────────────────────────────────────────────────────
  let inserted = 0;
  let skipped  = 0;
  let errors   = 0;

  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO queue_items
      (id, topic, topic_name, session, slot_type, day_of_week,
       scheduled_date, overall_status, video_path, additional_videos,
       metadata_path, thumbnail_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPlatform = db.prepare(`
    INSERT OR IGNORE INTO platform_publishes
      (queue_item_id, platform, status, platform_video_id, attempts, last_error)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const migrateTx = db.transaction((entries: PublishEntry[]) => {
    for (const entry of entries) {
      try {
        const overallStatus = mapStatus(entry.status);
        const additionalVideos = entry.files.additionalVideos?.length
          ? JSON.stringify(entry.files.additionalVideos)
          : null;

        if (!dryRun) {
          const r = insertItem.run(
            entry.id,
            entry.topic,
            entry.topicName,
            entry.session,
            entry.slotType,
            entry.dayOfWeek,
            entry.scheduledDate,
            overallStatus,
            entry.files.video,
            additionalVideos,
            entry.files.metadata,
            entry.files.thumbnail ?? null,
          );

          if (r.changes > 0) {
            inserted++;

            // YouTube platform row
            const ytStatus = platformStatus(entry.status, entry.youtubeVideoId);
            insertPlatform.run(
              entry.id, 'youtube', ytStatus,
              (entry.youtubeVideoId && entry.youtubeVideoId !== 'pending')
                ? entry.youtubeVideoId : null,
              entry.attempts,
              entry.errorMessage ?? null,
            );

            // Instagram platform row
            const igStatus = platformStatus(entry.status, entry.instagramMediaId);
            insertPlatform.run(
              entry.id, 'instagram', igStatus,
              (entry.instagramMediaId && entry.instagramMediaId !== 'pending')
                ? entry.instagramMediaId : null,
              entry.attempts,
              entry.errorMessage ?? null,
            );

            // Telegram — new platform, always starts pending unless overall skipped
            insertPlatform.run(
              entry.id, 'telegram',
              entry.status === 'skipped' ? 'dead_letter' : 'pending',
              null, 0, null,
            );

            if (verbose) {
              console.log(`  ✅ ${entry.id} → ${overallStatus}`);
            }
          } else {
            skipped++;
            if (verbose) {
              console.log(`  ⏭  ${entry.id} already exists`);
            }
          }
        } else {
          inserted++; // dry-run counter
          if (verbose) {
            console.log(`  [DRY] ${entry.id} → ${overallStatus}`);
          }
        }
      } catch (err) {
        errors++;
        console.error(`  ❌ ${entry.id}: ${String(err)}`);
      }
    }
  });

  migrateTx(queue.entries);

  console.log('\n── Migration Summary ──────────────────────────────');
  console.log(`  Source entries : ${queue.entries.length}`);
  console.log(`  Inserted       : ${inserted}`);
  console.log(`  Already existed: ${skipped}`);
  console.log(`  Errors         : ${errors}`);
  console.log(`  DB path        : ${DB_PATH}`);
  console.log('─────────────────────────────────────────────────\n');

  if (errors > 0) {
    console.error('⚠️  Migration completed with errors. Review above.');
    process.exit(1);
  }

  if (!dryRun) {
    console.log('✅ Migration complete.');
    console.log('   Next steps:');
    console.log('     1. Verify:  npx tsx scripts/migrate/queue-json-to-sqlite.ts --verify');
    console.log('     2. Delete:  git rm config/publish-queue.json');
    console.log('     3. Commit:  git commit -m "chore: replace publish-queue.json with SQLite"');
  }
}

// ─── Verify ───────────────────────────────────────────────────────────────────

function runVerify(): void {
  if (!fs.existsSync(QUEUE_JSON_PATH)) {
    console.error('❌ config/publish-queue.json not found — nothing to verify against');
    process.exit(1);
  }

  const raw   = fs.readFileSync(QUEUE_JSON_PATH, 'utf-8');
  const queue = JSON.parse(raw) as PublishQueue;
  const db    = openDb();

  interface CountRow { count: number }
  const dbCount = (db.prepare(
    'SELECT COUNT(*) AS count FROM queue_items'
  ).get() as CountRow).count;

  const ppCount = (db.prepare(
    'SELECT COUNT(*) AS count FROM platform_publishes'
  ).get() as CountRow).count;

  console.log(`\n── Verify ─────────────────────────────────────────`);
  console.log(`  JSON entries       : ${queue.entries.length}`);
  console.log(`  DB queue_items     : ${dbCount}`);
  console.log(`  DB platform_publishes: ${ppCount} (expect ~${queue.entries.length * 3})`);

  const missing: string[] = [];
  for (const entry of queue.entries.slice(0, 20)) {
    interface ExistsRow { count: number }
    const exists = (db.prepare(
      'SELECT COUNT(*) AS count FROM queue_items WHERE id = ?'
    ).get(entry.id) as ExistsRow).count > 0;
    if (!exists) missing.push(entry.id);
  }

  if (missing.length > 0) {
    console.error(`\n❌ Missing entries (first 20 sample):`);
    missing.forEach(id => console.error(`   - ${id}`));
    process.exit(1);
  }

  console.log('\n✅ Spot-check passed — migration looks correct.');
  if (dbCount < queue.entries.length) {
    console.warn(`⚠️  DB has fewer rows than JSON. Re-run migration without --dry-run.`);
  }
  console.log('─────────────────────────────────────────────────\n');
}

main();
