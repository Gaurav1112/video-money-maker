#!/usr/bin/env npx tsx
/**
 * update-publish-queue.ts — Update a publish queue entry after upload
 *
 * Usage:
 *   npx tsx scripts/update-publish-queue.ts \
 *     --id "load-balancing/s1/long" \
 *     --status published \
 *     --youtube-id "dQw4w9WgXcQ" \
 *     --instagram-id "17895695668004550"
 *
 *   npx tsx scripts/update-publish-queue.ts \
 *     --id "caching/s2/vertical-1" \
 *     --status failed \
 *     --error "YouTube quota exceeded"
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ─────────────────────────────────────────────────────────────────

type PublishStatus = 'pending' | 'published' | 'failed' | 'skipped';

interface PublishEntry {
  id: string;
  topic: string;
  topicName: string;
  session: number;
  slotType: string;
  dayOfWeek: string;
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
const PUBLISH_HISTORY_PATH = path.resolve(__dirname, '../config/publish-history.json');

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  function getArg(name: string): string | undefined {
    const eqForm = args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
    if (eqForm) return eqForm;
    const idx = args.indexOf(`--${name}`);
    if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) {
      return args[idx + 1];
    }
    return undefined;
  }

  const entryId = getArg('id');
  const status = getArg('status') as PublishStatus | undefined;
  const youtubeId = getArg('youtube-id');
  const instagramId = getArg('instagram-id');
  const errorMsg = getArg('error');

  if (!entryId || !status) {
    console.error('Usage: update-publish-queue.ts --id <entry-id> --status <published|failed|skipped>');
    console.error('  Optional: --youtube-id <id> --instagram-id <id> --error "message"');
    process.exit(1);
  }

  if (!['published', 'failed', 'skipped', 'pending'].includes(status)) {
    console.error('Status must be: published, failed, skipped, or pending');
    process.exit(1);
  }

  // Load queue
  if (!fs.existsSync(PUBLISH_QUEUE_PATH)) {
    console.error(`Publish queue not found: ${PUBLISH_QUEUE_PATH}`);
    process.exit(1);
  }

  const queue: PublishQueue = JSON.parse(fs.readFileSync(PUBLISH_QUEUE_PATH, 'utf-8'));
  const entryIndex = queue.entries.findIndex(e => e.id === entryId);

  if (entryIndex === -1) {
    console.error(`Entry not found: ${entryId}`);
    console.error(`Available IDs (first 10): ${queue.entries.slice(0, 10).map(e => e.id).join(', ')}`);
    process.exit(1);
  }

  const entry = queue.entries[entryIndex];
  const previousStatus = entry.status;

  // Update entry
  entry.status = status;
  entry.lastUpdated = new Date().toISOString();
  entry.attempts++;

  if (youtubeId) entry.youtubeVideoId = youtubeId;
  if (instagramId) entry.instagramMediaId = instagramId;
  if (errorMsg) entry.errorMessage = errorMsg;

  if (status === 'published') {
    entry.errorMessage = null;
    queue.lastPublishedIndex = entryIndex;
  }

  queue.lastUpdated = new Date().toISOString().split('T')[0];

  // Save queue
  fs.writeFileSync(PUBLISH_QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');

  // Also update publish-history.json
  if (status === 'published') {
    let history: { version: number; lastPublished: string | null; lastCategoryIndex: number; totalPublished: number; entries: Array<unknown> };
    if (fs.existsSync(PUBLISH_HISTORY_PATH)) {
      history = JSON.parse(fs.readFileSync(PUBLISH_HISTORY_PATH, 'utf-8'));
    } else {
      history = { version: 1, lastPublished: null, lastCategoryIndex: -1, totalPublished: 0, entries: [] };
    }

    history.lastPublished = new Date().toISOString();
    history.totalPublished++;
    history.entries.push({
      id: entry.id,
      topic: entry.topic,
      session: entry.session,
      slotType: entry.slotType,
      publishedAt: new Date().toISOString(),
      youtubeVideoId: entry.youtubeVideoId,
      instagramMediaId: entry.instagramMediaId,
    });

    fs.writeFileSync(PUBLISH_HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
  }

  // Also update the topic-queue.json for the 'long' slot (marks session as published)
  if (status === 'published' && entry.slotType === 'long') {
    const topicQueuePath = path.resolve(__dirname, '../config/topic-queue.json');
    if (fs.existsSync(topicQueuePath)) {
      const topicQueue = JSON.parse(fs.readFileSync(topicQueuePath, 'utf-8'));
      const topic = topicQueue.topics.find((t: { slug: string }) => t.slug === entry.topic);
      if (topic) {
        if (!topic.published.includes(entry.session)) {
          topic.published.push(entry.session);
          topic.published.sort((a: number, b: number) => a - b);
        }
        topicQueue.lastUpdated = new Date().toISOString().split('T')[0];
        fs.writeFileSync(topicQueuePath, JSON.stringify(topicQueue, null, 2) + '\n');
        console.log(`Updated topic-queue.json: ${entry.topic} session ${entry.session} marked published`);
      }
    }
  }

  // Summary
  console.log(`Updated: ${entryId}`);
  console.log(`  Status: ${previousStatus} -> ${status}`);
  console.log(`  Attempts: ${entry.attempts}`);
  if (youtubeId) console.log(`  YouTube ID: ${youtubeId}`);
  if (instagramId) console.log(`  Instagram ID: ${instagramId}`);
  if (errorMsg) console.log(`  Error: ${errorMsg}`);

  // Queue summary
  const counts = { pending: 0, published: 0, failed: 0, skipped: 0 };
  for (const e of queue.entries) {
    counts[e.status]++;
  }
  console.log(`\nQueue: ${counts.published} published, ${counts.pending} pending, ${counts.failed} failed, ${counts.skipped} skipped`);
}

main();
