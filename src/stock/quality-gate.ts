import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const THRESHOLD = 100;

export interface QualityGateResult {
  passed: boolean;
  reason?: string;
  meanVariance: number;
}

async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
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

async function getFrameVariance(videoPath: string, timeOffset: number): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffmpeg', [
      '-y',
      '-ss', String(timeOffset),
      '-i', videoPath,
      '-vframes', '1',
      '-vf', 'format=gray,signalstats=stat=tout+vrep+brng',
      '-f', 'null',
      '-',
    ], { maxBuffer: 10 * 1024 * 1024 });
    const match = stdout.match(/YAVG=(\d+(?:\.\d+)?)/);
    if (match) return parseFloat(match[1]) * 10;
    return 500;
  } catch {
    return 500;
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
