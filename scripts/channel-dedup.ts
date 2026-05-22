#!/usr/bin/env npx tsx
/**
 * Channel dedup — find videos with duplicate content and keep only the
 * best-performing copy of each; set the rest to PRIVATE (reversible, NOT delete).
 *
 * The 13 uncoordinated upload workflows (disabled in F009) re-uploaded the
 * same quizzes repeatedly. This privates the redundant copies so the channel
 * stops looking like a spam farm and views stop splitting across duplicates.
 *
 * Reads data/channel-inventory.json (run channel-inventory.ts first).
 *
 * Usage:
 *   npx tsx scripts/channel-dedup.ts            # DRY-RUN (default)
 *   npx tsx scripts/channel-dedup.ts --execute  # apply: set duplicates private
 */
import { google } from 'googleapis';
import * as fs from 'fs';
import { getYouTubeAuthClient } from './lib/youtube-oauth.js';

export interface DedupRecord {
  videoId: string;
  title: string;
  views: number;
  privacyStatus: string;
  publishedAt: string;
}

export interface DuplicateGroup {
  normalized: string;
  keeper: DedupRecord;
  duplicates: DedupRecord[];
}

// Broad emoji + symbol ranges + variation selectors + ZWJ.
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

/** Lowercase, strip emoji + hashtags + punctuation, collapse whitespace. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(EMOJI_RE, '')
    .replace(/#\w+/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Group PUBLIC records by normalized title. Returns only groups with ≥2
 * members. Within a group the keeper is the highest-view video; ties go to
 * the earliest publishedAt (more accumulated algorithmic history).
 */
export function buildDuplicateGroups(records: DedupRecord[]): DuplicateGroup[] {
  const byKey: Record<string, DedupRecord[]> = {};
  for (const r of records) {
    if (r.privacyStatus !== 'public') continue;
    const key = normalizeTitle(r.title);
    if (!key) continue;
    (byKey[key] ??= []).push(r);
  }
  const groups: DuplicateGroup[] = [];
  for (const [normalized, members] of Object.entries(byKey)) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => {
      if (b.views !== a.views) return b.views - a.views;
      return a.publishedAt.localeCompare(b.publishedAt); // earliest wins tie
    });
    groups.push({ normalized, keeper: sorted[0], duplicates: sorted.slice(1) });
  }
  return groups;
}

async function main() {
  const execute = process.argv.includes('--execute');
  const invPath = 'data/channel-inventory.json';
  if (!fs.existsSync(invPath)) {
    console.error(`Missing ${invPath}. Run scripts/channel-inventory.ts first.`);
    process.exit(1);
  }
  const inv = JSON.parse(fs.readFileSync(invPath, 'utf8'));
  const records: DedupRecord[] = inv.records ?? [];
  const groups = buildDuplicateGroups(records);

  const totalDupes = groups.reduce((n, g) => n + g.duplicates.length, 0);
  console.log(`Found ${groups.length} duplicate groups, ${totalDupes} redundant videos.\n`);

  for (const g of groups) {
    console.log(`"${g.normalized}"`);
    console.log(`  KEEP    ${g.keeper.videoId}  ${String(g.keeper.views).padStart(5)} views`);
    for (const d of g.duplicates) {
      console.log(`  PRIVATE ${d.videoId}  ${String(d.views).padStart(5)} views`);
    }
  }

  if (!execute) {
    console.log(
      `\n[DRY-RUN] No changes. Re-run with --execute to private the ${totalDupes} duplicates.`
    );
    return;
  }

  console.log(`\nExecuting — privating ${totalDupes} duplicate videos...`);
  const auth = getYouTubeAuthClient();
  const yt = google.youtube({ version: 'v3', auth });
  let ok = 0;
  let fail = 0;
  for (const g of groups) {
    for (const d of g.duplicates) {
      try {
        await yt.videos.update({
          part: ['status'],
          requestBody: { id: d.videoId, status: { privacyStatus: 'private' } },
        });
        console.log(`  PRIVATED ${d.videoId} (${d.views} views)`);
        ok++;
      } catch (err) {
        console.warn(`  FAIL ${d.videoId}: ${String(err).slice(0, 100)}`);
        fail++;
      }
    }
  }
  const remainingPublic = records.filter((r) => r.privacyStatus === 'public').length - ok;
  console.log(`\nDone. ${ok} privated, ${fail} failed. ~${remainingPublic} public videos remain.`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
