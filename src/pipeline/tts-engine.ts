import axios from 'axios';
import NodeCache from 'node-cache';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { TTSResult } from '../types';
import { refineTimestamps, isWhisperEnabled } from './whisper-timestamps';

const cache = new NodeCache({ stdTTL: 2592000 }); // 30 days
const KOKORO_API = process.env.KOKORO_API_URL || 'http://localhost:8880';
const AUDIO_DIR = path.join(process.cwd(), 'public', 'audio');

// Default voice for Guru Sishya — Indian English male teacher
// Primary: Edge TTS PrabhatNeural (free, unlimited, Indian male)
// Fallback: Kokoro af_heart (self-hosted)
const DEFAULT_VOICE = 'en-IN-PrabhatNeural';
const DEFAULT_VOICE_LANGUAGE = 'indian-english';
const EDGE_TTS_PRIMARY = true; // Edge TTS is our primary engine

// Voice map for Edge TTS — supports multiple languages and accents
const VOICE_MAP: Record<string, string> = {
  'english': 'en-US-AriaNeural',        // Clear American English
  'indian-english': 'en-IN-PrabhatNeural', // Indian English male teacher (PRIMARY)
  'hindi': 'hi-IN-MadhurNeural',          // Hindi male
  'hinglish': 'en-IN-PrabhatNeural',      // Indian English male — handles Hinglish naturally
  'male-english': 'en-US-GuyNeural',      // Male American
  'male-indian': 'en-IN-PrabhatNeural',   // Male Indian English
};

// Voice map for Kokoro TTS — language-aware voice selection
// Tested voices: hf_alpha, hf_beta (Hindi female), hm_omega, hm_psi (Hindi male),
// if_sara (Indian English female), af_heart (Indian English male),
// af_bella (American English female), am_puck (American English male)
// Hindi voices handle Devanagari + romanized Hindi well.
// Indian English voices (if_sara, af_heart) handle Hinglish naturally.
// Blends like "hm_omega+am_puck" also work for mixed-language narration.
const KOKORO_VOICE_MAP: Record<string, string> = {
  'english': 'af_bella',            // American English female — clear, engaging
  'indian-english': 'af_heart',     // Indian English male — authoritative, Khan Sir style
  'hindi': 'hm_omega',              // Hindi male — deep, authoritative tone
  'hinglish': 'af_heart',          // Indian English male — handles Hindi+English mix naturally
  'male-english': 'am_puck',        // American English male
  'male-indian': 'af_heart',       // Indian English male
  'male-hindi': 'hm_omega',         // Hindi male — deep, authoritative tone
  'male-hinglish': 'af_heart',     // Indian English male — good Hinglish delivery
};

// Ensure audio directory exists
fs.mkdirSync(AUDIO_DIR, { recursive: true });

export async function generateAudio(
  text: string,
  voice: string = DEFAULT_VOICE,
  outputName?: string,
  voiceLanguage: string = DEFAULT_VOICE_LANGUAGE,
  rate: string = '-5%'
): Promise<TTSResult> {
  // Resolve voices from language maps
  const kokoroVoice = KOKORO_VOICE_MAP[voiceLanguage] || voice;
  const edgeVoice = process.env.EDGE_TTS_VOICE || VOICE_MAP[voiceLanguage] || 'en-IN-PrabhatNeural';
  console.log(`  [TTS] generateAudio edge=${edgeVoice} kokoro=${kokoroVoice} (lang=${voiceLanguage})`);

  const cacheKey = crypto.createHash('sha256').update(text + edgeVoice + voiceLanguage + rate).digest('hex');

  // Check cache
  const cached = cache.get<TTSResult>(cacheKey);
  if (cached && fs.existsSync(cached.audioPath)) return cached;

  // Priority 1: Edge TTS (free, unlimited, PrabhatNeural Indian male teacher)
  // Gets real sentence-level timestamps from VTT — no Whisper needed!
  try {
    return await edgeTTS(text, cacheKey, outputName, voiceLanguage, rate);
  } catch (edgeErr) {
    console.warn('Edge TTS failed:', (edgeErr as Error).message, '— trying Kokoro...');
  }

  // Priority 2: Kokoro (self-hosted, good quality)
  try {
    return await kokoroTTS(text, kokoroVoice, cacheKey, outputName);
  } catch (kokoroErr) {
    console.warn('Kokoro TTS unavailable, trying macOS...');
  }

  // Priority 3: macOS native TTS (free, works offline on Mac)
  if (process.platform === 'darwin') {
    try {
      return await macosTTS(text, cacheKey, outputName);
    } catch (macErr) {
      console.warn('macOS TTS failed:', (macErr as Error).message);
    }
  }

  // Last resort: silent placeholder
  console.warn('All TTS failed. Using silent fallback.');
  return silentFallback(text, cacheKey);
}

/**
 * Post-process a TTS result with Whisper to get real word timestamps.
 * Runs by default for accurate sync. Disable with USE_WHISPER=false or --no-whisper.
 * Falls back to original proportional timestamps on failure.
 */
async function whisperRefine(result: TTSResult): Promise<TTSResult> {
  if (!isWhisperEnabled() || !result.audioPath) return result;

  const refined = await refineTimestamps(result.audioPath, result.wordTimestamps, result.duration);
  return {
    audioPath: result.audioPath,
    wordTimestamps: refined.wordTimestamps,
    duration: refined.duration,
  };
}

// ─── Kokoro TTS (self-hosted, best quality) ───
async function kokoroTTS(
  text: string,
  voice: string,
  cacheKey: string,
  outputName?: string
): Promise<TTSResult> {
  const filename = outputName || `tts_${cacheKey.slice(0, 12)}.mp3`;
  const audioPath = path.join(AUDIO_DIR, filename);

  // Try /dev/captioned_speech first for REAL word-level timestamps
  try {
    const captionedResult = await kokoroCaptionedSpeech(text, voice, audioPath);
    cache.set(cacheKey, captionedResult);
    console.log(`  ✓ Kokoro TTS (captioned): ${filename} (${captionedResult.duration.toFixed(1)}s, ${captionedResult.wordTimestamps.length} words)`);
    return captionedResult;
  } catch (captionedErr) {
    console.warn('  Kokoro /dev/captioned_speech unavailable, falling back to /v1/audio/speech...');
  }

  // Fall back to standard /v1/audio/speech with proportional timestamps
  const response = await axios.post(
    `${KOKORO_API}/v1/audio/speech`,
    {
      model: 'kokoro',
      input: text,
      voice,
      response_format: 'mp3',
      speed: 0.9,
    },
    { timeout: 60000, responseType: 'arraybuffer' }
  );

  fs.writeFileSync(audioPath, Buffer.from(response.data));

  const stats = fs.statSync(audioPath);
  const duration = stats.size / 16000; // MP3 ~16KB/sec at 128kbps

  const result = makeTimestamps(text, duration, audioPath);
  const refined = await whisperRefine(result);
  cache.set(cacheKey, refined);
  console.log(`  ✓ Kokoro TTS (${isWhisperEnabled() ? 'whisper' : 'proportional'}): ${filename} (${refined.duration.toFixed(1)}s)`);
  return refined;
}

// ─── Kokoro Captioned Speech (real word-level timestamps) ───
async function kokoroCaptionedSpeech(
  text: string,
  voice: string,
  audioPath: string
): Promise<TTSResult> {
  const response = await axios.post(
    `${KOKORO_API}/dev/captioned_speech`,
    {
      model: 'kokoro',
      input: text,
      voice,
      speed: 0.9,
      response_format: 'mp3',
    },
    { timeout: 60000, responseType: 'json' }
  );

  const data = response.data;

  // Extract base64 audio — handle both possible field names
  const audioBase64: string = data.audio || data.audio_data;
  if (!audioBase64) {
    throw new Error('No audio data in captioned_speech response');
  }

  // Decode and save audio
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  fs.writeFileSync(audioPath, audioBuffer);

  // Extract timestamps — handle multiple possible response formats
  const rawTimestamps: Array<{ word: string; start_time?: number; end_time?: number; start?: number; end?: number }> =
    data.timestamps || data.words || data.word_timestamps || [];

  // Map to our { word, start, end } format
  const wordTimestamps: Array<{ word: string; start: number; end: number }> = rawTimestamps.map((t) => ({
    word: t.word,
    start: t.start_time ?? t.start ?? 0,
    end: t.end_time ?? t.end ?? 0,
  }));

  // Derive duration from the last timestamp's end time, or estimate from file size
  let duration: number;
  if (wordTimestamps.length > 0) {
    duration = wordTimestamps[wordTimestamps.length - 1].end;
  } else {
    const stats = fs.statSync(audioPath);
    duration = stats.size / 16000;
  }

  // If API returned no timestamps, fall back to proportional
  if (wordTimestamps.length === 0) {
    return {
      audioPath,
      wordTimestamps: makeTimestampsProportional(text, duration),
      duration,
    };
  }

  return { audioPath, wordTimestamps, duration };
}

// ─── Edge TTS (free Microsoft neural voices — PRIMARY ENGINE) ───
// Uses en-IN-PrabhatNeural (Indian English male teacher voice)
// Generates VTT subtitles for real sentence-level timestamps (no Whisper needed!)
async function edgeTTS(
  text: string,
  cacheKey: string,
  outputName?: string,
  voiceLanguage: string = 'indian-english',
  rate: string = '-5%'
): Promise<TTSResult> {
  const { execFileSync } = await import('child_process');

  const filename = outputName || `edge_${cacheKey.slice(0, 12)}.mp3`;
  const audioPath = path.join(AUDIO_DIR, filename);
  const vttPath = audioPath.replace(/\.mp3$/, '.vtt');

  // Clean text for command safety
  const cleanText = text.slice(0, 5000);

  // Voice: PrabhatNeural (Indian English male) is the primary voice
  const voice = process.env.EDGE_TTS_VOICE || VOICE_MAP[voiceLanguage] || 'en-IN-PrabhatNeural';

  execFileSync('python3', [
    '-m', 'edge_tts',
    '--voice', voice,
    `--rate=${rate}`,       // Per-scene pacing from VideoStyle
    '--pitch=+2Hz',         // Slightly warmer, more energetic pitch
    '--text', cleanText,
    '--write-media', audioPath,
    '--write-subtitles', vttPath,  // Real VTT timestamps!
  ], { timeout: 120000 });

  // Parse VTT for sentence-level timestamps, then distribute words within sentences
  let wordTimestamps: Array<{ word: string; start: number; end: number }> = [];
  let duration: number;

  if (fs.existsSync(vttPath)) {
    const vttContent = fs.readFileSync(vttPath, 'utf-8');
    wordTimestamps = parseEdgeVttToWords(vttContent);
    // Duration from last timestamp or file size
    if (wordTimestamps.length > 0) {
      duration = wordTimestamps[wordTimestamps.length - 1].end;
    } else {
      const stats = fs.statSync(audioPath);
      duration = stats.size / 12000;
      wordTimestamps = makeTimestampsProportional(text, duration);
    }
    console.log(`  ✓ Edge TTS VTT: ${wordTimestamps.length} word timestamps from real sentence boundaries`);
  } else {
    // No VTT file — fall back to proportional
    const stats = fs.statSync(audioPath);
    duration = stats.size / 12000;
    wordTimestamps = makeTimestampsProportional(text, duration);
    console.warn('  ⚠ Edge TTS: no VTT file, using proportional timestamps');
  }

  const result: TTSResult = { audioPath, wordTimestamps, duration };
  cache.set(cacheKey, result);
  console.log(`  ✓ Edge TTS (${voice}): ${filename} (${duration.toFixed(1)}s, ${wordTimestamps.length} words)`);
  return result;
}

/**
 * Parse Edge TTS VTT output into word-level timestamps.
 * Edge TTS v7+ outputs sentence-level cues. We split each sentence into words
 * and distribute timing proportionally within each sentence boundary.
 * This gives us accurate sentence boundaries (from Microsoft's neural model)
 * with proportional word timing within each sentence — much better than
 * pure proportional across the entire audio.
 */
function parseEdgeVttToWords(vttContent: string): Array<{ word: string; start: number; end: number }> {
  const timestamps: Array<{ word: string; start: number; end: number }> = [];

  // Parse VTT cues: "HH:MM:SS,mmm --> HH:MM:SS,mmm\ntext"
  // Edge TTS uses comma (,) as ms separator, not dot (.)
  const cuePattern = /(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*\n(.+?)(?=\n\n|\n\d+\n|$)/gs;
  let match;

  while ((match = cuePattern.exec(vttContent)) !== null) {
    const start = parseVttTimeEdge(match[1]);
    const end = parseVttTimeEdge(match[2]);
    const text = match[3].trim();
    const words = text.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) continue;

    if (words.length === 1) {
      timestamps.push({ word: words[0], start, end });
    } else {
      // Distribute words proportionally within sentence boundaries
      const totalChars = words.reduce((sum, w) => sum + w.length, 0);
      const cueDuration = end - start;
      let currentTime = start;

      for (const word of words) {
        const wordDuration = (word.length / totalChars) * cueDuration;
        timestamps.push({
          word,
          start: currentTime,
          end: currentTime + wordDuration,
        });
        currentTime += wordDuration;
      }
    }
  }

  return timestamps;
}

/** Parse VTT time format: "00:00:12,839" or "00:00:12.839" → seconds */
function parseVttTimeEdge(time: string): number {
  const [h, m, rest] = time.split(':');
  const [s, ms] = rest.split(/[.,]/);
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

// ─── macOS Native TTS (free, works offline) ───
async function macosTTS(
  text: string,
  cacheKey: string,
  outputName?: string
): Promise<TTSResult> {
  const { execFileSync } = await import('child_process');

  const filename = outputName || `mac_${cacheKey.slice(0, 12)}.mp3`;
  const aiffPath = path.join(AUDIO_DIR, filename.replace('.mp3', '.aiff'));
  const mp3Path = path.join(AUDIO_DIR, filename);

  // Clean text for shell safety
  const cleanText = text.replace(/['"\\]/g, ' ').slice(0, 2000);

  // Generate speech using macOS 'say' command
  execFileSync('say', ['-o', aiffPath, '-v', 'Samantha', cleanText], { timeout: 30000 });

  // Convert AIFF to M4A (lightweight, Remotion-compatible)
  const m4aPath = mp3Path.replace('.mp3', '.m4a');
  execFileSync('afconvert', [aiffPath, m4aPath, '-d', 'aac', '-f', 'm4af'], { timeout: 15000 });

  // Cleanup AIFF
  if (fs.existsSync(aiffPath)) fs.unlinkSync(aiffPath);

  // Get duration from file size (M4A ~8KB/sec)
  const stats = fs.statSync(m4aPath);
  const duration = stats.size / 8000;

  const result = makeTimestamps(text, duration, m4aPath);
  const refined = await whisperRefine(result);
  cache.set(cacheKey, refined);
  console.log(`  ✓ macOS TTS: ${filename} (${refined.duration.toFixed(1)}s)`);
  return refined;
}

// ─── Silent fallback ───
function silentFallback(text: string, cacheKey: string): TTSResult {
  const words = text.split(/\s+/).filter(Boolean);
  const duration = (words.length / 150) * 60;

  const audioPath = path.join(AUDIO_DIR, `fallback_${cacheKey.slice(0, 12)}.mp3`);
  if (!fs.existsSync(audioPath)) {
    // Minimal silent MP3
    const silentHeader = Buffer.from([0xFF, 0xFB, 0x90, 0x00]);
    const framesNeeded = Math.ceil(duration * 38.28);
    const frames = Buffer.alloc(framesNeeded * 418, 0);
    silentHeader.copy(frames, 0);
    fs.writeFileSync(audioPath, frames);
  }

  return makeTimestamps(text, duration, audioPath);
}

// ─── Helper: create word timestamps ───
function makeTimestamps(text: string, duration: number, audioPath: string): TTSResult {
  return {
    audioPath,
    wordTimestamps: makeTimestampsProportional(text, duration),
    duration,
  };
}

/** Distribute timestamps proportionally by character count (better than uniform) */
export function makeTimestampsProportional(
  text: string,
  duration: number,
): Array<{ word: string; start: number; end: number }> {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const timestamps: Array<{ word: string; start: number; end: number }> = [];
  let currentTime = 0;

  for (const word of words) {
    const wordDuration = (word.length / totalChars) * duration;
    timestamps.push({
      word,
      start: currentTime,
      end: currentTime + wordDuration,
    });
    currentTime += wordDuration;
  }

  return timestamps;
}

export function parseVttTimestamps(
  vttContent: string,
): Array<{ word: string; start: number; end: number }> {
  const timestamps: Array<{ word: string; start: number; end: number }> = [];
  const cuePattern = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\s*\n(.+)/g;
  let match;

  while ((match = cuePattern.exec(vttContent)) !== null) {
    const start = parseVttTime(match[1]);
    const end = parseVttTime(match[2]);
    const text = match[3].trim();
    const words = text.split(/\s+/);
    if (words.length === 1) {
      timestamps.push({ word: text, start, end });
    } else {
      const cueDuration = end - start;
      words.forEach((w, i) => {
        timestamps.push({
          word: w,
          start: start + (i / words.length) * cueDuration,
          end: start + ((i + 1) / words.length) * cueDuration,
        });
      });
    }
  }

  return timestamps;
}

function parseVttTime(time: string): number {
  const [h, m, rest] = time.split(':');
  const [s, ms] = rest.split('.');
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

// ─── Batch: generate audio for all scenes ───
export async function generateSceneAudios(
  scenes: Array<{ narration: string; type: string }>,
  voice: string = DEFAULT_VOICE,
  voiceLanguage: string = DEFAULT_VOICE_LANGUAGE,
  rateMap?: Record<string, string>
): Promise<TTSResult[]> {
  // Edge TTS is primary — resolve voice from Edge voice map
  const resolvedVoice = VOICE_MAP[voiceLanguage] || voice;
  console.log(`  [TTS] generateSceneAudios voice=${voice} → resolved=${resolvedVoice} (lang=${voiceLanguage})`);

  const results: TTSResult[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene.narration.trim()) {
      results.push({ audioPath: '', wordTimestamps: [], duration: 0 });
      continue;
    }
    console.log(`  Generating audio for scene ${i + 1}/${scenes.length} [${scene.type}]...`);
    const spokenText = preprocessForSpeech(scene.narration);
    const sceneRate = rateMap?.[scene.type] ?? '-5%';
    const result = await generateAudio(spokenText, resolvedVoice, `scene_${i}.mp3`, voiceLanguage, sceneRate);
    results.push(result);
  }
  return results;
}

// ─── Speech Preprocessor ───

/**
 * Convert text to speech-friendly format.
 * - Numbers → spoken English (100000 → "one lakh", 1000000 → "ten lakh")
 * - Code syntax → spoken (O(n) → "O of n", O(n²) → "O of n squared")
 * - Abbreviations → spoken (API → "A P I", REST → "REST", SQL → "sequel")
 * - Add pauses → "..." becomes a natural pause
 */
export function preprocessForSpeech(text: string): string {
  let result = text;

  // Add natural pauses before contradiction words (Edge TTS respects commas)
  result = result.replace(/\b(but|however|actually|in fact|surprisingly)\b/gi, ', $1');
  // Clean up double commas that may result
  result = result.replace(/,\s*,/g, ',');
  // Add micro-pause before reveal words (dash creates a beat)
  result = result.replace(/\b(the answer is|the key is|the secret is|here is why)\b/gi, '— $1');

  // Convert large numbers to spoken English
  // Must handle: 100000, 1,000,000, 10M, 200 million, 99.99%, 50x, 14ms
  result = result.replace(/\b(\d{1,3}(,\d{3})+)\b/g, (match) => {
    // Remove commas and convert
    return numberToWords(parseInt(match.replace(/,/g, '')));
  });

  result = result.replace(/\b(\d+)\s*(million|billion|trillion|crore|lakh)\b/gi, (_, num, unit) => {
    return `${numberToWords(parseInt(num))} ${unit}`;
  });

  // Plain large numbers without commas
  result = result.replace(/\b(\d{4,})\b/g, (match) => {
    const num = parseInt(match);
    if (num > 999) return numberToWords(num);
    return match;
  });

  // Code notation: O(n) → "O of n", O(n²) → "O of n squared"
  result = result.replace(/O\(([^)]+)\)/g, (_, expr) => {
    const spoken = expr
      .replace(/n²/g, 'n squared')
      .replace(/n³/g, 'n cubed')
      .replace(/log\s*n/g, 'log n')
      .replace(/n\s*log\s*n/g, 'n log n')
      .replace(/\^2/g, ' squared')
      .replace(/\^3/g, ' cubed');
    return `O of ${spoken}`;
  });

  // Common tech abbreviations
  result = result.replace(/\bAPI\b/g, 'A P I');
  result = result.replace(/\bAPIs\b/g, 'A P Is');
  result = result.replace(/\bSQL\b/g, 'sequel');
  result = result.replace(/\bNoSQL\b/g, 'no sequel');
  result = result.replace(/\bURL\b/g, 'U R L');
  result = result.replace(/\bHTTP\b/g, 'H T T P');
  result = result.replace(/\bHTTPS\b/g, 'H T T P S');
  result = result.replace(/\bCPU\b/g, 'C P U');
  result = result.replace(/\bGPU\b/g, 'G P U');
  result = result.replace(/\bRAM\b/g, 'ram');
  result = result.replace(/\bSSD\b/g, 'S S D');
  result = result.replace(/\bDNS\b/g, 'D N S');
  result = result.replace(/\bCDN\b/g, 'C D N');
  result = result.replace(/\bLRU\b/g, 'L R U');
  result = result.replace(/\bBFS\b/g, 'B F S');
  result = result.replace(/\bDFS\b/g, 'D F S');
  result = result.replace(/\bJSON\b/g, 'jason');
  result = result.replace(/\bYAML\b/g, 'yammel');
  result = result.replace(/\bAWS\b/g, 'A W S');
  result = result.replace(/\bGCP\b/g, 'G C P');

  // Percentages: "99.99%" → "ninety nine point nine nine percent"
  result = result.replace(/(\d+\.?\d*)%/g, (_, num) => {
    return `${numberToWords(parseFloat(num))} percent`;
  });

  // Multipliers: "50x" → "fifty times"
  result = result.replace(/(\d+)x\b/g, (_, num) => {
    return `${numberToWords(parseInt(num))} times`;
  });

  // Units: "14ms" → "14 milliseconds", "10MB" → "10 megabytes"
  result = result.replace(/(\d+)\s*ms\b/g, '$1 milliseconds');
  result = result.replace(/(\d+)\s*MB\b/g, '$1 megabytes');
  result = result.replace(/(\d+)\s*GB\b/g, '$1 gigabytes');
  result = result.replace(/(\d+)\s*TB\b/g, '$1 terabytes');
  result = result.replace(/(\d+)\s*KB\b/g, '$1 kilobytes');

  // Ellipsis → pause marker
  result = result.replace(/\.\.\./g, ', ');

  // === Python dunder methods (specific matches first) ===
  result = result.replace(/__init__/g, 'init');
  result = result.replace(/__str__/g, 'string method');
  result = result.replace(/__repr__/g, 'repr method');
  result = result.replace(/__len__/g, 'len method');
  result = result.replace(/__getitem__/g, 'get item method');
  result = result.replace(/__setitem__/g, 'set item method');
  result = result.replace(/__delitem__/g, 'delete item method');
  result = result.replace(/__iter__/g, 'iter method');
  result = result.replace(/__next__/g, 'next method');
  result = result.replace(/__enter__/g, 'enter method');
  result = result.replace(/__exit__/g, 'exit method');
  result = result.replace(/__eq__/g, 'equals method');
  result = result.replace(/__lt__/g, 'less than method');
  result = result.replace(/__gt__/g, 'greater than method');
  result = result.replace(/__add__/g, 'add method');
  result = result.replace(/__hash__/g, 'hash method');
  result = result.replace(/__call__/g, 'call method');
  result = result.replace(/__contains__/g, 'contains method');
  result = result.replace(/__name__/g, 'name attribute');
  result = result.replace(/__main__/g, 'main module');

  // Generic dunder fallback: __something__ → "something"
  result = result.replace(/__([a-zA-Z_]+)__/g, (_, name) => name.replace(/_/g, ' '));

  // self.__x → "self dot x" (private attribute access)
  result = result.replace(/self\.__([a-zA-Z_]+)/g, (_, attr) => `self dot ${attr}`);

  // === Common method notation ===
  result = result.replace(/self\./g, 'self dot ');
  result = result.replace(/\.get\(\)/g, ' dot get');
  result = result.replace(/\.put\(\)/g, ' dot put');
  result = result.replace(/\.size\(\)/g, ' dot size');

  // === Code operators (order: multi-char first to avoid partial matches) ===
  result = result.replace(/->/g, 'returns');
  result = result.replace(/=>/g, 'arrow function');
  result = result.replace(/!=/g, 'not equal to');
  result = result.replace(/==/g, 'equals');
  result = result.replace(/<=/g, 'less than or equal to');
  result = result.replace(/>=/g, 'greater than or equal to');
  result = result.replace(/&&/g, 'and');
  result = result.replace(/\|\|/g, 'or');
  result = result.replace(/\+\+/g, 'increment');
  result = result.replace(/--/g, 'decrement');

  // === CamelCase/PascalCase splitting for well-known class names ===
  result = result.replace(/\bHashMap\b/g, 'Hash Map');
  result = result.replace(/\bArrayList\b/g, 'Array List');
  result = result.replace(/\bLinkedList\b/g, 'Linked List');
  result = result.replace(/\bTreeMap\b/g, 'Tree Map');
  result = result.replace(/\bTreeSet\b/g, 'Tree Set');
  result = result.replace(/\bHashSet\b/g, 'Hash Set');
  result = result.replace(/\bLinkedHashMap\b/g, 'Linked Hash Map');
  result = result.replace(/\bPriorityQueue\b/g, 'Priority Queue');
  result = result.replace(/\bStringBuilder\b/g, 'String Builder');
  result = result.replace(/\bInputStream\b/g, 'Input Stream');
  result = result.replace(/\bOutputStream\b/g, 'Output Stream');
  result = result.replace(/\bNullPointerException\b/g, 'Null Pointer Exception');
  result = result.replace(/\bIndexOutOfBoundsException\b/g, 'Index Out Of Bounds Exception');

  return result;
}

function numberToWords(num: number): string {
  if (num === 0) return 'zero';
  if (isNaN(num)) return String(num);

  // Handle decimals
  if (num % 1 !== 0) {
    const [whole, decimal] = num.toString().split('.');
    const wholeWords = numberToWords(parseInt(whole));
    const decimalWords = decimal.split('').map(d => numberToWords(parseInt(d))).join(' ');
    return `${wholeWords} point ${decimalWords}`;
  }

  if (num < 0) return 'negative ' + numberToWords(-num);

  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' hundred' + (num % 100 ? ' and ' + numberToWords(num % 100) : '');

  // Indian number system for Indian audience
  if (num >= 10000000) return numberToWords(Math.floor(num / 10000000)) + ' crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
  if (num >= 100000) return numberToWords(Math.floor(num / 100000)) + ' lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
  if (num >= 1000) return numberToWords(Math.floor(num / 1000)) + ' thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');

  return String(num);
}
