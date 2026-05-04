import { describe, it, expect } from 'vitest';
import { generateShortMetadata } from '../../src/services/short-metadata.js';
import type { StockStoryboard } from '../../src/stock/types.js';

const STORY: StockStoryboard = {
  fps: 30,
  width: 1080,
  height: 1920,
  topic: 'Kafka Consumer Groups',
  audioFile: 'master.mp3',
  durationInFrames: 900,
  scenes: [
    {
      sceneIndex: 0, startFrame: 0, endFrame: 90, durationFrames: 90,
      type: 'hook', narration: 'A short hook line', templateId: 'X',
    },
    {
      sceneIndex: 1, startFrame: 90, endFrame: 270, durationFrames: 180,
      type: 'body', narration: 'A body line', templateId: 'X',
    },
  ],
};

describe('short-metadata shortTitle override', () => {
  it('uses the curated bank shortTitle when provided', () => {
    const m = generateShortMetadata(STORY, {
      shortTitle: '90% of Engineers Get Kafka Consumer Groups WRONG 😳',
    });
    expect(m.title).toContain('90% of Engineers Get Kafka Consumer Groups WRONG');
    expect(m.title).toContain('#Shorts');
  });

  it('falls back to hookHeadline when no shortTitle', () => {
    const m = generateShortMetadata(STORY, { hookHeadline: 'Custom hook line' });
    expect(m.title.startsWith('Custom hook line')).toBe(true);
  });

  it('falls back to TITLE_TEMPLATES when neither override is set', () => {
    const m = generateShortMetadata(STORY);
    expect(m.title.length).toBeGreaterThan(0);
    expect(m.title.endsWith('#Shorts')).toBe(true);
  });

  it('truncates an over-long shortTitle with ellipsis', () => {
    const long = 'A'.repeat(200);
    const m = generateShortMetadata(STORY, { shortTitle: long });
    expect(m.title.length).toBeLessThanOrEqual(100);
    expect(m.title).toContain('…');
  });
});

// Panel-21 Dist P0-A + Panel-22 Torvalds P1 regression guard:
// the description's first 600 chars (above the YT mobile "see more"
// fold) MUST lead with hook + CTAs + prose, NOT a hashtag wall. The
// hashtag block must live at the BOTTOM of the description.
describe('short-metadata description fold ordering (Panel-21 P0-A)', () => {
  it('opens with the hook line, not a hashtag block', () => {
    const m = generateShortMetadata(STORY, { hookHeadline: 'Hook line here' });
    const firstLine = m.description.split('\n')[0] ?? '';
    expect(firstLine.startsWith('⚡')).toBe(true);
    // First line must NOT be hashtag-dominated (>= 30% tags = wall).
    const tokens = firstLine.split(/\s+/).filter(Boolean);
    const tags = tokens.filter((t) => t.startsWith('#')).length;
    expect(tags / Math.max(tokens.length, 1)).toBeLessThan(0.3);
  });

  it('places the canonical hashtag block as the last non-empty line', () => {
    const m = generateShortMetadata(STORY);
    const trimmed = m.description.trimEnd();
    const lastLine = trimmed.split('\n').filter((l) => l.length > 0).at(-1) ?? '';
    expect(lastLine).toMatch(/#SystemDesignShorts/);
    expect(lastLine).toMatch(/#Shorts\b/);
  });

  it('keeps the hashtag wall out of the first 600 chars (above-fold zone)', () => {
    const m = generateShortMetadata(STORY);
    const aboveFold = m.description.slice(0, 600);
    // No line within the first 600 chars should be hashtag-dominated.
    const lines = aboveFold.split('\n');
    for (const line of lines) {
      const tokens = line.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) continue;
      const tagRatio = tokens.filter((t) => t.startsWith('#')).length / tokens.length;
      expect(tagRatio).toBeLessThan(0.7);
    }
  });
});
