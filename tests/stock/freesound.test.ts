import { describe, it, expect, vi, afterEach } from 'vitest';
import { FreesoundProvider } from '../../src/stock/providers/freesound.js';

describe('FreesoundProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['FREESOUND_API_KEY'];
  });

  it('returns empty array when FREESOUND_API_KEY is not set', async () => {
    delete process.env['FREESOUND_API_KEY'];
    const provider = new FreesoundProvider();
    const result = await provider.searchSfx('whoosh');
    expect(result).toEqual([]);
  });

  it('returns SFX clips with CC0 license', async () => {
    process.env['FREESOUND_API_KEY'] = 'test-key';
    const mockData = {
      results: [
        { id: 123, name: 'Whoosh 1', previews: { 'preview-lq-mp3': 'https://freesound.org/data/previews/123/123.mp3' }, license: 'Creative Commons 0' },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }));
    const provider = new FreesoundProvider();
    const result = await provider.searchSfx('whoosh');
    expect(result.length).toBe(1);
    expect(result[0].license).toBe('CC0');
  });

  it('returns empty array on fetch error', async () => {
    process.env['FREESOUND_API_KEY'] = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const provider = new FreesoundProvider();
    const result = await provider.searchSfx('ding');
    expect(result).toEqual([]);
  });
});
