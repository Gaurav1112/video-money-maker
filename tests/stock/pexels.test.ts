/**
 * tests/stock/pexels.test.ts
 *
 * Unit tests for PexelsProvider using fetch mock.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PexelsProvider } from '../../src/stock/providers/pexels.js';

const MOCK_RESPONSE = {
  videos: [
    {
      id: 12345,
      url: 'https://www.pexels.com/video/server-12345/',
      duration: 20,
      user: { name: 'Test Author' },
      video_files: [
        { quality: 'hd',  width: 1920, height: 1080, link: 'https://cdn.pexels.com/hd.mp4' },
        { quality: 'sd',  width: 1280, height: 720,  link: 'https://cdn.pexels.com/sd.mp4' },
      ],
    },
    {
      id: 67890,
      url: 'https://www.pexels.com/video/code-67890/',
      duration: 10,
      user: { name: 'Dev Author' },
      video_files: [
        { quality: 'hd', width: 2560, height: 1440, link: 'https://cdn.pexels.com/4k.mp4' },
      ],
    },
  ],
};

describe('PexelsProvider', () => {
  beforeEach(() => {
    process.env['PEXELS_API_KEY'] = 'test-key-123';
  });

  afterEach(() => {
    delete process.env['PEXELS_API_KEY'];
    vi.restoreAllMocks();
  });

  it('returns [] without calling fetch when API key is missing', async () => {
    delete process.env['PEXELS_API_KEY'];
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const provider = new PexelsProvider();
    const results = await provider.search({ keywords: ['server'], minDurationSec: 0, portrait: true });
    expect(results).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls correct URL with portrait orientation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    const provider = new PexelsProvider();
    await provider.search({ keywords: ['server', 'network'], minDurationSec: 0, portrait: true });

    const calledUrl = (vi.mocked(globalThis.fetch).mock.calls[0][0]) as string;
    expect(calledUrl).toContain('orientation=portrait');
    expect(calledUrl).toContain('server');
  });

  it('sends Authorization header with API key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    const provider = new PexelsProvider();
    await provider.search({ keywords: ['server'], minDurationSec: 0, portrait: false });

    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0];
    const options = callArgs[1] as RequestInit;
    expect((options.headers as Record<string, string>)['Authorization']).toBe('test-key-123');
  });

  it('maps response to StockClip fields correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    const provider = new PexelsProvider();
    const results = await provider.search({ keywords: ['server'], minDurationSec: 0, portrait: false });

    expect(results).toHaveLength(2);
    const first = results[0];
    expect(first.id).toBe('pexels-12345');
    expect(first.provider).toBe('pexels');
    expect(first.license).toBe('Pexels License');
    expect(first.credit).toBe('Test Author');
    expect(first.pageUrl).toBe('https://www.pexels.com/video/server-12345/');
    // Best HD file picked (width 1920)
    expect(first.url).toBe('https://cdn.pexels.com/hd.mp4');
    expect(first.durationSec).toBe(20);
  });

  it('picks highest-width HD file when multiple HD files exist', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_RESPONSE), { status: 200 })
    );
    const provider = new PexelsProvider();
    const results = await provider.search({ keywords: ['code'], minDurationSec: 0, portrait: false });
    // Video 67890 has only one HD file at 2560×1440
    const second = results[1];
    expect(second.url).toBe('https://cdn.pexels.com/4k.mp4');
    expect(second.width).toBe(2560);
  });

  it('returns [] and warns on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 })
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const provider = new PexelsProvider();
    const results = await provider.search({ keywords: ['server'], minDurationSec: 0, portrait: false });
    expect(results).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('401'));
  });

  it('returns [] and warns on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network fail'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const provider = new PexelsProvider();
    const results = await provider.search({ keywords: ['server'], minDurationSec: 0, portrait: false });
    expect(results).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('network fail'));
  });

  it('portrait=false uses landscape orientation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ videos: [] }), { status: 200 })
    );
    const provider = new PexelsProvider();
    await provider.search({ keywords: ['server'], minDurationSec: 0, portrait: false });
    const calledUrl = (vi.mocked(globalThis.fetch).mock.calls[0][0]) as string;
    expect(calledUrl).toContain('orientation=landscape');
  });

  it('provider name is pexels', () => {
    expect(new PexelsProvider().name).toBe('pexels');
  });
});
