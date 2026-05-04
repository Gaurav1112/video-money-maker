/**
 * tests/stock/composer.test.ts
 *
 * Integration tests for the ffmpeg composer.
 * Creates a synthetic 1-scene video and verifies output dimensions + streams.
 *
 * Requires ffmpeg and ffprobe on PATH (or ffmpeg-static / ffprobe-static).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compose } from '../../src/stock/composer.js';

const WORK_ROOT = path.join(__dirname, '_composertest');
const CLIP_PATH  = path.join(WORK_ROOT, 'testclip.mp4');
const OUT_PATH   = path.join(WORK_ROOT, 'out.mp4');

function ffprobePath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('ffprobe-static') as { path: string }).path;
  } catch {
    return 'ffprobe';
  }
}

function ffprobeJson(file: string): Record<string, unknown> {
  const out = execFileSync(ffprobePath(), [
    '-v', 'error',
    '-show_streams',
    '-show_format',
    '-of', 'json',
    file,
  ]).toString();
  return JSON.parse(out) as Record<string, unknown>;
}

beforeAll(() => {
  fs.mkdirSync(WORK_ROOT, { recursive: true });

  // Generate a 2-second synthetic portrait clip (1080×1920 black)
  execFileSync('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'color=c=black:s=1080x1920:r=30',
    '-t', '2',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    CLIP_PATH,
  ]);
}, 60_000);

afterAll(() => {
  if (fs.existsSync(WORK_ROOT)) {
    fs.rmSync(WORK_ROOT, { recursive: true, force: true });
  }
});

describe('compose', () => {
  it('produces an output file', async () => {
    await compose({
      scenes: [{ clipPath: CLIP_PATH, durationSec: 2, sceneIndex: 0 }],
      outputPath: OUT_PATH,
      workDir: path.join(WORK_ROOT, 'work1'),
    });
    expect(fs.existsSync(OUT_PATH)).toBe(true);
    expect(fs.statSync(OUT_PATH).size).toBeGreaterThan(1000);
  }, 120_000);

  it('output is 1080×1920 portrait', () => {
    const info = ffprobeJson(OUT_PATH);
    const streams = info['streams'] as Array<Record<string, unknown>>;
    const video = streams.find((s) => s['codec_type'] === 'video');
    expect(video).toBeDefined();
    expect(video!['width']).toBe(1080);
    expect(video!['height']).toBe(1920);
  });

  it('output has h264 video codec', () => {
    const info = ffprobeJson(OUT_PATH);
    const streams = info['streams'] as Array<Record<string, unknown>>;
    const video = streams.find((s) => s['codec_type'] === 'video');
    expect(video!['codec_name']).toBe('h264');
  });

  it('output has aac audio codec', () => {
    const info = ffprobeJson(OUT_PATH);
    const streams = info['streams'] as Array<Record<string, unknown>>;
    const audio = streams.find((s) => s['codec_type'] === 'audio');
    expect(audio).toBeDefined();
    expect(audio!['codec_name']).toBe('aac');
  });

  it('output duration is within 100ms of expected', () => {
    const info = ffprobeJson(OUT_PATH);
    const fmt = info['format'] as Record<string, unknown>;
    const dur = parseFloat(fmt['duration'] as string);
    expect(Math.abs(dur - 2.0)).toBeLessThan(0.1);
  });

  it('composes multiple scenes by concatenation', async () => {
    const outMulti = path.join(WORK_ROOT, 'out-multi.mp4');
    await compose({
      scenes: [
        { clipPath: CLIP_PATH, durationSec: 2, sceneIndex: 0 },
        { clipPath: CLIP_PATH, durationSec: 2, sceneIndex: 1 },
      ],
      outputPath: outMulti,
      workDir: path.join(WORK_ROOT, 'work2'),
    });
    const info = ffprobeJson(outMulti);
    const fmt = info['format'] as Record<string, unknown>;
    const dur = parseFloat(fmt['duration'] as string);
    expect(dur).toBeGreaterThan(3.5); // ~4 seconds
  }, 120_000);

  it('handles synthetic fallback clip without downloading', async () => {
    const outFallback = path.join(WORK_ROOT, 'out-fallback.mp4');
    await compose({
      scenes: [{ clipPath: 'synthetic://solid-color', durationSec: 2, sceneIndex: 0 }],
      outputPath: outFallback,
      workDir: path.join(WORK_ROOT, 'work3'),
    });
    expect(fs.existsSync(outFallback)).toBe(true);
  }, 120_000);

  it('composes closing scene with brandSubline + endCardText without error', async () => {
    const outBrand = path.join(WORK_ROOT, 'out-brand.mp4');
    await compose({
      scenes: [{
        clipPath: CLIP_PATH,
        durationSec: 2,
        sceneIndex: 0,
        brandSubline: 'www.guru-sishya.in · Interview Ready in 21 Days',
        endCardText: 'Subscribe\n@GuruSishya-India',
      }],
      outputPath: outBrand,
      workDir: path.join(WORK_ROOT, 'work-brand'),
    });
    expect(fs.existsSync(outBrand)).toBe(true);
  }, 120_000);

  it('composes body scene with brandSubline (no endCard) without error', async () => {
    const outBodyBrand = path.join(WORK_ROOT, 'out-body-brand.mp4');
    await compose({
      scenes: [{
        clipPath: CLIP_PATH,
        durationSec: 2,
        sceneIndex: 0,
        brandSubline: 'www.guru-sishya.in · Interview Ready in 21 Days',
      }],
      outputPath: outBodyBrand,
      workDir: path.join(WORK_ROOT, 'work-body-brand'),
    });
    expect(fs.existsSync(outBodyBrand)).toBe(true);
  }, 120_000);
});
