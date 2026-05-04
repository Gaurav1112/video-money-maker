#!/usr/bin/env npx tsx
/**
 * render-hinglish-audio.ts
 *
 * Renders Hinglish-VO audio for a given topic/session by rewriting the
 * original English narration via rule-based Hinglish transform and
 * synthesizing it with Edge TTS (hi-IN-MadhurNeural voice).
 *
 * Usage:
 *   npx tsx scripts/render-hinglish-audio.ts \
 *     --topic <slug> --session <N> --output-dir <dir>
 *
 * Outputs:
 *   <output-dir>/<topic>/session-<N>/audio-hi.mp3    (full concat)
 *   <output-dir>/<topic>/session-<N>/scenes/scene-<NN>-hi.mp3  (per scene)
 *
 * Determinism:
 *   Each scene mp3 is run through ffmpeg with -map_metadata -1
 *   -fflags +bitexact -flags:a +bitexact to strip any variable
 *   timestamp metadata that edge-tts may embed.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

import {
  renderDualTrack,
  type SessionInput,
} from '../src/pipeline/dual-track-orchestrator.js';

// ─── Types ────────────────────────────────────────────────────────────────

interface PublishEntry {
  id: string;
  topic: string;
  session: number;
  files: {
    video: string;
    metadata: string;
    thumbnail?: string;
  };
  [key: string]: unknown;
}

interface PublishQueue {
  entries: PublishEntry[];
  [key: string]: unknown;
}

interface SceneRecord {
  narration: string;
  sceneIndex?: number;
  [key: string]: unknown;
}

interface MetadataJson {
  scenes?: SceneRecord[];
  slug?: string;
  topic?: string;
  [key: string]: unknown;
}

// ─── Config ───────────────────────────────────────────────────────────────

const QUEUE_PATH = path.resolve(__dirname, '..', 'config', 'publish-queue.json');
const OUTPUT_ROOT = path.resolve(__dirname, '..', 'output');

// ─── Helpers ──────────────────────────────────────────────────────────────

function parseArgs(): { topic: string; session: number; outputDir: string } {
  const args = process.argv.slice(2);

  function getArg(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : undefined;
  }

  const topic = getArg('topic');
  const sessionStr = getArg('session');
  const outputDir = getArg('output-dir');

  if (!topic || !sessionStr || !outputDir) {
    console.error('Usage: render-hinglish-audio.ts --topic <slug> --session <N> --output-dir <dir>');
    process.exit(1);
  }

  const session = parseInt(sessionStr, 10);
  if (isNaN(session) || session < 1) {
    console.error('--session must be a positive integer');
    process.exit(1);
  }

  return { topic, session, outputDir };
}

/**
 * Strip variable-metadata from an mp3 to guarantee byte-determinism.
 * Writes a cleaned copy over the same path.
 */
function stripMp3Metadata(filePath: string): void {
  const tmpPath = `${filePath}.clean.mp3`;
  try {
    execFileSync('ffmpeg', [
      '-y',
      '-i', filePath,
      '-map_metadata', '-1',
      '-fflags', '+bitexact',
      '-flags:a', '+bitexact',
      '-c:a', 'copy',
      tmpPath,
    ], { stdio: 'pipe' });
    fs.renameSync(tmpPath, filePath);
  } catch {
    // If ffmpeg not available or fails, leave file as-is (non-fatal)
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { topic, session, outputDir } = parseArgs();

  // 1. Load queue to find entry
  if (!fs.existsSync(QUEUE_PATH)) {
    console.error(`[render-hinglish-audio] queue not found: ${QUEUE_PATH}`);
    process.exit(1);
  }
  const queue: PublishQueue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));

  const entry = queue.entries.find(
    (e) => e.topic === topic && Number(e.session) === session,
  );

  if (!entry) {
    console.error(`[render-hinglish-audio] entry not found: topic=${topic} session=${session}`);
    process.exit(1);
  }

  // 2. Resolve metadata path and load scenes
  const metadataPath = path.join(OUTPUT_ROOT, entry.files.metadata);
  if (!fs.existsSync(metadataPath)) {
    console.error(`[render-hinglish-audio] metadata not found: ${metadataPath}`);
    process.exit(1);
  }

  const metadata: MetadataJson = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  if (!metadata.scenes || !Array.isArray(metadata.scenes) || metadata.scenes.length === 0) {
    console.error(`[render-hinglish-audio] metadata at ${metadataPath} has no scenes`);
    process.exit(1);
  }

  console.error(`[render-hinglish-audio] loaded ${metadata.scenes.length} scenes from ${metadataPath}`);

  // 3. Build SessionInput
  const sessionInput: SessionInput = {
    topic,
    sessionId: session,
    scenes: metadata.scenes.map((s) => ({ ...s })),
  };

  // 4. Render Hinglish track only via the dual-track orchestrator
  console.error(`[render-hinglish-audio] rendering Hinglish audio for ${topic} session-${session}…`);

  const result = await renderDualTrack(sessionInput, {
    outputBaseDir: outputDir,
    renderEnglish: false,
  });

  const audioHiPath = result.hinglish.audioPath;
  console.error(`[render-hinglish-audio] concat → ${audioHiPath}`);

  // 5. Strip variable metadata from concat file for byte-determinism
  stripMp3Metadata(audioHiPath);

  // 6. Copy per-scene files to canonical scenes/ directory
  const sessionOutputDir = path.dirname(audioHiPath);
  const scenesDir = path.join(sessionOutputDir, 'scenes');
  fs.mkdirSync(scenesDir, { recursive: true });

  for (let i = 0; i < result.hinglish.scenePaths.length; i++) {
    const src = result.hinglish.scenePaths[i];
    const padded = String(i).padStart(2, '0');
    const dst = path.join(scenesDir, `scene-${padded}-hi.mp3`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      stripMp3Metadata(dst);
      console.error(`[render-hinglish-audio]   scene-${padded}-hi.mp3 ← ${src}`);
    }
  }

  // 7. Verify output is non-empty via ffprobe
  try {
    const duration = execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      audioHiPath,
    ]).toString().trim();
    const durationSec = parseFloat(duration);
    if (isNaN(durationSec) || durationSec <= 0) {
      console.error(`[render-hinglish-audio] ❌ output duration is zero or NaN: ${duration}`);
      process.exit(1);
    }
    console.error(`[render-hinglish-audio] ✅ audio duration: ${durationSec.toFixed(2)}s`);
  } catch {
    console.error('[render-hinglish-audio] ⚠️  ffprobe not available — skipping duration check');
  }

  console.log(`audio_path=${audioHiPath}`);
}

// Only run when executed as the entry-point script (not when imported by tests)
const _argv1 = process.argv[1] ?? '';
if (_argv1.endsWith('render-hinglish-audio.ts') || _argv1.endsWith('render-hinglish-audio.js')) {
  main().catch((err) => {
    console.error(`[render-hinglish-audio] fatal: ${(err as Error).message}`);
    process.exit(1);
  });
}
