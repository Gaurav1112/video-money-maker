/**
 * tests/publishing/exactly-once.test.ts
 *
 * RED: upload-youtube.ts does not check for an existing videoId before
 *      uploading. No idempotency key / registry check at call site.
 *
 * GREEN after: uploadEpisode() checks EpisodeRegistry for existing videoId
 *              before initiating upload; returns existing id if found.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocked YouTube client
const mockInsert = vi.fn();
vi.mock('googleapis', () => ({
  google: {
    youtube: () => ({ videos: { insert: mockInsert } }),
    auth: { OAuth2: vi.fn().mockReturnValue({ setCredentials: vi.fn() }) },
  },
}));

// EpisodeRegistry stub
const mockRegistry = {
  episodes: {
    42: {
      episodeNumber: 42,
      languages: {
        hi: { rendered: true, uploaded: true, videoId: 'existing-vid-id' },
      },
    },
  },
  lastRendered: 42,
  lastUploaded: 42,
};

let uploadEpisode: (
  episodeNumber: number,
  language: string,
  videoPath: string,
  registry: typeof mockRegistry,
) => Promise<string>;

try {
  const mod = await import('../../src/pipeline/upload-youtube');
  uploadEpisode = mod.uploadEpisode;
} catch {
  uploadEpisode = undefined as any;
}

describe('publishing: exactly-once upload', () => {
  beforeEach(() => mockInsert.mockClear());

  it('uploadEpisode is exported', () => {
    expect(typeof uploadEpisode).toBe('function');
  });

  it('returns existing videoId without calling YouTube API if already uploaded', async () => {
    const id = await uploadEpisode(42, 'hi', '/videos/ep42-hi.mp4', mockRegistry as any);
    expect(id).toBe('existing-vid-id');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('calls YouTube API for episodes not yet uploaded', async () => {
    mockInsert.mockResolvedValueOnce({ data: { id: 'new-vid-id' } });
    const id = await uploadEpisode(42, 'te', '/videos/ep42-te.mp4', mockRegistry as any);
    expect(id).toBe('new-vid-id');
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});
