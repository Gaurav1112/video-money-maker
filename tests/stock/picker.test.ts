/**
 * tests/stock/picker.test.ts
 *
 * Tests for pickClipsForStoryboard using in-memory stub providers.
 */

import { describe, it, expect } from 'vitest';
import { pickClipsForStoryboard } from '../../src/stock/picker.js';
import { FALLBACK_CLIP } from '../../src/stock/fallback.js';
import type { ClipQuery, StockClip, StockSearchProvider, StockStoryboard } from '../../src/stock/types.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeClip(overrides: Partial<StockClip> & { id: string }): StockClip {
  return {
    provider: 'coverr',
    url: `https://example.com/${overrides.id}.mp4`,
    tags: [],
    durationSec: 15,
    width: 1920,
    height: 1080,
    license: 'Coverr License',
    ...overrides,
  };
}

class StubProvider implements StockSearchProvider {
  readonly name = 'coverr' as const;
  private clips: StockClip[];

  constructor(clips: StockClip[]) {
    this.clips = clips;
  }

  async search(query: ClipQuery): Promise<StockClip[]> {
    const exclude = new Set(query.excludeIds ?? []);
    return this.clips.filter((c) => {
      if (exclude.has(c.id)) return false;
      return c.tags.some((t) => query.keywords.includes(t));
    });
  }
}

const STORYBOARD: StockStoryboard = {
  fps: 30,
  width: 1920,
  height: 1080,
  topic: 'Load Balancing',
  durationInFrames: 450,
  scenes: [
    { sceneIndex: 0, startFrame: 0,   endFrame: 150, durationFrames: 150, type: 'text', narration: 'server load traffic', templateId: 'LoadBalancerArch' },
    { sceneIndex: 1, startFrame: 150, endFrame: 300, durationFrames: 150, type: 'text', narration: 'cache data storage',   templateId: 'CacheArch' },
    { sceneIndex: 2, startFrame: 300, endFrame: 450, durationFrames: 150, type: 'text', narration: 'code developer',      templateId: 'CodeArch' },
  ],
};

describe('pickClipsForStoryboard', () => {
  it('returns one PickedClip per scene in scene order', async () => {
    const clips = [
      makeClip({ id: 'c1', tags: ['server', 'load', 'traffic', 'network', 'routing'] }),
      makeClip({ id: 'c2', tags: ['cache', 'memory', 'data', 'storage'] }),
      makeClip({ id: 'c3', tags: ['code', 'programming', 'developer', 'software'] }),
    ];
    const provider = new StubProvider(clips);
    const picked = await pickClipsForStoryboard(STORYBOARD, [provider]);

    expect(picked).toHaveLength(3);
    expect(picked[0].clip.id).toBe('c1');
    expect(picked[1].clip.id).toBe('c2');
    expect(picked[2].clip.id).toBe('c3');
  });

  it('never repeats a clip across scenes', async () => {
    // Only one clip that matches all scenes
    const clips = [
      makeClip({ id: 'shared', tags: ['server', 'load', 'cache', 'code', 'network', 'routing', 'traffic'] }),
    ];
    const provider = new StubProvider(clips);
    const picked = await pickClipsForStoryboard(STORYBOARD, [provider]);

    const ids = picked.map((p) => p.clip.id);
    // Exactly one scene uses 'shared'
    expect(ids.filter((id) => id === 'shared')).toHaveLength(1);
    // The other 2 scenes fall back to FALLBACK_CLIP
    expect(ids.filter((id) => id === FALLBACK_CLIP.id)).toHaveLength(2);
  });

  it('uses FALLBACK_CLIP when no results are found for a scene', async () => {
    const provider = new StubProvider([]); // no clips
    const picked = await pickClipsForStoryboard(STORYBOARD, [provider]);
    expect(picked.every((p) => p.clip.id === FALLBACK_CLIP.id)).toBe(true);
  });

  it('is deterministic — same inputs produce same output', async () => {
    const clips = [
      makeClip({ id: 'a', tags: ['server', 'load', 'traffic', 'network', 'routing'] }),
      makeClip({ id: 'b', tags: ['cache', 'memory', 'data', 'storage'] }),
      makeClip({ id: 'c', tags: ['code', 'programming', 'developer', 'software'] }),
    ];
    const p1 = await pickClipsForStoryboard(STORYBOARD, [new StubProvider(clips)]);
    const p2 = await pickClipsForStoryboard(STORYBOARD, [new StubProvider(clips)]);
    expect(p1.map((x) => x.clip.id)).toEqual(p2.map((x) => x.clip.id));
  });

  it('queries multiple providers and merges results', async () => {
    const providerA = new StubProvider([
      makeClip({ id: 'from-a', tags: ['server', 'load', 'traffic', 'network', 'routing'] }),
    ]);
    const providerB = new StubProvider([
      makeClip({ id: 'from-b', tags: ['cache', 'memory', 'data', 'storage'] }),
    ]);
    const pickedA = (await pickClipsForStoryboard(STORYBOARD, [providerA]))[1];
    const pickedB = (await pickClipsForStoryboard(STORYBOARD, [providerB]))[0];
    // With both providers, each scene should get its best match
    const both = await pickClipsForStoryboard(STORYBOARD, [providerA, providerB]);
    expect(both[0].clip.id).toBe('from-a');
    expect(both[1].clip.id).toBe('from-b');
    // Ensure both providers were queried in isolation
    expect(pickedA.clip.id).toBe(FALLBACK_CLIP.id); // A has no cache clip
    expect(pickedB.clip.id).toBe(FALLBACK_CLIP.id); // B has no server clip
  });
});
