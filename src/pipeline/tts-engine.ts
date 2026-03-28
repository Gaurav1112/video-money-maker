import axios from 'axios';
import NodeCache from 'node-cache';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { TTSResult } from '../types';

const cache = new NodeCache({ stdTTL: 2592000 }); // 30 days
const KOKORO_API = process.env.KOKORO_API_URL || 'http://localhost:8880';
const AUDIO_DIR = path.join(process.cwd(), 'public', 'audio');

// Voice map for Edge TTS — supports multiple languages and accents
const VOICE_MAP: Record<string, string> = {
  'english': 'en-US-AriaNeural',        // Clear American English
  'indian-english': 'en-IN-NeerjaNeural', // Indian English (relatable for Indian students)
  'hindi': 'hi-IN-SwaraNeural',          // Hindi female
  'hinglish': 'en-IN-NeerjaNeural',      // Indian English works for Hinglish too
  'male-english': 'en-US-GuyNeural',     // Male American
  'male-indian': 'en-IN-PrabhatNeural',  // Male Indian English
};

// Ensure audio directory exists
fs.mkdirSync(AUDIO_DIR, { recursive: true });

export async function generateAudio(
  text: string,
  voice: string = 'af_bella',
  outputName?: string,
  voiceLanguage: string = 'indian-english'
): Promise<TTSResult> {
  const cacheKey = crypto.createHash('sha256').update(text + voice + voiceLanguage).digest('hex');

  // Check cache
  const cached = cache.get<TTSResult>(cacheKey);
  if (cached && fs.existsSync(cached.audioPath)) return cached;

  // Try Kokoro first (self-hosted, best quality)
  try {
    return await kokoroTTS(text, voice, cacheKey, outputName);
  } catch (kokoroErr) {
    console.warn('Kokoro TTS unavailable, trying Edge TTS...');
  }

  // Try Edge TTS (free Microsoft natural voices, works everywhere with internet)
  try {
    return await edgeTTS(text, cacheKey, outputName, voiceLanguage);
  } catch (edgeErr) {
    console.warn('Edge TTS failed:', (edgeErr as Error).message);
  }

  // Try macOS native TTS (free, works offline on Mac)
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

// ─── Kokoro TTS (self-hosted, best quality) ───
async function kokoroTTS(
  text: string,
  voice: string,
  cacheKey: string,
  outputName?: string
): Promise<TTSResult> {
  const response = await axios.post(
    `${KOKORO_API}/v1/audio/speech`,
    {
      model: 'kokoro',
      input: text,
      voice,
      response_format: 'mp3',
      speed: 0.95,
    },
    { timeout: 60000, responseType: 'arraybuffer' }
  );

  const filename = outputName || `tts_${cacheKey.slice(0, 12)}.mp3`;
  const audioPath = path.join(AUDIO_DIR, filename);
  fs.writeFileSync(audioPath, Buffer.from(response.data));

  const stats = fs.statSync(audioPath);
  const duration = stats.size / 16000; // MP3 ~16KB/sec at 128kbps

  const result = makeTimestamps(text, duration, audioPath);
  cache.set(cacheKey, result);
  console.log(`  ✓ Kokoro TTS: ${filename} (${duration.toFixed(1)}s)`);
  return result;
}

// ─── Edge TTS (free Microsoft natural voices) ───
async function edgeTTS(
  text: string,
  cacheKey: string,
  outputName?: string,
  voiceLanguage: string = 'indian-english'
): Promise<TTSResult> {
  const { execFileSync } = await import('child_process');

  const filename = outputName || `edge_${cacheKey.slice(0, 12)}.mp3`;
  const audioPath = path.join(AUDIO_DIR, filename);

  // Clean text for command safety
  const cleanText = text.replace(/"/g, '\\"').slice(0, 3000);

  // Use python3 edge-tts module (Microsoft neural voices - very natural)
  // Voice selection based on language preference from VOICE_MAP
  const voice = process.env.EDGE_TTS_VOICE || VOICE_MAP[voiceLanguage] || VOICE_MAP['indian-english'];

  execFileSync('python3', [
    '-m', 'edge_tts',
    '--voice', voice,
    '--rate=-15%',   // Teacher pace — slower and clearer for learning
    '--text', cleanText,
    '--write-media', audioPath,
  ], { timeout: 60000 });

  const stats = fs.statSync(audioPath);
  // Edge TTS MP3 is ~12KB/sec at the default quality
  const duration = stats.size / 12000;

  const result = makeTimestamps(text, duration, audioPath);
  cache.set(cacheKey, result);
  console.log(`  ✓ Edge TTS (${voice}): ${filename} (${duration.toFixed(1)}s)`);
  return result;
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
  cache.set(cacheKey, result);
  console.log(`  ✓ macOS TTS: ${filename} (${duration.toFixed(1)}s)`);
  return result;
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
  voice: string = 'af_bella',
  voiceLanguage: string = 'indian-english'
): Promise<TTSResult[]> {
  const results: TTSResult[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene.narration.trim()) {
      results.push({ audioPath: '', wordTimestamps: [], duration: 0 });
      continue;
    }
    console.log(`  Generating audio for scene ${i + 1}/${scenes.length} [${scene.type}]...`);
    const spokenText = preprocessForSpeech(scene.narration);
    const result = await generateAudio(spokenText, voice, `scene_${i}.mp3`, voiceLanguage);
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
