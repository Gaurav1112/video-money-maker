/**
 * tests/retention/audio-lufs.test.ts
 *
 * RED:
 *  1. `tests/fixtures/master-1s.wav` does not exist yet.
 *  2. `ffprobe-static` is not in devDependencies.
 *  3. audio-mixer.ts does not apply loudnorm filter.
 *
 * GREEN after:
 *  - Run: npm run test:fixtures  (generates fixture via ffmpeg loudnorm)
 *  - Add ffprobe-static to devDependencies
 *  - buildMixCommand appends loudnorm=I=-14:TP=-1.5:LRA=11 to output
 *
 * Generate fixture (add to package.json scripts):
 *   ffmpeg -y -f lavfi -i "sine=440:d=1" -ar 44100 -ac 2
 *     -af "loudnorm=I=-14:TP=-1.5:LRA=11" tests/fixtures/master-1s.wav
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const FIXTURE = path.join(__dirname, '../fixtures/master-1s.wav');
const FFPROBE = (() => {
  try {
    return require('ffprobe-static').path as string;
  } catch {
    return 'ffprobe'; // system ffprobe fallback
  }
})();

function measureLufs(file: string): { I: number; truePeak: number } {
  const out = execFileSync(
    FFPROBE,
    [
      '-v', 'error',
      '-f', 'lavfi',
      '-i', `amovie='${file.replace(/'/g, "'\\''")}',ebur128=peak=true`,
      '-show_entries', 'frame=tags',
      '-of', 'json',
    ],
    { encoding: 'utf8', timeout: 30_000 },
  );
  const mI = out.match(/"lavfi\.r128\.I":\s*"(-?\d+\.?\d*)"/);
  const peaks = [...out.matchAll(/"lavfi\.r128\.true_peak":\s*"(-?\d+\.?\d*)"/g)].map((m) =>
    parseFloat(m[1]),
  );
  return {
    I: mI ? parseFloat(mI[1]) : NaN,
    truePeak: peaks.length > 0 ? Math.max(...peaks) : NaN,
  };
}

describe('audio: LUFS & true peak (fixture)', () => {
  it('fixture file exists', () => {
    expect(fs.existsSync(FIXTURE)).toBe(true);
  });

  it('integrated loudness ∈ [-15, -13] LUFS', () => {
    const { I } = measureLufs(FIXTURE);
    expect(I).toBeGreaterThanOrEqual(-15);
    expect(I).toBeLessThanOrEqual(-13);
  });

  it('true peak ≤ -1 dBTP', () => {
    const { truePeak } = measureLufs(FIXTURE);
    expect(truePeak).toBeLessThanOrEqual(-1.0);
  });
});
