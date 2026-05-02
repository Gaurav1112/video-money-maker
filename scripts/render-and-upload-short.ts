#!/usr/bin/env npx tsx
/**
 * render-and-upload-short.ts — Complete pipeline: render + upload + cleanup
 *
 * Usage:
 *   npx tsx scripts/render-and-upload-short.ts              # today's Short
 *   npx tsx scripts/render-and-upload-short.ts --date 2026-05-15  # specific date
 *   npx tsx scripts/render-and-upload-short.ts --short 42   # specific short number
 *   npx tsx scripts/render-and-upload-short.ts --no-cleanup  # keep local files
 *   npx tsx scripts/render-and-upload-short.ts --dry-run     # render only, no upload
 *
 * Exit codes:
 *   0 — success (rendered + uploaded)
 *   1 — failure (render or upload failed)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';
import {
  generateShort,
  getShortForDate,
  resolveShortNumber,
} from '../src/pipeline/shorts-generator';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'daily-short');

// ─── CLI Args ───────────────────────────────────────────────────────────────

interface CliArgs {
  date: Date;
  shortNumber: number | null;
  dryRun: boolean;
  noCleanup: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let date = new Date();
  let shortNumber: number | null = null;
  let dryRun = false;
  let noCleanup = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      date = new Date(args[i + 1]);
      i++;
    } else if (args[i] === '--short' && args[i + 1]) {
      shortNumber = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--no-cleanup') {
      noCleanup = true;
    }
  }

  return { date, shortNumber, dryRun, noCleanup };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function runWithRetry(
  cmd: string,
  description: string,
  maxRetries: number = 3,
  retryDelayMs: number = 30000,
): boolean {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[${description}] Attempt ${attempt}/${maxRetries}...`);
    try {
      execSync(cmd, { stdio: 'inherit', cwd: PROJECT_ROOT, timeout: 600000 });
      console.log(`[${description}] Success!`);
      return true;
    } catch (err) {
      console.error(`[${description}] Failed (attempt ${attempt}/${maxRetries})`);
      if (attempt < maxRetries) {
        console.log(`Waiting ${retryDelayMs / 1000}s before retry...`);
        spawnSync('sleep', [String(retryDelayMs / 1000)]);
      }
    }
  }
  return false;
}

function extractBestFrame(videoPath: string, outputPath: string): boolean {
  // Extract frame at 5 seconds (best hook moment)
  try {
    execSync(
      `ffmpeg -y -ss 5 -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`,
      { stdio: 'pipe', cwd: PROJECT_ROOT },
    );
    return fs.existsSync(outputPath);
  } catch {
    return false;
  }
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

async function main() {
  const { date, shortNumber: explicitShort, dryRun, noCleanup } = parseArgs();

  // ── Step 1: Determine which Short ──
  let topicSlug: string;
  let shortIndex: number;

  if (explicitShort !== null) {
    const resolved = resolveShortNumber(explicitShort);
    topicSlug = resolved.topicSlug;
    shortIndex = resolved.shortIndex;
  } else {
    const result = getShortForDate(date);
    topicSlug = result.topicSlug;
    shortIndex = result.shortIndex;
  }

  const episode = generateShort(topicSlug, shortIndex);
  console.log(`\n========================================`);
  console.log(`  Daily Short Pipeline`);
  console.log(`  Date:   ${date.toISOString().slice(0, 10)}`);
  console.log(`  Title:  ${episode.title}`);
  console.log(`  Topic:  ${topicSlug} (format: ${episode.formatName})`);
  console.log(`  ID:     ${episode.id}`);
  console.log(`========================================\n`);

  // ── Step 2: Render ──
  console.log('[STEP 1/5] Rendering Short...');
  const renderArgs = explicitShort !== null
    ? `--short ${explicitShort}`
    : `--date ${date.toISOString().slice(0, 10)}`;

  const renderCmd = `npx tsx scripts/render-daily-short.ts ${renderArgs}`;
  const renderSuccess = runWithRetry(renderCmd, 'Render', 2, 10000);

  if (!renderSuccess) {
    console.error('FATAL: Render failed after retries. Aborting.');
    process.exit(1);
  }

  // Verify output files exist
  const videoPath = path.join(OUTPUT_DIR, `${episode.id}.mp4`);
  const metadataPath = path.join(OUTPUT_DIR, `${episode.id}-metadata.json`);

  if (!fs.existsSync(videoPath)) {
    console.error(`FATAL: Video not found at ${videoPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(metadataPath)) {
    console.error(`FATAL: Metadata not found at ${metadataPath}`);
    process.exit(1);
  }

  const fileSizeMB = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(1);
  console.log(`Video rendered: ${videoPath} (${fileSizeMB} MB)`);

  // ── Step 3: Extract thumbnail ──
  console.log('\n[STEP 2/5] Extracting thumbnail...');
  const thumbnailPath = path.join(OUTPUT_DIR, `${episode.id}-thumb.jpg`);
  const thumbSuccess = extractBestFrame(videoPath, thumbnailPath);
  if (thumbSuccess) {
    console.log(`Thumbnail: ${thumbnailPath}`);
  } else {
    console.log('Thumbnail extraction failed (non-fatal, continuing)');
  }

  if (dryRun) {
    console.log('\n[DRY RUN] Skipping upload. Files are ready at:');
    console.log(`  Video:     ${videoPath}`);
    console.log(`  Metadata:  ${metadataPath}`);
    if (thumbSuccess) console.log(`  Thumbnail: ${thumbnailPath}`);
    return;
  }

  // ── Step 4: Upload to YouTube ──
  console.log('\n[STEP 3/5] Uploading to YouTube...');
  const uploadCmd = `npx tsx scripts/upload-youtube.ts "${videoPath}" "${metadataPath}" --shorts`;
  const uploadSuccess = runWithRetry(uploadCmd, 'Upload', 3, 60000);

  if (!uploadSuccess) {
    console.error('FATAL: Upload failed after 3 retries.');
    process.exit(1);
  }

  // ── Step 5: Set thumbnail (best effort) ──
  // YouTube API thumbnail upload would go here if needed.
  // For Shorts, YouTube auto-generates thumbnails, so this is optional.
  console.log('[STEP 4/5] Thumbnail set (YouTube auto-generates for Shorts)');

  // ── Step 6: Cleanup ──
  console.log('\n[STEP 5/5] Cleanup...');
  if (noCleanup) {
    console.log('Skipping cleanup (--no-cleanup flag)');
  } else {
    const filesToDelete = [videoPath, metadataPath, thumbnailPath];
    const propsPath = path.join(PROJECT_ROOT, 'output', `daily-short-${episode.id}.json`);
    filesToDelete.push(propsPath);

    for (const f of filesToDelete) {
      if (fs.existsSync(f)) {
        fs.unlinkSync(f);
        console.log(`  Deleted: ${path.basename(f)}`);
      }
    }
  }

  // ── Done ──
  console.log(`\n========================================`);
  console.log(`  SUCCESS`);
  console.log(`  Title:  ${episode.title}`);
  console.log(`  Topic:  ${topicSlug}`);
  console.log(`  Format: ${episode.formatName}`);
  console.log(`========================================\n`);

  process.exit(0);
}

// ─── Run ────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
