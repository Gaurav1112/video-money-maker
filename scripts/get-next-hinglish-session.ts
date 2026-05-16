#!/usr/bin/env npx tsx
/**
 * get-next-hinglish-session.ts
 *
 * Reads config/publish-queue.json and returns the first entry that:
 *   - has a non-null youtubeVideoId   (English track already uploaded)
 *   - does NOT have hinglishPublished === true
 *
 * Stdout (parsed by workflow grep patterns):
 *   topic=<slug>
 *   session=<N>
 *
 * OR, if nothing is pending:
 *   NO_SESSION
 *
 * All diagnostic messages go to stderr so stdout stays machine-readable.
 *
 * Usage:
 *   npx tsx scripts/get-next-hinglish-session.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types (subset of publish-queue schema) ───────────────────────────────

export interface PublishEntry {
  id: string;
  topic: string;
  session: number;
  youtubeVideoId: string | null;
  hinglishPublished?: boolean;
  hinglishVideoId?: string | null;
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

// ─── Core logic (exported for testing) ───────────────────────────────────

export function findNextHinglishEntry(queue: PublishQueue): PublishEntry | undefined {
  return queue.entries.find(
    (e) =>
      e.youtubeVideoId !== null &&
      e.youtubeVideoId !== undefined &&
      e.youtubeVideoId !== '' &&
      e.hinglishPublished !== true,
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main(): void {
  if (!fs.existsSync(QUEUE_PATH)) {
    console.error(`[get-next-hinglish-session] queue not found: ${QUEUE_PATH}`);
    console.log('NO_SESSION');
    process.exit(0);
  }

  let queue: PublishQueue;
  try {
    queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8')) as PublishQueue;
  } catch (err) {
    console.error(`[get-next-hinglish-session] failed to parse queue: ${(err as Error).message}`);
    console.log('NO_SESSION');
    process.exit(0);
  }

  const entry = findNextHinglishEntry(queue);

  if (!entry) {
    console.error('[get-next-hinglish-session] all sessions already Hinglish-published (or none have English upload yet)');
    console.log('NO_SESSION');
    process.exit(0);
  }

  console.error(`[get-next-hinglish-session] found: topic=${entry.topic} session=${entry.session} youtubeVideoId=${entry.youtubeVideoId}`);
  // Machine-readable output on stdout
  console.log(`topic=${entry.topic}`);
  console.log(`session=${entry.session}`);
}

// Only run when executed as the entry-point script (not when imported by tests)
const _argv1 = process.argv[1] ?? '';
if (_argv1.endsWith('get-next-hinglish-session.ts') || _argv1.endsWith('get-next-hinglish-session.js')) {
  main();
}
