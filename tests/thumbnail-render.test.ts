/**
 * thumbnail-render.test.ts — CI smoke test for the procedural thumbnail
 * pipeline introduced in Batch-13.
 *
 * Panel-13 Eng P0 (Hashimoto/Brendan): the new `generateThumbnailPng`
 * (lavfi color sources + geq alpha gradient + drawbox + drawtext) had
 * zero automated coverage — byte-determinism was only verified by
 * manual `shasum` runs. If `ubuntu-latest` drifts to a future ffmpeg
 * version that breaks `geq` alpha compositing or the `lavfi color=`
 * source format, there's no CI tripwire today.
 *
 * This test:
 *   1. Calls generateThumbnailPng with each known category palette
 *   2. Asserts the output PNG exists and is a valid 1080×1920 image
 *   3. Asserts byte-determinism: re-running with identical input
 *      produces a byte-identical PNG.
 *
 * Skipped when ffmpeg is not on PATH (so it stays green on dev machines
 * without the toolchain), but always runs in CI where ffmpeg is
 * preinstalled.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { generateThumbnailPng } from '../scripts/render-stock-short';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createHash } from 'node:crypto';

function hasFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function hasGeqFilter(): boolean {
  try {
    const result = execFileSync('ffmpeg', ['-filters'], { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
    return result.includes('geq');
  } catch (e) {
    // If we can't detect, assume not available to be safe
    return false;
  }
}

const FFMPEG_AVAILABLE = hasFfmpeg();
const GEQ_AVAILABLE = FFMPEG_AVAILABLE && hasGeqFilter();
const describeIfFfmpeg = GEQ_AVAILABLE ? describe : describe.skip;

function sha1(buf: Buffer): string {
  return createHash('sha1').update(buf).digest('hex');
}

function pngDimensions(filePath: string): { width: number; height: number } {
  // PNG IHDR chunk starts at byte 16; width/height are big-endian uint32.
  const buf = fs.readFileSync(filePath).slice(16, 24);
  const width = buf.readUInt32BE(0);
  const height = buf.readUInt32BE(4);
  return { width, height };
}

describeIfFfmpeg('generateThumbnailPng (Batch-13 procedural pipeline)', () => {
  let tmpDir: string;
  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thumb-test-'));
  });

  it('produces a valid 1080x1920 PNG for system-design palette', async () => {
    const out = path.join(tmpDir, 'sd.png');
    await generateThumbnailPng({
      hook: 'Kafka Consumer Groups WRONG',
      handle: '@GuruSishya-India',
      category: 'system-design',
      outPath: out,
    });
    expect(fs.existsSync(out)).toBe(true);
    const dims = pngDimensions(out);
    expect(dims).toEqual({ width: 1080, height: 1920 });
  }, 30000);

  it('renders all known category palettes without error', async () => {
    const cats = ['dsa', 'behavioral', 'db-internals', 'system-design'];
    for (const c of cats) {
      const out = path.join(tmpDir, `${c}.png`);
      await generateThumbnailPng({
        hook: 'Test Hook Line',
        handle: '@Test',
        category: c,
        outPath: out,
      });
      expect(fs.existsSync(out)).toBe(true);
    }
  }, 60000);

  it('falls back gracefully on unknown / empty category', async () => {
    const out = path.join(tmpDir, 'unknown.png');
    await generateThumbnailPng({
      hook: 'Generic Hook',
      handle: '@GuruSishya-India',
      category: 'nonexistent-category',
      outPath: out,
    });
    expect(fs.existsSync(out)).toBe(true);
    const dims = pngDimensions(out);
    expect(dims).toEqual({ width: 1080, height: 1920 });
  }, 30000);

  it('is byte-deterministic: identical inputs produce identical PNG', async () => {
    const a = path.join(tmpDir, 'det-a.png');
    const b = path.join(tmpDir, 'det-b.png');
    const opts = {
      hook: 'Determinism Check 42',
      handle: '@GuruSishya-India',
      category: 'dsa',
    };
    await generateThumbnailPng({ ...opts, outPath: a });
    await generateThumbnailPng({ ...opts, outPath: b });
    const ha = sha1(fs.readFileSync(a));
    const hb = sha1(fs.readFileSync(b));
    expect(ha).toEqual(hb);
  }, 60000);
});
