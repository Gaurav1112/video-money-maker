// Weekly Decision Digest (F011)
//
// Mechanically assembles ONE human-readable Sunday Markdown digest from the
// already-collected analytics data, ending with exactly one rule-based
// recommended action. Prints the digest to stdout; a Sunday cron commits it.
//
// Constitution: deterministic (pure delta/median/decision-tree, no Math.random),
// honest (missing data degrades to "unavailable" / "first run", never fabricated),
// local & cheap (pure Node — node:fs, node:child_process — no new deps, no LLM).
//
// Run: npx tsx scripts/weekly-digest.ts > data/analytics/weekly-digest.md

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readPairedComparisons, pickWinningFormula, VARIANT_CONSTANTS } from './lib/variant-store';

const ANALYTICS_DIR = 'data/analytics';
const MONETIZATION_MD = path.join(ANALYTICS_DIR, 'monetization.md');
const DIGEST_MD = path.join(ANALYTICS_DIR, 'weekly-digest.md');
const INVENTORY_JSON = 'data/channel-inventory.json';
const VARIANT_DIR = 'data/variants';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Pure helpers (exported, unit-tested)
// ---------------------------------------------------------------------------

export interface Delta {
  prev: number | null;
  curr: number | null;
  delta: number | null;
}

/** Week-over-week delta. Null prev/curr → null delta (first-run signal). */
export function computeDelta(prev: number | null, curr: number | null): Delta {
  if (prev === null || prev === undefined || curr === null || curr === undefined) {
    return { prev: prev ?? null, curr: curr ?? null, delta: null };
  }
  return { prev, curr, delta: curr - prev };
}

export interface Signals {
  daysSinceLastChange: number | null;
  completionDeltaPp: number | null;
  subscriberDeltaPerWeek: number | null;
  weeksFlat: number;
}

/**
 * Deterministic decision tree → exactly one recommended action.
 * Evaluated top-to-bottom; first match wins. No LLM.
 */
export function recommendAction(s: Signals): string {
  if (s.daysSinceLastChange !== null && s.daysSinceLastChange < 3) {
    return 'Hold — less than 3 days since the last big change. Let data accumulate.';
  }
  if (s.completionDeltaPp !== null && s.completionDeltaPp < 0) {
    return 'Retention regressed — investigate the last change before shipping anything new.';
  }
  if (s.completionDeltaPp !== null && s.completionDeltaPp >= 5) {
    return 'Last change worked — keep the current format and consider doubling down on it.';
  }
  if (s.subscriberDeltaPerWeek !== null && s.subscriberDeltaPerWeek >= 10) {
    return 'Subscriber growth healthy — maintain the current publishing cadence.';
  }
  if (s.subscriberDeltaPerWeek === 0 && s.completionDeltaPp === 0 && s.weeksFlat >= 2) {
    return 'Plateau — recommended pivot: a bigger move (new format, tighter niche, or a collab).';
  }
  return 'Steady state — continue as-is and review again next Sunday.';
}

// ---------------------------------------------------------------------------
// Git history helper
// ---------------------------------------------------------------------------

/** Return file contents at a git ref, or null if the ref/path does not resolve. */
function gitShow(ref: string, filePath: string): string | null {
  try {
    return execFileSync('git', ['show', `${ref}:${filePath}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/**
 * Best-effort read of a file as it was ~7 days ago. Tries HEAD~7 first, then
 * the oldest commit touching the file within the last 8 days. Null on failure.
 */
function gitShowPrev(filePath: string): string | null {
  const direct = gitShow('HEAD~7', filePath);
  if (direct !== null) return direct;
  try {
    const log = execFileSync('git', ['log', '--since=8 days ago', '--format=%H', '--', filePath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .split('\n')
      .filter(Boolean);
    if (log.length === 0) return null;
    // oldest commit in the window is the last line
    return gitShow(log[log.length - 1], filePath);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Parsing / data helpers
// ---------------------------------------------------------------------------

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

interface MonetizationSnapshot {
  subscribers: number | null;
  views90d: number | null;
  watchHours: number | null;
}

/** Parse the F010 monetization.md table. Returns nulls on format drift. */
function parseMonetization(md: string | null): MonetizationSnapshot {
  const snap: MonetizationSnapshot = { subscribers: null, views90d: null, watchHours: null };
  if (!md) return snap;
  const num = (label: RegExp): number | null => {
    const row = md.split('\n').find((l) => label.test(l));
    if (!row) return null;
    const cells = row.split('|').map((c) => c.trim());
    const raw = cells[2];
    if (!raw) return null;
    const n = Number(raw.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  snap.subscribers = num(/^\|\s*Subscribers\s*\|/i);
  snap.views90d = num(/90-day Shorts views/i);
  snap.watchHours = num(/12-month watch hours/i);
  return snap;
}

/** Pull a recorded median completion out of a prior weekly-digest.md. */
function parsePriorMedianCompletion(md: string | null): number | null {
  if (!md) return null;
  const m = md.match(/median completion[^\d]*([\d.]+)\s*%/i);
  return m ? Number(m[1]) : null;
}

function fmt(n: number | null): string {
  return n === null ? 'unavailable' : n.toLocaleString('en-US');
}

function deltaStr(d: Delta, unit = ''): string {
  if (d.delta === null) {
    return d.curr === null ? 'unavailable' : `${fmt(d.curr)}${unit} (first run — no delta yet)`;
  }
  const sign = d.delta > 0 ? '+' : '';
  return `${fmt(d.prev)} → ${fmt(d.curr)}${unit} (${sign}${d.delta}${unit})`;
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function sectionMonetization(): { md: string; subscriberDelta: number | null } {
  const lines: string[] = ['## 1. Monetization delta', ''];
  const currMd = fs.existsSync(MONETIZATION_MD) ? fs.readFileSync(MONETIZATION_MD, 'utf8') : null;
  const curr = parseMonetization(currMd);
  const prev = parseMonetization(gitShowPrev(MONETIZATION_MD));

  if (!currMd) {
    lines.push('_unavailable — `data/analytics/monetization.md` not found._', '');
    return { md: lines.join('\n'), subscriberDelta: null };
  }

  const hasPrev = prev.subscribers !== null || prev.views90d !== null || prev.watchHours !== null;
  if (!hasPrev) {
    lines.push('_First run — no prior `monetization.md` in git history, no delta yet._', '');
  }

  const subD = computeDelta(prev.subscribers, curr.subscribers);
  const viewD = computeDelta(prev.views90d, curr.views90d);
  const whD = computeDelta(prev.watchHours, curr.watchHours);

  lines.push(`- Subscribers: ${deltaStr(subD)}`);
  lines.push(`- 90-day views (approx): ${deltaStr(viewD)}`);
  lines.push(`- 12-month watch hours: ${deltaStr(whD)}`);
  lines.push('');

  // YPP gap re-print
  const subs = curr.subscribers;
  if (subs !== null) {
    const subPct = Math.min(100, (subs / 1000) * 100);
    lines.push(`**YPP Path 1** (1,000 subs + 10M Shorts views/90d):`);
    lines.push(`- Subscribers: ${subPct.toFixed(1)}% — gap ${fmt(1000 - subs)}`);
    if (curr.views90d !== null) {
      const vPct = Math.min(100, (curr.views90d / 10_000_000) * 100);
      lines.push(`- Shorts views: ${vPct.toFixed(2)}% — gap ${fmt(10_000_000 - curr.views90d)}`);
    }
    lines.push(`**YPP Path 2** (1,000 subs + 4,000 watch hours/12mo):`);
    lines.push(`- Subscribers: ${subPct.toFixed(1)}% — gap ${fmt(1000 - subs)}`);
    if (curr.watchHours !== null) {
      const wPct = Math.min(100, (curr.watchHours / 4000) * 100);
      lines.push(`- Watch hours: ${wPct.toFixed(1)}% — gap ${fmt(4000 - curr.watchHours)}`);
    }
  } else {
    lines.push('_YPP gap unavailable — subscriber count not parseable._');
  }
  lines.push('');
  return { md: lines.join('\n'), subscriberDelta: subD.delta };
}

interface MetricFile {
  videoId?: string;
  averageViewPercentage?: number;
  fetchedAt?: string;
}

function sectionRetention(): { md: string; completionDeltaPp: number | null } {
  const lines: string[] = ['## 2. Retention trend', ''];
  if (!fs.existsSync(ANALYTICS_DIR)) {
    lines.push('_unavailable — no `data/analytics/` directory._', '');
    return { md: lines.join('\n'), completionDeltaPp: null };
  }

  const metrics: MetricFile[] = [];
  for (const f of fs.readdirSync(ANALYTICS_DIR)) {
    if (!f.endsWith('.json')) continue;
    const m = readJson<MetricFile>(path.join(ANALYTICS_DIR, f));
    if (m && typeof m.averageViewPercentage === 'number') metrics.push(m);
  }

  if (metrics.length === 0) {
    lines.push('_unavailable — no per-video metric JSON files with completion data._', '');
    return { md: lines.join('\n'), completionDeltaPp: null };
  }

  const completions = metrics.map((m) => m.averageViewPercentage as number);
  const med = median(completions) as number;

  // week-over-week vs prior digest
  const priorMed = parsePriorMedianCompletion(gitShowPrev(DIGEST_MD));
  const trendD = computeDelta(priorMed, med);
  if (trendD.delta === null) {
    lines.push(
      `- Median completion: **${med.toFixed(1)}%** across ${metrics.length} videos ` +
        `(first run — no prior digest, no trend yet).`
    );
  } else {
    const sign = trendD.delta > 0 ? '+' : '';
    lines.push(
      `- Median completion: ${priorMed!.toFixed(1)}% → **${med.toFixed(1)}%** ` +
        `(${sign}${trendD.delta.toFixed(1)}pp) across ${metrics.length} videos.`
    );
  }

  // F011 30s-Short effect: new (last 7d) vs older videos
  const inventory = readJson<{ records?: Array<{ videoId: string; publishedAt: string }> }>(
    INVENTORY_JSON
  );
  if (inventory?.records) {
    const cutoff = Date.now() - WEEK_MS;
    const publishedAt = new Map(inventory.records.map((r) => [r.videoId, r.publishedAt]));
    const recent: number[] = [];
    const older: number[] = [];
    for (const m of metrics) {
      if (!m.videoId) continue;
      const pub = publishedAt.get(m.videoId);
      if (!pub) continue;
      const ts = Date.parse(pub);
      if (Number.isNaN(ts)) continue;
      (ts >= cutoff ? recent : older).push(m.averageViewPercentage as number);
    }
    const recMed = median(recent);
    const oldMed = median(older);
    if (recMed !== null && oldMed !== null) {
      const gap = recMed - oldMed;
      const verdict = gap > 0 ? 'showing up' : 'not yet visible';
      lines.push(
        `- F011 30s-Short check: last-7-day videos median ${recMed.toFixed(1)}% vs ` +
          `older ${oldMed.toFixed(1)}% (${gap >= 0 ? '+' : ''}${gap.toFixed(1)}pp) — change ${verdict}.`
      );
    } else {
      lines.push(
        `- F011 30s-Short check: not enough split data ` +
          `(${recent.length} recent / ${older.length} older videos with completion).`
      );
    }
  } else {
    lines.push('- F011 30s-Short check: unavailable — `channel-inventory.json` not readable.');
  }
  lines.push('');
  return { md: lines.join('\n'), completionDeltaPp: trendD.delta };
}

interface InventoryRecord {
  videoId: string;
  title: string;
  publishedAt: string;
  views: number;
}

function sectionTopBottom(): string {
  const lines: string[] = ['## 3. Top / bottom video of the week', ''];
  const inventory = readJson<{ records?: InventoryRecord[] }>(INVENTORY_JSON);
  if (!inventory?.records) {
    lines.push('_unavailable — `data/channel-inventory.json` not readable._', '');
    return lines.join('\n');
  }
  const cutoff = Date.now() - WEEK_MS;
  const recent = inventory.records.filter((r) => {
    const ts = Date.parse(r.publishedAt);
    return !Number.isNaN(ts) && ts >= cutoff;
  });
  if (recent.length === 0) {
    lines.push('_No videos published in the last 7 days._', '');
    return lines.join('\n');
  }

  const completion = (() => {
    const map = new Map<string, number>();
    if (fs.existsSync(ANALYTICS_DIR)) {
      for (const f of fs.readdirSync(ANALYTICS_DIR)) {
        if (!f.endsWith('.json')) continue;
        const m = readJson<MetricFile>(path.join(ANALYTICS_DIR, f));
        if (m?.videoId && typeof m.averageViewPercentage === 'number') {
          map.set(m.videoId, m.averageViewPercentage);
        }
      }
    }
    return map;
  })();

  const sorted = [...recent].sort((a, b) => b.views - a.views);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const describe = (r: InventoryRecord, label: string) => {
    const c = completion.get(r.videoId);
    const cStr = c !== undefined ? `, ${c.toFixed(1)}% completion` : '';
    lines.push(`- **${label}**: "${r.title}" — ${fmt(r.views)} views${cStr}`);
  };
  describe(top, 'Top');
  if (bottom.videoId !== top.videoId) describe(bottom, 'Bottom');
  else lines.push('_(only one video this week)_');
  lines.push('');
  return lines.join('\n');
}

function sectionAbHook(): string {
  const lines: string[] = ['## 4. A/B hook status', ''];
  let pairs;
  try {
    pairs = readPairedComparisons(VARIANT_DIR, ANALYTICS_DIR);
  } catch {
    lines.push('_unavailable — variant data not readable._', '');
    return lines.join('\n');
  }
  const need = VARIANT_CONSTANTS.MIN_PAIRS;
  lines.push(`- Paired comparisons: **${pairs.length}**.`);
  const winner = pickWinningFormula(pairs);
  if (winner) {
    lines.push(`- Current winning hook formula: **${winner}**.`);
  } else if (pairs.length < need) {
    lines.push(`- Winner: insufficient data (need ${need} pairs, have ${pairs.length}).`);
  } else {
    lines.push(`- Winner: no clear leader yet — margin below threshold.`);
  }
  lines.push('');
  return lines.join('\n');
}

function sectionRecommendation(signals: Signals): string {
  const lines: string[] = ['## 5. THE recommended action', ''];
  lines.push(`> **${recommendAction(signals)}**`);
  lines.push('');
  lines.push(
    `_Signals: daysSinceLastChange=${signals.daysSinceLastChange ?? 'n/a'}, ` +
      `completionDeltaPp=${signals.completionDeltaPp ?? 'n/a'}, ` +
      `subscriberDeltaPerWeek=${signals.subscriberDeltaPerWeek ?? 'n/a'}, ` +
      `weeksFlat=${signals.weeksFlat}. Advisory only — a human decides._`
  );
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Days since last code change touching the pipeline (best-effort)
// ---------------------------------------------------------------------------

function daysSinceLastChange(): number | null {
  try {
    const iso = execFileSync('git', ['log', '-1', '--format=%cI', '--', 'scripts', 'src'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!iso) return null;
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return null;
    return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const now = new Date().toISOString();
  const mon = sectionMonetization();
  const ret = sectionRetention();
  const topBottom = sectionTopBottom();
  const abHook = sectionAbHook();

  const signals: Signals = {
    daysSinceLastChange: daysSinceLastChange(),
    completionDeltaPp: ret.completionDeltaPp,
    subscriberDeltaPerWeek: mon.subscriberDelta,
    // weeksFlat is not derivable from a single snapshot pair; conservative 0.
    weeksFlat: 0,
  };
  const recommendation = sectionRecommendation(signals);

  const digest = [
    '# Weekly Decision Digest — @GuruSishya-India',
    '',
    `_Generated: ${now}_`,
    '',
    'One report. Five sections. One recommended action. Read the bottom line.',
    '',
    mon.md,
    ret.md,
    topBottom,
    abHook,
    recommendation,
  ].join('\n');

  process.stdout.write(digest.endsWith('\n') ? digest : digest + '\n');
}

// Only run when invoked directly (not when imported by tests).
const invokedDirectly = process.argv[1] !== undefined && /weekly-digest\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  main();
}
