/**
 * audio-stitcher.ts — REWRITTEN for EBU R128 compliance
 *
 * Key changes vs. original:
 *  1. DELETED 'volume=3dB' post-loudnorm boost (was causing ~-11 LUFS / +1.5 dBTP clipping)
 *  2. Single-pass loudnorm with measured parameters targets platform LUFS exactly
 *  3. True-peak ceiling tightened to -1.0 dBTP (was -1.5 dBTP, irrelevant with the boost)
 *  4. Silence gaps use room-tone-30s.wav loop instead of anullsrc digital zero
 *  5. When bgmFile is supplied: sidechaincompress ducks BGM -20 dB under narration
 *  6. BGM stereo width managed via stereotools (70% width — mono-safe for YouTube/phone)
 *  7. Sample rate promoted to 48 kHz (AAC/YouTube delivery standard)
 *  8. Post-stitch LUFS verify — throws if outside ±0.5 LU of platform target
 */

import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { verifyLufs } from './lufs-verify';

// ---------------------------------------------------------------------------
// Platform loudness targets (EBU R128 / platform delivery specs)
// ---------------------------------------------------------------------------
export const PLATFORM_TARGETS = {
  youtube:  { lufs: -14, truePeak: -1.0 },
  instagram: { lufs: -16, truePeak: -1.0 },
  tiktok:   { lufs: -14, truePeak: -1.0 },
  podcast:  { lufs: -16, truePeak: -1.0 },
} as const;

export type Platform = keyof typeof PLATFORM_TARGETS;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface TTSResult {
  sceneIndex: number;
  audioPath: string;       // absolute path to per-scene mp3/wav
  durationSeconds: number;
}

export interface StitchOptions {
  outputDir: string;
  platform?: Platform;     // default: 'youtube'
  roomTonePath?: string;   // absolute path to room-tone-30s.wav; falls back to bundled asset
  bgmFile?: string;        // optional BGM track to mix with sidechain ducking
  silenceDurationMs?: number; // gap between scenes, default 800ms
}

export interface StitchResult {
  masterPath: string;
  totalDuration: number;
  sceneOffsets: number[];  // seconds offset of each scene start in master
}

// ---------------------------------------------------------------------------
// Room-tone asset path
// ---------------------------------------------------------------------------
const BUNDLED_ROOM_TONE = path.resolve(__dirname, '../../assets/room-tone-30s.wav');

// ---------------------------------------------------------------------------
// Helper: run ffprobe to get duration
// ---------------------------------------------------------------------------
function probeDuration(filePath: string): number {
  const result = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration',
     '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
    { encoding: 'utf-8' }
  );
  const dur = parseFloat(result.stdout.trim());
  if (isNaN(dur)) throw new Error(`ffprobe failed on ${filePath}: ${result.stderr}`);
  return dur;
}

// ---------------------------------------------------------------------------
// Helper: pre-process a single TTS scene file
//
//   HPF 85 Hz      → removes LF mud / mic rumble
//   acompressor    → tames plosive transients (root cause of "audio sounds quiet")
//   alimiter       → brick-wall ceiling before concat
//   aresample      → upmix to 48 kHz stereo-center for consistent mix bus
//
// Returns path to processed temp file.
// ---------------------------------------------------------------------------
function preprocessScene(inputPath: string, outputDir: string, index: number): string {
  const outPath = path.join(outputDir, `_scene_${index}_pre.wav`);
  execFileSync('ffmpeg', [
    '-y',
    '-i', inputPath,
    '-af', [
      'aresample=48000',
      'highpass=f=85:poles=2',
      // 3:1 compressor targeting -18 dBFS — controls plosive burst amplitude
      'acompressor=threshold=0.126:ratio=3:attack=5:release=50:makeup=1.5:knee=5',
      // Upmix mono TTS to stereo center (pan both channels equal)
      'pan=stereo|c0=c0|c1=c0',
      // Brick-wall limiter before concat
      'alimiter=level_in=1:level_out=1:limit=0.891:attack=3:release=30',
    ].join(','),
    '-ar', '48000',
    '-ac', '2',
    outPath,
  ], { stdio: 'pipe' });
  return outPath;
}

// ---------------------------------------------------------------------------
// Helper: generate room-tone segment of exact duration
//
// Loops room-tone-30s.wav to fill the requested duration.
// Falls back to bandpassed pink noise if the asset is missing.
// ---------------------------------------------------------------------------
function generateRoomTone(
  durationSec: number,
  outputPath: string,
  roomTonePath: string,
): void {
  const assetExists = fs.existsSync(roomTonePath);

  const filterGraph = assetExists
    // Loop the pre-baked asset and trim to exact duration
    ? [
        `aloop=loop=-1:size=2e+09`,
        `atrim=duration=${durationSec.toFixed(3)}`,
        `aresample=48000`,
        // Asset is already at -65 dBFS; ensure it stays there after resampling
        `volume=1.0`,
      ].join(',')
    // Fallback: pink noise at -65 dBFS, bandpassed 80-300 Hz (studio noise floor profile)
    : [
        `anoisesrc=color=pink:amplitude=0.0006:r=48000:duration=${durationSec.toFixed(3)}`,
        `bandpass=f=150:width_type=h:w=220`,
        `pan=stereo|c0=c0|c1=c0`,
      ].join(',');

  const inputArgs: string[] = assetExists
    ? ['-stream_loop', '-1', '-i', roomTonePath]
    : ['-f', 'lavfi', '-i', `anoisesrc=color=pink:amplitude=0.0006:r=48000`];

  const filterArg = assetExists
    ? `aloop=loop=-1:size=2000000000,atrim=duration=${durationSec.toFixed(3)},aresample=48000`
    : filterGraph;

  execFileSync('ffmpeg', [
    '-y',
    ...inputArgs,
    '-af', filterArg,
    '-ar', '48000',
    '-ac', '2',
    '-t', durationSec.toFixed(3),
    outputPath,
  ], { stdio: 'pipe' });
}

// ---------------------------------------------------------------------------
// Main export: stitchAudio
// ---------------------------------------------------------------------------
export async function stitchAudio(
  scenes: TTSResult[],
  opts: StitchOptions,
): Promise<StitchResult> {
  const {
    outputDir,
    platform = 'youtube',
    bgmFile,
    silenceDurationMs = 800,
  } = opts;

  const roomTonePath = opts.roomTonePath ?? BUNDLED_ROOM_TONE;
  const target = PLATFORM_TARGETS[platform];
  const silenceSec = silenceDurationMs / 1000;

  fs.mkdirSync(outputDir, { recursive: true });

  // --- Step 1: Pre-process each scene and collect offsets ----------------
  const processedPaths: string[] = [];
  const sceneOffsets: number[] = [];
  let cursor = 0;

  for (const scene of scenes) {
    if (!fs.existsSync(scene.audioPath)) {
      console.warn(`[audio-stitcher] Missing TTS file for scene ${scene.sceneIndex}, skipping`);
      continue;
    }

    const prePath = preprocessScene(scene.audioPath, outputDir, scene.sceneIndex);
    processedPaths.push(prePath);
    sceneOffsets.push(cursor);

    const dur = probeDuration(prePath);
    cursor += dur;

    // Generate room-tone gap (not anullsrc — room tone fills gaps >300ms)
    if (silenceSec > 0.3) {
      const gapPath = path.join(outputDir, `_gap_${scene.sceneIndex}.wav`);
      generateRoomTone(silenceSec, gapPath, roomTonePath);
      processedPaths.push(gapPath);
      cursor += silenceSec;
    }
  }

  const totalDuration = cursor;

  // --- Step 2: Concat all segments into raw master -----------------------
  const rawMasterPath = path.join(outputDir, '_raw_master.wav');
  const concatListPath = path.join(outputDir, '_concat.txt');

  const concatList = processedPaths
    .map(p => `file '${p.replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(concatListPath, concatList, 'utf-8');

  execFileSync('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-ar', '48000',
    '-ac', '2',
    rawMasterPath,
  ], { stdio: 'pipe' });

  // --- Step 3: Two-pass loudnorm — NO post-boost --------------------------
  //
  // Pass 1: measure integrated loudness, true peak, LRA, threshold, offset
  // Pass 2: apply linear correction to platform target
  //
  // CRITICAL: NO 'volume=3dB' after this. The measured stats fully correct
  // for any per-file gain deficit. The compressor in step 1 ensures plosives
  // no longer dominate the gain calculation.

  // Pass 1 — measure
  const pass1Result = spawnSync('ffmpeg', [
    '-i', rawMasterPath,
    '-af', `loudnorm=I=${target.lufs}:LRA=11:TP=${target.truePeak}:print_format=json`,
    '-f', 'null',
    '-',
  ], { encoding: 'utf-8' });

  const stderrText = pass1Result.stderr ?? '';
  const jsonMatch = stderrText.match(/\{[\s\S]*?\}/);
  if (!jsonMatch) {
    throw new Error(`[audio-stitcher] loudnorm pass-1 JSON parse failed.\nstderr: ${stderrText.slice(-800)}`);
  }

  const measured: {
    input_i: string;
    input_tp: string;
    input_lra: string;
    input_thresh: string;
    target_offset: string;
  } = JSON.parse(jsonMatch[0]);

  const measuredI    = measured.input_i;
  const measuredTP   = measured.input_tp;
  const measuredLRA  = measured.input_lra;
  const measuredThresh = measured.input_thresh;
  const offset       = measured.target_offset;

  // Pass 2 — linear correct to exact target, zero post-boost
  const normalizedPath = path.join(outputDir, '_normalized.wav');

  execFileSync('ffmpeg', [
    '-y',
    '-i', rawMasterPath,
    '-af', [
      `loudnorm=I=${target.lufs}:LRA=11:TP=${target.truePeak}` +
      `:measured_I=${measuredI}:measured_TP=${measuredTP}` +
      `:measured_LRA=${measuredLRA}:measured_thresh=${measuredThresh}` +
      `:offset=${offset}:linear=true:print_format=none`,
      // NO 'volume=3dB' — that line has been deleted intentionally.
      // If speech sounds quiet, fix the pre-loudnorm signal chain (HPF + compressor above).
    ].join(','),
    '-ar', '48000',
    '-ac', '2',
    normalizedPath,
  ], { stdio: 'pipe' });

  // --- Step 4: BGM sidechain ducking (optional) ---------------------------
  //
  // When bgmFile is supplied, mix BGM under narration using FFmpeg
  // sidechaincompress: BGM ducks to -20 dBFS whenever narration exceeds -36 dBFS.
  // BGM stereo width is reduced to 70% for mono-safe YouTube/phone playback.
  //
  //   threshold=0.015  → -36 dBFS trigger level (narration onset)
  //   ratio=8          → aggressive 8:1 duck
  //   attack=15ms      → allows first consonant through before duck engages
  //   release=400ms    → natural BGM fade-back (sounds unforced)
  //   weights=1 0.1    → amix: narration unity, BGM at -20 dBFS (-20 dB = 0.1)

  let mixedPath = normalizedPath;

  if (bgmFile && fs.existsSync(bgmFile)) {
    mixedPath = path.join(outputDir, '_mixed.wav');

    execFileSync('ffmpeg', [
      '-y',
      '-i', normalizedPath,
      '-stream_loop', '-1', '-i', bgmFile,
      '-filter_complex', [
        // Narration bus: resample to 48kHz stereo
        '[0:a]aformat=sample_rates=48000:channel_layouts=stereo[narr];',
        // BGM bus: resample, reduce stereo width to 70% (mono-safe), loop-trim to narration length
        `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,` +
        `atrim=duration=${totalDuration.toFixed(3)},` +
        // stereotools: mlev=0.7 (reduce mid), slev=0.7 (reduce side) → 70% width
        `stereotools=mlev=0.7:slev=0.7:sbal=0:mbal=0:mode=ms>lr[bgm_wide];`,
        // Sidechain: narration triggers BGM duck
        '[narr]asplit=2[narr_out][narr_sc];',
        '[bgm_wide][narr_sc]sidechaincompress=' +
          'threshold=0.015:ratio=8:attack=15:release=400:makeup=1:knee=4:detection=peak[bgm_ducked];',
        // Final mix: narration at unity, BGM at -20 dBFS (weight 0.1)
        '[narr_out][bgm_ducked]amix=inputs=2:weights=1 0.1:normalize=0[out]',
      ].join(''),
      '-map', '[out]',
      '-ar', '48000',
      '-ac', '2',
      '-t', totalDuration.toFixed(3),
      mixedPath,
    ], { stdio: 'pipe' });
  }

  // --- Step 5: Encode to master MP3 at 48kHz / 192kbps -------------------
  const masterPath = path.join(outputDir, 'master-audio.mp3');

  execFileSync('ffmpeg', [
    '-y',
    '-i', mixedPath,
    '-codec:a', 'libmp3lame',
    '-b:a', '192k',
    '-ar', '48000',
    '-ac', '2',
    masterPath,
  ], { stdio: 'pipe' });

  // --- Step 6: LUFS verify — fails build if outside ±0.5 LU -------------
  await verifyLufs(masterPath, {
    targetLufs: target.lufs,
    targetTruePeak: target.truePeak,
    toleranceLu: 0.5,
  });

  // --- Cleanup temp files -------------------------------------------------
  const tempFiles = [
    rawMasterPath,
    normalizedPath,
    concatListPath,
    ...(bgmFile ? [mixedPath] : []),
    ...processedPaths,
  ];
  for (const f of tempFiles) {
    try { fs.unlinkSync(f); } catch { /* ignore missing */ }
  }

  return { masterPath, totalDuration, sceneOffsets };
}
