/**
 * tests/retention/opener.test.ts
 *
 * RED: scene[0].dur is 'auto' from long dialogue → likely > 90 frames.
 *      shortsCutScene is not set to true on the hook scene (it is, but
 *      calcSceneDur for kaaliya's line pushes past 90 frames for longer text).
 *
 * GREEN after: LION_RABBIT_SCENES[0].dialogue[0].text is ≤ 14 chars
 *              so calcDialogueDur ≤ 14*6+18 = 102 ... needs trim to ≤ 90.
 *              Fix: cap hook scene dur to 90 frames or set explicit dur.
 */
import { describe, it, expect } from 'vitest';
import { LION_RABBIT_SCENES, INTRO_SCENE_INDEX } from '../../src/compositions/episode1/scenes-lion-rabbit';
import { calcSceneDur, calcEpisodeDuration } from '../../src/compositions/episode1/timing';

const FPS = 30;
const MAX_OPENER_FRAMES = 90; // 3s at 30fps

describe('retention: opener ≤ 90 frames', () => {
  it('hook scene (scene[0]) has shortsCutScene = true', () => {
    const hook = LION_RABBIT_SCENES[0];
    expect(hook.shortsCutScene).toBe(true);
  });

  it('hook scene total duration ≤ 90 frames (3s)', () => {
    const hook = LION_RABBIT_SCENES[0];
    const frames =
      hook.dur === 'auto'
        ? calcSceneDur(hook.dialogue)
        : typeof hook.dur === 'number'
          ? hook.dur * FPS
          : MAX_OPENER_FRAMES + 1; // fail if unknown format
    expect(frames).toBeLessThanOrEqual(MAX_OPENER_FRAMES);
  });

  it('villain appears BEFORE intro scene (INTRO_SCENE_INDEX > 0)', () => {
    expect(INTRO_SCENE_INDEX).toBeGreaterThan(0);
  });

  it('scene[0] is the hook scene, not an intro/title', () => {
    const first = LION_RABBIT_SCENES[0];
    expect(first.id).not.toMatch(/^intro|^title|^brand/i);
  });

  it('episode total duration is at least 60s (enough content)', () => {
    const totalFrames = calcEpisodeDuration(LION_RABBIT_SCENES);
    expect(totalFrames / FPS).toBeGreaterThanOrEqual(60);
  });
});
