/**
 * tests/retention/ducking.test.ts
 *
 * RED:
 *  1. `buildMixCommand` does not yet apply sidechain compression for layers
 *     where duckDuringDialogue=true — the `duckedVolumeDb` field exists in
 *     types but is ignored in the command builder.
 *  2. bgm-under-narration-1s.wav fixture does not exist.
 *
 * GREEN after:
 *  - buildMixCommand applies `sidechaincompress` filter for duckable layers
 *  - Generate fixture:
 *      ffmpeg -y -i bgm-solo-1s.wav -i master-1s.wav \
 *        -filter_complex "[0:a][1:a]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=200[a]" \
 *        -map "[a]" tests/fixtures/bgm-under-narration-1s.wav
 */
import { describe, it, expect } from 'vitest';
import { buildMixCommand } from '../../src/audio/audio-mixer';
import type { AudioLayer } from '../../src/types';
import { execFileSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const FFMPEG = (() => {
  try {
    return require('ffmpeg-static') as string;
  } catch {
    return 'ffmpeg';
  }
})();

function rmsDb(file: string): number {
  const log = execFileSync(
    FFMPEG,
    ['-i', file, '-af', 'astats=metadata=1:reset=0', '-f', 'null', '-'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000 },
  );
  const m = log.match(/RMS level dB:\s*(-?\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : NaN;
}

const DIALOGUE_LAYER: AudioLayer = {
  type: 'dialogue',
  filePath: 'dialogue.wav',
  startMs: 0,
  volumeDb: 0,
};

const MUSIC_LAYER: AudioLayer = {
  type: 'music',
  filePath: 'bgm.mp3',
  startMs: 0,
  volumeDb: -6,
  duckDuringDialogue: true,
  duckedVolumeDb: -21,
};

describe('retention: audio ducking', () => {
  it('buildMixCommand produces a sidechain filter when duckDuringDialogue=true', () => {
    const args = buildMixCommand('out.mp3', [DIALOGUE_LAYER, MUSIC_LAYER]);
    const filterArg = args.join(' ');
    expect(filterArg).toMatch(/sidechaincompress|sidechain/i);
  });

  it('buildMixCommand result is an array (never a shell string)', () => {
    const args = buildMixCommand('out.mp3', [DIALOGUE_LAYER, MUSIC_LAYER]);
    expect(Array.isArray(args)).toBe(true);
    // Must not be a single joined string that would be passed to sh -c
    expect(args.length).toBeGreaterThan(3);
  });

  it('no duckable layer at full volume when dialogue exists', () => {
    const args = buildMixCommand('out.mp3', [DIALOGUE_LAYER, MUSIC_LAYER]);
    const full = args.join(' ');
    // The duckable layer should never have volume=1.0000 (full volume)
    // when a dialogue layer is present
    expect(full).not.toMatch(/\[1:a\].*volume=1\.0000.*\[p1\]/);
  });

  describe('fixture: BGM ducked ≥ 15 dB under narration (requires fixtures)', () => {
    const solo = path.join(__dirname, '../fixtures/bgm-solo-1s.wav');
    const ducked = path.join(__dirname, '../fixtures/bgm-under-narration-1s.wav');

    it('fixture files exist', () => {
      expect(fs.existsSync(solo)).toBe(true);
      expect(fs.existsSync(ducked)).toBe(true);
    });

    it('BGM solo RMS vs ducked BGM differs ≥ 15 dB', () => {
      const soloRms = rmsDb(solo);
      const duckedRms = rmsDb(ducked);
      expect(soloRms - duckedRms).toBeGreaterThanOrEqual(15);
    });
  });
});
