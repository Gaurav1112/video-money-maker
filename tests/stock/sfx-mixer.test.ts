import { describe, it, expect } from 'vitest';
import { buildSfxMix } from '../../src/stock/sfx-mixer.js';

describe('buildSfxMix', () => {
  it('returns empty strings when no sfx clips', () => {
    const result = buildSfxMix({
      sceneBoundaries: [{ sceneIndex: 0, startSec: 0 }, { sceneIndex: 1, startSec: 5 }],
      sfxClips: [],
      totalDurationSec: 30,
    });
    expect(result.filterComplex).toBe('');
    expect(result.inputArgs).toEqual([]);
  });

  it('returns empty strings when no boundaries', () => {
    const result = buildSfxMix({
      sceneBoundaries: [],
      sfxClips: [{ id: 'sfx-1', url: 'https://example.com/sfx.mp3', durationSec: 0.5 }],
      totalDurationSec: 30,
    });
    expect(result.filterComplex).toBe('');
  });

  it('generates filter_complex for scene transitions', () => {
    const result = buildSfxMix({
      sceneBoundaries: [
        { sceneIndex: 0, startSec: 0 },
        { sceneIndex: 1, startSec: 5 },
        { sceneIndex: 2, startSec: 10 },
      ],
      sfxClips: [
        { id: 'sfx-1', url: 'https://example.com/sfx1.mp3', durationSec: 0.4 },
        { id: 'sfx-2', url: 'https://example.com/sfx2.mp3', durationSec: 0.5 },
      ],
      totalDurationSec: 30,
    });
    expect(result.filterComplex).toContain('amix');
    expect(result.filterComplex).toContain('adelay');
    expect(result.inputArgs.length).toBeGreaterThan(0);
  });

  it('result is a string snapshot', () => {
    const result = buildSfxMix({
      sceneBoundaries: [
        { sceneIndex: 0, startSec: 0 },
        { sceneIndex: 1, startSec: 9 },
      ],
      sfxClips: [{ id: 'sfx-whoosh', url: 'https://freesound.org/data/previews/495/495400_10614873-lq.mp3', durationSec: 0.4 }],
      totalDurationSec: 30,
    });
    expect(result.filterComplex).toContain('adelay=9000|9000');
  });
});
