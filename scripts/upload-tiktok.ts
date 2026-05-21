#!/usr/bin/env tsx
/**
 * upload-tiktok.ts — F005 CLI wrapper.
 *
 * Usage:
 *   npx tsx scripts/upload-tiktok.ts <video.mp4> <metadata.json>
 *
 * Required env (missing any → exit 0 with skip log):
 *   TIKTOK_CLIENT_KEY
 *   TIKTOK_CLIENT_SECRET
 *   TIKTOK_ACCESS_TOKEN
 *   TIKTOK_OPEN_ID
 *
 * Optional:
 *   TIKTOK_PRIVACY_LEVEL  — SELF_ONLY (default, safe for Sandbox) | PUBLIC_TO_EVERYONE
 */

import * as fs from 'node:fs';
import { buildTikTokCaption } from './lib/tiktok-caption';
import { uploadToTikTok } from './lib/tiktok-client';

const REQUIRED_ENV = [
  'TIKTOK_CLIENT_KEY',
  'TIKTOK_CLIENT_SECRET',
  'TIKTOK_ACCESS_TOKEN',
  'TIKTOK_OPEN_ID',
] as const;

async function main() {
  const [videoPath, metadataPath] = process.argv.slice(2);
  if (!videoPath || !metadataPath) {
    console.error('Usage: upload-tiktok.ts <video.mp4> <metadata.json>');
    process.exit(1);
  }

  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
      console.log(`[tiktok] ${key} missing — skipping TikTok upload`);
      process.exit(0);
    }
  }

  if (!fs.existsSync(videoPath)) {
    console.error(`[tiktok] video not found: ${videoPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(metadataPath)) {
    console.error(`[tiktok] metadata not found: ${metadataPath}`);
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const caption = buildTikTokCaption(meta);

  const privacy = (process.env['TIKTOK_PRIVACY_LEVEL'] || 'SELF_ONLY') as
    | 'SELF_ONLY'
    | 'PUBLIC_TO_EVERYONE'
    | 'MUTUAL_FOLLOW_FRIENDS';

  try {
    const result = await uploadToTikTok(videoPath, caption, {
      accessToken: process.env['TIKTOK_ACCESS_TOKEN']!,
      openId: process.env['TIKTOK_OPEN_ID']!,
      privacyLevel: privacy,
    });
    console.log(`[tiktok] uploaded: publish_id=${result.publishId} privacy=${privacy}`);
  } catch (e) {
    console.error(`[tiktok] upload failed: ${(e as Error).message}`);
    process.exit(1);
  }
}

main();
