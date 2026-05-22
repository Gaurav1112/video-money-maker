#!/usr/bin/env npx tsx
/**
 * scripts/make-reels.ts — v2 REWRITE (2025-07)
 *
 * FIX: Was trimming a 1920×1080 horizontal clip to 300 s and calling it a Reel.
 *   • make-reels.ts line 7:  "1920x1080 horizontal clip that Instagram will display natively."
 *   • make-reels.ts line 24: const REEL_DURATION = 300; // 5 minutes in seconds
 * Both are wrong for every short-form platform.
 *
 * NOW: Renders the ViralShort Remotion composition — 1080×1920 9:16, ≤55 s —
 * leaving a 5 s safety buffer under the YT Shorts 60 s hard cap.
 *
 * Key properties:
 *   • Deterministic — topic slug is SHA-256 hashed; (hash % sceneCount) picks the
 *     clipStart so the same topic always produces the same Short in CI reruns.
 *   • Zero-money — free Remotion OSS renderer + GH Actions ubuntu-latest.
 *   • Output: out/shorts/<slug>.mp4 + out/shorts/<slug>-metadata.json
 *
 * Usage:
 *   npx tsx scripts/make-reels.ts --topic "Load Balancing"
 *   npx tsx scripts/make-reels.ts --storyboard content/load-balancing-s1.json
 *   npx tsx scripts/make-reels.ts --all
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Storyboard } from '../src/types';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Output width — 9:16 vertical. FIXED from 1920 (was wrong direction). */
const WIDTH = 1080;
/** Output height — 9:16 vertical. */
const HEIGHT = 1920;
const FPS = 30;

/**
 * Hard cap: 55 s × 30 fps = 1650 frames.
 * YT Shorts cap is 60 s; 5 s buffer prevents accidental over-cap on slow scenes.
 * ViralShort's own MAX_TOTAL_FRAMES = 900 (30 s) is within this — guard is a safety net.
 */
const MAX_DURATION_FRAMES = 55 * FPS; // 1650

const COMPOSITION_ID = 'ViralShort';

/** Remotion bundle entrypoint — matches remotion.config.ts in repo root */
const ENTRY_POINT = path.resolve('src', 'index.ts');

/** Content JSON storyboards (symlinked in CI: ln -sf ../guru-sishya/public/content content) */
const CONTENT_DIR = path.resolve('content');

/** Rendered Shorts land here */
const SHORTS_DIR = path.resolve('out', 'shorts');

const SITE_URL = 'https://guru-sishya.in';

const INSTAGRAM_HASHTAGS = [
  '#coding',
  '#programming',
  '#interviewprep',
  '#faang',
  '#dsa',
  '#systemdesign',
  '#softwareengineering',
  '#learntocode',
  '#gurusishya',
  '#reels',
  '#techreels',
];

// ── Deterministic seed ─────────────────────────────────────────────────────────

/**
 * Derives a stable uint32 from the topic slug via SHA-256.
 * Identical slug → identical number → identical scene pick across all CI runs.
 */
function topicSeed(slug: string): number {
  const hex = createHash('sha256').update(slug).digest('hex');
  return parseInt(hex.slice(0, 8), 16); // first 32 bits → 0..4_294_967_295
}

/**
 * Picks the clipStart index deterministically.
 * Only content scenes (not 'title' / 'summary') are counted.
 */
function deterministicSceneIndex(storyboard: Storyboard, slug: string): number {
  const content = storyboard.scenes.filter((s) => s.type !== 'title' && s.type !== 'summary');
  if (content.length === 0) return 0;
  return topicSeed(slug) % content.length;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
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

function buildCaption(storyboard: Storyboard): string {
  const topic = storyboard.topic || 'System Design';
  return [
    `${topic} explained in under 30 seconds 🔥`,
    '',
    `Full deep-dive FREE at ${SITE_URL}`,
    '',
    INSTAGRAM_HASHTAGS.join(' '),
  ].join('\n');
}

function buildMetadata(
  slug: string,
  storyboard: Storyboard,
  sceneIndex: number,
  durationFrames: number,
  outPath: string
) {
  return {
    slug,
    topic: storyboard.topic,
    platform: 'instagram',
    type: 'reel',
    format: { width: WIDTH, height: HEIGHT, fps: FPS, aspectRatio: '9:16' },
    durationFrames,
    durationSeconds: +(durationFrames / FPS).toFixed(2),
    deterministicSeed: topicSeed(slug),
    clipStart: sceneIndex,
    generatedAt: new Date().toISOString(),
    outputFile: outPath,
    instagram: {
      caption: buildCaption(storyboard),
      hashtags: INSTAGRAM_HASHTAGS,
      coverText: storyboard.topic?.toUpperCase() ?? '',
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

  const outMp4 = path.join(SHORTS_DIR, `${slug}.mp4`);
  const outMeta = path.join(SHORTS_DIR, `${slug}-metadata.json`);
  ensureDir(SHORTS_DIR);

  console.log(`\n  ┌─ ${slug}`);
  console.log(`  │  clipStart    : ${sceneIndex}  (seed=${topicSeed(slug)})`);
  console.log(`  │  output       : ${outMp4}`);

  const serveUrl = await getBundle();
  const inputProps = { storyboard, clipStart: sceneIndex };

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
  });

  // Enforce ≤55 s hard cap regardless of calculateViralShortMetadata result
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
  console.log('  INSTAGRAM REEL MAKER  v2');
  console.log('  Renders ViralShort @ 1080×1920 (9:16), ≤55 s');
  console.log('  ──────────────────────────────────────────────');

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
    console.log('    npx tsx scripts/make-reels.ts --topic "Load Balancing"');
    console.log('    npx tsx scripts/make-reels.ts --storyboard content/lb-s1.json');
    console.log('    npx tsx scripts/make-reels.ts --all');
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
