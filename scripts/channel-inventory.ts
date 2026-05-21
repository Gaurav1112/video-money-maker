#!/usr/bin/env npx tsx
import { google } from 'googleapis';
import * as fs from 'fs';
import { getYouTubeAuthClient } from './lib/youtube-oauth.js';

interface VideoRecord {
  videoId: string;
  title: string;
  publishedAt: string;
  ageInDays: number;
  durationISO: string;
  views: number;
  likes: number;
  comments: number;
  privacyStatus: string;
  url: string;
}

const OUT_PATH = 'data/channel-inventory.json';

function isoDurationToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
}

async function main() {
  const auth = getYouTubeAuthClient();
  const yt = google.youtube({ version: 'v3', auth });
  const ch = await yt.channels.list({ part: ['contentDetails', 'snippet', 'statistics'], mine: true });
  const channel = ch.data.items?.[0];
  if (!channel) throw new Error('No channel found for authenticated user');
  console.log(`Channel: ${channel.snippet?.title}`);
  console.log(`Subscribers: ${channel.statistics?.subscriberCount}`);
  console.log(`Total uploads: ${channel.statistics?.videoCount}\n`);

  const uploadsPl = channel.contentDetails?.relatedPlaylists?.uploads!;
  const allIds: string[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const resp: any = await yt.playlistItems.list({
      part: ['contentDetails'],
      playlistId: uploadsPl,
      maxResults: 50,
      pageToken,
    });
    for (const item of resp.data.items ?? []) {
      const vid = item.contentDetails?.videoId;
      if (vid) allIds.push(vid);
    }
    pageToken = resp.data.nextPageToken ?? undefined;
  } while (pageToken);

  console.log(`Pulled ${allIds.length} video IDs from uploads playlist.\n`);

  const records: VideoRecord[] = [];
  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    const v = await yt.videos.list({
      part: ['snippet', 'statistics', 'contentDetails', 'status'],
      id: batch,
    });
    for (const item of v.data.items ?? []) {
      const published = item.snippet?.publishedAt ?? '';
      const ageMs = published ? Date.now() - new Date(published).getTime() : 0;
      records.push({
        videoId: item.id!,
        title: item.snippet?.title ?? '',
        publishedAt: published,
        ageInDays: Math.round(ageMs / 86400000),
        durationISO: item.contentDetails?.duration ?? '',
        views: Number(item.statistics?.viewCount ?? 0),
        likes: Number(item.statistics?.likeCount ?? 0),
        comments: Number(item.statistics?.commentCount ?? 0),
        privacyStatus: item.status?.privacyStatus ?? '',
        url: `https://youtu.be/${item.id}`,
      });
    }
  }

  records.sort((a, b) => b.views - a.views);

  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    channelTitle: channel.snippet?.title,
    subscriberCount: Number(channel.statistics?.subscriberCount ?? 0),
    totalUploads: records.length,
    records,
  }, null, 2));
  console.log(`Wrote ${OUT_PATH} (${records.length} records, sorted by views desc).\n`);

  // Print summary
  console.log('=== TOP 10 by views ===');
  records.slice(0, 10).forEach(r => {
    console.log(`${String(r.views).padStart(6)} views | ${String(r.ageInDays).padStart(3)}d old | ${r.privacyStatus.padEnd(8)} | ${r.title.slice(0, 70)}`);
  });
  console.log('\n=== BOTTOM 10 by views (oldest first) ===');
  const bottom = [...records].sort((a, b) => a.views - b.views).slice(0, 10);
  bottom.forEach(r => {
    console.log(`${String(r.views).padStart(6)} views | ${String(r.ageInDays).padStart(3)}d old | ${r.privacyStatus.padEnd(8)} | ${r.title.slice(0, 70)}`);
  });
  console.log('\n=== Bucket counts ===');
  const buckets = { '0-9': 0, '10-49': 0, '50-99': 0, '100-499': 0, '500-999': 0, '1k+': 0 };
  records.forEach(r => {
    if (r.views < 10) buckets['0-9']++;
    else if (r.views < 50) buckets['10-49']++;
    else if (r.views < 100) buckets['50-99']++;
    else if (r.views < 500) buckets['100-499']++;
    else if (r.views < 1000) buckets['500-999']++;
    else buckets['1k+']++;
  });
  Object.entries(buckets).forEach(([k, v]) => console.log(`  ${k.padStart(8)}: ${v} videos`));
}

main().catch(err => { console.error(err); process.exit(1); });
