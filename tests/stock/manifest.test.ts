/**
 * tests/stock/manifest.test.ts
 *
 * Unit tests for ManifestProvider using an inline fixture
 * (does not depend on assets/stock/manifest.json).
 */

import { describe, it, expect } from 'vitest';
import { ManifestProvider } from '../../src/stock/providers/manifest.js';
import type { StockClip } from '../../src/stock/types.js';

// ─── Inline fixture ───────────────────────────────────────────────────────────

const COVERR_CLIPS: StockClip[] = [
  {
    id: 'coverr-server-01',
    provider: 'coverr',
    url: 'https://example.com/server.mp4',
    tags: ['server', 'network', 'traffic'],
    durationSec: 15,
    width: 1920,
    height: 1080,
    license: 'Coverr License',
  },
  {
    id: 'coverr-code-01',
    provider: 'coverr',
    url: 'https://example.com/code.mp4',
    tags: ['code', 'developer', 'typing'],
    durationSec: 10,
    width: 1920,
    height: 1080,
    license: 'Coverr License',
  },
  {
    id: 'coverr-portrait-01',
    provider: 'coverr',
    url: 'https://example.com/portrait.mp4',
    tags: ['server', 'code', 'network'],
    durationSec: 12,
    width: 1080,
    height: 1920,
    license: 'Coverr License',
  },
];

const MIXKIT_CLIPS: StockClip[] = [
  {
    id: 'mixkit-data-01',
    provider: 'mixkit',
    url: 'https://example.com/data.mp4',
    tags: ['server', 'network', 'data'],
    durationSec: 8,
    width: 1280,
    height: 720,
    license: 'Mixkit License',
  },
];

const ALL_CLIPS = [...COVERR_CLIPS, ...MIXKIT_CLIPS];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ManifestProvider', () => {
  it('filters by provider — coverr provider does not return mixkit clips', async () => {
    const provider = new ManifestProvider('coverr', ALL_CLIPS);
    const results = await provider.search({ keywords: ['server'], minDurationSec: 0, portrait: false });
    expect(results.every((c) => c.provider === 'coverr')).toBe(true);
  });

  it('filters by provider — mixkit provider does not return coverr clips', async () => {
    const provider = new ManifestProvider('mixkit', ALL_CLIPS);
    const results = await provider.search({ keywords: ['server'], minDurationSec: 0, portrait: false });
    expect(results.every((c) => c.provider === 'mixkit')).toBe(true);
  });

  it('returns clips ordered by score (more keyword matches = higher rank)', async () => {
    const provider = new ManifestProvider('coverr', ALL_CLIPS);
    // With portrait=true: coverr-portrait-01 matches both 'server' and 'code'
    // AND gets the portrait orientation bonus — it should rank first
    const results = await provider.search({
      keywords: ['server', 'code'],
      minDurationSec: 0,
      portrait: true,
    });
    expect(results[0].id).toBe('coverr-portrait-01');
  });

  it('earlier-keyword matches outrank later-keyword matches', async () => {
    const provider = new ManifestProvider('coverr', ALL_CLIPS);
    // 'server' is keyword[0], 'code' is keyword[1]
    // coverr-server-01 matches keyword[0] only
    // coverr-code-01 matches keyword[1] only
    // → server-01 should outrank code-01
    const results = await provider.search({
      keywords: ['server', 'code'],
      minDurationSec: 0,
      portrait: false,
    });
    const ids = results.map((c) => c.id);
    // coverr-portrait-01 matches both (index 0 and 1) so it's first
    // coverr-server-01 matches index 0 (weight = 2), coverr-code-01 matches index 1 (weight = 1)
    const serverIdx = ids.indexOf('coverr-server-01');
    const codeIdx = ids.indexOf('coverr-code-01');
    expect(serverIdx).toBeLessThan(codeIdx);
  });

  it('excludeIds removes specified clips', async () => {
    const provider = new ManifestProvider('coverr', ALL_CLIPS);
    const results = await provider.search({
      keywords: ['server'],
      minDurationSec: 0,
      portrait: false,
      excludeIds: ['coverr-server-01'],
    });
    expect(results.find((c) => c.id === 'coverr-server-01')).toBeUndefined();
  });

  it('empty keywords returns empty results', async () => {
    const provider = new ManifestProvider('coverr', ALL_CLIPS);
    const results = await provider.search({ keywords: [], minDurationSec: 0, portrait: false });
    expect(results).toHaveLength(0);
  });

  it('portrait preference adds score boost — portrait clip ranks above landscape when portrait=true', async () => {
    const provider = new ManifestProvider('coverr', ALL_CLIPS);
    const portrait = await provider.search({
      keywords: ['server'],
      minDurationSec: 0,
      portrait: true,
    });
    // coverr-portrait-01 is the only portrait clip and should be ranked first
    expect(portrait[0].id).toBe('coverr-portrait-01');
  });

  it('is deterministic — two runs return same order', async () => {
    const provider = new ManifestProvider('coverr', ALL_CLIPS);
    const q = { keywords: ['server', 'code', 'network'], minDurationSec: 0, portrait: true };
    const run1 = await provider.search(q);
    const run2 = await provider.search(q);
    expect(run1.map((c) => c.id)).toEqual(run2.map((c) => c.id));
  });
});
