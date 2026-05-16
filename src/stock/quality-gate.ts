import { execFile } from 'node:child_process';
import { FFMPEG_BIN, FFPROBE_BIN } from '../lib/ffmpeg-bin.js';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
// Composite score = mean luma (YAVG, 0–255) + 10 × mean frame-to-frame delta
// (YDIF). Real footage averages ~80–150; solid-black is 0; static slide is
// ~YAVG only (no YDIF). Threshold 30 catches solid-black, near-black, and
// frozen-frame failures while accepting dim but valid B-roll.
const THRESHOLD = 30;

export interface QualityGateResult {
  passed: boolean;
  reason?: string;
  meanVariance: number;
}

async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(FFPROBE_BIN, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      videoPath,
    ]);
    return parseFloat(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

/**
 * Extracts frame "variance" by combining signalstats YAVG (mean luma 0–255)
 * and YDIF (frame-to-prev-frame mean abs delta). A solid-black frame returns
 * YAVG≈0 and YDIF≈0, scoring 0. Real footage typically scores 60+ from YAVG
 * alone, plus motion adds YDIF.
 *
 * ffmpeg writes `lavfi.signalstats.*` metadata to STDERR via the `metadata`
 * filter. Previous implementation read stdout (always empty for `-f null -`)
 * AND used `stat=tout+vrep+brng` which DOES NOT include YAVG → regex never
 * matched → fallback 500*10 = 5000 → quality gate ALWAYS passed (silent black).
 */
async function getFrameVariance(videoPath: string, timeOffset: number): Promise<number> {
  try {
    // Sample 12 consecutive frames so YDIF (needs 2 frames) has values.
    const { stderr } = await execFileAsync(FFMPEG_BIN, [
      '-y',
      '-ss', String(timeOffset),
      '-i', videoPath,
      '-vframes', '12',
      '-vf', 'signalstats,metadata=mode=print',
      '-f', 'null',
      '-',
    ], { maxBuffer: 10 * 1024 * 1024 });

    const yavgMatches = [...stderr.matchAll(/lavfi\.signalstats\.YAVG=(\d+(?:\.\d+)?)/g)];
    const ydifMatches = [...stderr.matchAll(/lavfi\.signalstats\.YDIF=(\d+(?:\.\d+)?)/g)];
    if (yavgMatches.length === 0) return 0;

    const yavgMean = yavgMatches.reduce((a, m) => a + parseFloat(m[1]), 0) / yavgMatches.length;
    const ydifMean = ydifMatches.length > 0
      ? ydifMatches.reduce((a, m) => a + parseFloat(m[1]), 0) / ydifMatches.length
      : 0;

    // Composite score: YAVG (0–255 luma) + 10×YDIF (motion). Solid black ≈ 0.
    return yavgMean + 10 * ydifMean;
  } catch {
    return 0;
  }
}

export async function runQualityGate(videoPath: string): Promise<QualityGateResult> {
  const duration = await getVideoDuration(videoPath);
  if (duration <= 0) {
    return { passed: false, reason: 'Could not probe video duration', meanVariance: 0 };
  }

  const sampleCount = 5;
  const variances: number[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const t = (duration * (i + 1)) / (sampleCount + 1);
    const v = await getFrameVariance(videoPath, t);
    variances.push(v);
  }

  const meanVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
  const passed = meanVariance >= THRESHOLD;

  return {
    passed,
    meanVariance,
    reason: passed ? undefined : `Mean frame variance ${meanVariance.toFixed(1)} < threshold ${THRESHOLD}`,
  };
}
