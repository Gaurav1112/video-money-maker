/**
 * tests/audio-stitcher.test.ts — golden-file LUFS regression test
 *
 * Approach:
 *   1. Use a deterministic 10-second sine-tone WAV as "TTS scene" input.
 *      ffmpeg -f lavfi -i "sine=frequency=440:duration=10" is fully deterministic.
 *   2. Run stitchAudio() on it with platform='youtube' (target -14 LUFS).
 *   3. Assert the output master-audio.mp3 measures -14 ± 0.5 LUFS and ≤ -1.0 dBTP.
 *
 * The sine tone is NOT a golden audio file (too large for git). Instead the
 * test generates it on-the-fly from ffmpeg lavfi — deterministic by construction.
 *
 * Run: npx jest tests/audio-stitcher.test.ts
 * CI:  The test requires ffmpeg in PATH (available in GH Actions ubuntu-latest).
 *
 * NOTE: This test does NOT mock ffmpeg — it exercises the real signal chain.
 * Execution time: ~8s on a modern machine (two loudnorm passes + ebur128 measure).
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFileSync } from 'child_process';
import { stitchAudio, PLATFORM_TARGETS } from '../src/audio/audio-stitcher';
import { measureLufs } from '../src/audio/lufs-verify';

// ---------------------------------------------------------------------------
// Test fixtures — generated deterministically from ffmpeg lavfi
// ---------------------------------------------------------------------------

const TEST_WORK_DIR = path.join(os.tmpdir(), 'audio-stitcher-test-' + process.pid);

/** Generate a deterministic 8-second 440 Hz sine tone at -20 dBFS as a WAV */
function generateSineTone(outPath: string, durationSec = 8, freqHz = 440): void {
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `sine=frequency=${freqHz}:duration=${durationSec}:sample_rate=48000`,
    '-af', `volume=-20dB`,   // -20 dBFS — realistic TTS level before normalization
    '-ar', '48000',
    '-ac', '1',
    outPath,
  ], { stdio: 'pipe' });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
  fs.mkdirSync(TEST_WORK_DIR, { recursive: true });
});

afterAll(() => {
  fs.rmSync(TEST_WORK_DIR, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('audio-stitcher — EBU R128 compliance', () => {

  test(
    'YouTube: output is -14 ±0.5 LUFS and ≤ -1.0 dBTP (no +3dB boost)',
    async () => {
      // Arrange: two "scenes" — deterministic sine tones of different durations
      const scene0 = path.join(TEST_WORK_DIR, 'scene0.wav');
      const scene1 = path.join(TEST_WORK_DIR, 'scene1.wav');
      generateSineTone(scene0, 8, 440);
      generateSineTone(scene1, 6, 523); // C5 for variety

      const outputDir = path.join(TEST_WORK_DIR, 'yt-output');

      // Act
      const result = await stitchAudio(
        [
          { sceneIndex: 0, audioPath: scene0, durationSeconds: 8 },
          { sceneIndex: 1, audioPath: scene1, durationSeconds: 6 },
        ],
        {
          outputDir,
          platform: 'youtube',
          silenceDurationMs: 800,
        },
      );

      // Assert: file exists
      expect(fs.existsSync(result.masterPath)).toBe(true);

      // Assert: LUFS measurement
      const m = measureLufs(result.masterPath);

      const target = PLATFORM_TARGETS.youtube;
      expect(m.integratedLufs).toBeGreaterThanOrEqual(target.lufs - 0.5);
      expect(m.integratedLufs).toBeLessThanOrEqual(target.lufs + 0.5);

      // CRITICAL: this test fails if volume=3dB is present in the filter chain
      // (output would be ~-11 LUFS and true peak would exceed -1.0 dBTP)
      expect(m.truePeakDbtp).toBeLessThanOrEqual(target.truePeak);
    },
    30_000, // 30s timeout — two ffmpeg loudnorm passes
  );

  test(
    'Instagram: output is -16 ±0.5 LUFS',
    async () => {
      const scene0 = path.join(TEST_WORK_DIR, 'scene_ig0.wav');
      generateSineTone(scene0, 6, 392); // G4
      const outputDir = path.join(TEST_WORK_DIR, 'ig-output');

      const result = await stitchAudio(
        [{ sceneIndex: 0, audioPath: scene0, durationSeconds: 6 }],
        { outputDir, platform: 'instagram', silenceDurationMs: 800 },
      );

      const m = measureLufs(result.masterPath);
      const target = PLATFORM_TARGETS.instagram;

      expect(m.integratedLufs).toBeGreaterThanOrEqual(target.lufs - 0.5);
      expect(m.integratedLufs).toBeLessThanOrEqual(target.lufs + 0.5);
      expect(m.truePeakDbtp).toBeLessThanOrEqual(target.truePeak);
    },
    30_000,
  );

  test(
    'sceneOffsets are monotonically increasing',
    async () => {
      const scene0 = path.join(TEST_WORK_DIR, 'scene_off0.wav');
      const scene1 = path.join(TEST_WORK_DIR, 'scene_off1.wav');
      const scene2 = path.join(TEST_WORK_DIR, 'scene_off2.wav');
      generateSineTone(scene0, 4, 262);
      generateSineTone(scene1, 5, 330);
      generateSineTone(scene2, 3, 392);
      const outputDir = path.join(TEST_WORK_DIR, 'offset-output');

      const result = await stitchAudio(
        [
          { sceneIndex: 0, audioPath: scene0, durationSeconds: 4 },
          { sceneIndex: 1, audioPath: scene1, durationSeconds: 5 },
          { sceneIndex: 2, audioPath: scene2, durationSeconds: 3 },
        ],
        { outputDir, platform: 'youtube' },
      );

      expect(result.sceneOffsets).toHaveLength(3);
      expect(result.sceneOffsets[0]).toBe(0);
      expect(result.sceneOffsets[1]).toBeGreaterThan(result.sceneOffsets[0]);
      expect(result.sceneOffsets[2]).toBeGreaterThan(result.sceneOffsets[1]);
    },
    30_000,
  );

  test(
    'BGM sidechain: output still within ±0.5 LUFS of target when BGM is mixed',
    async () => {
      const scene0 = path.join(TEST_WORK_DIR, 'scene_bgm0.wav');
      const bgm    = path.join(TEST_WORK_DIR, 'bgm.wav');
      generateSineTone(scene0, 8, 440);
      // BGM: lower frequency, same level — simulates ambient track
      generateSineTone(bgm, 30, 110);
      const outputDir = path.join(TEST_WORK_DIR, 'bgm-output');

      const result = await stitchAudio(
        [{ sceneIndex: 0, audioPath: scene0, durationSeconds: 8 }],
        { outputDir, platform: 'youtube', bgmFile: bgm },
      );

      const m = measureLufs(result.masterPath);
      const target = PLATFORM_TARGETS.youtube;

      // Allow slightly wider tolerance when BGM is present (±1.0 LU)
      expect(m.integratedLufs).toBeGreaterThanOrEqual(target.lufs - 1.0);
      expect(m.integratedLufs).toBeLessThanOrEqual(target.lufs + 1.0);
      expect(m.truePeakDbtp).toBeLessThanOrEqual(target.truePeak);
    },
    40_000,
  );

  test(
    'verifyLufs throws when volume=3dB boost is simulated (regression guard)',
    async () => {
      // Simulate what the old code produced: a boosted file ~-11 LUFS
      const boostedPath = path.join(TEST_WORK_DIR, 'boosted.wav');
      const toneIn = path.join(TEST_WORK_DIR, 'tone_for_boost.wav');
      generateSineTone(toneIn, 8, 440);

      // Apply loudnorm -14 THEN +3dB (the old broken chain)
      execFileSync('ffmpeg', [
        '-y', '-i', toneIn,
        '-af', 'loudnorm=I=-14:LRA=11:TP=-1.5:linear=false,volume=3dB',
        boostedPath,
      ], { stdio: 'pipe' });

      const { verifyLufs } = await import('../src/audio/lufs-verify');

      await expect(
        verifyLufs(boostedPath, { targetLufs: -14, targetTruePeak: -1.0, toleranceLu: 0.5 }),
      ).rejects.toThrow(/loudness assertion FAILED/);
    },
    20_000,
  );

});
