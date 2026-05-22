#!/usr/bin/env npx tsx
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { getYouTubeAuthClient } from './lib/youtube-oauth.js';
import { fetchVideoMetrics } from './lib/youtube-analytics-client';
import { persistMetrics } from './lib/analytics-store';

const OUT_DIR = 'data/analytics';
// Feature 012: widened 50 -> 200 so the full channel (incl. older long-form
// videos) has retention data. YouTube Analytics API quota covers this easily.
const MAX_VIDEOS = 200;

async function listChannelUploads(): Promise<string[]> {
  const auth = getYouTubeAuthClient();
  const yt = google.youtube({ version: 'v3', auth });
  const ch = await yt.channels.list({ part: ['contentDetails'], mine: true });
  const uploadsPl = ch.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPl) throw new Error('No uploads playlist found for authenticated channel');
  const ids: string[] = [];
  let pageToken: string | undefined = undefined;
  while (ids.length < MAX_VIDEOS) {
    const resp: any = await yt.playlistItems.list({
      part: ['contentDetails'],
      playlistId: uploadsPl,
      maxResults: Math.min(50, MAX_VIDEOS - ids.length),
      pageToken,
    });
    for (const item of resp.data.items ?? []) {
      const vid = item.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = resp.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }
  return ids;
}

async function main() {
  console.log(`Listing channel uploads (max ${MAX_VIDEOS})...`);
  const videoIds = await listChannelUploads();
  console.log(`Found ${videoIds.length} videos on channel.`);
  if (videoIds.length === 0) {
    console.log('Nothing to ingest.');
    return;
  }
  const metrics = await fetchVideoMetrics(videoIds, 30);
  persistMetrics(OUT_DIR, metrics);
  console.log(`Wrote ${metrics.length} metric files to ${OUT_DIR}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
