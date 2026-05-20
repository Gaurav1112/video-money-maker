#!/usr/bin/env npx tsx
import * as fs from 'fs';
import * as path from 'path';
import { fetchVideoMetrics, VideoMetrics } from './lib/youtube-analytics-client';

const UPLOAD_DIRS = [
  'output/daily-short',
  'output/shorts',
];
const OUT_DIR = 'data/analytics';

export function buildVideoIdList(uploadsDir: string): string[] {
  if (!fs.existsSync(uploadsDir)) return [];
  return fs.readdirSync(uploadsDir)
    .filter(f => f.endsWith('.upload-result.json'))
    .flatMap(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(uploadsDir, f), 'utf8'));
        return data.videoId ? [data.videoId as string] : [];
      } catch {
        // Silently skip unparseable files — tolerates partial writes / corrupt JSON.
        return [];
      }
    });
}

export function persistMetrics(outDir: string, metrics: VideoMetrics[]): void {
  fs.mkdirSync(outDir, { recursive: true });
  for (const m of metrics) {
    fs.writeFileSync(path.join(outDir, `${m.videoId}.json`), JSON.stringify(m, null, 2));
  }
}

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

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
