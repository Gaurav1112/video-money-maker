#!/usr/bin/env npx tsx
/**
 * mark-hinglish-published.ts
 *
 * Marks a publish-queue entry as Hinglish-published.
 *
 * Usage:
 *   npx tsx scripts/mark-hinglish-published.ts \
 *     --topic <slug> --session <N> [--video-id <youtubeVideoId>]
 *
 * Mutations applied to config/publish-queue.json:
 *   entries[i].hinglishPublished    = true
 *   entries[i].hinglishVideoId      = <id>   (if --video-id provided)
 *   entries[i].hinglishPublishedAt  = YYYY-MM-DD
 *   top-level lastUpdated           = YYYY-MM-DD
 *
 * Write is atomic: we write to a .tmp file then rename it over the
 * original so a crash mid-write cannot corrupt the queue.
 *
 * Idempotent: no-op if already marked (exits 0, prints a notice).
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────

export interface PublishEntry {
  id: string;
  topic: string;
  session: number;
  hinglishPublished?: boolean;
  hinglishVideoId?: string | null;
  hinglishPublishedAt?: string | null;
  [key: string]: unknown;
}

export interface PublishQueue {
  version: number;
  lastUpdated: string;
  entries: PublishEntry[];
  [key: string]: unknown;
}

// ─── Config ───────────────────────────────────────────────────────────────

const QUEUE_PATH = path.resolve(__dirname, '..', 'config', 'publish-queue.json');

// ─── Helpers ──────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

/** Atomic write: write to .tmp, then rename over target. */
export function atomicWrite(filePath: string, data: string): void {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, data, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// ─── Core logic (exported for testing) ───────────────────────────────────

export interface MarkOptions {
  topic: string;
  session: number;
  videoId?: string;
}

export function markHinglishPublished(
  queue: PublishQueue,
  opts: MarkOptions,
): { queue: PublishQueue; changed: boolean } {
  const entry = queue.entries.find(
    (e) => e.topic === opts.topic && Number(e.session) === opts.session,
  );

  if (!entry) {
    throw new Error(
      `Entry not found in queue: topic=${opts.topic} session=${opts.session}`,
    );
  }

  if (entry.hinglishPublished === true) {
    // Already marked — idempotent no-op
    return { queue, changed: false };
  }

  entry.hinglishPublished = true;
  entry.hinglishPublishedAt = todayIso();
  if (opts.videoId) {
    entry.hinglishVideoId = opts.videoId;
  }
  queue.lastUpdated = todayIso();

  return { queue, changed: true };
}

// ─── CLI ──────────────────────────────────────────────────────────────────

function parseArgs(): MarkOptions {
  const args = process.argv.slice(2);

  function getArg(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : undefined;
  }

  const topic = getArg('topic');
  const sessionStr = getArg('session');
  const videoId = getArg('video-id');

  if (!topic || !sessionStr) {
    console.error('Usage: mark-hinglish-published.ts --topic <slug> --session <N> [--video-id <id>]');
    process.exit(1);
  }

  const session = parseInt(sessionStr, 10);
  if (isNaN(session) || session < 1) {
    console.error('--session must be a positive integer');
    process.exit(1);
  }

  return { topic, session, videoId };
}

function main(): void {
  const opts = parseArgs();

  if (!fs.existsSync(QUEUE_PATH)) {
    console.error(`[mark-hinglish-published] queue not found: ${QUEUE_PATH}`);
    process.exit(1);
  }

  let queue: PublishQueue;
  try {
    queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8')) as PublishQueue;
  } catch (err) {
    console.error(`[mark-hinglish-published] failed to parse queue: ${(err as Error).message}`);
    process.exit(1);
  }

  let result: ReturnType<typeof markHinglishPublished>;
  try {
    result = markHinglishPublished(queue, opts);
  } catch (err) {
    console.error(`[mark-hinglish-published] ${(err as Error).message}`);
    process.exit(1);
  }

  if (!result.changed) {
    console.log(`[mark-hinglish-published] already marked — no-op (topic=${opts.topic} session=${opts.session})`);
    process.exit(0);
  }

  atomicWrite(QUEUE_PATH, JSON.stringify(result.queue, null, 2) + '\n');

  console.log(`[mark-hinglish-published] ✅ marked topic=${opts.topic} session=${opts.session}${opts.videoId ? ` videoId=${opts.videoId}` : ''}`);
}

// Only run when executed as the entry-point script (not when imported by tests)
const _argv1 = process.argv[1] ?? '';
if (_argv1.endsWith('mark-hinglish-published.ts') || _argv1.endsWith('mark-hinglish-published.js')) {
  main();
}
