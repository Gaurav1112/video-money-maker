/**
 * tests/retention/loop-ending.test.ts
 *
 * RED: The last scene in LION_RABBIT_SCENES currently has no loopHook field
 *      and the narration/textOverlay does not contain a loop-trigger phrase.
 *
 * GREEN after: Add loopHook to the final scene, or ensure the last
 *              non-outro scene dialogue textOverlay matches the loop regex.
 */
import { describe, it, expect } from 'vitest';
import { LION_RABBIT_SCENES } from '../../src/compositions/episode1/scenes-lion-rabbit';
import type { ViralScene } from '../../src/compositions/episode1/types';

const LOOP_REGEX = /फिर\s*मिलेंगे|अगली\s*बार|subscribe|bell\s*icon|next\s*story|watch\s*again|देखते\s*रहो/i;

function sceneHasLoopSignal(scene: ViralScene): boolean {
  if ((scene as any).loopHook) return true;
  if (scene.dialogue.some((d) => LOOP_REGEX.test(d.text))) return true;
  if (scene.dialogue.some((d) => d.textOverlay && LOOP_REGEX.test(d.textOverlay))) return true;
  return false;
}

describe('retention: loop-able ending', () => {
  it('at least one scene in the final 3 has a loop signal', () => {
    const tail = LION_RABBIT_SCENES.slice(-3);
    const hasLoop = tail.some(sceneHasLoopSignal);
    expect(hasLoop).toBe(true);
  });

  it('last scene or second-to-last has loop/subscribe cue', () => {
    const last2 = LION_RABBIT_SCENES.slice(-2);
    expect(last2.some(sceneHasLoopSignal)).toBe(true);
  });

  it('no scenes have patternInterrupt + loopHook on the SAME dialogue line (conflicting signals)', () => {
    for (const scene of LION_RABBIT_SCENES) {
      for (const line of scene.dialogue) {
        if ((line as any).loopHook && line.patternInterrupt) {
          expect(true).toBe(false); // explicit fail with message below
        }
      }
    }
    // If we get here: no conflict
    expect(true).toBe(true);
  });
});
