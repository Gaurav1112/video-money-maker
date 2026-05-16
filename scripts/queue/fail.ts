#!/usr/bin/env npx tsx
/**
 * scripts/queue/fail.ts — Record a publish failure; dead-letter after max_attempts
 *
 * Exactly-once: only updates if idempotency_key matches claimed row.
 * After max_attempts: writes to dead_letter table and sends Slack/Discord alarm.
 *
 * Usage:
 *   npx tsx scripts/queue/fail.ts \
 *     --platform-publish-id  42                         \
 *     --idempotency-key      <sha256>                   \
 *     --error                "HTTP 403 token expired"   \
 *     --run-id               ${{ github.run_id }}       \
 *     [--cookie-expiry]    # triggers special alarm message
 *
 * Exit codes:
 *   0 — recorded (failed or dead-lettered)
 *   1 — fatal error
 */

import * as fs from 'fs';
import * as https from 'https';
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
    error:             require('--error'),
    runId:             get('--run-id') ?? process.env['GITHUB_RUN_ID'] ?? 'local',
    cookieExpiry:      argv.includes('--cookie-expiry'),
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

// ─── Webhook notification (Slack or Discord) ──────────────────────────────────

function sendWebhook(message: string): void {
  const slackUrl   = process.env['SLACK_WEBHOOK_URL'];
  const discordUrl = process.env['DISCORD_WEBHOOK_URL'];

  if (!slackUrl && !discordUrl) {
    console.warn('⚠️  No SLACK_WEBHOOK_URL or DISCORD_WEBHOOK_URL set — skipping notification');
    return;
  }

  const targets: Array<{ url: string; body: string }> = [];

  if (slackUrl) {
    targets.push({
      url:  slackUrl,
      body: JSON.stringify({ text: message }),
    });
  }
  if (discordUrl) {
    targets.push({
      url:  discordUrl,
      body: JSON.stringify({ content: message }),
    });
  }

  for (const { url, body } of targets) {
    try {
      const parsed = new URL(url);
      const req = https.request({
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        console.log(`Webhook response: ${res.statusCode}`);
      });
      req.on('error', (e) => console.warn(`Webhook error: ${e.message}`));
      req.write(body);
      req.end();
    } catch (e) {
      console.warn(`Failed to send webhook: ${String(e)}`);
    }
  }
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
    max_attempts: number;
  }

  const row = db.prepare(
    'SELECT id, queue_item_id, platform, status, idempotency_key, attempts, max_attempts FROM platform_publishes WHERE id = ?'
  ).get(args.platformPublishId) as PPRow | undefined;

  if (!row) {
    console.error(`❌ platform_publish id ${args.platformPublishId} not found`);
    process.exit(1);
  }

  // Idempotency check — only process if key matches (prevents stale retries)
  if (row.idempotency_key !== args.idempotencyKey) {
    console.warn(
      `⚠️  Idempotency key mismatch — this may be a stale retry. Skipping fail update.\n` +
      `   Expected: ${row.idempotency_key}\n` +
      `   Got:      ${args.idempotencyKey}`
    );
    setOutput('result', 'key_mismatch');
    return;
  }

  // Already dead-lettered — no-op
  if (row.status === 'dead_letter') {
    console.log(`ℹ️  Already dead-lettered: ${row.queue_item_id}/${row.platform}`);
    setOutput('result', 'already_dead_letter');
    return;
  }

  const isDeadLetter = row.attempts >= row.max_attempts;
  const newStatus = isDeadLetter ? 'dead_letter' : 'failed';

  const failTx = db.transaction(() => {
    // Update platform status — reset claimed_by on failure so next run can claim it
    db.prepare(`
      UPDATE platform_publishes
      SET    status      = ?,
             last_error  = ?,
             claimed_by  = CASE WHEN ? = 'dead_letter' THEN claimed_by ELSE NULL END,
             updated_at  = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE  id              = ?
        AND  idempotency_key = ?
    `).run(newStatus, args.error, newStatus, args.platformPublishId, args.idempotencyKey);

    // Write publish log
    db.prepare(`
      INSERT INTO publish_log
        (queue_item_id, platform, status, error, run_id, idempotency_key)
      VALUES (?, ?, 'failure', ?, ?, ?)
    `).run(row.queue_item_id, row.platform, args.error, args.runId, args.idempotencyKey);

    if (isDeadLetter) {
      // Insert into dead_letter table
      db.prepare(`
        INSERT INTO dead_letter (queue_item_id, platform, error, run_id, attempts)
        VALUES (?, ?, ?, ?, ?)
      `).run(row.queue_item_id, row.platform, args.error, args.runId, row.attempts);

      // Update queue item overall_status
      db.prepare(`
        UPDATE queue_items
        SET    overall_status = 'dead_letter',
               updated_at    = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE  id             = ?
      `).run(row.queue_item_id);
    }
  });

  failTx();

  const repoUrl = `https://github.com/${process.env['GITHUB_REPOSITORY'] ?? 'Gaurav1112/video-money-maker'}`;
  const runUrl  = `${repoUrl}/actions/runs/${args.runId}`;

  if (isDeadLetter) {
    const alarmType = args.cookieExpiry ? '🍪 COOKIE/TOKEN EXPIRY' : '💀 DEAD LETTER';
    const message = [
      `${alarmType} — video-money-maker`,
      `Item:     ${row.queue_item_id}`,
      `Platform: ${row.platform}`,
      `Attempts: ${row.attempts}/${row.max_attempts}`,
      `Error:    ${args.error}`,
      `Run:      ${runUrl}`,
      args.cookieExpiry
        ? `ACTION REQUIRED: Refresh ${row.platform.toUpperCase()} OAuth token (see INTEGRATION.md §Token Rotation)`
        : `ACTION REQUIRED: Review dead_letter table, fix, then manually re-enqueue.`,
    ].join('\n');

    console.error(`\n${message}\n`);
    sendWebhook(message);
    setOutput('result', 'dead_letter');
  } else {
    console.log(
      `⚠️  Recorded failure (attempt ${row.attempts}/${row.max_attempts}): ` +
      `${row.queue_item_id}/${row.platform} — ${args.error}`
    );
    setOutput('result', 'failed');
  }

  setOutput('queue_item_id', row.queue_item_id);
  setOutput('platform', row.platform);
  setOutput('is_dead_letter', String(isDeadLetter));
}

main();
