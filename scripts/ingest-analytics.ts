#!/usr/bin/env npx tsx
import { fetchVideoMetrics } from './lib/youtube-analytics-client';
import { buildVideoIdList, persistMetrics } from './lib/analytics-store';

const UPLOAD_DIRS = [
  // ADD NEW OUTPUT DIRS HERE
  'output/daily-short',
  'output/shorts',
];
const OUT_DIR = 'data/analytics';

async function main() {
  const videoIds = [...new Set(UPLOAD_DIRS.flatMap(buildVideoIdList))];
  console.log(`Ingesting analytics for ${videoIds.length} videos...`);
  if (videoIds.length === 0) {
    console.log('No upload-result.json files found. Nothing to ingest.');
    return;
  }
  const metrics = await fetchVideoMetrics(videoIds, 30);
  persistMetrics(OUT_DIR, metrics);
  console.log(`Wrote ${metrics.length} metric files to ${OUT_DIR}/`);
}

main().catch(err => { console.error(err); process.exit(1); });
