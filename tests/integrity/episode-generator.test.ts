/**
 * tests/integrity/episode-generator.test.ts
 *
 * RED:
 *  1. zod is not in devDependencies — import throws.
 *  2. generateStoryboard returns `durationFrames` but Storyboard.totalFrames
 *     may not equal sum(durationFrames) because introFrames/moralFrames/
 *     outroFrames are added separately but sceneIndex 0 starts AT introFrames.
 *     The `endFrame = startFrame + durationFrames` assertion will fail for
 *     scenes that have durationFrames=0 (edge case when dialogue array is empty).
 *
 * GREEN after:
 *  - Add zod to devDependencies
 *  - Guard durationFrames > 0 in generateStoryboard (or in scene creation)
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { generateEpisode } from '../../src/story/story-engine';
import { generateStoryboard } from '../../src/pipeline/storyboard';

const FPS = 30;

const StoryboardSceneSchema = z.object({
  sceneIndex: z.number().int().nonnegative(),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive(), // strictly positive
  characters: z.array(z.any()),
  cameraMovement: z.string(),
});

const StoryboardSchema = z.object({
  scenes: z.array(StoryboardSceneSchema).min(1),
  totalFrames: z.number().int().positive(),
  totalDurationMs: z.number().positive(),
});

describe('integrity: episode-generator output schema', () => {
  const episode = generateEpisode(1, 1);
  const storyboard = generateStoryboard(episode, []);

  it('storyboard satisfies StoryboardSchema (zod)', () => {
    expect(() => StoryboardSchema.parse(storyboard)).not.toThrow();
  });

  it('every scene durationFrames > 0', () => {
    for (const scene of storyboard.scenes) {
      expect(scene.durationFrames).toBeGreaterThan(0);
    }
  });

  it('scenes are ordered by startFrame (non-decreasing)', () => {
    for (let i = 1; i < storyboard.scenes.length; i++) {
      expect(storyboard.scenes[i].startFrame).toBeGreaterThanOrEqual(
        storyboard.scenes[i - 1].startFrame,
      );
    }
  });

  it('no overlapping scenes (startFrame[i] >= startFrame[i-1] + durationFrames[i-1])', () => {
    for (let i = 1; i < storyboard.scenes.length; i++) {
      const prev = storyboard.scenes[i - 1];
      const curr = storyboard.scenes[i];
      expect(curr.startFrame).toBeGreaterThanOrEqual(prev.startFrame + prev.durationFrames);
    }
  });

  it('totalFrames equals last scene end + outro/moral padding', () => {
    const lastScene = storyboard.scenes[storyboard.scenes.length - 1];
    const lastEnd = lastScene.startFrame + lastScene.durationFrames;
    // totalFrames must be >= lastEnd (padding is added for moral card + outro)
    expect(storyboard.totalFrames).toBeGreaterThanOrEqual(lastEnd);
  });

  it('totalDurationMs is consistent with totalFrames at 30fps', () => {
    const expected = (storyboard.totalFrames / FPS) * 1000;
    expect(storyboard.totalDurationMs).toBeCloseTo(expected, 0);
  });

  it('deterministic: same (topicId, episodeNumber) → identical storyboard', () => {
    const ep2 = generateEpisode(1, 1);
    const sb2 = generateStoryboard(ep2, []);
    expect(JSON.stringify(sb2)).toBe(JSON.stringify(storyboard));
  });
});
