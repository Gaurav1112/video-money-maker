import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Snaps a given start frame time to the nearest audio energy local minimum within ±150ms.
 * Returns the snapped frame number.
 */
export async function snapToBeat(
  startFrameMs: number,
  audioPath: string,
  fps: number
): Promise<number> {
  const windowMs = 150;
  const startSec = Math.max(0, (startFrameMs - windowMs) / 1000);
  const durationSec = (windowMs * 2) / 1000;

  try {
    const { stderr } = await execFileAsync('ffmpeg', [
      '-y',
      '-i', audioPath,
      '-ss', String(startSec),
      '-t', String(durationSec),
      '-af', 'astats=metadata=1:reset=1',
      '-f', 'null',
      '-',
    ], { maxBuffer: 5 * 1024 * 1024 });

    const rmsMatches = [...stderr.matchAll(/lavfi\.astats\.Overall\.RMS_level=([+-]?\d+(?:\.\d+)?)/g)];
    if (rmsMatches.length === 0) {
      return Math.round((startFrameMs / 1000) * fps);
    }

    let minRms = Infinity;
    let minIndex = Math.floor(rmsMatches.length / 2);
    for (let i = 0; i < rmsMatches.length; i++) {
      const rms = parseFloat(rmsMatches[i][1]);
      if (rms < minRms) {
        minRms = rms;
        minIndex = i;
      }
    }

    const offsetMs = (minIndex / rmsMatches.length) * (windowMs * 2) - windowMs;
    const snappedMs = startFrameMs + offsetMs;
    return Math.round((snappedMs / 1000) * fps);
  } catch {
    return Math.round((startFrameMs / 1000) * fps);
  }
}
