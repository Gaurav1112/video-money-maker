#!/usr/bin/env npx tsx
/**
 * generate-publish-queue.ts — Build the publish-queue.json manifest
 *
 * Generates a round-robin interleaved publishing schedule across all topics.
 * Each session gets 3 publish slots:
 *   - Tuesday:  Long-form (16:9) to YouTube
 *   - Thursday: Vertical part 1 (9:16) to YouTube Shorts + Instagram Reels
 *   - Saturday: Vertical parts 2+3 (9:16) to YouTube Shorts + Instagram Reels
 *
 * Rotation: cycles through topics by category order, so viewers get variety.
 *   Load Balancing S1 -> Arrays & Strings S1 -> Design URL Shortener S1 ->
 *   Apache Kafka S1 -> Java Core S1 -> Spring Boot S1 -> RDBMS & SQL S1 ->
 *   Software Design Patterns S1 -> HTML & CSS S1 ->
 *   Load Balancing S2 -> ...
 *
 * Usage:
 *   npx tsx scripts/generate-publish-queue.ts
 *   npx tsx scripts/generate-publish-queue.ts --start-date 2026-05-06
 *   npx tsx scripts/generate-publish-queue.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ─────────────────────────────────────────────────────────────────

interface TopicEntry {
  slug: string;
  name: string;
  sessions: number;
  category: string;
  priority: 'high' | 'medium' | 'low';
  rendered: number[];
  published: number[];
}

interface TopicQueue {
  version: number;
  lastUpdated: string;
  topics: TopicEntry[];
}

type PublishSlotType = 'long' | 'vertical-1' | 'vertical-23';
type PublishStatus = 'pending' | 'published' | 'failed' | 'skipped';

interface PublishEntry {
  /** Unique ID: topic-slug/session-N/slot-type */
  id: string;
  topic: string;
  topicName: string;
  session: number;
  slotType: PublishSlotType;
  /** Day of the week this slot targets */
  dayOfWeek: 'Tuesday' | 'Thursday' | 'Saturday';
  /** Scheduled ISO date (YYYY-MM-DD) */
  scheduledDate: string;
  status: PublishStatus;
  /** Number of failed attempts */
  attempts: number;
  /** YouTube video ID after upload */
  youtubeVideoId: string | null;
  /** Instagram media ID after upload */
  instagramMediaId: string | null;
  /** ISO timestamp of last status change */
  lastUpdated: string | null;
  /** Error message if failed */
  errorMessage: string | null;
  /** Files to upload for this slot */
  files: {
    video: string;
    /** Additional videos (for vertical-23 slot) */
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

const QUEUE_PATH = path.resolve(__dirname, '../config/topic-queue.json');
const PUBLISH_QUEUE_PATH = path.resolve(__dirname, '../config/publish-queue.json');
const PUBLISH_CONFIG_PATH = path.resolve(__dirname, '../config/publish-config.json');
const GURU_SISHYA_BASE = path.join(process.env.HOME || '~', 'Documents', 'guru-sishya');

// Category rotation order (from publish-config.json)
const CATEGORY_ORDER = [
  'system-design',
  'dsa',
  'system-design-cases',
  'infrastructure',
  'languages',
  'frameworks',
  'databases',
  'fundamentals',
  'frontend',
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function getNextPublishDay(from: Date, targetDay: 'Tuesday' | 'Thursday' | 'Saturday'): Date {
  const dayMap: Record<string, number> = {
    Tuesday: 2,
    Thursday: 4,
    Saturday: 6,
  };
  const target = dayMap[targetDay];
  const d = new Date(from);
  const current = d.getDay();
  let diff = target - current;
  if (diff <= 0) diff += 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Build a round-robin interleaved list of (topic, session) pairs.
 * Cycles through categories, picking one topic per category per round,
 * advancing the session counter for each topic.
 */
function buildRotation(topics: TopicEntry[]): Array<{ slug: string; name: string; session: number }> {
  // Group topics by category, sorted by priority within each category
  const byCategory = new Map<string, TopicEntry[]>();
  for (const cat of CATEGORY_ORDER) {
    byCategory.set(cat, []);
  }
  for (const t of topics) {
    const list = byCategory.get(t.category);
    if (list) list.push(t);
  }

  // Sort each category: high first, then medium, then low; alphabetically within priority
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  for (const [, list] of byCategory) {
    list.sort((a, b) => {
      const pa = priorityRank[a.priority] ?? 1;
      const pb = priorityRank[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return a.slug.localeCompare(b.slug);
    });
  }

  // Track current session index per topic
  const sessionCounters = new Map<string, number>();
  for (const t of topics) {
    sessionCounters.set(t.slug, 1);
  }

  const result: Array<{ slug: string; name: string; session: number }> = [];
  let hasMore = true;

  while (hasMore) {
    hasMore = false;

    for (const cat of CATEGORY_ORDER) {
      const topicsInCat = byCategory.get(cat) || [];

      for (const topic of topicsInCat) {
        const currentSession = sessionCounters.get(topic.slug)!;

        if (currentSession <= topic.sessions) {
          result.push({
            slug: topic.slug,
            name: topic.name,
            session: currentSession,
          });
          sessionCounters.set(topic.slug, currentSession + 1);
          hasMore = true;
        }
      }
    }
  }

  return result;
}

/**
 * Resolve video file paths for a given topic/session.
 * Uses the actual directory structure at ~/Documents/guru-sishya/
 */
function resolveFiles(
  topicSlug: string,
  session: number,
  slotType: PublishSlotType,
): PublishEntry['files'] {
  const sessionDir = `${topicSlug}/session-${session}`;
  const longVideo = `${sessionDir}/long/${topicSlug}-s${session}.mp4`;
  const verticalVideo = `${sessionDir}/vertical/${topicSlug}-s${session}-vertical.mp4`;
  const metadata = `${sessionDir}/metadata.json`;
  const thumbnail = `${sessionDir}/long/${topicSlug}-s${session}-thumb.png`;

  // Check for vertical-parts directory (split parts like part1of3, part2of3, etc.)
  const verticalPartsDir = `${sessionDir}/vertical-parts`;
  const part1 = `${verticalPartsDir}/${topicSlug}-s${session}-part1of3.mp4`;
  const part2 = `${verticalPartsDir}/${topicSlug}-s${session}-part2of3.mp4`;
  const part3 = `${verticalPartsDir}/${topicSlug}-s${session}-part3of3.mp4`;

  switch (slotType) {
    case 'long':
      return { video: longVideo, metadata, thumbnail };
    case 'vertical-1':
      return { video: part1, metadata };
    case 'vertical-23':
      return {
        video: part2,
        additionalVideos: [part3],
        metadata,
      };
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  // Parse start date
  const startDateArg = args.find(a => a.startsWith('--start-date='))?.split('=')[1]
    || (args.indexOf('--start-date') >= 0 ? args[args.indexOf('--start-date') + 1] : undefined);

  // Default start date: next Tuesday from today
  let startDate: Date;
  if (startDateArg) {
    startDate = new Date(startDateArg + 'T00:00:00');
  } else {
    startDate = getNextPublishDay(new Date(), 'Tuesday');
  }

  // Load topic queue
  if (!fs.existsSync(QUEUE_PATH)) {
    console.error(`Topic queue not found: ${QUEUE_PATH}`);
    process.exit(1);
  }
  const topicQueue: TopicQueue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));

  // Build rotation
  const rotation = buildRotation(topicQueue.topics);

  console.log(`\nGenerating publish queue...`);
  console.log(`Topics: ${topicQueue.topics.length}`);
  console.log(`Total session slots: ${rotation.length}`);
  console.log(`Start date: ${formatDate(startDate)}`);
  console.log(`Schedule: Tue=long, Thu=vertical-1, Sat=vertical-2+3\n`);

  // Build entries: each rotation item becomes 3 publish slots (Tue, Thu, Sat)
  const entries: PublishEntry[] = [];
  let currentDate = new Date(startDate);

  // The schedule for each session is:
  // Week N Tuesday:  long-form
  // Week N Thursday: vertical part 1
  // Week N Saturday: vertical parts 2+3
  // Then the next session starts Week N+1 Tuesday

  for (const item of rotation) {
    // Ensure currentDate is a Tuesday
    if (currentDate.getDay() !== 2) {
      currentDate = getNextPublishDay(currentDate, 'Tuesday');
    }

    const slotTypes: Array<{ type: PublishSlotType; day: 'Tuesday' | 'Thursday' | 'Saturday'; offset: number }> = [
      { type: 'long', day: 'Tuesday', offset: 0 },
      { type: 'vertical-1', day: 'Thursday', offset: 2 },
      { type: 'vertical-23', day: 'Saturday', offset: 4 },
    ];

    for (const slot of slotTypes) {
      const slotDate = addDays(currentDate, slot.offset);
      const files = resolveFiles(item.slug, item.session, slot.type);

      entries.push({
        id: `${item.slug}/s${item.session}/${slot.type}`,
        topic: item.slug,
        topicName: item.name,
        session: item.session,
        slotType: slot.type,
        dayOfWeek: slot.day,
        scheduledDate: formatDate(slotDate),
        status: 'pending',
        attempts: 0,
        youtubeVideoId: null,
        instagramMediaId: null,
        lastUpdated: null,
        errorMessage: null,
        files,
      });
    }

    // Move to next week's Tuesday
    currentDate = addDays(currentDate, 7);
  }

  const publishQueue: PublishQueue = {
    version: 2,
    lastUpdated: formatDate(new Date()),
    lastPublishedIndex: -1,
    schedule: {
      pattern: 'tue-long_thu-vertical1_sat-vertical23',
      note: 'Tuesday=long-form YouTube, Thursday=vertical part 1 (IG+YT), Saturday=vertical parts 2+3 (IG+YT)',
    },
    entries,
  };

  // Summary
  const totalWeeks = Math.ceil(entries.length / 3);
  const lastDate = entries[entries.length - 1]?.scheduledDate || 'N/A';

  console.log(`Generated ${entries.length} publish slots across ${totalWeeks} weeks`);
  console.log(`Last scheduled date: ${lastDate}`);
  console.log(`First 9 entries (3 sessions):`);

  for (const entry of entries.slice(0, 9)) {
    console.log(`  ${entry.scheduledDate} (${entry.dayOfWeek.padEnd(8)}) ${entry.topic} S${entry.session} [${entry.slotType}]`);
  }

  if (dryRun) {
    console.log(`\nDry run complete. No file written.`);
    return;
  }

  fs.writeFileSync(PUBLISH_QUEUE_PATH, JSON.stringify(publishQueue, null, 2) + '\n');
  console.log(`\nWritten to: ${PUBLISH_QUEUE_PATH}`);
}

main();
