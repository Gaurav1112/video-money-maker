#!/usr/bin/env tsx
/**
 * synthesize-weekly.ts — F003 weekly Dev.to + Hashnode synthesis.
 *
 * Runs every Sunday at 10:00 IST via .github/workflows/weekly-article.yml.
 * Reads the past week's quiz Shorts from data/variants/, builds a deterministic
 * Markdown digest, cross-posts to Dev.to AND Hashnode with canonical_url
 * pointing to the @GuruSishya-India YouTube channel, and records the result in
 * data/articles-posted/<iso-week>.json for dedup.
 *
 * Usage:
 *   npx tsx scripts/synthesize-weekly.ts            # publish for previous ISO week
 *   npx tsx scripts/synthesize-weekly.ts --dry-run  # print article, no network
 *   npx tsx scripts/synthesize-weekly.ts --week 2026-W21  # explicit week
 *
 * Env (any missing → that platform is skipped, exit 0):
 *   DEVTO_API_KEY
 *   HASHNODE_API_KEY
 *   HASHNODE_PUBLICATION_ID
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildWeeklyArticle, type Short } from './lib/weekly-template';
import { publishToDevto } from './lib/devto-client';
import { publishToHashnode } from './lib/hashnode-client';

const ROOT = process.cwd();
const VARIANTS_DIR = path.join(ROOT, 'data', 'variants');
const POSTED_DIR = path.join(ROOT, 'data', 'articles-posted');

interface PostRecord {
  isoWeek: string;
  devto: { url: string; id: number } | null;
  hashnode: { url: string; id: string } | null;
  postedAt: string;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const weekIdx = args.indexOf('--week');
  const week = weekIdx >= 0 ? args[weekIdx + 1] : undefined;
  return { dryRun, week };
}

/** ISO week string like '2026-W21' for the week containing the given Date. */
export function isoWeekOf(d: Date): string {
  // Copy date so we don't mutate.
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday of current week determines the year.
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function previousIsoWeek(): string {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  return isoWeekOf(sevenDaysAgo);
}

function readShortsForWeek(isoWeek: string): Short[] {
  if (!fs.existsSync(VARIANTS_DIR)) return [];
  const files = fs.readdirSync(VARIANTS_DIR).filter((f) => f.endsWith('.json'));
  const out: Short[] = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(VARIANTS_DIR, f), 'utf8'));
      if (!raw.publishedAt) continue;
      if (isoWeekOf(new Date(raw.publishedAt)) !== isoWeek) continue;
      out.push({
        id: raw.videoId || raw.id || f.replace('.json', ''),
        title: raw.title || raw.hook || 'Untitled Short',
        youtubeUrl: raw.youtubeUrl || (raw.videoId ? `https://youtube.com/shorts/${raw.videoId}` : ''),
        publishedAt: raw.publishedAt,
        topic: raw.topic || 'tech',
      });
    } catch {
      // skip unreadable variant files
    }
  }
  out.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  return out.slice(0, 5);
}

function readPostRecord(isoWeek: string): PostRecord | null {
  const p = path.join(POSTED_DIR, `${isoWeek}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writePostRecord(rec: PostRecord) {
  fs.mkdirSync(POSTED_DIR, { recursive: true });
  fs.writeFileSync(path.join(POSTED_DIR, `${rec.isoWeek}.json`), JSON.stringify(rec, null, 2));
}

async function main() {
  const { dryRun, week } = parseArgs();
  const isoWeek = week || previousIsoWeek();
  console.log(`[weekly-article] target ISO week: ${isoWeek}`);

  const shorts = readShortsForWeek(isoWeek);
  console.log(`[weekly-article] found ${shorts.length} Shorts for ${isoWeek}`);

  const article = buildWeeklyArticle(shorts, isoWeek);

  if (dryRun) {
    console.log(`\n--- Title ---\n${article.title}`);
    console.log(`\n--- Tags ---\n${article.tags.join(', ')}`);
    console.log(`\n--- Body ---\n${article.body}`);
    return;
  }

  if (shorts.length === 0) {
    console.log(`[weekly-article] no Shorts in window, skipping publish`);
    return;
  }

  const existing = readPostRecord(isoWeek);
  if (existing && existing.devto && existing.hashnode) {
    console.log(`[weekly-article] already posted for ${isoWeek}, skipping`);
    console.log(`  dev.to:   ${existing.devto.url}`);
    console.log(`  hashnode: ${existing.hashnode.url}`);
    return;
  }

  const devtoKey = process.env['DEVTO_API_KEY'];
  const hashnodeKey = process.env['HASHNODE_API_KEY'];
  const hashnodePubId = process.env['HASHNODE_PUBLICATION_ID'];

  let devtoResult: PostRecord['devto'] = existing?.devto ?? null;
  let hashnodeResult: PostRecord['hashnode'] = existing?.hashnode ?? null;

  // ─── Dev.to ──────────────────────────────────────────────────────────────
  if (devtoResult) {
    console.log(`[weekly-article] dev.to already posted: ${devtoResult.url}`);
  } else if (!devtoKey) {
    console.log(`[weekly-article] DEVTO_API_KEY missing — skipping Dev.to`);
  } else {
    try {
      devtoResult = await publishToDevto(article, devtoKey);
      console.log(`[weekly-article] dev.to posted: ${devtoResult.url}`);
    } catch (e) {
      console.error(`[weekly-article] dev.to failed: ${(e as Error).message}`);
    }
  }

  // ─── Hashnode ────────────────────────────────────────────────────────────
  if (hashnodeResult) {
    console.log(`[weekly-article] hashnode already posted: ${hashnodeResult.url}`);
  } else if (!hashnodeKey || !hashnodePubId) {
    console.log(`[weekly-article] HASHNODE_API_KEY or HASHNODE_PUBLICATION_ID missing — skipping Hashnode`);
  } else {
    try {
      hashnodeResult = await publishToHashnode(article, hashnodeKey, hashnodePubId);
      console.log(`[weekly-article] hashnode posted: ${hashnodeResult.url}`);
    } catch (e) {
      console.error(`[weekly-article] hashnode failed: ${(e as Error).message}`);
    }
  }

  // Only persist if at least one platform succeeded.
  if (devtoResult || hashnodeResult) {
    writePostRecord({
      isoWeek,
      devto: devtoResult,
      hashnode: hashnodeResult,
      postedAt: new Date().toISOString(),
    });
    console.log(`[weekly-article] dedup record saved to data/articles-posted/${isoWeek}.json`);
  } else {
    console.log(`[weekly-article] no platform succeeded; no dedup record written`);
  }
}

main().catch((e) => {
  console.error(`[weekly-article] fatal: ${(e as Error).message}`);
  process.exit(1);
});
