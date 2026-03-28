import axios from 'axios';
import NodeCache from 'node-cache';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { TTSResult } from '../types';

const cache = new NodeCache({ stdTTL: 2592000 }); // 30 days
const KOKORO_API = process.env.KOKORO_API_URL || 'http://localhost:8880';
const AUDIO_DIR = path.join(process.cwd(), 'public', 'audio');

// Ensure audio directory exists
fs.mkdirSync(AUDIO_DIR, { recursive: true });

export async function generateAudio(
  text: string,
  voice: string = 'af_bella',
  outputName?: string
): Promise<TTSResult> {
  const cacheKey = crypto.createHash('sha256').update(text + voice).digest('hex');

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
    return await edgeTTS(text, cacheKey, outputName);
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
  outputName?: string
): Promise<TTSResult> {
  const { execFileSync } = await import('child_process');

  const filename = outputName || `edge_${cacheKey.slice(0, 12)}.mp3`;
  const audioPath = path.join(AUDIO_DIR, filename);

  // Clean text for command safety
  const cleanText = text.replace(/"/g, '\\"').slice(0, 3000);

  // Use python3 edge-tts module (Microsoft neural voices - very natural)
  // en-US-AriaNeural = warm, clear female voice
  // en-IN-NeerjaNeural = Indian English female (great for Indian students!)
  const voice = process.env.EDGE_TTS_VOICE || 'en-US-AriaNeural';

  execFileSync('python3', [
    '-m', 'edge_tts',
    '--voice', voice,
    '--rate', '-10%',   // Slightly slower — teacher pace, not rushed
    '--pitch', '+0Hz',
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
  const words = text.split(/\s+/).filter(Boolean);
  const timePerWord = duration / Math.max(words.length, 1);
  const wordTimestamps = words.map((word, i) => ({
    word,
    start: i * timePerWord,
    end: (i + 1) * timePerWord,
  }));
  return { audioPath, wordTimestamps, duration };
}

// ─── Batch: generate audio for all scenes ───
export async function generateSceneAudios(
  scenes: Array<{ narration: string; type: string }>,
  voice: string = 'af_bella'
): Promise<TTSResult[]> {
  const results: TTSResult[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene.narration.trim()) {
      results.push({ audioPath: '', wordTimestamps: [], duration: 0 });
      continue;
    }
    console.log(`  Generating audio for scene ${i + 1}/${scenes.length} [${scene.type}]...`);
    const result = await generateAudio(scene.narration, voice, `scene_${i}.mp3`);
    results.push(result);
  }
  return results;
}
