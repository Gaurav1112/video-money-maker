#!/usr/bin/env npx tsx
/**
 * get-next-publish.ts — Determine the next video to publish from the queue
 *
 * Reads publish-queue.json and returns the next pending entry, respecting:
 *   - Day-of-week schedule (Tue=long, Thu=vertical-1, Sat=vertical-2+3)
 *   - Failed entries get retried (up to 3 attempts)
 *   - Skips entries whose video files don't exist (marks as skipped)
 *
 * For CI, outputs GitHub Actions variables:
 *   PUBLISH_ID, TOPIC, SESSION, SLOT_TYPE, VIDEO_PATH, METADATA_PATH, etc.
 *
 * Usage:
 *   npx tsx scripts/get-next-publish.ts              # next by schedule
 *   npx tsx scripts/get-next-publish.ts --force      # next regardless of day
 *   npx tsx scripts/get-next-publish.ts --id kafka/s1/long  # specific entry
 *   npx tsx scripts/get-next-publish.ts --status     # show queue summary
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ─────────────────────────────────────────────────────────────────

type PublishSlotType = 'long' | 'vertical-1' | 'vertical-23';
type PublishStatus = 'pending' | 'published' | 'failed' | 'skipped';

interface PublishEntry {
  id: string;
  topic: string;
  topicName: string;
  session: number;
  slotType: PublishSlotType;
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
  lastPublishedIndex: number;
  schedule: {
    pattern: string;
    note: string;
  };
  entries: PublishEntry[];
}

// ─── Config ────────────────────────────────────────────────────────────────

const PUBLISH_QUEUE_PATH = path.resolve(__dirname, '../config/publish-queue.json');
const MAX_RETRY_ATTEMPTS = 3;

/** Map day-of-week number (0=Sunday) to slot types allowed on that day */
const DAY_SLOT_MAP: Record<number, PublishSlotType[]> = {
  2: ['long'],          // Tuesday
  4: ['vertical-1'],    // Thursday
  6: ['vertical-23'],   // Saturday
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function getTodayDayOfWeek(): number {
  return new Date().getDay();
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function loadQueue(): PublishQueue {
  if (!fs.existsSync(PUBLISH_QUEUE_PATH)) {
    console.error(`Publish queue not found: ${PUBLISH_QUEUE_PATH}`);
    console.error('Run: npx tsx scripts/generate-publish-queue.ts');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(PUBLISH_QUEUE_PATH, 'utf-8'));
}

function saveQueue(queue: PublishQueue): void {
  queue.lastUpdated = getTodayDate();
  fs.writeFileSync(PUBLISH_QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
}

// ─── Find Next Entry ───────────────────────────────────────────────────────

function findNextEntry(
  queue: PublishQueue,
  options: { force: boolean; specificId?: string },
): PublishEntry | null {
  const today = getTodayDate();
  const dayOfWeek = getTodayDayOfWeek();

  // Specific entry by ID
  if (options.specificId) {
    const entry = queue.entries.find(e => e.id === options.specificId);
    if (!entry) {
      console.error(`Entry not found: ${options.specificId}`);
      process.exit(1);
    }
    if (entry.status === 'published') {
      console.error(`Entry already published: ${options.specificId}`);
      process.exit(1);
    }
    return entry;
  }

  // Get allowed slot types for today
  const allowedSlots = options.force
    ? ['long', 'vertical-1', 'vertical-23'] as PublishSlotType[]
    : (DAY_SLOT_MAP[dayOfWeek] || []);

  if (allowedSlots.length === 0 && !options.force) {
    console.error(`Today is not a publish day. Use --force to override.`);
    console.error(`Publish days: Tuesday (long), Thursday (vertical-1), Saturday (vertical-2+3)`);
    return null;
  }

  // Priority 1: Retry failed entries (oldest first, within allowed slots)
  for (const entry of queue.entries) {
    if (
      entry.status === 'failed' &&
      entry.attempts < MAX_RETRY_ATTEMPTS &&
      (options.force || allowedSlots.includes(entry.slotType))
    ) {
      return entry;
    }
  }

  // Priority 2: Next pending entry by scheduled date
  for (const entry of queue.entries) {
    if (
      entry.status === 'pending' &&
      (options.force || allowedSlots.includes(entry.slotType)) &&
      (options.force || entry.scheduledDate <= today)
    ) {
      return entry;
    }
  }

  return null;
}

// ─── Status Summary ────────────────────────────────────────────────────────

function showStatus(queue: PublishQueue): void {
  const counts = { pending: 0, published: 0, failed: 0, skipped: 0 };

  for (const entry of queue.entries) {
    counts[entry.status]++;
  }

  console.log('\n=== Publish Queue Status ===');
  console.log(`Total entries:  ${queue.entries.length}`);
  console.log(`Pending:        ${counts.pending}`);
  console.log(`Published:      ${counts.published}`);
  console.log(`Failed:         ${counts.failed}`);
  console.log(`Skipped:        ${counts.skipped}`);
  console.log(`Last updated:   ${queue.lastUpdated}`);

  // Next 5 pending
  const nextPending = queue.entries
    .filter(e => e.status === 'pending')
    .slice(0, 5);

  if (nextPending.length > 0) {
    console.log('\nNext 5 pending:');
    for (const e of nextPending) {
      console.log(`  ${e.scheduledDate} (${e.dayOfWeek.padEnd(8)}) ${e.topic} S${e.session} [${e.slotType}]`);
    }
  }

  // Failed entries
  const failedEntries = queue.entries.filter(e => e.status === 'failed');
  if (failedEntries.length > 0) {
    console.log('\nFailed entries:');
    for (const e of failedEntries) {
      console.log(`  ${e.id} — attempts: ${e.attempts}, error: ${e.errorMessage || 'unknown'}`);
    }
  }

  // Progress by topic
  const topicProgress = new Map<string, { total: number; published: number }>();
  for (const entry of queue.entries) {
    if (!topicProgress.has(entry.topic)) {
      topicProgress.set(entry.topic, { total: 0, published: 0 });
    }
    const tp = topicProgress.get(entry.topic)!;
    tp.total++;
    if (entry.status === 'published') tp.published++;
  }

  console.log('\nProgress by topic:');
  for (const [topic, prog] of topicProgress) {
    if (prog.published > 0 || prog.total <= 30) {
      const bar = '='.repeat(Math.round((prog.published / prog.total) * 20));
      const empty = '-'.repeat(20 - bar.length);
      console.log(`  ${topic.padEnd(45)} [${bar}${empty}] ${prog.published}/${prog.total}`);
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const statusMode = args.includes('--status');
  const jsonMode = args.includes('--json');

  const idArg = args.find(a => a.startsWith('--id='))?.split('=')[1]
    || (args.indexOf('--id') >= 0 ? args[args.indexOf('--id') + 1] : undefined);

  const queue = loadQueue();

  if (statusMode) {
    showStatus(queue);
    return;
  }

  const entry = findNextEntry(queue, { force, specificId: idArg });

  if (!entry) {
    console.log('NO_PUBLISH=true');
    console.log('No entries to publish.');
    return;
  }

  // Output for GitHub Actions (or shell consumption)
  if (jsonMode) {
    console.log(JSON.stringify(entry, null, 2));
  } else {
    // Output key=value pairs for GitHub Actions
    console.log(`PUBLISH_ID=${entry.id}`);
    console.log(`TOPIC=${entry.topic}`);
    console.log(`TOPIC_NAME=${entry.topicName}`);
    console.log(`SESSION=${entry.session}`);
    console.log(`SLOT_TYPE=${entry.slotType}`);
    console.log(`DAY_OF_WEEK=${entry.dayOfWeek}`);
    console.log(`SCHEDULED_DATE=${entry.scheduledDate}`);
    console.log(`VIDEO_PATH=${entry.files.video}`);
    console.log(`METADATA_PATH=${entry.files.metadata}`);
    if (entry.files.thumbnail) {
      console.log(`THUMBNAIL_PATH=${entry.files.thumbnail}`);
    }
    if (entry.files.additionalVideos && entry.files.additionalVideos.length > 0) {
      console.log(`ADDITIONAL_VIDEOS=${entry.files.additionalVideos.join(',')}`);
    }
    console.log(`ATTEMPTS=${entry.attempts}`);
    console.log(`NO_PUBLISH=false`);
  }
}

main();
