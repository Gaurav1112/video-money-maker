import axios from 'axios';
import NodeCache from 'node-cache';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { TTSResult } from '../types';

const cache = new NodeCache({ stdTTL: 2592000 }); // 30 days
const KOKORO_API = process.env.KOKORO_API_URL || 'http://localhost:8880';
const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';

export async function generateAudio(
  text: string,
  voice: string = 'af',
  outputName?: string
): Promise<TTSResult> {
  const cacheKey = crypto.createHash('sha256').update(text + voice).digest('hex');

  // Check cache
  const cached = cache.get<TTSResult>(cacheKey);
  if (cached && fs.existsSync(cached.audioPath)) return cached;

  try {
    return await kokoroTTS(text, voice, cacheKey, outputName);
  } catch (error) {
    console.warn('Kokoro TTS failed, using fallback:', (error as Error).message);
    return fallbackEstimate(text, cacheKey);
  }
}

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
      speed: 1.0,
    },
    {
      timeout: 60000,
      responseType: 'arraybuffer',
    }
  );

  // Save audio file
  const audioDir = path.join(OUTPUT_DIR, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });
  const filename = outputName || `tts_${cacheKey.slice(0, 12)}.mp3`;
  const audioPath = path.join(audioDir, filename);
  fs.writeFileSync(audioPath, Buffer.from(response.data));

  // Estimate duration from file size (MP3 ~16KB/sec at 128kbps)
  const stats = fs.statSync(audioPath);
  const estimatedDuration = stats.size / 16000;

  // Estimate word timestamps (even spacing)
  const words = text.split(/\s+/).filter(Boolean);
  const timePerWord = estimatedDuration / words.length;
  const wordTimestamps = words.map((word, i) => ({
    word,
    start: i * timePerWord,
    end: (i + 1) * timePerWord,
  }));

  const result: TTSResult = { audioPath, wordTimestamps, duration: estimatedDuration };
  cache.set(cacheKey, result);
  return result;
}

function fallbackEstimate(text: string, cacheKey: string): TTSResult {
  // Fallback: estimate duration from word count (150 WPM)
  const words = text.split(/\s+/).filter(Boolean);
  const duration = (words.length / 150) * 60;

  // Generate a silent audio placeholder so Remotion can render
  const audioDir = path.join(OUTPUT_DIR, 'audio');
  fs.mkdirSync(audioDir, { recursive: true });
  const audioPath = path.join(audioDir, `fallback_${cacheKey.slice(0, 12)}.mp3`);

  // Only create if doesn't exist
  if (!fs.existsSync(audioPath)) {
    // Create minimal valid MP3 (silent)
    // A minimal MP3 frame header for silence
    const silentMp3Header = Buffer.from([
      0xFF, 0xFB, 0x90, 0x00, // MP3 frame header (MPEG1, Layer3, 128kbps, 44100Hz, stereo)
    ]);
    // Repeat for approximate duration (128kbps = 16KB/sec)
    const framesNeeded = Math.ceil(duration * 38.28); // ~38.28 frames/sec at 128kbps
    const frames = Buffer.alloc(framesNeeded * 418, 0); // 418 bytes per frame
    // Write header to first frame
    silentMp3Header.copy(frames, 0);
    fs.writeFileSync(audioPath, frames);
  }

  const wordTimestamps = words.map((word, i) => ({
    word,
    start: i * (duration / words.length),
    end: (i + 1) * (duration / words.length),
  }));

  return { audioPath, wordTimestamps, duration };
}

export async function generateSceneAudios(
  scenes: Array<{ narration: string; type: string }>,
  voice: string = 'af'
): Promise<TTSResult[]> {
  const results: TTSResult[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (!scene.narration.trim()) {
      results.push({ audioPath: '', wordTimestamps: [], duration: 0 });
      continue;
    }
    const result = await generateAudio(scene.narration, voice, `scene_${i}.mp3`);
    results.push(result);
  }
  return results;
}
