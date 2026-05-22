#!/usr/bin/env tsx
/**
 * upload-instagram-wrapper.ts — F004 thin guard around publish-to-instagram.ts.
 *
 * Why: publish-to-instagram.ts exits 1 on missing token, which makes the
 * auto-shorts.yml workflow show yellow ✗ every run until the operator
 * configures secrets. This wrapper checks all 7 required env vars first and
 * exits 0 with a skip log if any are missing — keeping the workflow clean
 * while secrets are being set up.
 *
 * Usage (called from .github/workflows/auto-shorts.yml):
 *   npx tsx scripts/upload-instagram-wrapper.ts <video.mp4> <metadata.json>
 *
 * Required env (Instagram-Login API — graph.instagram.com):
 *   IG_ACCESS_TOKEN       (legacy alias: INSTAGRAM_ACCESS_TOKEN)
 *   IG_USER_ID            (legacy alias: INSTAGRAM_BUSINESS_ID)
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

/**
 * Each entry is one logical requirement. A string[] means "any one of these
 * env vars satisfies it" — used so the new IG_* names and the legacy
 * INSTAGRAM_* names both work.
 */
const REQUIRED_ENV: ReadonlyArray<string[]> = [
  ['IG_ACCESS_TOKEN', 'INSTAGRAM_ACCESS_TOKEN'],
  ['IG_USER_ID', 'INSTAGRAM_BUSINESS_ID'],
  ['R2_ACCOUNT_ID'],
  ['R2_ACCESS_KEY_ID'],
  ['R2_SECRET_ACCESS_KEY'],
  ['R2_BUCKET_NAME'],
  ['R2_PUBLIC_URL'],
];

function main() {
  const [video, metadata] = process.argv.slice(2);
  if (!video || !metadata) {
    console.error('Usage: upload-instagram-wrapper.ts <video.mp4> <metadata.json>');
    process.exit(1);
  }

  for (const aliases of REQUIRED_ENV) {
    if (!aliases.some((key) => process.env[key])) {
      console.log(`[ig-wrapper] ${aliases.join('/')} missing — skipping Instagram upload`);
      process.exit(0);
    }
  }

  // Derive topic from filename (e.g. caching-short-0-variantA.mp4 → caching).
  const base = path.basename(video, '.mp4');
  const topic = base.split('-')[0] || 'tech';

  // Delegate to the audited publish-to-instagram.ts (unmodified).
  const target = path.resolve(__dirname, 'publish-to-instagram.ts');
  const result = spawnSync(
    'npx',
    ['tsx', target, '--video', video, '--metadata', metadata, '--topic', topic, '--session', '1'],
    { stdio: 'inherit', env: process.env }
  );
  process.exit(result.status ?? 1);
}

main();
