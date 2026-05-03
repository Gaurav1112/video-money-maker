/**
 * tests/stock/cache.test.ts
 *
 * Unit tests for StockCache using fetch mock.
 * Uses a project-relative temp dir so we never write to /tmp.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Readable } from 'node:stream';
import { StockCache } from '../../src/stock/cache.js';
import type { StockClip } from '../../src/stock/types.js';
import { FALLBACK_CLIP } from '../../src/stock/fallback.js';

const CACHE_ROOT = path.join(__dirname, '_testcache');

function makeClip(url: string): StockClip {
  return {
    id: 'test-clip-01',
    provider: 'coverr',
    url,
    tags: ['test'],
    durationSec: 5,
    width: 1920,
    height: 1080,
    license: 'Coverr License',
  };
}

function makeResponseWithBody(content: string): Response {
  const readable = Readable.toWeb(Readable.from([Buffer.from(content)])) as ReadableStream<Uint8Array>;
  return new Response(readable, { status: 200 });
}

describe('StockCache', () => {
  beforeEach(() => {
    fs.mkdirSync(CACHE_ROOT, { recursive: true });
    delete process.env['STOCK_CACHE_OFFLINE'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['STOCK_CACHE_OFFLINE'];
    // Clean up test cache dir
    if (fs.existsSync(CACHE_ROOT)) {
      fs.rmSync(CACHE_ROOT, { recursive: true, force: true });
    }
  });

  it('downloads a clip and returns local path', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeResponseWithBody('fake-video-data'));
    const cache = new StockCache(CACHE_ROOT);
    const localPath = await cache.download(makeClip('https://example.com/video.mp4'));

    expect(fs.existsSync(localPath)).toBe(true);
    expect(localPath.endsWith('.mp4')).toBe(true);
  });

  it('cache hit skips fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(makeResponseWithBody('data'));
    const cache = new StockCache(CACHE_ROOT);
    const clip = makeClip('https://example.com/cached.mp4');

    // First download
    await cache.download(clip);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second request — should use cache
    await cache.download(clip);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // still 1
  });

  it('filename is deterministic (sha256-based)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(makeResponseWithBody('d'))
    );
    const cache = new StockCache(CACHE_ROOT);
    const url = 'https://example.com/deterministic.mp4';
    const path1 = await cache.download(makeClip(url));
    fs.unlinkSync(path1);
    const path2 = await cache.download(makeClip(url));
    expect(path.basename(path1)).toBe(path.basename(path2));
  });

  it('throws on cache miss in offline mode', async () => {
    process.env['STOCK_CACHE_OFFLINE'] = '1';
    const cache = new StockCache(CACHE_ROOT);
    await expect(
      cache.download(makeClip('https://example.com/not-cached.mp4'))
    ).rejects.toThrow('offline mode');
  });

  it('returns synthetic URL directly without fetching for FALLBACK_CLIP', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cache = new StockCache(CACHE_ROOT);
    const result = await cache.download(FALLBACK_CLIP);
    expect(result).toBe('synthetic://solid-color');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('throws on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
    const cache = new StockCache(CACHE_ROOT);
    await expect(cache.download(makeClip('https://example.com/missing.mp4'))).rejects.toThrow('404');
  });
});
