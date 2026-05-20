// scripts/lib/analytics-store.ts
import * as fs from 'fs';
import * as path from 'path';
import type { VideoMetrics } from './youtube-analytics-client';

export function buildVideoIdList(uploadsDir: string): string[] {
  if (!fs.existsSync(uploadsDir)) return [];
  return fs.readdirSync(uploadsDir)
    .filter(f => f.endsWith('.upload-result.json'))
    .flatMap(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(uploadsDir, f), 'utf8'));
        return data.videoId ? [data.videoId as string] : [];
      } catch {
        // Tolerate partial writes / corrupt JSON — operator can re-run after fixing.
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
