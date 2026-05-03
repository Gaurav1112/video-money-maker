/**
 * tests/format/longform.test.ts
 *
 * RED: No explicit long-form props validator exists. The composition props
 *      width/height could silently be swapped (portrait long-form = broken).
 *
 * GREEN after: Add buildLongformProps() that asserts width=1920, height=1080
 *              and durationInFrames ≥ 300 (10s minimum).
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { generateEpisode } from '../../src/story/story-engine';
import { generateStoryboard } from '../../src/pipeline/storyboard';

const LongformPropsSchema = z.object({
  width: z.literal(1920),
  height: z.literal(1080),
  durationInFrames: z.number().int().min(300), // at least 10s
  fps: z.literal(30),
});

// buildLongformProps must be added to Episode1.tsx or a new builder
let buildLongformProps: (storyboard: ReturnType<typeof generateStoryboard>) => z.infer<typeof LongformPropsSchema>;
try {
  const mod = await import('../../src/compositions/episode1/longform-builder');
  buildLongformProps = mod.buildLongformProps;
} catch {
  buildLongformProps = undefined as any;
}

describe('format: Long-form (1920×1080)', () => {
  const episode = generateEpisode(1, 1);
  const storyboard = generateStoryboard(episode, []);

  it('buildLongformProps is exported from longform-builder', () => {
    expect(typeof buildLongformProps).toBe('function');
  });

  it('props satisfy LongformPropsSchema (zod)', () => {
    const props = buildLongformProps(storyboard);
    expect(() => LongformPropsSchema.parse(props)).not.toThrow();
  });

  it('width is 1920 (landscape, not portrait)', () => {
    const props = buildLongformProps(storyboard);
    expect(props.width).toBe(1920);
    expect(props.width).toBeGreaterThan(props.height);
  });

  it('height is 1080', () => {
    const props = buildLongformProps(storyboard);
    expect(props.height).toBe(1080);
  });

  it('fps is 30', () => {
    const props = buildLongformProps(storyboard);
    expect(props.fps).toBe(30);
  });

  it('durationInFrames derived from storyboard.totalFrames', () => {
    const props = buildLongformProps(storyboard);
    expect(props.durationInFrames).toBe(storyboard.totalFrames);
  });
});
