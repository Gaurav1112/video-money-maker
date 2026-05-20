#!/usr/bin/env npx tsx
import * as fs from 'fs';
import * as path from 'path';
import type { VideoMetrics } from './lib/youtube-analytics-client';

const ANALYTICS_DIR = 'data/analytics';

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function loadAll(): VideoMetrics[] {
  if (!fs.existsSync(ANALYTICS_DIR)) return [];
  return fs.readdirSync(ANALYTICS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(ANALYTICS_DIR, f), 'utf8')) as VideoMetrics);
}

function main() {
  const all = loadAll();
  if (all.length === 0) {
    console.log('# Weekly Report\n\nNo analytics data yet.');
    return;
  }
  const completionPct = all.map(m => m.averageViewPercentage);
  const views = all.map(m => m.views);
  const lines = [
    `# Weekly Report — ${new Date().toISOString().slice(0, 10)}`,
    '',
    `**Videos analyzed:** ${all.length}`,
    `**Median completion %:** ${median(completionPct).toFixed(1)}%  (target: ≥70%)`,
    `**Median views:** ${median(views).toFixed(0)}`,
    `**Median comments per 1k views:** ${(median(all.map(m => (m.comments / Math.max(1, m.views)) * 1000))).toFixed(2)}`,
    '',
    '## Per-Video',
    '',
    '| Video | Views | Completion % | AVD (s) | Likes | Comments |',
    '|---|---|---|---|---|---|',
    ...all
      .sort((a, b) => b.averageViewPercentage - a.averageViewPercentage)
      .map(m =>
        `| \`${m.videoId}\` | ${m.views} | ${m.averageViewPercentage.toFixed(1)}% | ${m.averageViewDuration.toFixed(1)} | ${m.likes} | ${m.comments} |`),
  ];
  console.log(lines.join('\n'));
}

main();
