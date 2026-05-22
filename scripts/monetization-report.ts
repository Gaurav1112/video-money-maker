#!/usr/bin/env npx tsx
/**
 * scripts/monetization-report.ts — Feature 010, Part A
 *
 * Measures how far @GuruSishya-India is from YouTube Partner Program (YPP)
 * monetization and prints a deterministic Markdown report.
 *
 * YPP requires 1,000 subscribers PLUS one of:
 *   Path 1 — 10,000,000 valid Shorts views in the trailing 90 days
 *   Path 2 — 4,000 watch hours in the trailing 12 months
 *
 * Honesty contract: any metric that cannot be fetched prints the literal
 * string `unavailable`. No number is ever fabricated. The script always
 * exits 0 so the daily cron commits even a degraded report.
 *
 * CLI:  npx tsx scripts/monetization-report.ts            (writes + stdout)
 */
import * as fs from 'node:fs';

// ─── Thresholds ──────────────────────────────────────────────────────────────
export const SUBS_THRESHOLD = 1_000;
export const SHORTS_VIEWS_THRESHOLD = 10_000_000; // trailing 90 days
export const WATCH_HOURS_THRESHOLD = 4_000; // trailing 12 months
const SHORTS_MAX_SECONDS = 180; // ≤ 3min ≈ a Short

// ─── Pure calc (unit-tested) ─────────────────────────────────────────────────
export interface Progress {
  pct: number; // 0-100, clamped
  gap: number; // absolute remaining, clamped at 0
}

/** Percent complete (clamped 0-100) and absolute gap toward a threshold. */
export function yppProgress(current: number, threshold: number): Progress {
  if (!(threshold > 0)) return { pct: 100, gap: 0 };
  const safeCurrent = Number.isFinite(current) && current > 0 ? current : 0;
  const pct = Math.min(100, (safeCurrent / threshold) * 100);
  const gap = Math.max(0, threshold - safeCurrent);
  return { pct, gap };
}

/**
 * Blunt one-line verdict. If subscribers are the weakest of the three
 * percentages, they are the blocker (both YPP paths need 1k subs). Otherwise
 * name whichever non-subscriber path is further along.
 */
export function pickVerdict(subsPct: number, shortsPct: number, hoursPct: number): string {
  if (subsPct <= shortsPct && subsPct <= hoursPct) {
    return `Subscribers are the blocker (${subsPct.toFixed(1)}% of 1,000) — both YPP paths need 1k subs first.`;
  }
  if (shortsPct >= hoursPct) {
    return `Shorts-views path is closer (${shortsPct.toFixed(1)}% vs watch-hours ${hoursPct.toFixed(1)}%) — lean into Shorts volume.`;
  }
  return `Watch-hours path is closer (${hoursPct.toFixed(1)}% vs Shorts ${shortsPct.toFixed(1)}%) — lean into longer retention.`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isoDurationToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return +(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0);
}

function fmt(n: number | null): string {
  return n === null ? 'unavailable' : n.toLocaleString('en-US');
}

interface InventoryRecord {
  videoId: string;
  durationISO: string;
  views: number;
}
interface Inventory {
  fetchedAt?: string;
  subscriberCount?: number;
  records?: InventoryRecord[];
}

function readInventory(): Inventory | null {
  try {
    return JSON.parse(fs.readFileSync('data/channel-inventory.json', 'utf-8')) as Inventory;
  } catch {
    return null;
  }
}

/** Best-effort channel-level Analytics query. Returns null on any failure. */
async function queryChannel(metrics: string, days: number): Promise<Record<string, number> | null> {
  try {
    const { getYouTubeAnalyticsClient } = await import('./lib/youtube-analytics-client.js');
    const analytics = await getYouTubeAnalyticsClient();
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    const resp = await analytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics,
    });
    const row = resp.data.rows?.[0];
    if (!row) return null;
    const names = metrics.split(',');
    const out: Record<string, number> = {};
    names.forEach((name, i) => {
      out[name] = Number(row[i] ?? 0);
    });
    return out;
  } catch (err) {
    console.error(`[monetization] Analytics query failed (${metrics}): ${(err as Error).message}`);
    return null;
  }
}

function bar(pct: number): string {
  const filled = Math.round((pct / 100) * 20);
  return '█'.repeat(filled) + '░'.repeat(20 - filled);
}

// ─── Report ──────────────────────────────────────────────────────────────────
async function buildReport(): Promise<string> {
  const inv = readInventory();
  const subs = inv?.subscriberCount ?? null;

  // 90-day Shorts views — approximation. Primary: channel-level 90d views.
  const ch90 = await queryChannel('views,estimatedMinutesWatched', 90);
  const channel90dViews = ch90?.views ?? null;

  // Cross-check: sum inventory views of videos ≤ 3min (lifetime, not 90d).
  let inventoryShortsViews: number | null = null;
  if (inv?.records?.length) {
    inventoryShortsViews = inv.records
      .filter(
        (r) =>
          isoDurationToSeconds(r.durationISO) > 0 &&
          isoDurationToSeconds(r.durationISO) <= SHORTS_MAX_SECONDS
      )
      .reduce((s, r) => s + (r.views || 0), 0);
  }
  // Use the channel 90d figure as the headline Shorts-views proxy.
  const shortsViews90d = channel90dViews;

  // 12-month watch hours.
  const ch365 = await queryChannel('estimatedMinutesWatched', 365);
  const watchHours12mo =
    ch365?.estimatedMinutesWatched != null ? Math.round(ch365.estimatedMinutesWatched / 60) : null;

  // Progress.
  const subsP = yppProgress(subs ?? 0, SUBS_THRESHOLD);
  const shortsP =
    shortsViews90d != null ? yppProgress(shortsViews90d, SHORTS_VIEWS_THRESHOLD) : null;
  const hoursP = watchHours12mo != null ? yppProgress(watchHours12mo, WATCH_HOURS_THRESHOLD) : null;

  const verdict =
    subs != null && shortsP && hoursP
      ? pickVerdict(subsP.pct, shortsP.pct, hoursP.pct)
      : 'Verdict unavailable — one or more metrics could not be fetched.';

  const now = new Date().toISOString();
  const lines: string[] = [];
  lines.push('# YPP Monetization Tracker — @GuruSishya-India');
  lines.push('');
  lines.push(`_Generated: ${now}_`);
  lines.push('');
  lines.push('## Current standing');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Subscribers | ${fmt(subs)} |`);
  lines.push(`| 90-day Shorts views (approx) | ${fmt(shortsViews90d)} |`);
  lines.push(`| 12-month watch hours | ${fmt(watchHours12mo)} |`);
  lines.push(
    `| Inventory cross-check (lifetime views, videos ≤3min) | ${fmt(inventoryShortsViews)} |`
  );
  lines.push('');
  lines.push(
    '> **Approximation caveat:** The YouTube Analytics API does not cleanly ' +
      'separate Shorts views from long-form views. The "90-day Shorts views" ' +
      'figure above is the channel-level 90-day `views` total and therefore ' +
      'an upper bound. The inventory cross-check sums lifetime views of videos ' +
      '≤3min as a lower-bound sanity check.'
  );
  lines.push('');
  lines.push('## YPP Path 1 — 1,000 subs + 10,000,000 Shorts views / 90 days');
  lines.push('');
  lines.push(
    `- Subscribers: \`${bar(subsP.pct)}\` ${subsP.pct.toFixed(1)}% — gap ${fmt(subsP.gap)}`
  );
  if (shortsP) {
    lines.push(
      `- Shorts views: \`${bar(shortsP.pct)}\` ${shortsP.pct.toFixed(1)}% — gap ${fmt(shortsP.gap)}`
    );
  } else {
    lines.push('- Shorts views: unavailable');
  }
  lines.push('');
  lines.push('## YPP Path 2 — 1,000 subs + 4,000 watch hours / 12 months');
  lines.push('');
  lines.push(
    `- Subscribers: \`${bar(subsP.pct)}\` ${subsP.pct.toFixed(1)}% — gap ${fmt(subsP.gap)}`
  );
  if (hoursP) {
    lines.push(
      `- Watch hours: \`${bar(hoursP.pct)}\` ${hoursP.pct.toFixed(1)}% — gap ${fmt(hoursP.gap)}`
    );
  } else {
    lines.push('- Watch hours: unavailable');
  }
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(`**${verdict}**`);
  lines.push('');
  // ETA — trend data is not yet stored historically, so be honest.
  lines.push(
    '_ETA: insufficient trend data — this tracker stores only a single ' +
      'snapshot. After several daily runs, week-over-week deltas can be read ' +
      'from git history of this file._'
  );
  lines.push('');
  return lines.join('\n');
}

async function main(): Promise<void> {
  let report: string;
  try {
    report = await buildReport();
  } catch (err) {
    report =
      '# YPP Monetization Tracker\n\n' +
      `Report generation failed: ${(err as Error).message}\n\n` +
      'All metrics: unavailable\n';
  }
  fs.mkdirSync('data/analytics', { recursive: true });
  fs.writeFileSync('data/analytics/monetization.md', report);
  process.stdout.write(report);
  process.exit(0);
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('monetization-report.ts')) {
  void main();
}
