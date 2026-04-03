import type { Scene, SfxTrigger } from '../types';
import type { SfxDensity } from './video-styles';

/**
 * Auto-generate SFX triggers by analyzing scene content.
 * Scans for patterns and assigns appropriate sound effects.
 */
export function generateSfxTriggers(
  scenes: Scene[],
  density: SfxDensity = 'sparse',
): SfxTrigger[] {
  const maxPerScene = density === 'dense' ? 3 : 1;
  const triggers: SfxTrigger[] = [];

  scenes.forEach((scene, sceneIndex) => {
    const sceneTriggers: SfxTrigger[] = [];

    // Code scenes get a typing SFX at start
    if (scene.type === 'code') {
      sceneTriggers.push({
        sceneIndex,
        wordIndex: 0,
        effect: 'typing',
        volume: 0.3,
      });
    }

    // Review/quiz scenes get a ding when answer is revealed (midpoint)
    if (scene.type === 'review') {
      const midWord = Math.floor((scene.wordTimestamps?.length || 10) / 2);
      sceneTriggers.push({
        sceneIndex,
        wordIndex: midWord,
        effect: 'ding',
        volume: 0.5,
      });
    }

    // Text scenes with numbers get an impact SFX
    if (scene.narration && /\d{2,}/.test(scene.narration)) {
      const words = scene.narration.split(/\s+/);
      const numIdx = words.findIndex(w => /\d{2,}/.test(w));
      if (numIdx >= 0) {
        sceneTriggers.push({
          sceneIndex,
          wordIndex: numIdx,
          effect: 'impact',
          volume: 0.4,
        });
      }
    }

    // Summary scenes get a success chime
    if (scene.type === 'summary') {
      sceneTriggers.push({
        sceneIndex,
        wordIndex: 0,
        effect: 'success-chime',
        volume: 0.4,
      });
    }

    // Limit per scene
    triggers.push(...sceneTriggers.slice(0, maxPerScene));
  });

  return triggers;
}
