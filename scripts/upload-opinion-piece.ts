#!/usr/bin/env npx tsx
/**
 * Orchestrate: render an opinion-piece episode + upload BOTH long and short to YouTube.
 *
 * Usage:
 *   npx tsx scripts/upload-opinion-piece.ts --episode <slug>
 *   npx tsx scripts/upload-opinion-piece.ts --episode <slug> --dry-run
 *   npx tsx scripts/upload-opinion-piece.ts --next-unpublished  # picks lowest-numbered unpublished slug
 *
 * Behavior:
 *   1. Picks slug (explicit --episode or first unpublished by name sort).
 *   2. Runs scripts/render-opinion-piece.ts to produce long.mp4, short.mp4,
 *      long-thumbnail.jpg, short-thumbnail.jpg, long-metadata.json, short-metadata.json.
 *   3. Uploads the long-form via scripts/upload-youtube.ts (with thumbnail).
 *   4. Uploads the short via scripts/upload-youtube.ts --shorts (with thumbnail).
 *   5. Writes data/opinions-published/<slug>.json so the next cron run skips it.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PUBLISHED_DIR = 'data/opinions-published';

function listEpisodes(): string[] {
  const dir = 'content/opinions';
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .sort();
}

function isPublished(slug: string): boolean {
  return fs.existsSync(path.join(PUBLISHED_DIR, `${slug}.json`));
}

function pickNextUnpublished(): string | null {
  for (const slug of listEpisodes()) if (!isPublished(slug)) return slug;
  return null;
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const nextFlag = args.includes('--next-unpublished');
  const epIdx = args.indexOf('--episode');
  const slug: string | null =
    epIdx > -1 ? args[epIdx + 1] : nextFlag ? pickNextUnpublished() : null;

  if (!slug) {
    if (nextFlag) {
      console.log('No unpublished episodes — cron has nothing to publish. Exiting cleanly.');
      return;
    }
    console.error('No --episode <slug> and no unpublished episodes found.');
    process.exit(1);
  }
  console.log(`Episode: ${slug}`);
  if (isPublished(slug)) {
    console.log('Already published; nothing to do.');
    return;
  }

  const outDir = path.join('output/opinions', slug);
  const longMp4 = path.join(outDir, 'long.mp4');
  const shortMp4 = path.join(outDir, 'short.mp4');
  const longMeta = path.join(outDir, 'long-metadata.json');
  const shortMeta = path.join(outDir, 'short-metadata.json');
  const longThumb = path.join(outDir, 'long-thumbnail.jpg');
  const shortThumb = path.join(outDir, 'short-thumbnail.jpg');

  // 1. Render unless all required artifacts already exist (idempotent).
  const requiredArtifacts = [longMp4, shortMp4, longMeta, shortMeta, longThumb];
  const allArtifactsPresent = requiredArtifacts.every((f) => fs.existsSync(f));
  if (allArtifactsPresent) {
    console.log('All render artifacts present — skipping render step.');
  } else {
    console.log('Rendering...');
    execSync(`npx tsx scripts/render-opinion-piece.ts --episode ${slug}`, { stdio: 'inherit' });
  }

  for (const f of [longMp4, shortMp4, longMeta, shortMeta]) {
    if (!fs.existsSync(f)) {
      console.error(`Missing required file: ${f}`);
      process.exit(1);
    }
  }

  if (dryRun) {
    console.log('[DRY-RUN] Would upload:');
    console.log(`  long:  ${longMp4} + ${longMeta} + ${longThumb}`);
    console.log(`  short: ${shortMp4} + ${shortMeta} + ${shortThumb} --shorts`);
    return;
  }

  // 2. Upload long
  console.log('Uploading long-form...');
  const longCmd = [
    'npx tsx scripts/upload-youtube.ts',
    longMp4,
    longMeta,
    fs.existsSync(longThumb) ? `--thumbnail "${longThumb}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  execSync(longCmd, { stdio: 'inherit' });
  const longResultPath = longMp4.replace(/\.mp4$/, '.upload-result.json');
  const longResult = JSON.parse(fs.readFileSync(longResultPath, 'utf8'));

  // 3. Upload short
  console.log('Uploading short...');
  const shortCmd = [
    'npx tsx scripts/upload-youtube.ts',
    shortMp4,
    shortMeta,
    '--shorts',
    fs.existsSync(shortThumb) ? `--thumbnail "${shortThumb}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  execSync(shortCmd, { stdio: 'inherit' });
  const shortResultPath = shortMp4.replace(/\.mp4$/, '.upload-result.json');
  const shortResult = JSON.parse(fs.readFileSync(shortResultPath, 'utf8'));

  // 4. Persist dedupe record
  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(PUBLISHED_DIR, `${slug}.json`),
    JSON.stringify(
      {
        slug,
        publishedAt: new Date().toISOString(),
        longVideoId: longResult.videoId,
        shortVideoId: shortResult.videoId,
        longUrl: longResult.url,
        shortUrl: shortResult.url,
      },
      null,
      2
    )
  );
  console.log(`\n[opinion-publish] Published ${slug}`);
  console.log(`  long  : ${longResult.url}`);
  console.log(`  short : ${shortResult.url}`);
}

main();
