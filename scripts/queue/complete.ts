#!/usr/bin/env npx tsx
/**
 * scripts/queue/complete.ts — Mark a platform publish as successfully completed
 *
 * Idempotent: safe to call multiple times with the same idempotency_key.
 * If the row is already 'published', exits 0 without making changes.
 *
 * Usage:
 *   npx tsx scripts/queue/complete.ts \
 *     --platform-publish-id  42           \
 *     --idempotency-key      <sha256>      \
 *     --platform-video-id    dQw4w9WgXcQ  \
 *     --duration-ms          4200          \
 *     --run-id               ${{ github.run_id }}
 *
 * Exit codes:
 *   0 — success (marked published, or already was published)
 *   1 — fatal error (wrong idempotency key, DB error)
 */

import * as fs from 'fs';
import { openDb } from './init-db.js';

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const require = (flag: string): string => {
    const v = get(flag);
    if (!v) { console.error(`Missing required arg: ${flag}`); process.exit(1); }
    return v!;
  };

  return {
    platformPublishId: parseInt(require('--platform-publish-id'), 10),
    idempotencyKey:    require('--idempotency-key'),
    platformVideoId:   get('--platform-video-id'),
    durationMs:        get('--duration-ms') ? parseInt(get('--duration-ms')!, 10) : undefined,
    runId:             get('--run-id') ?? process.env['GITHUB_RUN_ID'] ?? 'local',
  };
}

// ─── GitHub Actions output ────────────────────────────────────────────────────

function setOutput(key: string, value: string): void {
  const ghOutput = process.env['GITHUB_OUTPUT'];
  if (ghOutput) {
    fs.appendFileSync(ghOutput, `${key}=${value}\n`);
  }
  console.log(`OUTPUT  ${key}=${value}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs();
  const db = openDb();

  interface PPRow {
    id: number;
    queue_item_id: string;
    platform: string;
    status: string;
    idempotency_key: string | null;
    attempts: number;
  }

  // Fetch the row — validate it exists and belongs to this claim
  const row = db.prepare(
    'SELECT id, queue_item_id, platform, status, idempotency_key, attempts FROM platform_publishes WHERE id = ?'
  ).get(args.platformPublishId) as PPRow | undefined;

  if (!row) {
    console.error(`❌ platform_publish id ${args.platformPublishId} not found`);
    process.exit(1);
  }

  // Idempotency: already published with this key → no-op
  if (row.status === 'published' && row.idempotency_key === args.idempotencyKey) {
    console.log(`✅ Already published (idempotent no-op): ${row.queue_item_id} / ${row.platform}`);
    setOutput('result', 'already_published');
    return;
  }

  // Validate idempotency key matches claim
  if (row.idempotency_key !== args.idempotencyKey) {
    console.error(
      `❌ Idempotency key mismatch for ${row.queue_item_id}/${row.platform}.\n` +
      `   Expected: ${row.idempotency_key}\n` +
      `   Got:      ${args.idempotencyKey}\n` +
      `   This claim belongs to a different run. Aborting.`
    );
    process.exit(1);
  }

  const completeTx = db.transaction(() => {
    // Mark published
    db.prepare(`
      UPDATE platform_publishes
      SET    status             = 'published',
             platform_video_id = ?,
             updated_at        = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE  id                = ?
        AND  idempotency_key   = ?
    `).run(args.platformVideoId ?? null, args.platformPublishId, args.idempotencyKey);

    // Write publish log
    db.prepare(`
      INSERT INTO publish_log
        (queue_item_id, platform, status, platform_video_id, duration_ms, run_id, idempotency_key)
      VALUES (?, ?, 'success', ?, ?, ?, ?)
    `).run(
      row.queue_item_id,
      row.platform,
      args.platformVideoId ?? null,
      args.durationMs ?? null,
      args.runId,
      args.idempotencyKey,
    );

    // Recalculate overall_status for the queue item
    interface CountRow { total: number; published_count: number; dead_count: number }
    const counts = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'published'    THEN 1 ELSE 0 END) AS published_count,
        SUM(CASE WHEN status = 'dead_letter'  THEN 1 ELSE 0 END) AS dead_count
      FROM platform_publishes
      WHERE queue_item_id = ?
    `).get(row.queue_item_id) as CountRow;

    let overallStatus: string;
    if (counts.published_count === counts.total) {
      overallStatus = 'published';   // all platforms done
    } else if (counts.dead_count > 0) {
      overallStatus = 'dead_letter'; // at least one dead-lettered
    } else {
      overallStatus = 'partial';     // some published, some pending/claimed/failed
    }

    db.prepare(`
      UPDATE queue_items
      SET    overall_status = ?,
             updated_at     = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE  id             = ?
    `).run(overallStatus, row.queue_item_id);
  });

  completeTx();

  console.log(
    `✅ Published: ${row.queue_item_id} / ${row.platform}` +
    (args.platformVideoId ? ` → ID ${args.platformVideoId}` : '') +
    (args.durationMs ? ` (${args.durationMs} ms)` : '')
  );

  setOutput('result', 'published');
  setOutput('queue_item_id', row.queue_item_id);
  setOutput('platform', row.platform);
}

main();
