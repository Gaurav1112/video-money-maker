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
