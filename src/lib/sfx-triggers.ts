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

  // Transition whoosh at the start of every scene (except the first)
  // Rotate through variants to avoid repetitive same-sound fatigue
  const WHOOSH_VARIANTS = ['whoosh-in', 'swoosh', 'whoosh-in'] as const;
  scenes.forEach((_scene, sceneIndex) => {
    if (sceneIndex > 0) {
      triggers.push({
        sceneIndex,
        wordIndex: 0,
        effect: WHOOSH_VARIANTS[sceneIndex % WHOOSH_VARIANTS.length],
        volume: 0.3,
      });
    }
  });

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

    // Title scenes get a riser for dramatic entrance
    if (scene.type === 'title') {
      sceneTriggers.push({
        sceneIndex,
        wordIndex: 0,
        effect: 'riser',
        volume: 0.35,
      });
    }

    // Emphasis words get a pop SFX (dense mode only, avoids double-triggering in sparse)
    if (density === 'dense' && scene.narration) {
      const emphasisPattern = /\b(key|important|critical|never|always|biggest|worst|best|secret|trick|dangerous|breaking)\b/i;
      const words = scene.narration.split(/\s+/);
      const emphIdx = words.findIndex(w => emphasisPattern.test(w));
      if (emphIdx >= 0) {
        sceneTriggers.push({
          sceneIndex,
          wordIndex: emphIdx,
          effect: 'pop',
          volume: 0.35,
        });
      }
    }

    // Comparison/table scenes get a tension-build
    if (scene.type === 'table') {
      sceneTriggers.push({
        sceneIndex,
        wordIndex: 0,
        effect: 'tension-build',
        volume: 0.3,
      });
    }

    // Limit per scene
    triggers.push(...sceneTriggers.slice(0, maxPerScene));
  });

  return triggers;
}
