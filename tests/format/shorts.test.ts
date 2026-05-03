/**
 * tests/format/shorts.test.ts
 *
 * RED:
 *  1. No Shorts-specific composition exists that enforces 1080×1920.
 *  2. No duration cap of 55s (1650 frames) is applied to the Shorts cut.
 *  3. shortsCutScene filter not applied to select only tagged scenes.
 *
 * GREEN after:
 *  - Add getShortsScenes(scenes) that filters shortsCutScene=true
 *  - Add buildShortsProps() that enforces width=1080, height=1920,
 *    and trims durationInFrames to ≤ 1650
 */
import { describe, it, expect } from 'vitest';
import { LION_RABBIT_SCENES } from '../../src/compositions/episode1/scenes-lion-rabbit';
import { calcSceneDur } from '../../src/compositions/episode1/timing';

// These helpers don't exist yet — their absence makes the tests red.
let getShortsScenes: (scenes: typeof LION_RABBIT_SCENES) => typeof LION_RABBIT_SCENES;
let buildShortsProps: (scenes: typeof LION_RABBIT_SCENES) => {
  width: number;
  height: number;
  durationInFrames: number;
};

try {
  const mod = await import('../../src/compositions/episode1/shorts-builder');
  getShortsScenes = mod.getShortsScenes;
  buildShortsProps = mod.buildShortsProps;
} catch {
  getShortsScenes = undefined as any;
  buildShortsProps = undefined as any;
}

const MAX_SHORTS_FRAMES = 55 * 30; // 1650 frames = 55s
const MIN_SHORTS_SCENES = 3;

describe('format: Shorts (1080×1920, ≤55s)', () => {
  it('getShortsScenes is exported from shorts-builder', () => {
    expect(typeof getShortsScenes).toBe('function');
  });

  it('buildShortsProps is exported from shorts-builder', () => {
    expect(typeof buildShortsProps).toBe('function');
  });

  it('getShortsScenes returns only shortsCutScene=true scenes', () => {
    const shorts = getShortsScenes(LION_RABBIT_SCENES);
    for (const scene of shorts) {
      expect((scene as any).shortsCutScene ?? scene.dialogue.some((d) => d.shortsFlag)).toBe(true);
    }
  });

  it('Shorts cut has ≥ 3 scenes', () => {
    const shorts = getShortsScenes(LION_RABBIT_SCENES);
    expect(shorts.length).toBeGreaterThanOrEqual(MIN_SHORTS_SCENES);
  });

  it('buildShortsProps.width = 1080', () => {
    const props = buildShortsProps(LION_RABBIT_SCENES);
    expect(props.width).toBe(1080);
  });

  it('buildShortsProps.height = 1920', () => {
    const props = buildShortsProps(LION_RABBIT_SCENES);
    expect(props.height).toBe(1920);
  });

  it('buildShortsProps.durationInFrames ≤ 1650 (55s)', () => {
    const props = buildShortsProps(LION_RABBIT_SCENES);
    expect(props.durationInFrames).toBeLessThanOrEqual(MAX_SHORTS_FRAMES);
  });

  it('first scene in Shorts cut ≤ 1.5s (45 frames) for fast hook', () => {
    const shorts = getShortsScenes(LION_RABBIT_SCENES);
    const first = shorts[0];
    const dur =
      first.dur === 'auto'
        ? calcSceneDur(first.dialogue)
        : typeof first.dur === 'number'
          ? first.dur * 30
          : 46;
    expect(dur).toBeLessThanOrEqual(45);
  });
});
