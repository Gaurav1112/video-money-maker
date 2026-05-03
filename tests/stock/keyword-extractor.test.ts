/**
 * tests/stock/keyword-extractor.test.ts
 */

import { describe, it, expect } from 'vitest';
import { extractKeywords } from '../../src/stock/keyword-extractor.js';
import type { StockScene } from '../../src/stock/types.js';

function scene(overrides: Partial<StockScene> = {}): StockScene {
  return {
    sceneIndex: 0,
    startFrame: 0,
    endFrame: 90,
    durationFrames: 90,
    type: 'text',
    narration: '',
    ...overrides,
  };
}

describe('extractKeywords', () => {
  it('returns up to 6 keywords', () => {
    const kws = extractKeywords(
      scene({ narration: 'loading server cache network data storage memory systems' }),
      'extra topic words here'
    );
    expect(kws.length).toBeLessThanOrEqual(6);
  });

  it('is deterministic — same inputs produce same output', () => {
    const s = scene({ narration: 'the server handles network traffic and cache misses', templateId: 'LoadBalancerArch' });
    expect(extractKeywords(s, 'Load Balancing')).toEqual(extractKeywords(s, 'Load Balancing'));
  });

  it('templateId keywords come before narration keywords', () => {
    const s = scene({
      narration: 'coding developer typing laptop',
      templateId: 'LoadBalancerArch',
    });
    const kws = extractKeywords(s, 'Test');
    // 'server','load','traffic','network','routing' from template should appear first
    expect(kws[0]).toBe('server');
  });

  it('no templateId falls back to narration and topic', () => {
    const s = scene({ narration: 'caching data storage systems' });
    const kws = extractKeywords(s, 'Cache Systems');
    expect(kws).toContain('cache');
    // No template keywords
    expect(kws).not.toContain('server');
  });

  it('deduplicates across template + narration + topic', () => {
    const s = scene({
      narration: 'server network routing traffic',
      templateId: 'LoadBalancerArch',
    });
    const kws = extractKeywords(s, 'server');
    const unique = [...new Set(kws)];
    expect(kws).toEqual(unique);
  });

  it('drops stop-words from narration', () => {
    const s = scene({ narration: 'this is the very important load balancer that handles traffic' });
    const kws = extractKeywords(s, 'System');
    expect(kws).not.toContain('this');
    expect(kws).not.toContain('that');
    expect(kws).not.toContain('very');
  });

  it('drops tokens shorter than 4 characters', () => {
    const s = scene({ narration: 'the big red box has data' });
    const kws = extractKeywords(s, 'Box');
    expect(kws).not.toContain('big');
    expect(kws).not.toContain('red');
    expect(kws).not.toContain('has');
  });

  it('handles CacheArch templateId', () => {
    const s = scene({ templateId: 'CacheArch' });
    const kws = extractKeywords(s, '');
    expect(kws).toContain('cache');
    expect(kws).toContain('memory');
  });

  it('returns empty array when narration is empty and no templateId and empty topic', () => {
    const kws = extractKeywords(scene({ narration: '' }), '');
    expect(kws).toHaveLength(0);
  });

  it('extracts topic words when narration is empty', () => {
    const kws = extractKeywords(scene({ narration: '' }), 'Load Balancing Basics');
    expect(kws).toContain('load');
    expect(kws).toContain('balancing');
    expect(kws).toContain('basics');
  });
});
