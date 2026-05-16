/**
 * tests/stock/pixabay.test.ts
 *
 * Unit tests for PixabayProvider using fetch mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PixabayProvider } from '../../src/stock/providers/pixabay.js';

const MOCK_RESPONSE = {
  hits: [
    {
      id: 11111,
      pageURL: 'https://pixabay.com/videos/server-11111/',
      user: 'pixuser1',
      duration: 18,
      videos: {
        large:  { url: 'https://cdn.pixabay.com/large.mp4',  width: 1920, height: 1080, size: 5000000 },
        medium: { url: 'https://cdn.pixabay.com/medium.mp4', width: 1280, height: 720,  size: 2000000 },
      },
    },
    {
      id: 22222,
      pageURL: 'https://pixabay.com/videos/code-22222/',
      user: 'devmaker',
      duration: 12,
      videos: {
        medium: { url: 'https://cdn.pixabay.com/med2.mp4', width: 1280, height: 720, size: 1500000 },
      },
    },
  ],
};

describe('PixabayProvider', () => {
  beforeEach(() => {
    process.env['PIXABAY_API_KEY'] = 'px-key-abc';
  });

  afterEach(() => {
    delete process.env['PIXABAY_API_KEY'];
    vi.restoreAllMocks();
  });

  it('returns [] without calling fetch when API key is missing', async () => {
    delete process.env['PIXABAY_API_KEY'];
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const provider = new PixabayProvider();
    const results = await provider.search({ keywords: ['server'], minDurationSec: 0, portrait: false });
    expect(results).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls correct URL with API key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    const provider = new PixabayProvider();
    await provider.search({ keywords: ['server', 'network'], minDurationSec: 0, portrait: false });

    const calledUrl = (vi.mocked(globalThis.fetch).mock.calls[0][0]) as string;
    expect(calledUrl).toContain('pixabay.com/api/videos');
    expect(calledUrl).toContain('key=px-key-abc');
  });

  it('maps response to StockClip fields correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    const provider = new PixabayProvider();
    const results = await provider.search({ keywords: ['server'], minDurationSec: 0, portrait: false });

    expect(results).toHaveLength(2);
    const first = results[0];
    expect(first.id).toBe('pixabay-11111');
    expect(first.provider).toBe('pixabay');
    expect(first.license).toBe('Pixabay License');
    expect(first.credit).toBe('pixuser1');
    expect(first.pageUrl).toBe('https://pixabay.com/videos/server-11111/');
    // Prefers 'large' over 'medium'
    expect(first.url).toBe('https://cdn.pixabay.com/large.mp4');
    expect(first.durationSec).toBe(18);
  });

  it('falls back to medium when large is absent', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    const provider = new PixabayProvider();
    const results = await provider.search({ keywords: ['code'], minDurationSec: 0, portrait: false });
    const second = results[1];
    expect(second.url).toBe('https://cdn.pixabay.com/med2.mp4');
  });

  it('returns [] and warns on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 })
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const provider = new PixabayProvider();
    const results = await provider.search({ keywords: ['server'], minDurationSec: 0, portrait: false });
    expect(results).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('403'));
  });

  it('returns [] and warns on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const provider = new PixabayProvider();
    const results = await provider.search({ keywords: ['server'], minDurationSec: 0, portrait: false });
    expect(results).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  it('provider name is pixabay', () => {
    expect(new PixabayProvider().name).toBe('pixabay');
  });
});
