import { describe, it, expect } from 'vitest';
import { extractKeywords } from '../../src/stock/keyword-extractor.js';
import type { StockScene } from '../../src/stock/types.js';

function scene(overrides: Partial<StockScene> = {}): StockScene {
  return {
    sceneIndex: 0, startFrame: 0, endFrame: 90,
    durationFrames: 90, type: 'text', narration: '',
    ...overrides,
  };
}

describe('extractKeywords Hindi fallback', () => {
  it('pure Hindi narration returns ≥2 keywords from template/topic fallback', () => {
    const s = scene({ narration: 'आज तुम मेरा खाना हो', templateId: 'LoadBalancerArch' });
    const kws = extractKeywords(s, 'Load Balancer');
    expect(kws.length).toBeGreaterThanOrEqual(2);
  });

  it('pure Hindi with no templateId returns default tech tags', () => {
    const s = scene({ narration: 'एक छोटा खरगोश था जो बहुत ही होशियार था' });
    const kws = extractKeywords(s, 'Story');
    expect(kws.length).toBeGreaterThanOrEqual(2);
    expect(['technology', 'business', 'abstract', 'digital'].some(t => kws.includes(t))).toBe(true);
  });

  it('Hinglish narration returns keywords from English tokens', () => {
    const s = scene({ narration: 'Server architecture bahut important hai for scaling' });
    const kws = extractKeywords(s, 'Systems');
    expect(kws.some(k => ['server', 'architecture', 'scaling', 'important'].includes(k))).toBe(true);
  });
});
