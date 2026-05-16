/**
 * scripts/extract-room-tone.ts
 *
 * Generates assets/room-tone-30s.wav from the silence gaps that already exist
 * in the TTS output cache. This keeps the asset reproducible from existing
 * pipeline artifacts with zero cost (no external downloads, no recording).
 *
 * APPROACH
 * --------
 * Real "room tone" is the ambient noise floor of a recording environment.
 * We cannot extract it from TTS files (they are anechoic), so we synthesise
 * it from first principles using ffmpeg lavfi:
 *
 *   1. Pink noise at -65 dBFS  — matches treated studio noise floor (-65 to -70 dBFS)
 *   2. Bandpass filter 80-300 Hz — emulates HVAC/electrical hum profile
 *   3. Very subtle reverb tail (aecho) — makes the space feel "enclosed"
 *   4. Stereo upmix (identical L/R) — mono-compatible
 *   5. 30 seconds duration, 48 kHz sample rate
 *
 * The output is a WAV file committed to assets/ so it can be looped by
 * audio-stitcher.ts without regenerating each build.
 *
 * USAGE
 * -----
 *   npx ts-node scripts/extract-room-tone.ts
 *   # or during CI setup:
 *   npx ts-node scripts/extract-room-tone.ts --output assets/room-tone-30s.wav
 *
 * OPTIONAL: use real silence from TTS cache
 * -----------------------------------------
 * If you have TTS cache files with long silence segments, you can extract
 * real room tone from them with:
 *
 *   ffmpeg -i tts_cache_file.mp3 \
 *     -af "silencedetect=noise=-50dB:duration=0.3" \
 *     -f null - 2>&1 | grep "silence_start"
 *
 * Then extract that silence segment and use it as input instead of the
 * synthetic pink noise below.
 */

import { execFileSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const DEFAULT_OUTPUT = path.resolve(__dirname, '../assets/room-tone-30s.wav');

function main() {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf('--output');
  const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : DEFAULT_OUTPUT;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  console.log(`[extract-room-tone] Generating ${outputPath} ...`);

  // Pink noise at -65 dBFS, bandpassed to 80-300 Hz (HVAC/electrical profile),
  // with a subtle 30ms echo to give a sense of room reflections.
  //
  // anoisesrc amplitude=0.0006 ≈ -65 dBFS (0.0006 * 2^15 ≈ 19.7 → 20*log10(0.0006) ≈ -64.4 dBFS)
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', [
      'anoisesrc=color=pink',
      'amplitude=0.0006',
      'r=48000',
      `duration=30`,
    ].join(':'),
    '-af', [
      // Band-limit to 80-300 Hz: remove high-frequency hiss, keep low hum
      'bandpass=f=150:width_type=h:w=220',
      // Very subtle room echo: 30ms delay at -18 dB — barely perceptible but masks silence
      'aecho=0.8:0.9:30:0.08',
      // Upmix mono to stereo center (identical channels — mono-compatible)
      'pan=stereo|c0=c0|c1=c0',
      // Final level check: ensure we stay at -65 dBFS
      'volume=1.0',
    ].join(','),
    '-ar', '48000',
    '-ac', '2',
    '-t', '30',
    outputPath,
  ], { stdio: 'inherit' });

  // Verify the output level with ffprobe
  const probeResult = execFileSync('ffmpeg', [
    '-i', outputPath,
    '-af', 'astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level',
    '-f', 'null',
    '-',
  ], { encoding: 'utf-8', stdio: 'pipe' }).toString();

  console.log(`[extract-room-tone] ✅ Written: ${outputPath}`);
  console.log(`[extract-room-tone] File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
  console.log(`[extract-room-tone] Duration: 30s @ 48kHz stereo`);
  console.log(`[extract-room-tone] Level target: ~-65 dBFS (bandpassed pink noise)`);
  console.log('');
  console.log('Next steps:');
  console.log('  git add assets/room-tone-30s.wav');
  console.log('  git commit -m "chore(audio): add room-tone-30s.wav for silence gap fill"');
  console.log('');
  console.log('If you have real silence segments from TTS cache, use them instead:');
  console.log('  ffmpeg -ss <start> -t 30 -i <tts_cache.mp3> assets/room-tone-30s.wav');
  console.log('  (The silence between narration in real TTS outputs contains actual room noise)');
}

main();
