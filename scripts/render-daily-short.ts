#!/usr/bin/env npx tsx
/**
 * render-daily-short.ts — Render one 38-second Quiz Short per day
 *
 * Usage:
 *   npx tsx scripts/render-daily-short.ts              # auto-pick based on today's date
 *   npx tsx scripts/render-daily-short.ts --date 2026-05-15  # specific date
 *   npx tsx scripts/render-daily-short.ts --short 0    # specific quiz index (0-N)
 *   npx tsx scripts/render-daily-short.ts --dry-run     # preview without rendering
 *
 * Outputs to: output/daily-short/<id>.mp4 + metadata JSON
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { getDailyQuiz, getQuizByIndex, QUIZ_BANK } from '../src/lib/quiz-content';
import { generateSceneAudios } from '../src/pipeline/tts-engine';
import { generateStoryboard } from '../src/pipeline/storyboard';
import { wordTimestampsToSrt } from '../src/lib/srt';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'daily-short');
const PROPS_DIR = path.join(PROJECT_ROOT, 'output');

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

  // Determine which quiz to render
  const quiz = explicitShort !== null
    ? getQuizByIndex(explicitShort)
    : getDailyQuiz(date);

  // Build a stable ID for file naming
  const quizIndex = explicitShort !== null
    ? explicitShort % QUIZ_BANK.length
    : (() => {
        const startOfYear = new Date(date.getFullYear(), 0, 0);
        const diff = date.getTime() - startOfYear.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24)) % QUIZ_BANK.length;
      })();
  const episodeId = `${quiz.topic}-quiz-${quizIndex}`;

  console.log(`\n=== Daily Quiz Short ===`);
  console.log(`Date:     ${date.toISOString().slice(0, 10)}`);
  console.log(`Topic:    ${quiz.topic}`);
  console.log(`Index:    ${quizIndex} / ${QUIZ_BANK.length - 1}`);
  console.log(`Title:    ${quiz.title}`);
  console.log(`Question: ${quiz.question}`);

  if (dryRun) {
    console.log(`\n--- Hook ---\n${quiz.hookText}`);
    console.log(`\n--- Spoken Hook ---\n${quiz.spokenHook}`);
    console.log(`\n--- Options ---`);
    quiz.options.forEach((o, i) =>
      console.log(`  ${String.fromCharCode(65 + i)}) ${o}${i === quiz.correctIndex ? '  ✓' : ''}`)
    );
    console.log(`\n--- Explanation ---\n${quiz.explanation}`);
    console.log(`\n--- Twist ---\n${quiz.twist}`);
    console.log(`\n--- End Question ---\n${quiz.endQuestion}`);
    console.log('\n[DRY RUN — not rendering]');
    return;
  }

  // Ensure output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ── Step 1: Generate TTS audio from quiz narration ──
  console.log('\n[1/4] Generating TTS audio...');
  const fullNarration = `${quiz.spokenHook} ${quiz.question} ${quiz.explanation} ${quiz.twist}`;

  const audioResults = await generateSceneAudios(
    [{ narration: fullNarration, type: 'text' }],
    'en-IN-PrabhatNeural',
    'indian-english',
    { text: '+10%' },
  );

  // ── Step 2: Build storyboard (for audio stitching only) ──
  console.log('[2/4] Building storyboard...');
  const audioDuration = audioResults[0]?.duration ?? 38;

  // ── Emit SRT from TTS word timestamps ──
  const wordTimestamps = audioResults[0]?.wordTimestamps ?? [];
  if (wordTimestamps.length > 0) {
    const srt = wordTimestampsToSrt(wordTimestamps);
    const srtPath = path.join(OUTPUT_DIR, `${episodeId}.srt`);
    fs.writeFileSync(srtPath, srt);
    console.log(`   Captions: ${srtPath}`);
  }

  const quizScene = {
    type: 'text' as const,
    content: fullNarration,
    narration: fullNarration,
    duration: audioDuration,
    startFrame: 0,
    endFrame: Math.round(audioDuration * 30),
  };
  const storyboard = generateStoryboard([quizScene], audioResults, {
    topic: quiz.topic,
    sessionNumber: quizIndex,
    fps: 30,
    width: 1080,
    height: 1920,
    format: 'vertical',
  });

  storyboard.bgmFile = 'audio/bgm/warm-ambient.mp3';

  // Save props JSON
  const propsPath = path.join(PROPS_DIR, `daily-short-${episodeId}.json`);
  const propsData = {
    quiz,
    audioFile: storyboard.audioFile ? path.basename(storyboard.audioFile) : undefined,
    audioDurationSec: audioDuration,
    wordTimestamps,
  };
  fs.writeFileSync(propsPath, JSON.stringify(propsData, null, 2));
  console.log(`   Props: ${propsPath}`);

  // ── Step 3: Render via Remotion ──
  console.log('[3/4] Rendering video...');
  const outputPath = path.join(OUTPUT_DIR, `${episodeId}.mp4`);

  const renderCmd = [
    'npx', 'remotion', 'render',
    'src/compositions/index.tsx',
    'QuizShort',
    outputPath,
    `--props=${propsPath}`,
    '--codec=h264',
    '--crf=18',
    '--audio-bitrate=192K',
    `--concurrency=${process.env.CI ? '1' : '4'}`,
    '--timeout=180000',
  ].join(' ');

  execSync(renderCmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
  console.log(`   Video: ${outputPath}`);

  // ── Export frame-0 thumbnail ──
  const thumbnailPath = path.join(OUTPUT_DIR, `${episodeId}-thumbnail.jpg`);
  const thumbCmd = [
    'npx', 'remotion', 'still',
    'src/compositions/index.tsx',
    'QuizShort',
    thumbnailPath,
    `--props=${propsPath}`,
    '--frame=0',
    '--image-format=jpeg',
    '--jpeg-quality=92',
  ].join(' ');
  try {
    execSync(thumbCmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
    console.log(`   Thumbnail: ${thumbnailPath}`);
  } catch (err) {
    console.warn(`   [warn] thumbnail export failed; YouTube will auto-pick`);
  }

  // ── Step 4: Generate metadata ──
  console.log('[4/4] Generating metadata...');
  const metadata = {
    youtube: {
      title: quiz.title,
      description: [
        quiz.question,
        '',
        `A) ${quiz.options[0]}`,
        `B) ${quiz.options[1]}`,
        `C) ${quiz.options[2]}`,
        '',
        `💬 Comment your answer!`,
        '',
        `Full course: guru-sishya.in`,
        '',
        `#systemdesign #${quiz.topic.replace(/-/g, '')} #codinginterview #softwareengineer`,
      ].join('\n'),
      tags: [quiz.topic, 'system design', 'coding interview', 'software engineer', 'tech shorts'],
      categoryId: '28', // Science & Technology (per optimal_schedule memory)
    },
  };

  const metadataPath = path.join(OUTPUT_DIR, `${episodeId}-metadata.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`   Metadata: ${metadataPath}`);

  // Summary
  const fileSize = fs.statSync(outputPath).size;
  console.log(`\n=== Done ===`);
  console.log(`Video:    ${outputPath} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Metadata: ${metadataPath}`);
  console.log(`Title:    ${quiz.title}`);
}

// ─── Run ────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
