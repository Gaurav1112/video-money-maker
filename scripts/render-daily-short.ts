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
import {
  getDailyQuiz,
  getQuizByIndex,
  QUIZ_BANK,
  buildTags,
  type QuizQuestion,
} from '../src/lib/quiz-content';
import { generateSceneAudios } from '../src/pipeline/tts-engine';
import { generateStoryboard } from '../src/pipeline/storyboard';
import { wordTimestampsToSrt } from '../src/lib/srt';
import { applyHook, type HookFormula } from '../src/lib/quiz-hook';
import { readPairedComparisons, pickWinningFormula } from './lib/variant-store';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'daily-short');
const PROPS_DIR = path.join(PROJECT_ROOT, 'output');

// ─── Phase-aligned narration helpers ────────────────────────────────────────
// v3.1: the QuizShort composition is 120s but the original narration only
// produced ~30s of audio. These helpers derive phase-aligned voice-over so
// every visual phase has matching narration.

function deriveSpokenCode(quiz: QuizQuestion): string {
  if (!quiz.codeSnippet) {
    return 'Most developers get the configuration wrong. Let me show you exactly what to change.';
  }
  const lang = quiz.codeSnippet.language;
  return `Look at this ${lang} configuration. Most engineers write the wrong version. The right version uses a critical setting that survives failures. Compare them carefully — the difference is one line of config but it can save your entire production system.`;
}

function extractKeyInsight(explanation: string): string {
  // Find the first sentence containing a power word
  const sentences = explanation.split(/\.\s+/);
  const insight = sentences.find((s) =>
    /NOT|NEVER|WRONG|LOST|EVERY|ALWAYS|CRITICAL|MOST|ONLY/i.test(s)
  );
  return (insight ?? sentences[0]).trim();
}

function deriveSpokenExample(quiz: QuizQuestion): string {
  // Heuristic: build a "Here's what happens at scale" narration
  const companyMatch = quiz.explanation.match(
    /(Google|Netflix|Uber|LinkedIn|Meta|Amazon|Stripe|Cloudflare|GitHub|Twitter)/i
  );
  const company = companyMatch?.[1] ?? 'a top tech company';
  return `Here's how this plays out in the real world. ${company} runs into this exact problem at massive scale. The wrong approach leads to outages, data loss, and angry users. The right approach — the one we just covered — is what they actually use in production. The lesson: this matters. Pay attention to these defaults.`;
}

// ─── Loudness Normalization ──────────────────────────────────────────────────

function loudnormPass(inputPath: string, outputPath: string): void {
  console.log('   [loudnorm] pass 1 (measure)...');
  const measureCmd = `ffmpeg -y -i "${inputPath}" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | tail -20`;
  const measureOut = execSync(measureCmd, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    shell: '/bin/bash',
  });
  const jsonStart = measureOut.indexOf('{');
  const jsonEnd = measureOut.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < 0) {
    console.warn('   [loudnorm] could not parse pass-1 output; falling back to single-pass');
    execSync(
      `ffmpeg -y -i "${inputPath}" -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:v copy "${outputPath}"`,
      { cwd: PROJECT_ROOT, stdio: 'inherit' }
    );
    return;
  }
  const m = JSON.parse(measureOut.slice(jsonStart, jsonEnd + 1));
  console.log(`   [loudnorm] pass 2 (apply, measured_I=${m.input_i})...`);
  const applyFilter = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_LRA=${m.input_lra}:measured_TP=${m.input_tp}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  execSync(`ffmpeg -y -i "${inputPath}" -af "${applyFilter}" -c:v copy "${outputPath}"`, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });
}

// ─── CLI Args ───────────────────────────────────────────────────────────────

interface ParsedArgs {
  date: Date;
  shortNumber: number | null;
  dryRun: boolean;
  forceFormula: HookFormula | 'both' | null;
  useWinner: boolean;
  topic: string | null;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let date = new Date();
  let shortNumber: number | null = null;
  let dryRun = false;
  let forceFormula: HookFormula | 'both' | null = null;
  let useWinner = true;
  let topic: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      date = new Date(args[i + 1]);
      i++;
    } else if (args[i] === '--short' && args[i + 1]) {
      shortNumber = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--force-formula' && args[i + 1]) {
      const v = args[i + 1];
      if (
        v === 'specific_stat' ||
        v === 'wrong_answer_first' ||
        v === 'company_dramatic' ||
        v === 'both'
      ) {
        forceFormula = v;
      } else {
        throw new Error(`Unknown --force-formula value: ${v}`);
      }
      i++;
    } else if (args[i] === '--no-winner') {
      useWinner = false;
    } else if (args[i] === '--topic' && args[i + 1]) {
      // Feature 002: per-call override of the niche-down topic lock.
      topic = args[i + 1];
      i++;
    }
  }

  return { date, shortNumber, dryRun, forceFormula, useWinner, topic };
}

// Pick the set of formulas to render based on flags + persisted analytics.
function resolveFormulas(opts: {
  forceFormula: HookFormula | 'both' | null;
  useWinner: boolean;
}): HookFormula[] {
  if (opts.forceFormula && opts.forceFormula !== 'both') {
    return [opts.forceFormula];
  }
  if (opts.forceFormula === 'both') {
    return ['specific_stat', 'wrong_answer_first'];
  }
  if (opts.useWinner) {
    const variantDir = path.join(PROJECT_ROOT, 'data', 'variants');
    const analyticsDir = path.join(PROJECT_ROOT, 'data', 'analytics');
    const pairs = readPairedComparisons(variantDir, analyticsDir);
    const winner = pickWinningFormula(pairs);
    if (winner) return [winner];
  }
  return ['specific_stat', 'wrong_answer_first'];
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { date, shortNumber: explicitShort, dryRun, forceFormula, useWinner, topic } = parseArgs();

  // Determine which quiz to render.
  // Feature 002: when no explicit --short index is given, `topic` (CLI flag)
  // takes precedence over the QUIZ_TOPIC_LOCK env / default lock-date logic.
  const quiz =
    explicitShort !== null ? getQuizByIndex(explicitShort) : getDailyQuiz(date, topic ?? undefined);
  if (explicitShort === null) {
    console.log(
      `Topic filter (resolved): ${quiz.topic} (CLI=${topic ?? '-'}, env=${process.env.QUIZ_TOPIC_LOCK ?? '-'})`
    );
  }

  // Build a stable ID for file naming
  const quizIndex =
    explicitShort !== null
      ? explicitShort % QUIZ_BANK.length
      : (() => {
          const startOfYear = new Date(date.getFullYear(), 0, 0);
          const diff = date.getTime() - startOfYear.getTime();
          return Math.floor(diff / (1000 * 60 * 60 * 24)) % QUIZ_BANK.length;
        })();
  const episodeId = `${quiz.topic}-quiz-${quizIndex}`;

  // Feature 001 (A/B): pick which hook formulas to render.
  const formulas = resolveFormulas({ forceFormula, useWinner });

  console.log(`\n=== Daily Quiz Short ===`);
  console.log(`Date:     ${date.toISOString().slice(0, 10)}`);
  console.log(`Topic:    ${quiz.topic}`);
  console.log(`Index:    ${quizIndex} / ${QUIZ_BANK.length - 1}`);
  console.log(`Title:    ${quiz.title}`);
  console.log(`Question: ${quiz.question}`);
  console.log(`Formulas: ${formulas.join(', ')}`);

  if (dryRun) {
    console.log(`\n--- Spoken Hook (shared) ---\n${quiz.spokenHook}`);
    console.log(`\nWould render ${formulas.length} variant(s): ${formulas.join(', ')}`);
    for (const f of formulas) {
      const { hookText } = applyHook(quiz, f);
      console.log(`\n--- Hook [${f}] ---\n${hookText}`);
    }
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
  // v3: extended narration to fill the 120s baseline composition. Bridge
  // sentences are added at phase boundaries so TTS aligns with visual
  // beats (code panel, worked example, twist). If the quiz has a codeSnippet
  // we also speak its caption to anchor the panel.
  console.log('\n[1/4] Generating TTS audio...');
  // v3.1: Phase-aligned narration. Order matches QuizShort.tsx phase order:
  //   HOOK 0-3.5s | QUESTION 3.5-13s | FLASH 13-13.5s | CODE 14-30s |
  //   EXPLAIN 30-80s | EXAMPLE 80-110s | LOOP 110-116s | END 116-120s.
  // Quizzes can override CODE/EXAMPLE/END with hand-written spokenCode /
  // spokenExample / spokenCTA. Otherwise we derive sensible defaults.
  const narrationParts = [
    quiz.spokenHook, // ~3s hook
    '', // pause
    quiz.question, // ~5s question
    'Take a moment. Think about it.', // ~3s pause
    '',
    // CODE phase narration — ~16s
    quiz.spokenCode ?? deriveSpokenCode(quiz),
    '',
    // EXPLAIN phase narration — ~50s (this is the main content)
    quiz.explanation,
    // Repeat the key insight for emphasis (fills more time, helps retention)
    `Let me say that again. ${extractKeyInsight(quiz.explanation)}`,
    '',
    // WORKED EXAMPLE phase — ~30s
    quiz.spokenExample ?? deriveSpokenExample(quiz),
    '',
    // LOOP TRIGGER — ~6s
    `But wait. ${quiz.twist}`,
    // END CTA — ~4s
    quiz.spokenCTA ??
      `${quiz.endQuestion}. Drop your answer in the comments and check out the full course at www dot guru dash sishya dot in.`,
  ];
  const fullNarration = narrationParts.filter(Boolean).join(' ');

  const audioResults = await generateSceneAudios(
    [{ narration: fullNarration, type: 'text' }],
    'en-IN-PrabhatNeural',
    'indian-english',
    { text: '+10%' }
  );

  // ── Step 2: Build storyboard (for audio stitching only) ──
  console.log('[2/4] Building storyboard...');
  // v3: default to 120s baseline (composition enforces minimum via metadata).
  const audioDuration = audioResults[0]?.duration ?? 120;

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
  // BGM is set directly inside QuizShort.tsx (study-pad.mp3) — storyboard.bgmFile
  // is unused by the QuizShort composition; do not set it here.
  const storyboard = generateStoryboard([quizScene], audioResults, {
    topic: quiz.topic,
    sessionNumber: quizIndex,
    fps: 30,
    width: 1080,
    height: 1920,
    format: 'vertical',
  });

  // ── Step 3: Per-formula render loop ──
  // Audio + wordTimestamps are SHARED across formulas (spokenHook is identical
  // for all variants — only on-screen hook text differs). This keeps the second
  // render fast because Remotion + the TTS cache reuse the same audio file.
  console.log(`[3/4] Rendering ${formulas.length} variant(s)...`);
  for (let i = 0; i < formulas.length; i++) {
    const formula = formulas[i];
    const variantLabel = formulas.length === 1 ? '' : i === 0 ? '-variantA' : '-variantB';
    const variantId = `${episodeId}${variantLabel}`;
    console.log(`\n  -- Variant ${variantLabel || '(single)'} | ${formula} --`);

    const propsPath = path.join(PROPS_DIR, `daily-short-${variantId}.json`);
    const propsData = {
      quiz,
      audioFile: storyboard.audioFile ? path.basename(storyboard.audioFile) : undefined,
      audioDurationSec: audioDuration,
      wordTimestamps,
      hookFormula: formula,
    };
    fs.writeFileSync(propsPath, JSON.stringify(propsData, null, 2));
    console.log(`   Props: ${propsPath}`);

    const outputPath = path.join(OUTPUT_DIR, `${variantId}.mp4`);
    const renderCmd = [
      'npx',
      'remotion',
      'render',
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

    // Two-pass loudness normalize to -14 LUFS
    const normalizedPath = outputPath.replace(/\.mp4$/, '-normalized.mp4');
    try {
      loudnormPass(outputPath, normalizedPath);
      fs.renameSync(normalizedPath, outputPath);
      console.log(`   ✓ Loudness normalized to -14 LUFS`);
    } catch (err) {
      console.warn(`   [warn] loudnorm failed: ${String(err).slice(0, 100)} — keeping original`);
    }

    // Export thumbnail per variant (uses same formula so frame matches)
    const thumbnailPath = path.join(OUTPUT_DIR, `${variantId}-thumbnail.jpg`);
    const thumbCmd = [
      'npx',
      'remotion',
      'still',
      'src/compositions/index.tsx',
      'QuizThumbnail',
      thumbnailPath,
      `--props=${propsPath}`,
      '--frame=0',
      '--image-format=jpeg',
      '--jpeg-quality=92',
    ].join(' ');
    try {
      execSync(thumbCmd, { stdio: 'inherit', cwd: PROJECT_ROOT });
      console.log(`   Thumbnail: ${thumbnailPath}`);
    } catch {
      console.warn(`   [warn] thumbnail export failed; YouTube will auto-pick`);
    }

    // Write a "partial" variant record alongside the upload artifacts. The
    // upload-youtube.ts step fills in videoId + uploadedAt after upload.
    const partialDir = path.join(PROJECT_ROOT, 'data', 'variants');
    fs.mkdirSync(partialDir, { recursive: true });
    const partialPath = path.join(partialDir, `${variantId}.partial.json`);
    fs.writeFileSync(
      partialPath,
      JSON.stringify(
        {
          quizIndex,
          variant: formulas.length === 1 ? 'A' : i === 0 ? 'A' : 'B',
          hookFormula: formula,
          // siblingVideoId is filled in by the upload step once both ids exist.
        },
        null,
        2
      )
    );
    console.log(`   Variant partial: ${partialPath}`);
  }

  // For downstream metadata (single output path used by callers expecting the
  // legacy layout): use the first variant's MP4 as the canonical output.
  const firstVariantLabel = formulas.length === 1 ? '' : '-variantA';
  const outputPath = path.join(OUTPUT_DIR, `${episodeId}${firstVariantLabel}.mp4`);

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
        `📌 The answer: ${String.fromCharCode(65 + quiz.correctIndex)} — ${quiz.options[quiz.correctIndex]}`,
        '',
        '🧠 WHY THIS MATTERS',
        quiz.explanation,
        '',
        '⚡ THE TWIST',
        quiz.twist,
        '',
        `💬 ${quiz.endQuestion}`,
        '',
        '🎓 FULL SYSTEM DESIGN COURSE',
        'Master Kafka, Load Balancers, API Gateways, Databases and more:',
        'https://guru-sishya.in',
        '',
        '📺 RELATED VIDEOS',
        '• System Design Interview Playlist',
        '• Kafka Deep Dive Series',
        '• Free Course: Distributed Systems',
        '',
        '🔔 Subscribe for daily system design Shorts.',
        '',
        `#systemdesign #${quiz.topic.replace(/-/g, '')} #codinginterview #softwareengineer #techinterview #backend #distributedsystems`,
      ].join('\n'),
      tags: buildTags(quiz.topic),
      categoryId: '28', // Science & Technology (per optimal_schedule memory)
    },
  };

  const descriptionWords = metadata.youtube.description.split(/\s+/).filter(Boolean).length;
  if (descriptionWords < 150) {
    console.warn(
      `   [warn] description is ${descriptionWords} words (<150). Quiz "${quiz.title}" has short explanation/twist — consider expanding.`
    );
  }

  const metadataPath = path.join(OUTPUT_DIR, `${episodeId}-metadata.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`   Metadata: ${metadataPath} (${descriptionWords} words)`);

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
