/**
 * Lightweight TTS service.
 *
 * Default engine: Microsoft Edge-TTS (free, unlimited, Indian-English voices)
 * via the `python -m edge_tts` subprocess. Picked because:
 *   • zero quota / zero API key
 *   • en-IN-NeerjaNeural is excellent for Hinglish dev-edu narration
 *   • outputs streaming mp3 directly to disk
 *
 * Optional engine: ElevenLabs — used when ELEVENLABS_API_KEY is set AND
 *   USE_ELEVENLABS=1. Not the default because the free tier (10k chars/mo)
 *   is too small to ship daily Shorts.
 *
 * Determinism: outputs are content-addressed by SHA256(engine|voice|rate|text)
 * and cached under TTS_CACHE_DIR (default: assets/tts-cache/). Identical
 * inputs ⇒ byte-identical output across runs and CI machines.
 *
 * Public API:
 *   await synthesize({ text, outPath })  → { durationSec }
 */

import { execFile } from 'node:child_process';
import { existsSync, copyFileSync, mkdirSync, writeFileSync, createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { FFMPEG_BIN, FFPROBE_BIN } from '../lib/ffmpeg-bin.js';
import * as path from 'node:path';

const execFileP = promisify(execFile);

export interface TtsOptions {
  text: string;
  outPath: string;
  /** Rate adjust as percentage offset, e.g. "+5%" speeds up, "-10%" slows. */
  rate?: string;
  /** Edge-TTS voice id; defaults to en-IN-NeerjaNeural (female Indian). */
  voice?: string;
}

const DEFAULT_VOICE = process.env['TTS_VOICE'] ?? 'en-IN-NeerjaNeural';
const CACHE_DIR =
  process.env['TTS_CACHE_DIR'] ??
  path.join(process.cwd(), 'assets', 'tts-cache');

/**
 * Synthesises `text` to mp3 at `outPath`. Returns audio duration in seconds.
 * Throws on failure (no silent fallback — caller must decide).
 */
export async function synthesize(opts: TtsOptions): Promise<{ durationSec: number }> {
  const { text, outPath } = opts;
  if (!text || !text.trim()) {
    throw new Error('synthesize: empty text');
  }

  const useElevenLabs =
    process.env['USE_ELEVENLABS'] === '1' && !!process.env['ELEVENLABS_API_KEY'];
  const engine = useElevenLabs ? 'elevenlabs' : 'edge';
  const voice = opts.voice ?? DEFAULT_VOICE;
  const rate = opts.rate ?? '';

  const cacheKey = createHash('sha256')
    .update(`${engine}|${voice}|${rate}|${text}`)
    .digest('hex');
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.mp3`);

  if (existsSync(cachePath)) {
    copyFileSync(cachePath, outPath);
  } else {
    if (useElevenLabs) {
      await synthesizeElevenLabs({ ...opts, outPath: cachePath });
    } else {
      await synthesizeEdge({ ...opts, outPath: cachePath });
    }
    if (!existsSync(cachePath)) {
      throw new Error(`TTS produced no output at ${cachePath}`);
    }
    copyFileSync(cachePath, outPath);
  }

  const durationSec = await probeDurationSec(outPath);
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new Error(`TTS output has invalid duration: ${durationSec}`);
  }
  return { durationSec };
}

async function synthesizeEdge(opts: TtsOptions): Promise<void> {
  const voice = opts.voice ?? DEFAULT_VOICE;
  const args = [
    '-m', 'edge_tts',
    '-v', voice,
    '-t', opts.text,
    '--write-media', opts.outPath,
  ];
  if (opts.rate) {
    args.push('--rate', opts.rate);
  }
  await execFileP('python3', args, { maxBuffer: 16 * 1024 * 1024 });
}

interface ElevenLabsErrorBody {
  detail?: { status?: string; message?: string } | string;
}

async function synthesizeElevenLabs(opts: TtsOptions): Promise<void> {
  const apiKey = process.env['ELEVENLABS_API_KEY']!;
  // Default: Sarah (mature, reassuring) — replace with cloned voice when
  // upgraded.
  const voiceId = process.env['ELEVENLABS_VOICE_ID'] ?? 'EXAVITQu4vr4xnSDxMaL';
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: opts.text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let parsed: ElevenLabsErrorBody | undefined;
    try { parsed = JSON.parse(text) as ElevenLabsErrorBody; } catch { /* non-json */ }
    const detail = typeof parsed?.detail === 'object'
      ? (parsed.detail.message ?? parsed.detail.status ?? text)
      : (parsed?.detail ?? text);
    throw new Error(`ElevenLabs ${res.status}: ${String(detail).slice(0, 200)}`);
  }
  const ab = await res.arrayBuffer();
  writeFileSync(opts.outPath, Buffer.from(ab));
}

async function probeDurationSec(path: string): Promise<number> {
  const { stdout } = await execFileP(FFPROBE_BIN, [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    path,
  ]);
  return parseFloat(stdout.trim());
}

// Suppress unused-import warning when caller only uses synthesize.
void createReadStream;
