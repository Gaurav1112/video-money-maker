#!/usr/bin/env npx tsx
/**
 * Channel cleanup — set-to-private OR delete videos below a view threshold.
 *
 * Defaults are SAFE:
 *   --threshold 50   videos with < 50 views are candidates
 *   --min-age 7      only videos older than 7 days are candidates
 *   --action private set them to private (REVERSIBLE)
 *   --dry-run        DEFAULT — shows what would be affected, no mutation
 *
 * For hard delete, you MUST pass: --action delete --confirm-delete
 *
 * Reads from data/channel-inventory.json (run channel-inventory.ts first).
 */
import { google } from 'googleapis';
import * as fs from 'fs';
import { getYouTubeAuthClient } from './lib/youtube-oauth.js';

interface VideoRecord {
  videoId: string;
  title: string;
  ageInDays: number;
  views: number;
  privacyStatus: string;
}

interface Args {
  threshold: number;
  minAge: number;
  action: 'private' | 'delete';
  dryRun: boolean;
  confirmDelete: boolean;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (flag: string, def: string): string => {
    const i = a.indexOf(flag);
    return i > -1 && a[i + 1] ? a[i + 1] : def;
  };
  const has = (flag: string): boolean => a.includes(flag);
  const dryRun = !has('--execute');
  return {
    threshold: Number(get('--threshold', '50')),
    minAge: Number(get('--min-age', '7')),
    action: (get('--action', 'private') as 'private' | 'delete'),
    dryRun,
    confirmDelete: has('--confirm-delete'),
  };
}

async function main() {
  const args = parseArgs();
  console.log('Args:', args);

  if (args.action === 'delete' && !args.confirmDelete) {
    console.error('REFUSED: --action delete requires --confirm-delete flag. Hard delete is irreversible. Use --action private (default) for reversible cleanup.');
    process.exit(1);
  }

  const inventoryPath = 'data/channel-inventory.json';
  if (!fs.existsSync(inventoryPath)) {
    console.error(`Missing ${inventoryPath}. Run scripts/channel-inventory.ts first.`);
    process.exit(1);
  }
  const inv = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8'));
  const records: VideoRecord[] = inv.records ?? [];

  const candidates = records.filter(r =>
    r.views < args.threshold &&
    r.ageInDays >= args.minAge &&
    r.privacyStatus === 'public'
  );

  console.log(`\nFound ${candidates.length} candidates (views < ${args.threshold}, age >= ${args.minAge}d, currently public).`);
  console.log('Sample (first 20):');
  candidates.slice(0, 20).forEach(c => {
    console.log(`  ${String(c.views).padStart(4)} views | ${String(c.ageInDays).padStart(3)}d | ${c.title.slice(0, 70)} | ${c.videoId}`);
  });

  if (args.dryRun) {
    console.log(`\n[DRY-RUN] No changes made. Re-run with --execute to apply --action=${args.action}.`);
    return;
  }

  console.log(`\nExecuting action=${args.action} on ${candidates.length} videos...`);
  const auth = getYouTubeAuthClient();
  const yt = google.youtube({ version: 'v3', auth });
  let ok = 0, fail = 0;
  for (const c of candidates) {
    try {
      if (args.action === 'delete') {
        await yt.videos.delete({ id: c.videoId });
        console.log(`  DELETED: ${c.videoId} (${c.views} views) — ${c.title.slice(0, 60)}`);
      } else {
        await yt.videos.update({
          part: ['status'],
          requestBody: { id: c.videoId, status: { privacyStatus: 'private' } },
        });
        console.log(`  PRIVATED: ${c.videoId} (${c.views} views) — ${c.title.slice(0, 60)}`);
      }
      ok++;
    } catch (err: any) {
      console.warn(`  FAIL: ${c.videoId} — ${err.message?.slice(0, 100)}`);
      fail++;
    }
  }
  console.log(`\nDone. ${ok} succeeded, ${fail} failed.`);
}

main().catch(err => { console.error(err); process.exit(1); });
