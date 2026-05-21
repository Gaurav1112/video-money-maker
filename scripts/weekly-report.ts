#!/usr/bin/env npx tsx
import * as fs from 'fs';
import * as path from 'path';
import type { VideoMetrics } from './lib/youtube-analytics-client';
import {
  readPairedComparisons,
  summarizeByFormula,
  pickWinningFormula,
  VARIANT_CONSTANTS,
} from './lib/variant-store';

const ANALYTICS_DIR = 'data/analytics';
const VARIANTS_DIR = 'data/variants';

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

  // ── Feature 001 (A/B): per-formula comparison table ──
  const pairs = readPairedComparisons(VARIANTS_DIR, ANALYTICS_DIR);
  lines.push('', `## Per-formula comparison (last N=${pairs.length} paired uploads)`, '');
  if (pairs.length === 0) {
    lines.push('No paired A/B uploads with analytics yet.');
  } else {
    const summaries = summarizeByFormula(pairs);
    // Per-formula view medians (joined back through pairs).
    const viewsByFormula: Record<string, number[]> = {};
    const viewsByVideoId: Record<string, number> = {};
    for (const m of all) viewsByVideoId[m.videoId] = m.views;
    // We need access to the raw variant records for view stats — re-read them.
    const variantRaw: Array<{ videoId: string; hookFormula: string }> = [];
    if (fs.existsSync(VARIANTS_DIR)) {
      for (const f of fs.readdirSync(VARIANTS_DIR)) {
        if (!f.endsWith('.json') || f.endsWith('.partial.json')) continue;
        try {
          const r = JSON.parse(fs.readFileSync(path.join(VARIANTS_DIR, f), 'utf8'));
          if (r.videoId && r.hookFormula) variantRaw.push(r);
        } catch { /* skip */ }
      }
    }
    for (const r of variantRaw) {
      const v = viewsByVideoId[r.videoId];
      if (v === undefined) continue;
      (viewsByFormula[r.hookFormula] ??= []).push(v);
    }

    lines.push('| Formula | n_videos | median completion % | median views |');
    lines.push('|---------|----------|---------------------|--------------|');
    for (const s of summaries) {
      const mv = median(viewsByFormula[s.formula] ?? []);
      lines.push(`| ${s.formula} | ${s.nVideos} | ${s.medianCompletion.toFixed(1)}% | ${mv.toFixed(0)} |`);
    }
    lines.push('');

    const winner = pickWinningFormula(pairs);
    if (winner) {
      const top = summaries[0];
      const second = summaries[1];
      const margin = top.medianCompletion - second.medianCompletion;
      lines.push(
        `**Winner**: ${winner} (+${margin.toFixed(1)}pp margin, ≥${VARIANT_CONSTANTS.MARGIN_THRESHOLD_PP}pp threshold met)`,
      );
    } else {
      if (pairs.length < VARIANT_CONSTANTS.MIN_PAIRS) {
        lines.push(
          `**No winner yet — continuing A/B** (${pairs.length}/${VARIANT_CONSTANTS.MIN_PAIRS} pairs collected).`,
        );
      } else if (summaries.length >= 2) {
        const margin = summaries[0].medianCompletion - summaries[1].medianCompletion;
        lines.push(
          `**No winner yet — continuing A/B** (margin ${margin.toFixed(1)}pp < ${VARIANT_CONSTANTS.MARGIN_THRESHOLD_PP}pp threshold).`,
        );
      } else {
        lines.push('**No winner yet — continuing A/B** (insufficient formula diversity).');
      }
    }
  }

  console.log(lines.join('\n'));
}

main();
