#!/usr/bin/env npx tsx
/**
 * render-daily-short.ts — Render one standalone 45-second Short per day
 *
 * Usage:
 *   npx tsx scripts/render-daily-short.ts              # auto-pick based on today's date
 *   npx tsx scripts/render-daily-short.ts --date 2026-05-15  # specific date
 *   npx tsx scripts/render-daily-short.ts --short 42   # specific short number (0-659)
 *   npx tsx scripts/render-daily-short.ts --dry-run     # preview without rendering
 *
 * Outputs to: output/daily-short/<id>.mp4 + metadata JSON
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  generateShort,
  getShortForDate,
  resolveShortNumber,
  TOTAL_SHORTS,
} from '../src/pipeline/shorts-generator';
import { generateSceneAudios } from '../src/pipeline/tts-engine';
import { generateStoryboard } from '../src/pipeline/storyboard';
import type { Scene, Storyboard } from '../src/types';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'daily-short');
const PROPS_DIR = path.join(PROJECT_ROOT, 'output');

const BGM_FILES = [
  'audio/bgm/gentle-drone.mp3',
  'audio/bgm/study-pad.mp3',
  'audio/bgm/warm-ambient.mp3',
];

function pickBgm(seed: string): string {
  const hash = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return BGM_FILES[hash % BGM_FILES.length];
}

// ─── CLI Args ───────────────────────────────────────────────────────────────

function parseArgs(): { date: Date; shortNumber: number | null; dryRun: boolean } {
  const args = process.argv.slice(2);
  let date = new Date();
  let shortNumber: number | null = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      date = new Date(args[i + 1]);
      i++;
    } else if (args[i] === '--short' && args[i + 1]) {
      shortNumber = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  return { date, shortNumber, dryRun };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { date, shortNumber: explicitShort, dryRun } = parseArgs();

  // Determine which Short to render
  let topicSlug: string;
  let shortIndex: number;
  let shortNum: number;

  if (explicitShort !== null) {
    const resolved = resolveShortNumber(explicitShort);
    topicSlug = resolved.topicSlug;
    shortIndex = resolved.shortIndex;
    shortNum = explicitShort;
  } else {
    const result = getShortForDate(date);
    topicSlug = result.topicSlug;
    shortIndex = result.shortIndex;
    shortNum = result.shortNumber;
  }

  // Generate the Short content
  const episode = generateShort(topicSlug, shortIndex);

  console.log(`\n=== Daily Short #${shortNum} ===`);
  console.log(`Date:    ${date.toISOString().slice(0, 10)}`);
  console.log(`Topic:   ${topicSlug}`);
  console.log(`Format:  ${episode.formatName} (index ${shortIndex})`);
  console.log(`Title:   ${episode.title} (${episode.title.length} chars)`);
  console.log(`Words:   ${episode.narration.split(/\s+/).length}`);
  console.log(`ID:      ${episode.id}`);

  if (dryRun) {
    console.log(`\n--- Narration ---\n${episode.narration}`);
    console.log(`\n--- Heading ---\n${episode.heading}`);
    console.log(`\n--- Bullets ---`);
    episode.bullets.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
    console.log('\n[DRY RUN — not rendering]');
    return;
  }

  // Ensure output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ── Step 1: Generate TTS audio for each scene ──
  console.log('\n[1/4] Generating TTS audio...');
  const audioResults = await generateSceneAudios(
    episode.scenes,
    'en-IN-PrabhatNeural',
    'indian-english',
    { text: '+45%', code: '+25%', table: '+38%', interview: '+45%', title: '+50%', diagram: '+35%', review: '+42%', summary: '+48%' },
  );

  // ── Step 2: Build storyboard ──
  console.log('[2/4] Building storyboard...');
  const storyboard = generateStoryboard(episode.scenes, audioResults, {
    topic: topicSlug,
    sessionNumber: 0, // 0 = standalone short
    fps: 30,
    width: 1080,
    height: 1920,
    format: 'vertical',
  });

  // Override duration to exactly 1350 frames (45s)
  storyboard.durationInFrames = 1350;
  storyboard.bgmFile = pickBgm(episode.id);

  // Save props JSON
  const propsPath = path.join(PROPS_DIR, `daily-short-${episode.id}.json`);
  const propsData = {
    storyboard,
    heading: episode.heading,
    bullets: episode.bullets,
    visualCue: episode.visualCue,
  };
  fs.writeFileSync(propsPath, JSON.stringify(propsData, null, 2));
  console.log(`   Props: ${propsPath}`);

  // ── Step 3: Render via Remotion ──
  console.log('[3/4] Rendering video...');
  const outputPath = path.join(OUTPUT_DIR, `${episode.id}.mp4`);

  const renderCmd = [
    'npx', 'remotion', 'render',
    'src/compositions/index.tsx',
    'AtomicShort',
    outputPath,
    `--props=${propsPath}`,
    '--codec=h264',
    '--crf=18',
    '--audio-bitrate=192K',
    '--concurrency=4',
  ].join(' ');

  execSync(renderCmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
  console.log(`   Video: ${outputPath}`);

  // ── Step 4: Generate metadata ──
  console.log('[4/4] Generating metadata...');
  const metadata = generateShortMetadata(episode);
  const metadataPath = path.join(OUTPUT_DIR, `${episode.id}-metadata.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`   Metadata: ${metadataPath}`);

  // Summary
  const fileSize = fs.statSync(outputPath).size;
  console.log(`\n=== Done ===`);
  console.log(`Video:    ${outputPath} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Metadata: ${metadataPath}`);
  console.log(`Title:    ${episode.title}`);
}

// ─── Metadata Generator ─────────────────────────────────────────────────────

interface ShortMetadata {
  youtube: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    playlistTitle: string;
  };
}

function generateShortMetadata(episode: ReturnType<typeof generateShort>): ShortMetadata {
  const topicDisplay = episode.topicSlug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // NO #Shorts in title — YouTube auto-detects vertical content
  const title = episode.title;

  const description = [
    `${episode.heading}`,
    '',
    episode.bullets.map(b => `- ${b}`).join('\n'),
    '',
    `This is a standalone Short about ${topicDisplay}.`,
    'Full deep-dive series available on our channel.',
    '',
    '#SystemDesign #CodingInterview #TechShorts #SoftwareEngineering',
  ].join('\n');

  const tags = [
    topicDisplay.toLowerCase(),
    'system design',
    'coding interview',
    'software engineering',
    'tech shorts',
    'programming',
    episode.formatName,
  ];

  return {
    youtube: {
      title,
      description,
      tags,
      categoryId: '28', // Science & Technology
      playlistTitle: `${topicDisplay} Shorts`,
    },
  };
}

// ─── Run ────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
