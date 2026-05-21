#!/usr/bin/env npx tsx
/**
 * Render an opinion-piece episode to long-form + 60s Short MP4s.
 *
 * Usage:
 *   npx tsx scripts/render-opinion-piece.ts <slug> [--skip-render] [--no-preview]
 *
 * Example:
 *   npx tsx scripts/render-opinion-piece.ts 001-microservices-vs-monolith
 *
 * Pipeline:
 *   1. Parse content/opinions/<slug>.md → OpinionPiece
 *   2. Generate per-section TTS audio via en-IN-PrabhatNeural
 *   3. Write long-props.json + short-props.json + metadata.json under output/opinions/<slug>/
 *   4. Render OpinionLong (30s preview first per Constitution VII, then full)
 *   5. Render OpinionShort full
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  parseOpinionPiece,
  buildNarrationPlan,
  type OpinionPiece,
  type OpinionNarrationScene,
} from '../src/lib/opinion-piece-parser';
import { generateSceneAudios } from '../src/pipeline/tts-engine';
import type { TTSResult } from '../src/types';
import type { OpinionLongProps, OpinionSceneAudio } from '../src/compositions/OpinionLong';
import type { OpinionShortProps } from '../src/compositions/OpinionShort';

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CONTENT_DIR = path.join(ROOT, 'content', 'opinions');
const OUTPUT_DIR = path.join(ROOT, 'output', 'opinions');

interface CliArgs {
  slug: string;
  skipRender: boolean;
  noPreview: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  // Accept either positional slug OR `--episode <slug>`
  const epIdx = argv.indexOf('--episode');
  let slug: string | undefined;
  if (epIdx > -1) {
    slug = argv[epIdx + 1];
  } else {
    const positional = argv.filter((a) => !a.startsWith('--'));
    slug = positional[0];
  }
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  if (!slug) {
    console.error('Usage: render-opinion-piece.ts <slug>|--episode <slug> [--skip-render] [--no-preview]');
    process.exit(2);
  }
  return {
    slug,
    skipRender: flags.has('--skip-render'),
    noPreview: flags.has('--no-preview'),
  };
}

/** Convert an absolute audio path (typically under public/audio/) to a path
 * relative to `public/`, suitable for `staticFile()`. Falls back to absolute
 * path if the audio lives outside `public/`. */
function toPublicRelative(absPath: string): string {
  if (!absPath) return '';
  const norm = path.resolve(absPath);
  if (norm.startsWith(PUBLIC_DIR + path.sep)) {
    return norm.slice(PUBLIC_DIR.length + 1).split(path.sep).join('/');
  }
  return absPath;
}

function buildLongProps(
  opinion: OpinionPiece,
  audios: TTSResult[],
  plan: OpinionNarrationScene[]
): OpinionLongProps {
  const sceneAudios: OpinionSceneAudio[] = plan.map((p, i) => ({
    type: p.type as OpinionSceneAudio['type'],
    audioFile: toPublicRelative(audios[i]?.audioPath || ''),
    duration: audios[i]?.duration || 0,
  }));
  return {
    opinion,
    sceneAudios,
    bgmFile: 'audio/bgm/gentle-drone.mp3',
  };
}

function buildShortProps(
  opinion: OpinionPiece,
  hookAudio: TTSResult
): OpinionShortProps {
  const firstNowLine = opinion.thenNow.nowLines[0] || opinion.thenNow.thenLines[0] || '';
  return {
    hookText: opinion.hook,
    thenNowFirstLine: firstNowLine,
    audio: {
      audioFile: toPublicRelative(hookAudio?.audioPath || ''),
      duration: hookAudio?.duration || 60,
    },
  };
}

interface MetadataSidecar {
  slug: string;
  title: string;
  description: string;
  publishDate: string;
  chapters: { start: number; label: string }[];
  thumbnailText: string;
  durations: { long: number; short: number };
}

function buildMetadata(
  opinion: OpinionPiece,
  longProps: OpinionLongProps,
  shortDurationSec: number
): MetadataSidecar {
  // Chapter labels mirror SECTION_LABEL inside OpinionLong
  const LABELS: Record<OpinionSceneAudio['type'], string> = {
    hook: 'Hook',
    'then-now': '1995 vs 2026',
    pros: 'The Pros',
    cons: 'The Reality',
    pivot: 'The Real Question',
    lesson: 'The Lesson',
    question: 'Your Turn',
  };
  let acc = 0;
  const chapters: { start: number; label: string }[] = [];
  for (const s of longProps.sceneAudios) {
    chapters.push({ start: Math.round(acc), label: LABELS[s.type] });
    acc += s.duration;
  }
  const totalSec = chapters.length ? Math.round(acc) : opinion.durationSec;

  const description = [
    opinion.hook,
    '',
    'Chapters:',
    ...chapters.map((c) => `${formatHMS(c.start)} ${c.label}`),
    '',
    `Subscribe for weekly opinion pieces on software engineering and leadership.`,
  ].join('\n');

  return {
    slug: opinion.slug,
    title: opinion.title,
    description,
    publishDate: opinion.publishDate,
    chapters,
    thumbnailText: opinion.title,
    durations: { long: totalSec, short: Math.round(shortDurationSec) },
  };
}

function formatHMS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function runRemotionRender(opts: {
  compositionId: string;
  propsPath: string;
  outputPath: string;
  frames?: string;
  concurrency?: number;
}): void {
  const { compositionId, propsPath, outputPath, frames, concurrency = 4 } = opts;
  const args = [
    'npx',
    'remotion',
    'render',
    'src/compositions/index.tsx',
    compositionId,
    outputPath,
    `--props=${propsPath}`,
    `--concurrency=${concurrency}`,
  ];
  if (frames) args.push(`--frames=${frames}`);
  const cmd = args.join(' ');
  console.log(`\n  $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

function runRemotionStill(opts: {
  compositionId: string;
  propsPath: string;
  outputPath: string;
  frame?: number;
  jpegQuality?: number;
}): void {
  const { compositionId, propsPath, outputPath, frame = 0, jpegQuality = 92 } = opts;
  const args = [
    'npx',
    'remotion',
    'still',
    'src/compositions/index.tsx',
    compositionId,
    outputPath,
    `--props=${propsPath}`,
    `--frame=${frame}`,
    '--image-format=jpeg',
    `--jpeg-quality=${jpegQuality}`,
  ];
  const cmd = args.join(' ');
  console.log(`\n  $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

// ─── YouTube uploader-compatible metadata ────────────────────────────────

/** Convert seconds → HH:MM:SS (first chapter at 00:00:00). */
function formatHHMMSS(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Derive simple tags from the title when frontmatter lacks them. */
function deriveTags(opinion: OpinionPiece): string[] {
  const base = [
    'opinion',
    'software engineering',
    'engineering leadership',
    'tech leadership',
    'architecture',
  ];
  const titleWords = opinion.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !['that', 'this', 'with', 'from', 'your', 'are', 'and', 'the'].includes(w));
  const merged = Array.from(new Set([...base, ...titleWords]));
  return merged.slice(0, 20);
}

interface YoutubeMetadataFile {
  youtube: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    chapters: string;
    playlistTitle?: string;
  };
  thumbnailText?: string;
}

function buildLongYoutubeMetadata(
  opinion: OpinionPiece,
  longProps: OpinionLongProps,
  body: string
): YoutubeMetadataFile {
  const LABELS: Record<OpinionSceneAudio['type'], string> = {
    hook: 'Hook',
    'then-now': '1995 vs 2026',
    pros: 'The Pros',
    cons: 'The Reality',
    pivot: 'The Real Question',
    lesson: 'The Lesson',
    question: 'Your Turn',
  };

  // Chapter markers: respect "first at 0:00, subsequent ≥10s gap"
  let acc = 0;
  const rawChapters: { start: number; label: string }[] = [];
  for (const s of longProps.sceneAudios) {
    rawChapters.push({ start: Math.round(acc), label: LABELS[s.type] });
    acc += s.duration;
  }
  const chapters: { start: number; label: string }[] = [];
  for (const c of rawChapters) {
    if (chapters.length === 0) {
      chapters.push({ start: 0, label: c.label });
    } else {
      const prev = chapters[chapters.length - 1];
      if (c.start - prev.start >= 10) chapters.push(c);
    }
  }

  const chaptersText = chapters.map((c) => `${formatHHMMSS(c.start)} ${c.label}`).join('\n');

  // Description: first 4500 chars of essay body + brand CTA + chapters
  const essaySnippet = body.trim().slice(0, 4500);
  const cta =
    'Subscribe for weekly opinion pieces on software engineering and leadership.\n' +
    'New episode every Sunday.';
  const description = [
    opinion.hook,
    '',
    essaySnippet,
    '',
    'Chapters:',
    chaptersText,
    '',
    cta,
  ].join('\n');

  return {
    youtube: {
      title: opinion.title,
      description,
      tags: deriveTags(opinion),
      categoryId: '28', // Science & Technology
      chapters: chaptersText,
      playlistTitle: 'Weekly Opinion Pieces',
    },
    thumbnailText: opinion.title,
  };
}

function buildShortYoutubeMetadata(opinion: OpinionPiece): YoutubeMetadataFile {
  const description = [
    opinion.hook,
    '',
    'Full episode on the channel — weekly opinion pieces on software engineering and leadership.',
    '',
    '#Shorts #engineering #leadership #tech',
  ].join('\n');
  return {
    youtube: {
      title: opinion.title,
      description,
      tags: deriveTags(opinion),
      categoryId: '28',
      chapters: '',
      playlistTitle: 'Weekly Opinion Pieces — Shorts',
    },
    thumbnailText: opinion.hook.slice(0, 40),
  };
}

// ─── main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const mdPath = path.join(CONTENT_DIR, `${args.slug}.md`);
  if (!fs.existsSync(mdPath)) {
    console.error(`Markdown not found: ${mdPath}`);
    process.exit(1);
  }

  console.log(`\n[opinion-piece] Episode ${args.slug}`);
  console.log(`  source: ${mdPath}`);

  // Step 1 — parse
  const md = fs.readFileSync(mdPath, 'utf-8');
  const opinion = parseOpinionPiece(md, args.slug);
  console.log(`  title : ${opinion.title}`);
  console.log(`  sections: hook + then-now + ${opinion.pros.length} pros + ${opinion.cons.length} cons + pivot + lesson${opinion.question ? ' + question' : ''}`);

  // Step 2 — narration plan + TTS
  const plan = buildNarrationPlan(opinion);
  console.log(`\n[opinion-piece] Generating TTS for ${plan.length} sections (en-IN-PrabhatNeural)...`);
  const audios = await generateSceneAudios(
    plan.map((p) => ({ narration: p.narration, type: p.type })),
    'en-IN-PrabhatNeural',
    'indian-english'
  );
  const totalLongSec = audios.reduce((s, a) => s + (a.duration || 0), 0);
  console.log(`  long-form narration total : ${totalLongSec.toFixed(1)}s (${(totalLongSec / 60).toFixed(1)} min)`);

  // Strip frontmatter once to get the body essay text used in description.
  const essayBody = md.replace(/^---[\s\S]*?\n---\s*\n/, '').trim();

  // Step 3 — write props + metadata
  const outDir = path.join(OUTPUT_DIR, args.slug);
  ensureDir(outDir);

  const longProps = buildLongProps(opinion, audios, plan);
  const shortProps = buildShortProps(opinion, audios[0]);
  const metadata = buildMetadata(opinion, longProps, shortProps.audio.duration);

  // Thumbnail props (OpinionThumbnail expects { title, slug })
  const thumbnailProps = { title: opinion.title, slug: opinion.slug };

  // Per-output YouTube uploader-compatible metadata
  const longYoutubeMeta = buildLongYoutubeMetadata(opinion, longProps, essayBody);
  const shortYoutubeMeta = buildShortYoutubeMetadata(opinion);

  const longPropsPath = path.join(outDir, 'long-props.json');
  const shortPropsPath = path.join(outDir, 'short-props.json');
  const thumbPropsPath = path.join(outDir, 'thumbnail-props.json');
  const metadataPath = path.join(outDir, 'metadata.json');
  const longMetaPath = path.join(outDir, 'long-metadata.json');
  const shortMetaPath = path.join(outDir, 'short-metadata.json');

  fs.writeFileSync(longPropsPath, JSON.stringify(longProps, null, 2));
  fs.writeFileSync(shortPropsPath, JSON.stringify(shortProps, null, 2));
  fs.writeFileSync(thumbPropsPath, JSON.stringify(thumbnailProps, null, 2));
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  fs.writeFileSync(longMetaPath, JSON.stringify(longYoutubeMeta, null, 2));
  fs.writeFileSync(shortMetaPath, JSON.stringify(shortYoutubeMeta, null, 2));
  console.log(`\n  wrote ${path.relative(ROOT, longPropsPath)}`);
  console.log(`  wrote ${path.relative(ROOT, shortPropsPath)}`);
  console.log(`  wrote ${path.relative(ROOT, thumbPropsPath)}`);
  console.log(`  wrote ${path.relative(ROOT, metadataPath)}`);
  console.log(`  wrote ${path.relative(ROOT, longMetaPath)}`);
  console.log(`  wrote ${path.relative(ROOT, shortMetaPath)}`);

  if (args.skipRender) {
    console.log('\n[opinion-piece] --skip-render → exiting before render step');
    return;
  }

  // Step 4 — long-form preview (Constitution VII)
  const longOut = path.join(outDir, 'long.mp4');
  const previewOut = path.join(outDir, 'long-preview.mp4');

  if (!args.noPreview) {
    console.log('\n[opinion-piece] Rendering 30s preview (Constitution VII)…');
    runRemotionRender({
      compositionId: 'OpinionLong',
      propsPath: longPropsPath,
      outputPath: previewOut,
      frames: '0-900',
    });
    console.log(`  preview → ${path.relative(ROOT, previewOut)}`);
  }

  // Step 5 — full long-form render
  console.log('\n[opinion-piece] Rendering full long-form…');
  runRemotionRender({
    compositionId: 'OpinionLong',
    propsPath: longPropsPath,
    outputPath: longOut,
  });
  console.log(`  long → ${path.relative(ROOT, longOut)}`);

  // Step 6 — short render
  const shortOut = path.join(outDir, 'short.mp4');
  console.log('\n[opinion-piece] Rendering Short…');
  runRemotionRender({
    compositionId: 'OpinionShort',
    propsPath: shortPropsPath,
    outputPath: shortOut,
  });
  console.log(`  short → ${path.relative(ROOT, shortOut)}`);

  // Step 7 — long-form thumbnail still (1280x720 JPEG)
  const longThumbOut = path.join(outDir, 'long-thumbnail.jpg');
  console.log('\n[opinion-piece] Rendering long-form thumbnail still…');
  runRemotionStill({
    compositionId: 'OpinionThumbnail',
    propsPath: thumbPropsPath,
    outputPath: longThumbOut,
    frame: 0,
    jpegQuality: 92,
  });
  console.log(`  long thumbnail → ${path.relative(ROOT, longThumbOut)}`);

  // Step 8 — short thumbnail still (extracted from OpinionShort frame 30)
  const shortThumbOut = path.join(outDir, 'short-thumbnail.jpg');
  console.log('\n[opinion-piece] Rendering Short thumbnail still…');
  try {
    runRemotionStill({
      compositionId: 'OpinionShort',
      propsPath: shortPropsPath,
      outputPath: shortThumbOut,
      frame: 30,
      jpegQuality: 92,
    });
    console.log(`  short thumbnail → ${path.relative(ROOT, shortThumbOut)}`);
  } catch (e) {
    console.warn(`  short thumbnail skipped: ${(e as Error).message}`);
  }

  console.log('\n[opinion-piece] DONE.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
