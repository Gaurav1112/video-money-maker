#!/usr/bin/env npx tsx
/**
 * batch-render-quizzes.ts — Render multiple Quiz Shorts using voice recordings
 *
 * Usage:
 *   npx tsx scripts/batch-render-quizzes.ts --from 0 --to 9 --audio-dir voice-recordings/
 *   npx tsx scripts/batch-render-quizzes.ts --from 0 --to 9 --audio-dir voice-recordings/ --upload
 *   npx tsx scripts/batch-render-quizzes.ts --from 0 --to 9 --audio-dir voice-recordings/ --dry-run
 *
 * Expects audio files named: quiz-0.mp3, quiz-1.mp3, ... quiz-9.mp3
 * in the specified --audio-dir directory.
 *
 * Each quiz is rendered with the creator's voice and full visual automation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { getQuizByIndex, QUIZ_BANK } from '../src/lib/quiz-content';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'daily-short');
const PROPS_DIR = path.join(PROJECT_ROOT, 'output');
const PUBLIC_AUDIO_DIR = path.join(PROJECT_ROOT, 'public', 'audio');

// ─── CLI Args ───────────────────────────────────────────────────────────────

interface CliArgs {
  from: number;
  to: number;
  audioDir: string;
  upload: boolean;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let from = 0;
  let to = 9;
  let audioDir = 'voice-recordings';
  let upload = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) {
      from = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--to' && args[i + 1]) {
      to = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--audio-dir' && args[i + 1]) {
      audioDir = args[i + 1];
      i++;
    } else if (args[i] === '--upload') {
      upload = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }

  return { from, to, audioDir, upload, dryRun };
}

// ─── Render Single Quiz ─────────────────────────────────────────────────────

function renderQuiz(
  quizNumber: number,
  audioPath: string,
  dryRun: boolean
): { videoPath: string; metadataPath: string; success: boolean } {
  const quizIndex = quizNumber % QUIZ_BANK.length;
  const quiz = getQuizByIndex(quizNumber);
  const episodeId = `${quiz.topic}-quiz-${quizIndex}`;

  const videoPath = path.join(OUTPUT_DIR, `${episodeId}.mp4`);
  const metadataPath = path.join(OUTPUT_DIR, `${episodeId}-metadata.json`);

  // Copy audio to public/audio for Remotion
  const voiceFilename = `voice-quiz-${quizIndex}.mp3`;
  const destPath = path.join(PUBLIC_AUDIO_DIR, voiceFilename);
  fs.copyFileSync(audioPath, destPath);

  // Write props
  const propsPath = path.join(PROPS_DIR, `daily-short-${episodeId}.json`);
  const propsData = {
    quiz,
    audioFile: voiceFilename,
  };
  fs.writeFileSync(propsPath, JSON.stringify(propsData, null, 2));

  if (dryRun) {
    console.log(`  [DRY RUN] Would render: ${episodeId}`);
    console.log(`    Audio:  ${audioPath}`);
    console.log(`    Props:  ${propsPath}`);
    console.log(`    Output: ${videoPath}`);
    return { videoPath, metadataPath, success: true };
  }

  // Render
  const renderCmd = [
    'npx',
    'remotion',
    'render',
    'src/compositions/index.tsx',
    'QuizShort',
    videoPath,
    `--props=${propsPath}`,
    '--codec=h264',
    '--crf=18',
    '--audio-bitrate=192K',
    `--concurrency=${process.env.CI ? '1' : '4'}`,
    '--timeout=180000',
  ].join(' ');

  try {
    execSync(renderCmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
  } catch (err) {
    return { videoPath, metadataPath, success: false };
  }

  // Write metadata
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
        'Comment your answer!',
        '',
        'Full course: guru-sishya.in',
        '',
        `#systemdesign #${quiz.topic.replace(/-/g, '')} #codinginterview #softwareengineer`,
      ].join('\n'),
      tags: [quiz.topic, 'system design', 'coding interview', 'software engineer', 'tech shorts'],
      categoryId: '27',
    },
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  return { videoPath, metadataPath, success: true };
}

// ─── Upload Single Quiz ─────────────────────────────────────────────────────

function uploadQuiz(videoPath: string, metadataPath: string): boolean {
  const uploadCmd = `npx tsx scripts/upload-youtube.ts "${videoPath}" "${metadataPath}" --shorts`;
  try {
    execSync(uploadCmd, { stdio: 'inherit', cwd: PROJECT_ROOT, timeout: 600000 });
    return true;
  } catch {
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { from, to, audioDir, upload, dryRun } = parseArgs();
  const count = to - from + 1;

  // Resolve audio directory
  const resolvedAudioDir = path.isAbsolute(audioDir)
    ? audioDir
    : path.resolve(PROJECT_ROOT, audioDir);

  console.log(`\n========================================`);
  console.log(`  Batch Render Quiz Shorts (Voice)`);
  console.log(`  Range:     ${from} to ${to} (${count} quizzes)`);
  console.log(`  Audio dir: ${resolvedAudioDir}`);
  console.log(`  Upload:    ${upload ? 'YES' : 'no'}`);
  console.log(`  Dry run:   ${dryRun ? 'YES' : 'no'}`);
  console.log(`========================================\n`);

  // Ensure output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Validate all audio files exist before starting
  const missing: string[] = [];
  for (let i = from; i <= to; i++) {
    const audioPath = path.join(resolvedAudioDir, `quiz-${i}.mp3`);
    if (!fs.existsSync(audioPath)) {
      missing.push(`quiz-${i}.mp3`);
    }
  }

  if (missing.length > 0) {
    console.error('ERROR: Missing audio files:');
    missing.forEach((f) => console.error(`  ${resolvedAudioDir}/${f}`));
    console.error(`\nRecord these files first using:`);
    console.error(`  npx tsx scripts/batch-record.ts --from ${from} --to ${to}`);
    process.exit(1);
  }

  // Render each quiz
  const results: Array<{
    index: number;
    title: string;
    videoPath: string;
    metadataPath: string;
    rendered: boolean;
    uploaded: boolean;
  }> = [];

  for (let i = from; i <= to; i++) {
    const quiz = getQuizByIndex(i);
    const audioPath = path.join(resolvedAudioDir, `quiz-${i}.mp3`);
    const num = i - from + 1;

    console.log(`\n--- [${num}/${count}] Quiz #${i}: ${quiz.title} ---`);

    const { videoPath, metadataPath, success } = renderQuiz(i, audioPath, dryRun);

    let uploaded = false;
    if (success && upload && !dryRun) {
      console.log(`  Uploading to YouTube...`);
      uploaded = uploadQuiz(videoPath, metadataPath);
      if (!uploaded) {
        console.error(`  Upload FAILED for quiz #${i} — continuing with next`);
      }
    }

    results.push({
      index: i,
      title: quiz.title,
      videoPath,
      metadataPath,
      rendered: success,
      uploaded,
    });
  }

  // Summary
  const renderedCount = results.filter((r) => r.rendered).length;
  const uploadedCount = results.filter((r) => r.uploaded).length;
  const failedCount = results.filter((r) => !r.rendered).length;

  console.log(`\n========================================`);
  console.log(`  BATCH COMPLETE`);
  console.log(`  Rendered:  ${renderedCount}/${count}`);
  if (upload) console.log(`  Uploaded:  ${uploadedCount}/${count}`);
  if (failedCount > 0) console.log(`  Failed:    ${failedCount}/${count}`);
  console.log(`========================================\n`);

  // List results
  for (const r of results) {
    const status = !r.rendered ? 'FAILED' : r.uploaded ? 'UPLOADED' : 'RENDERED';
    console.log(`  [${status}] Quiz #${r.index}: ${r.title}`);
    if (r.rendered && !dryRun) {
      console.log(`           ${r.videoPath}`);
    }
  }

  // Exit with failure if any render failed
  if (failedCount > 0) {
    process.exit(1);
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
