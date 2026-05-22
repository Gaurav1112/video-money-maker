#!/usr/bin/env npx tsx
/**
 * Set the privacy status of one or more videos by ID.
 *
 * Counterpart to channel-cleanup.ts / channel-dedup.ts, which only move
 * videos toward private. This restores a video the dedup/cleanup wrongly
 * privated (e.g. a long-form mistaken for a duplicate of its Short).
 *
 *   npx tsx scripts/set-video-privacy.ts --status public WRiF-lPllsg
 */
import { google } from 'googleapis';
import { getYouTubeAuthClient } from './lib/youtube-oauth.js';

const VALID = ['public', 'private', 'unlisted'] as const;
type Status = (typeof VALID)[number];

async function main() {
  const argv = process.argv.slice(2);
  const statusIdx = argv.indexOf('--status');
  const status = (statusIdx > -1 ? argv[statusIdx + 1] : '') as Status;
  const ids = argv.filter((a, i) => !a.startsWith('--') && i !== statusIdx + 1);

  if (!VALID.includes(status) || ids.length === 0) {
    console.error(
      `Usage: set-video-privacy.ts --status <${VALID.join('|')}> <videoId> [videoId...]`
    );
    process.exit(1);
  }

  const yt = google.youtube({ version: 'v3', auth: getYouTubeAuthClient() });
  let ok = 0;
  let fail = 0;
  for (const id of ids) {
    try {
      await yt.videos.update({
        part: ['status'],
        requestBody: { id, status: { privacyStatus: status } },
      });
      console.log(`  ${status.toUpperCase()}: ${id}`);
      ok++;
    } catch (err: any) {
      console.warn(`  FAIL: ${id} — ${err.message?.slice(0, 120)}`);
      fail++;
    }
  }
  console.log(`\nDone. ${ok} updated, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
