/**
 * Whisper-based word timestamp extraction.
 *
 * Post-processes TTS audio to get REAL word-level timestamps
 * instead of proportional estimates. Uses faster-whisper via a Python script.
 *
 * ENABLED BY DEFAULT. Disable with:
 *   - CLI flag: --no-whisper
 *   - Env var: USE_WHISPER=false
 */

import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface WhisperResult {
  words: WhisperWord[];
  duration: number;
  error?: string;
}

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'extract-timestamps.py');

/** Check if whisper timestamps are enabled (ON by default, disable with --no-whisper or USE_WHISPER=false) */
export function isWhisperEnabled(): boolean {
  const envFlag = process.env.USE_WHISPER;
  if (envFlag === 'false' || envFlag === '0') return false;
  if (process.argv.includes('--no-whisper')) return false;
  return true; // DEFAULT: always use Whisper for accurate sync
}

/** Whisper model size — tiny is fastest (~1s per 10s audio), base is more accurate */
function getWhisperModel(): string {
  return process.env.WHISPER_MODEL || 'tiny';
}

/**
 * Extract word-level timestamps from an audio file using Whisper.
 *
 * @param audioPath - Path to the audio file (mp3, wav, m4a, etc.)
 * @returns Promise resolving to whisper result with word timestamps
 */
export async function extractWhisperTimestamps(audioPath: string): Promise<WhisperResult> {
  if (!fs.existsSync(audioPath)) {
    return { words: [], duration: 0, error: `Audio file not found: ${audioPath}` };
  }

  if (!fs.existsSync(SCRIPT_PATH)) {
    return { words: [], duration: 0, error: `Whisper script not found: ${SCRIPT_PATH}` };
  }

  const model = getWhisperModel();

  return new Promise((resolve) => {
    execFile(
      'python3',
      [SCRIPT_PATH, audioPath, '--model', model],
      { timeout: 120_000 }, // 2 minute timeout per file
      (error, stdout, stderr) => {
        if (error) {
          console.warn(`  ⚠ Whisper extraction failed: ${error.message}`);
          resolve({ words: [], duration: 0, error: error.message });
          return;
        }

        try {
          const result: WhisperResult = JSON.parse(stdout.trim());
          if (result.error) {
            console.warn(`  ⚠ Whisper error: ${result.error}`);
          }
          resolve(result);
        } catch (parseErr) {
          console.warn(`  ⚠ Failed to parse whisper output: ${stdout.slice(0, 200)}`);
          resolve({ words: [], duration: 0, error: 'JSON parse error' });
        }
      }
    );
  });
}

/**
 * Refine TTS timestamps using Whisper.
 *
 * Takes the proportional timestamps from TTS and replaces them with
 * real timestamps from Whisper speech recognition. Falls back to
 * the original proportional timestamps if Whisper fails.
 *
 * @param audioPath - Path to the audio file
 * @param proportionalTimestamps - Original proportional timestamps from TTS
 * @param duration - Original duration estimate
 * @returns Refined timestamps (whisper if available, proportional otherwise)
 */
export async function refineTimestamps(
  audioPath: string,
  proportionalTimestamps: Array<{ word: string; start: number; end: number }>,
  duration: number
): Promise<{ wordTimestamps: Array<{ word: string; start: number; end: number }>; duration: number; source: 'whisper' | 'proportional' }> {
  if (!isWhisperEnabled()) {
    return { wordTimestamps: proportionalTimestamps, duration, source: 'proportional' };
  }

  console.log(`  ⏳ Running Whisper timestamp extraction (model: ${getWhisperModel()})...`);
  const startTime = Date.now();

  const result = await extractWhisperTimestamps(audioPath);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (result.error || result.words.length === 0) {
    console.warn(`  ⚠ Whisper failed (${elapsed}s), using proportional timestamps`);
    return { wordTimestamps: proportionalTimestamps, duration, source: 'proportional' };
  }

  // Use whisper's duration if it detected one (more accurate than file-size estimate)
  const refinedDuration = result.duration > 0 ? result.duration : duration;

  console.log(`  ✓ Whisper: ${result.words.length} words extracted in ${elapsed}s (duration: ${refinedDuration.toFixed(1)}s)`);

  return {
    wordTimestamps: result.words,
    duration: refinedDuration,
    source: 'whisper',
  };
}
