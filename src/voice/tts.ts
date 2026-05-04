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
import { existsSync, copyFileSync, mkdirSync, writeFileSync, createReadStream, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { FFMPEG_BIN, FFPROBE_BIN } from '../lib/ffmpeg-bin.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);
// Path to the bundled Python helper that calls edge-tts with WordBoundary
// events. Located alongside the repo's other build scripts. Resolved from
// this file so it works regardless of cwd.
const WRAPPER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts');

export interface TtsOptions {
  text: string;
  outPath: string;
  /** Rate adjust as percentage offset, e.g. "+5%" speeds up, "-10%" slows. */
  rate?: string;
  /** Edge-TTS voice id; defaults to en-IN-NeerjaNeural (female Indian). */
  voice?: string;
  /**
   * When true, capture word-level timestamps via Edge-TTS `--write-subtitles`
   * (or, for ElevenLabs, return undefined — the API doesn't expose word
   * boundaries on the v1 TTS endpoint without a separate alignment call).
   * Used by the karaoke caption pipeline.
   */
  wantSubtitles?: boolean;
}

export interface WordStamp {
  word: string;
  startMs: number;
  endMs: number;
}

const DEFAULT_VOICE = process.env['TTS_VOICE'] ?? 'en-IN-NeerjaNeural';
const CACHE_DIR =
  process.env['TTS_CACHE_DIR'] ??
  path.join(process.cwd(), 'assets', 'tts-cache');

/**
 * Synthesises `text` to mp3 at `outPath`. Returns audio duration in seconds
 * and (when `wantSubtitles`) a list of word-level timestamps suitable for
 * karaoke caption rendering.
 *
 * Throws on failure (no silent fallback — caller must decide).
 */
export async function synthesize(
  opts: TtsOptions,
): Promise<{ durationSec: number; wordTimestamps?: WordStamp[] }> {
  const { text, outPath } = opts;
  if (!text || !text.trim()) {
    throw new Error('synthesize: empty text');
  }

  const useElevenLabs =
    process.env['USE_ELEVENLABS'] === '1' && !!process.env['ELEVENLABS_API_KEY'];
  const engine = useElevenLabs ? 'elevenlabs' : 'edge';
  const voice = opts.voice ?? DEFAULT_VOICE;
  const rate = opts.rate ?? '';
  const wantSubs = !!opts.wantSubtitles && !useElevenLabs;

  const cacheKey = createHash('sha256')
    .update(`${engine}|${voice}|${rate}|${text}`)
    .digest('hex');
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.mp3`);
  const subsCachePath = path.join(CACHE_DIR, `${cacheKey}.words.json`);

  if (existsSync(cachePath)) {
    copyFileSync(cachePath, outPath);
  } else {
    if (useElevenLabs) {
      await synthesizeElevenLabs({ ...opts, outPath: cachePath });
    } else {
      await synthesizeEdge({ ...opts, outPath: cachePath }, wantSubs ? subsCachePath : undefined);
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

  let wordTimestamps: WordStamp[] | undefined;
  if (wantSubs && existsSync(subsCachePath)) {
    try {
      const raw = readFileSync(subsCachePath, 'utf8');
      const parsed = JSON.parse(raw) as WordStamp[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        wordTimestamps = parsed;
      }
    } catch (err) {
      // Subs are non-fatal — captions just won't render. Log and continue.
      console.warn(`[tts] failed to read words.json (${String(err).slice(0, 120)}); captions will skip`);
    }
  }

  return { durationSec, wordTimestamps };
}

async function synthesizeEdge(opts: TtsOptions, wordsJsonPath?: string): Promise<void> {
  const voice = opts.voice ?? DEFAULT_VOICE;
  const rate = opts.rate ?? '+0%';
  if (wordsJsonPath) {
    // Word-level boundaries require the Python streaming API (the
    // `python -m edge_tts` CLI only emits sentence-level SRT). We
    // shell out to scripts/edge-tts-words.py which uses
    // edge_tts.Communicate(boundary='WordBoundary') and writes both
    // the mp3 and a {word,startMs,endMs}[] JSON in a single call —
    // ensuring audio and timing data come from the *same* synthesis
    // pass (so they always agree byte-for-byte).
    const helper = path.join(WRAPPER_DIR, 'edge-tts-words.py');
    await execFileP(
      'python3',
      [
        helper,
        '--voice', voice,
        '--rate', rate,
        '--text', opts.text,
        '--out-audio', opts.outPath,
        '--out-words', wordsJsonPath,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    return;
  }
  const args = [
    '-m', 'edge_tts',
    '-v', voice,
    '-t', opts.text,
    '--write-media', opts.outPath,
    '--rate', rate,
  ];
  await execFileP('python3', args, { maxBuffer: 16 * 1024 * 1024 });
}

/**
 * Parses Edge-TTS WebVTT output into word-level timestamps.
 *
 * Edge-TTS emits cues like:
 *   00:00:00.100 --> 00:00:00.500
 *   <00:00:00.100><c> Hello</c><00:00:00.350><c> world</c>
 *
 * We extract every `<c>WORD</c>` block, paired with the timestamp tag
 * that immediately precedes it. End time of the last word in a cue is
 * the cue's end time; intermediate words end at the next word's start.
 */
export function parseEdgeTtsVtt(vtt: string): WordStamp[] {
  const out: WordStamp[] = [];
  const cueBlocks = vtt.split(/\r?\n\r?\n/);
  for (const block of cueBlocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const headerIdx = lines.findIndex((l) => /-->/i.test(l));
    if (headerIdx < 0) continue;
    const header = lines[headerIdx]!;
    const m = header.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (!m) continue;
    const cueEndMs = vttTsToMs(m[2]!);
    const body = lines.slice(headerIdx + 1).join(' ');
    // Tokens: alternating <ts><c>word</c><ts><c>word</c>...
    const re = /<(\d{2}:\d{2}:\d{2}\.\d{3})>\s*<c>\s*([^<]+?)\s*<\/c>/g;
    const wordsInCue: WordStamp[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(body))) {
      const startMs = vttTsToMs(match[1]!);
      const word = match[2]!.trim();
      if (!word) continue;
      wordsInCue.push({ word, startMs, endMs: 0 });
    }
    for (let i = 0; i < wordsInCue.length; i++) {
      const cur = wordsInCue[i]!;
      const next = wordsInCue[i + 1];
      cur.endMs = next ? next.startMs : cueEndMs;
      out.push(cur);
    }
  }
  return out;
}

function vttTsToMs(ts: string): number {
  const m = ts.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!m) return 0;
  return (parseInt(m[1]!) * 3600 + parseInt(m[2]!) * 60 + parseInt(m[3]!)) * 1000 + parseInt(m[4]!);
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
