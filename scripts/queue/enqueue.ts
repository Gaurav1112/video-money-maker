#!/usr/bin/env npx tsx
/**
 * scripts/queue/enqueue.ts — Insert a new video into the publish queue
 *
 * Usage (CI):
 *   npx tsx scripts/queue/enqueue.ts \
 *     --id        "kafka/s1/long"          \
 *     --topic     kafka                    \
 *     --topic-name "Apache Kafka"          \
 *     --session   1                        \
 *     --slot-type long                     \
 *     --day-of-week Tuesday                \
 *     --scheduled-date 2025-06-10          \
 *     --video-path output/videos/long.mp4  \
 *     --metadata-path output/kafka-s1.json \
 *     --platforms youtube,instagram,telegram
 *
 * Outputs GITHUB_OUTPUT variables: queue_item_id, enqueued
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import { openDb } from './init-db.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface EnqueueArgs {
  id: string;
  topic: string;
  topicName: string;
  session: number;
  slotType: 'long' | 'vertical-1' | 'vertical-23' | 'daily-short';
  dayOfWeek: string;
  scheduledDate: string;
  videoPath: string;
  additionalVideos?: string[];
  metadataPath: string;
  thumbnailPath?: string;
  platforms: Array<'youtube' | 'instagram' | 'telegram'>;
  upsert: boolean;    // true → UPDATE if already exists with status pending/failed
}

// ─── Arg parsing ────────────────────────────────────────────────────────────

function parseArgs(): EnqueueArgs {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };
  const require = (flag: string): string => {
    const v = get(flag);
    if (!v) { console.error(`Missing required arg: ${flag}`); process.exit(1); }
    return v;
  };

  const platformsRaw = get('--platforms') ?? 'youtube,instagram,telegram';
  const platforms = platformsRaw.split(',').map(p => p.trim()) as Array<'youtube' | 'instagram' | 'telegram'>;

  const additionalVideosRaw = get('--additional-videos');
  const additionalVideos = additionalVideosRaw ? additionalVideosRaw.split(',').map(p => p.trim()) : undefined;

  return {
    id:             require('--id'),
    topic:          require('--topic'),
    topicName:      require('--topic-name'),
    session:        parseInt(require('--session'), 10),
    slotType:       require('--slot-type') as EnqueueArgs['slotType'],
    dayOfWeek:      get('--day-of-week') ?? new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    scheduledDate:  get('--scheduled-date') ?? new Date().toISOString().split('T')[0],
    videoPath:      require('--video-path'),
    additionalVideos,
    metadataPath:   require('--metadata-path'),
    thumbnailPath:  get('--thumbnail-path'),
    platforms,
    upsert:         argv.includes('--upsert'),
  };
}

// ─── GitHub Actions output ──────────────────────────────────────────────────

function setOutput(key: string, value: string): void {
  const ghOutput = process.env['GITHUB_OUTPUT'];
  if (ghOutput) {
    fs.appendFileSync(ghOutput, `${key}=${value}\n`);
  }
  console.log(`${key}=${value}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs();
  const db = openDb();

  const enqueueTx = db.transaction(() => {
    // Check for existing item
    const existing = (db.prepare(
      'SELECT id, overall_status FROM queue_items WHERE id = ?'
    ).get(args.id) as { id: string; overall_status: string } | undefined);

    if (existing) {
      if (!args.upsert) {
        console.warn(`⚠️  Item already exists: ${args.id} (status: ${existing.overall_status}). Use --upsert to overwrite.`);
        setOutput('queue_item_id', args.id);
        setOutput('enqueued', 'false');
        setOutput('reason', 'already_exists');
        return;
      }
      // Upsert: only update if not yet published
      if (existing.overall_status === 'published') {
        console.warn(`⚠️  Item already published, skipping upsert: ${args.id}`);
        setOutput('queue_item_id', args.id);
        setOutput('enqueued', 'false');
        setOutput('reason', 'already_published');
        return;
      }
    }

    // Insert or replace
    db.prepare(`
      INSERT INTO queue_items
        (id, topic, topic_name, session, slot_type, day_of_week, scheduled_date,
         overall_status, video_path, additional_videos, metadata_path, thumbnail_path,
         updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?,
         strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(id) DO UPDATE SET
        video_path     = excluded.video_path,
        metadata_path  = excluded.metadata_path,
        thumbnail_path = excluded.thumbnail_path,
        updated_at     = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE queue_items.overall_status NOT IN ('published')
    `).run(
      args.id,
      args.topic,
      args.topicName,
      args.session,
      args.slotType,
      args.dayOfWeek,
      args.scheduledDate,
      args.videoPath,
      args.additionalVideos ? JSON.stringify(args.additionalVideos) : null,
      args.metadataPath,
      args.thumbnailPath ?? null,
    );

    // Insert platform rows (ignore if already exists with published status)
    for (const platform of args.platforms) {
      db.prepare(`
        INSERT INTO platform_publishes (queue_item_id, platform)
        VALUES (?, ?)
        ON CONFLICT(queue_item_id, platform) DO NOTHING
      `).run(args.id, platform);
    }

    console.log(`✅ Enqueued: ${args.id} → platforms [${args.platforms.join(', ')}]`);
    setOutput('queue_item_id', args.id);
    setOutput('enqueued', 'true');
  });

  enqueueTx();
}

main();
