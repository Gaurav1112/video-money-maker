#!/usr/bin/env npx tsx
/**
 * Update titles of one or more videos. Reads pairs from a JSON file so the
 * workflow input stays small and the audit trail lives in the commit.
 *
 *   npx tsx scripts/set-video-title.ts data/retitle-batch.json
 *
 * Batch file format:
 *   [{"videoId":"abc123","title":"New title #Shorts","categoryId":"28"}, ...]
 *
 * categoryId is required by the YouTube API on update — defaults to "28"
 * (Science & Technology), which matches every video on the channel.
 */
import { google } from 'googleapis';
import * as fs from 'fs';
import { getYouTubeAuthClient } from './lib/youtube-oauth.js';

interface RetitleEntry {
  videoId: string;
  title: string;
  categoryId?: string;
}

async function main() {
  const path = process.argv[2];
  if (!path || !fs.existsSync(path)) {
    console.error('Usage: set-video-title.ts <batch.json>');
    process.exit(1);
  }
  const entries: RetitleEntry[] = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!Array.isArray(entries) || entries.length === 0) {
    console.error('Batch file must be a non-empty JSON array.');
    process.exit(1);
  }

  const yt = google.youtube({ version: 'v3', auth: getYouTubeAuthClient() });
  let ok = 0;
  let fail = 0;
  for (const e of entries) {
    if (e.title.length > 100) {
      console.warn(`  SKIP ${e.videoId} — title >100 chars (${e.title.length})`);
      fail++;
      continue;
    }
    try {
      await yt.videos.update({
        part: ['snippet'],
        requestBody: {
          id: e.videoId,
          snippet: { title: e.title, categoryId: e.categoryId ?? '28' },
        },
      });
      console.log(`  RETITLED: ${e.videoId} → "${e.title}"`);
      ok++;
    } catch (err: any) {
      console.warn(`  FAIL: ${e.videoId} — ${err.message?.slice(0, 120)}`);
      fail++;
    }
  }
  console.log(`\nDone. ${ok} retitled, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
