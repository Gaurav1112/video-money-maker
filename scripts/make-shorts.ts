#!/usr/bin/env npx tsx
/**
 * scripts/make-shorts.ts — YouTube Shorts renderer
 *
 * Sibling to make-reels.ts. Renders the same ViralShort composition (1080×1920,
 * ≤55 s, deterministic) but writes YouTube-Shorts-specific metadata:
 *
 *   • Title ends with " #shorts" — triggers YT Shorts shelf placement
 *   • endScreen disabled in metadata — YT Shorts cannot have end screens
 *   • Description includes #shorts as first tag
 *   • Output: out/shorts/<slug>-yt.mp4 + out/shorts/<slug>-yt-metadata.json
 *
 * All other rendering behaviour (1080×1920, ≤55 s, deterministic seed, same
 * ViralShort composition) is identical to make-reels.ts. Both scripts share
 * the same Remotion bundle cache within a single process run.
 *
 * Usage:
 *   npx tsx scripts/make-shorts.ts --topic "Load Balancing"
 *   npx tsx scripts/make-shorts.ts --storyboard content/load-balancing-s1.json
 *   npx tsx scripts/make-shorts.ts --all
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Storyboard } from '../src/types';
import { buildShortsTitle } from '../src/lib/title-templates';
import { playlistFor } from './lib/playlist-mapping';

// ── Constants (identical to make-reels.ts) ─────────────────────────────────────

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
/** 55 s × 30 fps — 5 s under YT Shorts 60 s hard cap */
const MAX_DURATION_FRAMES = 55 * FPS;

const COMPOSITION_ID = 'ViralShort';
const ENTRY_POINT = path.resolve('src', 'index.ts');
const CONTENT_DIR = path.resolve('content');
const SHORTS_DIR = path.resolve('out', 'shorts');
const SITE_URL = 'https://guru-sishya.in';

/**
 * YT Shorts hashtags.
 * Rule: #shorts MUST appear in title OR description for shelf eligibility.
 * We put it in both to be safe.
 */
const YT_HASHTAGS = [
  '#shorts', '#coding', '#programming', '#interviewprep', '#faang',
  '#dsa', '#systemdesign', '#softwareengineering', '#learntocode',
  '#gurusishya', '#youtubeshorts',
];

// ── Deterministic seed (same algorithm as make-reels.ts) ──────────────────────

function topicSeed(slug: string): number {
  const hex = createHash('sha256').update(slug).digest('hex');
  return parseInt(hex.slice(0, 8), 16);
}

function deterministicSceneIndex(storyboard: Storyboard, slug: string): number {
  const content = storyboard.scenes.filter(
    (s) => s.type !== 'title' && s.type !== 'summary',
  );
  if (content.length === 0) return 0;
  return topicSeed(slug) % content.length;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length
    ? process.argv[idx + 1]
    : undefined;
}

function discoverStoryboards(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(CONTENT_DIR, f))
    .sort();
}

function loadStoryboard(jsonPath: string): Storyboard {
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  return JSON.parse(raw) as Storyboard;
}

/**
 * YouTube title rules:
 *   • ≤ 100 characters total
 *   • #shorts trigger — must appear in title for guaranteed Shorts shelf
 *   • SHOCK-HOOK formula proven on @GuruSishya-India (944-view best-perf
 *     used "90% Engineers Get … WRONG" pattern from title-templates.ts).
 *
 * This now wraps src/lib/title-templates.ts:buildShortsTitle which:
 *   - rotates 30+ pre-vetted templates by sessionNumber hash
 *   - enforces shock-title ≤60 chars to avoid mid-word truncation in feed
 *   - appends #Shorts + topic + interview-prep hashtags
 *
 * Falls back to the legacy vanilla template if any error occurs in
 * template selection (defensive — never block the render on title gen).
 */
function buildYtTitle(storyboard: Storyboard): string {
  const topic = storyboard.topic || 'System Design';
  try {
    // sessionNumber drives template rotation; index 0 always picks the
    // proven "90% … WRONG" pattern (highest CTR template).
    const shortIndex = Math.max(0, (storyboard.sessionNumber ?? 1) - 1);
    const title = buildShortsTitle(
      { topic },
      shortIndex,
      '#SystemDesign', // typeHashtag — Shorts are System Design / interview-prep niche
      'en',
    );
    // buildShortsTitle returns "<shock-title> #Shorts #SystemDesign #InterviewPrep #FAANG"
    // already enforces ≤100. Belt-and-braces clamp:
    return title.length <= 100 ? title : title.slice(0, 99) + '…';
  } catch (err) {
    console.warn(
      `[make-shorts] title-templates fallback for "${topic}" — ${(err as Error).message}`,
    );
    const fallback = `${topic} explained in 30 seconds #shorts`;
    return fallback.length <= 100 ? fallback : `${fallback.slice(0, 97)}…`;
  }
}

/**
 * YouTube description for Shorts.
 * End screens are NOT supported on Shorts; we skip that section.
 */
function buildYtDescription(storyboard: Storyboard): string {
  const topic = storyboard.topic || 'System Design';
  return [
    `${topic} in under 30 seconds.`,
    '',
    `Full free course at ${SITE_URL}`,
    '',
    YT_HASHTAGS.join(' '),
  ].join('\n');
}

function buildMetadata(
  slug: string,
  storyboard: Storyboard,
  sceneIndex: number,
  durationFrames: number,
  outPath: string,
) {
  return {
    slug,
    topic: storyboard.topic,
    platform: 'youtube',
    type: 'short',
    format: { width: WIDTH, height: HEIGHT, fps: FPS, aspectRatio: '9:16' },
    durationFrames,
    durationSeconds: +(durationFrames / FPS).toFixed(2),
    deterministicSeed: topicSeed(slug),
    clipStart: sceneIndex,
    generatedAt: new Date().toISOString(),
    outputFile: outPath,
    youtube: {
      title: buildYtTitle(storyboard),
      description: buildYtDescription(storyboard),
      tags: YT_HASHTAGS.map((t) => t.replace('#', '')),
      categoryId: '28',         // Science & Technology
      privacyStatus: 'public',
      // B3: deterministic playlist mapping. upload-youtube.ts will
      // find-or-create this playlist and add the video to it. Drives
      // the "playlist session-time" signal for Shorts-feed promotion.
      playlistTitle: playlistFor(storyboard.topic || '') ?? undefined,
      // End screens are not supported on YouTube Shorts — explicitly disabled
      endScreen: false,
      // madeForKids: false is required for monetisation eligibility
      madeForKids: false,
    },
  };
}

// ── Remotion bundle (cached per process) ──────────────────────────────────────

let _bundleCache: string | null = null;

async function getBundle(): Promise<string> {
  if (_bundleCache) return _bundleCache;
  console.log('  → Bundling Remotion compositions…');
  _bundleCache = await bundle({ entryPoint: ENTRY_POINT });
  console.log('  → Bundle ready.');
  return _bundleCache;
}

// ── Core render ────────────────────────────────────────────────────────────────

async function renderShort(jsonPath: string): Promise<void> {
  const storyboard = loadStoryboard(jsonPath);
  const slug = slugify(storyboard.topic || path.basename(jsonPath, '.json'));
  const sceneIndex = deterministicSceneIndex(storyboard, slug);

  // Separate filename from Instagram output to avoid CI collision
  const outMp4 = path.join(SHORTS_DIR, `${slug}-yt.mp4`);
  const outMeta = path.join(SHORTS_DIR, `${slug}-yt-metadata.json`);
  ensureDir(SHORTS_DIR);

  console.log(`\n  ┌─ ${slug}  [YT Shorts]`);
  console.log(`  │  clipStart    : ${sceneIndex}  (seed=${topicSeed(slug)})`);
  console.log(`  │  output       : ${outMp4}`);

  const serveUrl = await getBundle();
  const inputProps = { storyboard, clipStart: sceneIndex };

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
  });

  const safeDuration = Math.min(composition.durationInFrames, MAX_DURATION_FRAMES);

  await renderMedia({
    composition: { ...composition, durationInFrames: safeDuration },
    serveUrl,
    codec: 'h264',
    outputLocation: outMp4,
    inputProps,
    timeoutInMilliseconds: 180_000,
    onProgress: ({ progress }) => {
      const pct = Math.round(progress * 100);
      if (pct % 25 === 0) process.stdout.write(`  │  render       : ${pct}%   \r`);
    },
  });

  console.log(`  └─ ✓ ${safeDuration} frames (${(safeDuration / FPS).toFixed(1)} s)  →  ${outMp4}`);

  const meta = buildMetadata(slug, storyboard, sceneIndex, safeDuration, outMp4);
  fs.writeFileSync(outMeta, JSON.stringify(meta, null, 2));
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const topicArg = getArg('--topic');
  const storyboardArg = getArg('--storyboard');
  const runAll = process.argv.includes('--all');

  console.log('');
  console.log('  YOUTUBE SHORTS MAKER');
  console.log('  Renders ViralShort @ 1080×1920 (9:16), ≤55 s, #shorts metadata');
  console.log('  ────────────────────────────────────────────────────────────────');

  let targets: string[] = [];

  if (storyboardArg) {
    if (!fs.existsSync(storyboardArg)) {
      console.error(`  ERROR: storyboard not found: ${storyboardArg}`);
      process.exit(1);
    }
    targets = [storyboardArg];
  } else if (topicArg) {
    const slug = slugify(topicArg);
    const all = discoverStoryboards();
    const matches = all.filter((f) => path.basename(f).includes(slug));
    if (matches.length === 0) {
      console.error(`  ERROR: no storyboard for topic "${topicArg}" (slug: ${slug})`);
      console.error(`  Available: ${all.map((f) => path.basename(f)).join(', ') || 'none'}`);
      process.exit(1);
    }
    targets = matches;
  } else if (runAll) {
    targets = discoverStoryboards();
    if (targets.length === 0) {
      console.error(`  ERROR: no JSON storyboards found in ${CONTENT_DIR}`);
      process.exit(1);
    }
    console.log(`  Found ${targets.length} storyboards`);
  } else {
    console.log('  Usage:');
    console.log('    npx tsx scripts/make-shorts.ts --topic "Load Balancing"');
    console.log('    npx tsx scripts/make-shorts.ts --storyboard content/lb-s1.json');
    console.log('    npx tsx scripts/make-shorts.ts --all');
    process.exit(0);
  }

  let ok = 0;
  let fail = 0;

  for (const target of targets) {
    try {
      await renderShort(target);
      ok++;
    } catch (err: unknown) {
      console.error(`\n  ✗ FAILED: ${path.basename(target)}`);
      console.error(`    ${err instanceof Error ? err.message : String(err)}`);
      fail++;
    }
  }

  console.log(`\n  Results: ${ok} rendered, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
