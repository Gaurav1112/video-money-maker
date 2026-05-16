#!/usr/bin/env npx tsx
/**
 * scripts/queue/claim.ts — Atomically claim the next pending platform publish
 *
 * Exactly-once guarantee:
 *   - Single SQLite transaction with UPDATE WHERE status='pending'
 *   - Idempotency key stored in DB prevents double-publish on step retry
 *   - If this run already holds a claim (same claimed_by), reuse it
 *
 * Usage:
 *   npx tsx scripts/queue/claim.ts \
 *     --platform  youtube            \
 *     --run-id    ${{ github.run_id }} \
 *     [--queue-id kafka/s1/long]     \   # claim a specific item
 *     [--slot-type long]             \   # filter by slot type
 *     [--force]                          # ignore scheduled_date ≤ today
 *
 * Exit codes:
 *   0 — success (claimed or no item available — check output claimed=true/false)
 *   1 — fatal error
 *
 * Outputs to $GITHUB_OUTPUT:
 *   claimed, platform_publish_id, queue_item_id, idempotency_key,
 *   video_path, metadata_path, thumbnail_path, additional_videos,
 *   topic, session, slot_type, attempt
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import { openDb } from './init-db.js';
import type Database from 'better-sqlite3';

// ─── Types ───────────────────────────────────────────────────────────────────

type Platform = 'youtube' | 'instagram' | 'telegram';

interface PlatformPublishRow {
  id: number;
  queue_item_id: string;
  platform: Platform;
  status: string;
  attempts: number;
  max_attempts: number;
  claimed_by: string | null;
  idempotency_key: string | null;
  video_path: string;
  additional_videos: string | null;
  metadata_path: string;
  thumbnail_path: string | null;
  topic: string;
  session: number;
  slot_type: string;
  scheduled_date: string;
}

// ─── Arg parsing ─────────────────────────────────────────────────────────────

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
    platform:  require('--platform') as Platform,
    runId:     require('--run-id'),
    queueId:   get('--queue-id'),
    slotType:  get('--slot-type'),
    force:     argv.includes('--force'),
  };
}

// ─── GitHub Actions output ───────────────────────────────────────────────────

function setOutput(key: string, value: string): void {
  const ghOutput = process.env['GITHUB_OUTPUT'];
  if (ghOutput) {
    fs.appendFileSync(ghOutput, `${key}=${value}\n`);
  }
  console.log(`OUTPUT  ${key}=${value}`);
}

function noClaim(): void {
  setOutput('claimed', 'false');
  console.log('ℹ️  No claimable item found for this platform/schedule.');
}

// ─── Idempotency key ─────────────────────────────────────────────────────────

function makeIdemKey(queueItemId: string, attempt: number, runId: string): string {
  return crypto
    .createHash('sha256')
    .update(`${queueItemId}:${attempt}:${runId}`)
    .digest('hex');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs();
  const db = openDb();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // ── Step 1: Check if this run already holds a claim (step-retry idempotency) ──
  const existingClaim = db.prepare(`
    SELECT pp.id, pp.queue_item_id, pp.platform, pp.attempts, pp.idempotency_key,
           pp.status,
           qi.video_path, qi.additional_videos, qi.metadata_path, qi.thumbnail_path,
           qi.topic, qi.session, qi.slot_type, qi.scheduled_date
    FROM   platform_publishes pp
    JOIN   queue_items qi ON qi.id = pp.queue_item_id
    WHERE  pp.claimed_by = ?
      AND  pp.platform   = ?
      AND  pp.status     = 'claimed'
  `).get(args.runId, args.platform) as PlatformPublishRow | undefined;

  if (existingClaim) {
    console.log(`♻️  Reusing existing claim for run ${args.runId}: item ${existingClaim.queue_item_id}`);
    emitClaim(existingClaim, existingClaim.idempotency_key!);
    return;
  }

  // ── Step 2: Atomic claim inside a transaction ────────────────────────────────
  const claimTx = db.transaction((): PlatformPublishRow | null => {
    // Build WHERE clause for item selection
    const dateFilter = args.force ? '1=1' : `qi.scheduled_date <= '${today}'`;
    const slotFilter = args.slotType
      ? `qi.slot_type = '${args.slotType.replace(/'/g, "''")}'`
      : '1=1';
    const idFilter = args.queueId
      ? `qi.id = '${args.queueId.replace(/'/g, "''")}'`
      : '1=1';

    // Find next claimable row — prioritise retries (failed) over fresh (pending)
    const candidate = db.prepare(`
      SELECT pp.id, pp.queue_item_id, pp.platform, pp.attempts, pp.max_attempts,
             pp.status,
             qi.video_path, qi.additional_videos, qi.metadata_path, qi.thumbnail_path,
             qi.topic, qi.session, qi.slot_type, qi.scheduled_date
      FROM   platform_publishes pp
      JOIN   queue_items qi ON qi.id = pp.queue_item_id
      WHERE  pp.platform = ?
        AND  pp.status IN ('pending', 'failed')
        AND  pp.attempts < pp.max_attempts
        AND  ${dateFilter}
        AND  ${slotFilter}
        AND  ${idFilter}
      ORDER BY
        CASE pp.status WHEN 'failed' THEN 0 ELSE 1 END ASC,  -- retries first
        qi.scheduled_date ASC
      LIMIT 1
    `).get(args.platform) as PlatformPublishRow | undefined;

    if (!candidate) return null;

    const idemKey = makeIdemKey(candidate.queue_item_id, candidate.attempts, args.runId);

    // Atomic claim — WHERE status IN ('pending','failed') prevents double-claim
    const result = (db.prepare(`
      UPDATE platform_publishes
      SET    status          = 'claimed',
             claimed_by      = ?,
             claimed_at      = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
             idempotency_key = ?,
             attempts        = attempts + 1,
             updated_at      = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE  id     = ?
        AND  status IN ('pending', 'failed')
    `).run(args.runId, idemKey, candidate.id) as Database.RunResult);

    if (result.changes === 0) {
      // Lost race (another concurrent run grabbed it) — no more items this slot
      return null;
    }

    return { ...candidate, idempotency_key: idemKey, attempts: candidate.attempts + 1 };
  });

  const claimed = claimTx() as PlatformPublishRow | null;

  if (!claimed) {
    noClaim();
    return;
  }

  emitClaim(claimed, claimed.idempotency_key!);
}

function emitClaim(row: PlatformPublishRow, idemKey: string): void {
  setOutput('claimed',             'true');
  setOutput('platform_publish_id', String(row.id));
  setOutput('queue_item_id',       row.queue_item_id);
  setOutput('idempotency_key',     idemKey);
  setOutput('video_path',          row.video_path);
  setOutput('metadata_path',       row.metadata_path);
  setOutput('thumbnail_path',      row.thumbnail_path ?? '');
  setOutput('additional_videos',   row.additional_videos ?? '');
  setOutput('topic',               row.topic);
  setOutput('session',             String(row.session));
  setOutput('slot_type',           row.slot_type);
  setOutput('attempt',             String(row.attempts));
}

main();
