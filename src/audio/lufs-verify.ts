/**
 * lufs-verify.ts — Post-render LUFS assertion using ffmpeg ebur128
 *
 * Wraps `ffmpeg -af ebur128` to measure EBU R128 integrated loudness and
 * true peak of a rendered audio file. Throws a descriptive error if the
 * measurement falls outside the allowed tolerance window.
 *
 * Usage:
 *   import { verifyLufs } from './lufs-verify';
 *   await verifyLufs('master-audio.mp3', { targetLufs: -14, targetTruePeak: -1.0 });
 *
 * Fails the build (throws) if:
 *   - Integrated loudness is outside targetLufs ± toleranceLu
 *   - True peak exceeds targetTruePeak
 *
 * Zero-cost: uses the ffmpeg binary already required by audio-stitcher.
 * Deterministic: ebur128 is a fixed algorithm with no random state.
 * GH-Actions compatible: exits non-zero on failure so the workflow step fails.
 */

import { spawnSync } from 'child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface LufsVerifyOptions {
  /** Target integrated loudness in LUFS (e.g. -14 for YouTube) */
  targetLufs: number;
  /** True-peak ceiling in dBTP (e.g. -1.0) */
  targetTruePeak: number;
  /** Allowed deviation from targetLufs (default ±0.5 LU) */
  toleranceLu?: number;
}

export interface LufsMeasurement {
  integratedLufs: number;
  truePeakDbtp: number;
  loudnessRangeLu: number;
}

// ---------------------------------------------------------------------------
// measureLufs: run ffmpeg ebur128 and return parsed measurement
// ---------------------------------------------------------------------------
export function measureLufs(filePath: string): LufsMeasurement {
  // ffmpeg ebur128 prints a summary block to stderr on exit:
  //   Integrated loudness:
  //     I:         -14.2 LUFS
  //   True peak:
  //     Peak:       -1.3 dBFS
  //   Loudness range:
  //     LRA:         6.2 LU
  const result = spawnSync(
    'ffmpeg',
    [
      '-nostats',
      '-i', filePath,
      '-af', 'ebur128=peak=true',
      '-f', 'null',
      '-',
    ],
    { encoding: 'utf-8' },
  );

  const stderr = (result.stderr ?? '') + (result.stdout ?? '');

  const iMatch    = stderr.match(/I:\s*([-\d.]+)\s*LUFS/);
  const peakMatch = stderr.match(/Peak:\s*([-\d.]+)\s*dBFS/);
  const lraMatch  = stderr.match(/LRA:\s*([-\d.]+)\s*LU/);

  if (!iMatch || !peakMatch) {
    throw new Error(
      `[lufs-verify] Could not parse ebur128 output for "${filePath}".\n` +
      `stderr tail:\n${stderr.slice(-600)}`,
    );
  }

  return {
    integratedLufs:   parseFloat(iMatch[1]),
    truePeakDbtp:     parseFloat(peakMatch[1]),
    loudnessRangeLu:  lraMatch ? parseFloat(lraMatch[1]) : NaN,
  };
}

// ---------------------------------------------------------------------------
// verifyLufs: assert measurement is within spec, throw on failure
// ---------------------------------------------------------------------------
export async function verifyLufs(
  filePath: string,
  opts: LufsVerifyOptions,
): Promise<LufsMeasurement> {
  const { targetLufs, targetTruePeak, toleranceLu = 0.5 } = opts;

  const m = measureLufs(filePath);

  const lufsLow  = targetLufs - toleranceLu;
  const lufsHigh = targetLufs + toleranceLu;

  const errors: string[] = [];

  if (m.integratedLufs < lufsLow || m.integratedLufs > lufsHigh) {
    errors.push(
      `Integrated loudness ${m.integratedLufs.toFixed(1)} LUFS ` +
      `is outside target ${targetLufs} ± ${toleranceLu} LU ` +
      `(allowed window: ${lufsLow} to ${lufsHigh} LUFS)`,
    );
  }

  if (m.truePeakDbtp > targetTruePeak) {
    errors.push(
      `True peak ${m.truePeakDbtp.toFixed(1)} dBTP exceeds ceiling ${targetTruePeak} dBTP` +
      (m.truePeakDbtp > 0
        ? ' — HARD CLIPPING: digital distortion will be audible'
        : ''),
    );
  }

  if (errors.length > 0) {
    const summary = [
      `[lufs-verify] ❌ Audio loudness assertion FAILED for "${filePath}":`,
      ...errors.map(e => `  • ${e}`),
      ``,
      `  Measured: ${m.integratedLufs.toFixed(1)} LUFS / ${m.truePeakDbtp.toFixed(1)} dBTP`,
      `  Target:   ${targetLufs} LUFS / ≤ ${targetTruePeak} dBTP`,
      ``,
      `  Likely cause: 'volume=3dB' post-loudnorm boost is present. Search audio-stitcher.ts`,
      `  for 'volume=' and delete any gain applied after the loudnorm filter chain.`,
    ].join('\n');

    throw new Error(summary);
  }

  console.log(
    `[lufs-verify] ✅ ${filePath}: ` +
    `${m.integratedLufs.toFixed(1)} LUFS / ${m.truePeakDbtp.toFixed(1)} dBTP ` +
    `(target ${targetLufs} LUFS / ≤ ${targetTruePeak} dBTP)`,
  );

  return m;
}

// ---------------------------------------------------------------------------
// CLI wrapper: node lufs-verify.js <file> [targetLufs] [targetTruePeak]
// Used by smoke-test.sh and GH Actions audio-gate step
// ---------------------------------------------------------------------------
if (require.main === module) {
  const [, , filePath, lufsArg, peakArg] = process.argv;
  if (!filePath) {
    console.error('Usage: npx ts-node src/audio/lufs-verify.ts <file> [targetLufs=-14] [targetTruePeak=-1.0]');
    process.exit(1);
  }

  const targetLufs      = parseFloat(lufsArg  ?? '-14');
  const targetTruePeak  = parseFloat(peakArg  ?? '-1.0');

  verifyLufs(filePath, { targetLufs, targetTruePeak, toleranceLu: 0.5 })
    .then(m => {
      console.log(JSON.stringify(m, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}
