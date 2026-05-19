#!/usr/bin/env npx tsx
/**
 * record-workflow.ts — Voice recording workflow for Quiz Shorts
 *
 * Two modes:
 *   1. SCRIPT MODE: Print what the creator needs to read aloud
 *      npx tsx scripts/record-workflow.ts --short 0
 *
 *   2. RENDER MODE: Use the creator's recording instead of TTS
 *      npx tsx scripts/record-workflow.ts --short 0 --render --audio public/audio/voice-recording.mp3
 *
 * The pipeline handles everything else: visuals, diagrams, quiz format, upload.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { getQuizByIndex, QUIZ_BANK, type QuizQuestion } from '../src/lib/quiz-content';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'daily-short');
const PROPS_DIR = path.join(PROJECT_ROOT, 'output');
const PUBLIC_AUDIO_DIR = path.join(PROJECT_ROOT, 'public', 'audio');

// ─── CLI Args ───────────────────────────────────────────────────────────────

interface CliArgs {
  shortNumber: number;
  render: boolean;
  audioPath: string | null;
  dryRun: boolean;
  upload: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let shortNumber = 0;
  let render = false;
  let audioPath: string | null = null;
  let dryRun = false;
  let upload = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--short' && args[i + 1]) {
      shortNumber = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--render') {
      render = true;
    } else if (args[i] === '--audio' && args[i + 1]) {
      audioPath = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--upload') {
      upload = true;
    }
  }

  return { shortNumber, render, audioPath, dryRun, upload };
}

// ─── Timing Estimation ──────────────────────────────────────────────────────

function estimateReadTime(text: string): number {
  // Average speaking rate: ~3 words/second for clear narration
  const words = text.split(/\s+/).length;
  return Math.ceil(words / 3);
}

// ─── Script Formatter ───────────────────────────────────────────────────────

export function formatRecordingScript(quiz: QuizQuestion, quizIndex: number): string {
  const hookTime = estimateReadTime(quiz.spokenHook);
  const questionTime = estimateReadTime(quiz.question);
  const explanationTime = estimateReadTime(quiz.explanation);
  const twistTime = estimateReadTime(quiz.twist);
  const totalTime = hookTime + questionTime + 1 + explanationTime + twistTime;

  const correctLetter = String.fromCharCode(65 + quiz.correctIndex);

  const lines = [
    `=== RECORDING SCRIPT ===`,
    `Quiz #${quizIndex}: ${quiz.title}`,
    `Topic: ${quiz.topic}`,
    ``,
    `[HOOK - ${hookTime} seconds, speak with urgency]`,
    `"${quiz.spokenHook}"`,
    ``,
    `[QUESTION - ${questionTime} seconds, clear and slow]`,
    `"${quiz.question}"`,
    ``,
    `[PAUSE - say nothing for 1 second]`,
    ``,
    `[ANSWER - ${explanationTime} seconds, confident tone]`,
    `"The answer is ${correctLetter} — ${quiz.options[quiz.correctIndex]}. ${quiz.explanation}"`,
    ``,
    `[TWIST - ${twistTime} seconds, dramatic]`,
    `"${quiz.twist}"`,
    ``,
    `Total read time: ~${totalTime} seconds`,
    ``,
    `--- Options shown on screen ---`,
    `A) ${quiz.options[0]}`,
    `B) ${quiz.options[1]}`,
    `C) ${quiz.options[2]}`,
    `Correct: ${correctLetter}`,
  ];

  return lines.join('\n');
}

// ─── Render with Voice ──────────────────────────────────────────────────────

async function renderWithVoice(
  quiz: QuizQuestion,
  quizIndex: number,
  audioPath: string,
  dryRun: boolean,
): Promise<string> {
  const episodeId = `${quiz.topic}-quiz-${quizIndex}`;

  // Resolve audio path
  const resolvedAudio = path.isAbsolute(audioPath)
    ? audioPath
    : path.resolve(PROJECT_ROOT, audioPath);

  if (!fs.existsSync(resolvedAudio)) {
    console.error(`ERROR: Audio file not found: ${resolvedAudio}`);
    console.error(`\nRecord your voice and save it to: ${audioPath}`);
    process.exit(1);
  }

  // Copy audio to public/audio so Remotion's staticFile() can access it
  const voiceFilename = `voice-quiz-${quizIndex}.mp3`;
  const destPath = path.join(PUBLIC_AUDIO_DIR, voiceFilename);
  fs.copyFileSync(resolvedAudio, destPath);
  console.log(`Audio copied to: ${destPath}`);

  // Ensure output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Save props JSON — use voice audio instead of TTS
  const propsPath = path.join(PROPS_DIR, `daily-short-${episodeId}.json`);
  const propsData = {
    quiz,
    audioFile: voiceFilename,
  };
  fs.writeFileSync(propsPath, JSON.stringify(propsData, null, 2));
  console.log(`Props: ${propsPath}`);

  if (dryRun) {
    console.log('\n[DRY RUN] Would render with these settings:');
    console.log(`  Audio:  ${resolvedAudio}`);
    console.log(`  Props:  ${propsPath}`);
    console.log(`  Output: ${path.join(OUTPUT_DIR, `${episodeId}.mp4`)}`);
    return '';
  }

  // Render via Remotion
  console.log('\nRendering video with your voice...');
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

  const fileSize = fs.statSync(outputPath).size;
  console.log(`\nVideo rendered: ${outputPath} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);

  // Generate metadata
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

  const metadataPath = path.join(OUTPUT_DIR, `${episodeId}-metadata.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`Metadata: ${metadataPath}`);

  return outputPath;
}

// ─── Upload ─────────────────────────────────────────────────────────────────

function uploadToYouTube(videoPath: string, quiz: QuizQuestion, quizIndex: number): void {
  const episodeId = `${quiz.topic}-quiz-${quizIndex}`;
  const metadataPath = path.join(OUTPUT_DIR, `${episodeId}-metadata.json`);

  if (!fs.existsSync(metadataPath)) {
    console.error(`Metadata not found: ${metadataPath}`);
    process.exit(1);
  }

  console.log('\nUploading to YouTube...');
  const uploadCmd = `npx tsx scripts/upload-youtube.ts "${videoPath}" "${metadataPath}" --shorts`;

  try {
    execSync(uploadCmd, { stdio: 'inherit', cwd: PROJECT_ROOT, timeout: 600000 });
    console.log('Upload complete!');
  } catch (err) {
    console.error('Upload failed. You can retry manually:');
    console.error(`  ${uploadCmd}`);
    process.exit(1);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { shortNumber, render, audioPath, dryRun, upload } = parseArgs();

  const quizIndex = shortNumber % QUIZ_BANK.length;
  const quiz = getQuizByIndex(shortNumber);

  if (!render) {
    // ── Script mode: print what to read ──
    console.log(formatRecordingScript(quiz, quizIndex));
    console.log(`\n--- Next steps ---`);
    console.log(`1. Record the script above`);
    console.log(`2. Save as: public/audio/voice-recording.mp3`);
    console.log(`3. Run: npx tsx scripts/record-workflow.ts --short ${shortNumber} --render --audio public/audio/voice-recording.mp3`);
    return;
  }

  // ── Render mode: build video with creator's voice ──
  if (!audioPath) {
    console.error('ERROR: --render requires --audio <path-to-recording>');
    console.error('Example: npx tsx scripts/record-workflow.ts --short 0 --render --audio public/audio/voice-recording.mp3');
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`  Voice Recording Pipeline`);
  console.log(`  Quiz #${quizIndex}: ${quiz.title}`);
  console.log(`  Topic:  ${quiz.topic}`);
  console.log(`  Audio:  ${audioPath}`);
  console.log(`========================================\n`);

  const videoPath = await renderWithVoice(quiz, quizIndex, audioPath, dryRun);

  if (dryRun) return;

  if (upload) {
    uploadToYouTube(videoPath, quiz, quizIndex);
  } else {
    console.log(`\nTo upload: npx tsx scripts/record-workflow.ts --short ${shortNumber} --render --audio ${audioPath} --upload`);
  }

  console.log(`\n========================================`);
  console.log(`  DONE`);
  console.log(`  Title:  ${quiz.title}`);
  console.log(`  Video:  ${videoPath}`);
  console.log(`========================================\n`);
}

// ─── Run ────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
