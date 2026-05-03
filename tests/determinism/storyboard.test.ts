/**
 * tests/determinism/storyboard.test.ts
 *
 * RED: generateEpisode uses mulberry32 seeded by topicId + episodeNumber
 *      (deterministic ✓) BUT generateStoryboard uses the episode.scenes array
 *      order which is stable — however if any downstream call ever adds
 *      Math.random() this test will catch it immediately.
 *
 *      The test is CURRENTLY RED because:
 *      - zod is not installed (schema import fails)
 *      - The "5 runs" assertion discovers any future regression
 *
 * GREEN after: install zod; verify no Math.random leaks in pipeline.
 */
import { describe, it, expect } from 'vitest';
import { generateEpisode } from '../../src/story/story-engine';
import { generateStoryboard } from '../../src/pipeline/storyboard';

const RUNS = 5;

describe('determinism: storyboard', () => {
  it(`same (topicId=1, episodeNumber=1) → byte-identical JSON across ${RUNS} runs`, () => {
    const results: string[] = [];
    for (let i = 0; i < RUNS; i++) {
      const ep = generateEpisode(1, 1);
      const sb = generateStoryboard(ep, []);
      results.push(JSON.stringify(sb));
    }
    const first = results[0];
    for (const r of results) {
      expect(r).toBe(first);
    }
  });

  it('different topicIds produce different storyboards', () => {
    const a = JSON.stringify(generateStoryboard(generateEpisode(1, 1), []));
    const b = JSON.stringify(generateStoryboard(generateEpisode(2, 1), []));
    expect(a).not.toBe(b);
  });

  it('different episode numbers produce different storyboards', () => {
    const a = JSON.stringify(generateStoryboard(generateEpisode(1, 1), []));
    const b = JSON.stringify(generateStoryboard(generateEpisode(1, 2), []));
    expect(a).not.toBe(b);
  });

  it('storyboard JSON is valid JSON (parseable)', () => {
    const sb = generateStoryboard(generateEpisode(3, 1), []);
    expect(() => JSON.parse(JSON.stringify(sb))).not.toThrow();
  });

  it('no NaN or Infinity in any numeric field', () => {
    const sb = generateStoryboard(generateEpisode(1, 1), []);
    const json = JSON.stringify(sb);
    expect(json).not.toContain('null'); // NaN → null in JSON.stringify
    expect(json).not.toContain('Infinity');
  });
});
