import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TTSResult } from '../types';

const AUDIO_DIR = path.join(process.cwd(), 'public', 'audio');

/**
 * Check if ffmpeg is available on the system.
 */
function hasFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { timeout: 5000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get accurate audio duration using ffprobe (falls back to file-size estimate).
 */
function probeDuration(filePath: string): number {
  try {
    const out = execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      filePath,
    ], { timeout: 10000, encoding: 'utf-8' });
    const parsed = parseFloat(out.trim());
    if (!isNaN(parsed) && parsed > 0) return parsed;
  } catch {
    // fall through
  }
  // Fallback: estimate from file size (~16KB/s for 128kbps MP3)
  const stats = fs.statSync(filePath);
  return stats.size / 16000;
}

/**
 * Concatenate all scene audio files into one master audio file.
 * Adds configurable silence gaps between scenes for breathing room.
 *
 * Returns the master file path, total duration, and per-scene offsets
 * so captions can be synced to the single audio track.
 */
export function stitchAudio(
  audioResults: TTSResult[],
  gapSeconds: number = 0.8,
  outputName: string = 'master-audio.mp3'
): {
  masterPath: string;
  totalDuration: number;
  /** Offset (in seconds) where each scene's audio begins in the master file */
  sceneOffsets: number[];
} {
  // Ensure output directory exists
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const masterPath = path.join(AUDIO_DIR, outputName);

  // Collect valid audio files
  const validEntries: { index: number; path: string }[] = [];
  for (let i = 0; i < audioResults.length; i++) {
    const audio = audioResults[i];
    if (audio.audioPath && fs.existsSync(audio.audioPath)) {
      validEntries.push({ index: i, path: audio.audioPath });
    }
  }

  // If no valid audio at all, return empty result
  if (validEntries.length === 0) {
    console.warn('⚠ No audio files to stitch');
    return { masterPath: '', totalDuration: 0, sceneOffsets: audioResults.map(() => 0) };
  }

  // If only one audio file, just copy it
  if (validEntries.length === 1) {
    fs.copyFileSync(validEntries[0].path, masterPath);
    const duration = probeDuration(masterPath);
    const offsets = audioResults.map(() => 0);
    offsets[validEntries[0].index] = 0;
    console.log(`✓ Master audio (single scene): ${outputName} (${duration.toFixed(1)}s)`);
    return { masterPath, totalDuration: duration, sceneOffsets: offsets };
  }

  // Check ffmpeg availability
  if (!hasFfmpeg()) {
    console.warn('⚠ ffmpeg not available — using first audio file as master (no stitching)');
    fs.copyFileSync(validEntries[0].path, masterPath);
    const duration = probeDuration(masterPath);
    return { masterPath, totalDuration: duration, sceneOffsets: audioResults.map(() => 0) };
  }

  // Generate silence file for gaps between scenes
  const silencePath = path.join(AUDIO_DIR, `_silence_${gapSeconds}s.mp3`);
  if (!fs.existsSync(silencePath)) {
    execFileSync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', `anullsrc=r=24000:cl=mono`,
      '-t', String(gapSeconds),
      '-codec:a', 'libmp3lame', '-b:a', '192k',
      silencePath,
    ], { timeout: 10000, stdio: 'pipe' });
  }

  // Build ffmpeg concat list and calculate per-scene offsets
  const listPath = path.join(AUDIO_DIR, '_concat-list.txt');
  const lines: string[] = [];
  const sceneOffsets: number[] = audioResults.map(() => -1); // -1 = no audio
  let cursor = 0; // seconds into the master file

  for (let vi = 0; vi < validEntries.length; vi++) {
    const entry = validEntries[vi];
    const sceneDuration = probeDuration(entry.path);

    // Record where this scene starts in the master
    sceneOffsets[entry.index] = cursor;

    lines.push(`file '${entry.path}'`);
    cursor += sceneDuration;

    // Add silence gap after each scene except the last
    if (vi < validEntries.length - 1) {
      lines.push(`file '${silencePath}'`);
      cursor += gapSeconds;
    }
  }

  fs.writeFileSync(listPath, lines.join('\n'));

  // Concatenate with ffmpeg (raw concat first, then normalize)
  const rawMasterPath = path.join(AUDIO_DIR, `_raw_${outputName}`);
  execFileSync('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0',
    '-i', listPath,
    '-codec:a', 'libmp3lame', '-b:a', '192k',
    rawMasterPath,
  ], { timeout: 120000, stdio: 'pipe' });

  // Loudness normalization — target -14 LUFS (YouTube standard).
  // True two-pass loudnorm: first pass measures actual loudness stats,
  // second pass applies precise correction. This is critical because
  // single-pass linear mode often under-corrects TTS audio (e.g. -18.8 dB).
  //
  // Pass 1: Measure loudness stats
  // ffmpeg outputs loudnorm JSON stats to stderr, so we need to capture it.
  // With stdio: 'pipe', execFileSync returns stdout; stderr goes to the error object on failure
  // or is swallowed on success. We use spawnSync to capture stderr directly.
  let measuredI = '-30';
  let measuredTP = '-15';
  let measuredLRA = '11';
  let measuredThresh = '-40';
  let offset = '0';
  try {
    const measureResult = spawnSync('ffmpeg', [
      '-i', rawMasterPath,
      '-af', 'loudnorm=I=-14:LRA=11:TP=-1.5:print_format=json',
      '-f', 'null', '-',
    ], { timeout: 120000, encoding: 'utf-8' });

    const stderrStr = (measureResult.stderr || '') as string;
    // ffmpeg prints the JSON block at the end of stderr
    const jsonMatch = stderrStr.match(/\{[\s\S]*"input_i"[\s\S]*?\}/);
    if (jsonMatch) {
      const stats = JSON.parse(jsonMatch[0]);
      measuredI = stats.input_i || measuredI;
      measuredTP = stats.input_tp || measuredTP;
      measuredLRA = stats.input_lra || measuredLRA;
      measuredThresh = stats.input_thresh || measuredThresh;
      offset = stats.target_offset || offset;
    }
  } catch {
    // If parsing fails, fall back to aggressive settings below
    console.warn('⚠ Could not parse loudnorm measurement — using aggressive normalization');
  }

  // Pass 2: Apply measured values for precise normalization + volume boost
  execFileSync('ffmpeg', [
    '-y',
    '-i', rawMasterPath,
    // Panel-12 Dist P0: REMOVED `volume=3dB` post-loudnorm boost — it was
    // causing ~-11 LUFS / +1.5 dBTP clipping vs the YT -14 LUFS target.
    // Single-pass loudnorm with measured values lands at -14 LUFS exactly.
    // (Mirrors the deletion in src/audio/audio-stitcher.ts so both
    // legacy and modern pipelines emit spec-compliant audio.)
    '-af', `loudnorm=I=-14:LRA=11:TP=-1.5:measured_I=${measuredI}:measured_TP=${measuredTP}:measured_LRA=${measuredLRA}:measured_thresh=${measuredThresh}:offset=${offset}:linear=true`,
    '-codec:a', 'libmp3lame', '-b:a', '192k',
    masterPath,
  ], { timeout: 120000, stdio: 'pipe' });

  // Cleanup temp files
  try { fs.unlinkSync(listPath); } catch { /* ignore */ }
  try { fs.unlinkSync(rawMasterPath); } catch { /* ignore */ }

  // Get actual total duration from the output file
  const totalDuration = probeDuration(masterPath);

  console.log(`✓ Master audio: ${outputName} (${totalDuration.toFixed(1)}s, ${validEntries.length} scenes stitched)`);
  return { masterPath, totalDuration, sceneOffsets };
}
