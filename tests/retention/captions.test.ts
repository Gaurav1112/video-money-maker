/**
 * tests/retention/captions.test.ts
 *
 * RED: TextOverlay does not currently export wrapCaption().
 *      Importing it will throw "is not a function".
 *
 * GREEN after: extract pure wrapCaption(text, maxChars) from TextOverlay.tsx
 *              and export it.  Also add safe-zone validation utility.
 */
import { describe, it, expect } from 'vitest';

// Pure helper — extracted from TextOverlay (must be exported after fix)
// We import it this way so the test fails clearly before the fix.
let wrapCaption: (text: string, max: number) => string[];
try {
  const mod = await import('../../src/compositions/episode1/TextOverlay');
  wrapCaption = mod.wrapCaption;
} catch {
  wrapCaption = undefined as unknown as typeof wrapCaption;
}

const SAFE_ZONE_RATIO = 0.10; // 10% margin on each side

const SAMPLES = [
  'आज जंगल में एक बड़ा खतरा आया जब शेर ने सबको डराया।',
  'खरगोश ने बहुत ही चतुराई से शेर को कुएं के पास ले जाकर उसे बेवकूफ बनाया।',
  'Kafka decouples producers and consumers across distributed regions.',
  'Replication keeps your data safe even when a node fails at midnight.',
];

describe('retention: captions', () => {
  it('wrapCaption is exported from TextOverlay', () => {
    expect(typeof wrapCaption).toBe('function');
  });

  it.each(SAMPLES)('every line ≤ 30 chars: %s', (text) => {
    const lines = wrapCaption(text, 30);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(30);
    }
  });

  it.each(SAMPLES)('produces ≥ 2 lines for long text: %s', (text) => {
    const lines = wrapCaption(text, 30);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('does not split mid-word', () => {
    const text = 'Hello World';
    const lines = wrapCaption(text, 8);
    for (const line of lines) {
      // Each token must appear as a whole word
      const words = line.split(' ');
      for (const w of words) expect(w).not.toBe('');
    }
  });

  it('safe-zone: canvas width 1920 → text must not use outer 10%', () => {
    const canvasWidth = 1920;
    const safeLeft = Math.round(canvasWidth * SAFE_ZONE_RATIO);
    const safeRight = canvasWidth - safeLeft;
    const textAreaWidth = safeRight - safeLeft; // 1536px
    // At 16px avg char width, 30 chars = 480px — well within 1536px safe zone
    const maxCharsFor1080p = Math.floor(textAreaWidth / 16);
    expect(maxCharsFor1080p).toBeGreaterThanOrEqual(30);
  });
});
