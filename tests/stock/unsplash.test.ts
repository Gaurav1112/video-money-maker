import { describe, it, expect, vi, afterEach } from 'vitest';
import { UnsplashProvider } from '../../src/stock/providers/unsplash.js';

describe('UnsplashProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['UNSPLASH_ACCESS_KEY'];
  });

  it('returns null when UNSPLASH_ACCESS_KEY is not set', async () => {
    delete process.env['UNSPLASH_ACCESS_KEY'];
    const provider = new UnsplashProvider();
    const result = await provider.searchPhoto('test query');
    expect(result).toBeNull();
  });

  it('returns photo URL when API responds successfully', async () => {
    process.env['UNSPLASH_ACCESS_KEY'] = 'test-key';
    const mockResponse = {
      results: [{ id: 'abc', urls: { regular: 'https://images.unsplash.com/photo-1', small: '' }, alt_description: null }],
      total: 1,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }));
    const provider = new UnsplashProvider();
    const result = await provider.searchPhoto('load balancer');
    expect(result).toBe('https://images.unsplash.com/photo-1');
  });

  it('returns null when API fails', async () => {
    process.env['UNSPLASH_ACCESS_KEY'] = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    const provider = new UnsplashProvider();
    const result = await provider.searchPhoto('test');
    expect(result).toBeNull();
  });

  it('returns null when no results', async () => {
    process.env['UNSPLASH_ACCESS_KEY'] = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], total: 0 }),
    }));
    const provider = new UnsplashProvider();
    const result = await provider.searchPhoto('nonexistent');
    expect(result).toBeNull();
  });
});
