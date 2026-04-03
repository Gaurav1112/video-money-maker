import type { Scene } from '../types';
import { getTopicCategory } from './topic-categories';

export interface OpenLoop {
  contradictionLine: string;
  resolutionLine: string;
  plantSceneIndex: number;
  targetSceneIndex: number;
}

type ContradictionPattern = (concept: string, detail: string) => {
  contradiction: string;
  resolution: string;
};

const PATTERNS: ContradictionPattern[] = [
  // 0: "Everyone says X, but..."
  (concept, detail) => ({
    contradiction: `Everyone says ${concept} is the best approach. That is actually wrong for most real-world systems. I will show you why in a moment.`,
    resolution: `Remember when I said ${concept} is wrong for most systems? Here is the proof. ${detail}`,
  }),
  // 1: "Your textbook is outdated"
  (concept, detail) => ({
    contradiction: `What your textbook says about ${concept} is outdated. The real approach that companies like Google use is coming up.`,
    resolution: `Here is what replaced the textbook version of ${concept}. ${detail}`,
  }),
  // 2: "The opposite is true"
  (concept, detail) => ({
    contradiction: `Most developers think more ${concept} means better performance. It can actually make things worse. Stay tuned to see why.`,
    resolution: `Here is why more ${concept} can backfire. ${detail} This is what separates junior from senior answers in interviews.`,
  }),
  // 3: "Nobody tells you this"
  (concept, detail) => ({
    contradiction: `There is one thing about ${concept} that nobody mentions in tutorials, and it is exactly what interviewers test. I will reveal it shortly.`,
    resolution: `Here is the hidden catch about ${concept} that interviewers love to ask. ${detail}`,
  }),
];

const HIGH_VALUE_TYPES = new Set(['code', 'interview', 'review', 'summary']);

/**
 * Generate contradiction-based open loops for a video.
 * Plants teasers in earlier scenes, resolves them in target scenes.
 * Deterministic: same input always produces same output.
 * Max 3 loops per video, all unique.
 */
export function generateOpenLoops(
  scenes: Scene[],
  topic: string,
  sessionNumber: number,
): OpenLoop[] {
  const loops: OpenLoop[] = [];
  const usedPatterns = new Set<number>();

  // Find high-value target scenes
  const targets = scenes
    .map((s, i) => ({ scene: s, index: i }))
    .filter(({ scene }) => HIGH_VALUE_TYPES.has(scene.type));

  for (const target of targets) {
    if (loops.length >= 3) break;

    // Plant 3-5 scenes before target
    const plantIndex = Math.max(1, target.index - 3 - (loops.length)); // vary offset
    if (plantIndex >= target.index) continue;
    if (loops.some(l => l.plantSceneIndex === plantIndex)) continue; // don't double-plant

    // Select pattern deterministically, ensuring no repeats
    const seed = (topic.length * 7 + sessionNumber * 13 + target.index * 3) % PATTERNS.length;
    let patternIdx = seed;
    while (usedPatterns.has(patternIdx) && usedPatterns.size < PATTERNS.length) {
      patternIdx = (patternIdx + 1) % PATTERNS.length;
    }
    usedPatterns.add(patternIdx);

    // Extract concept from target scene
    const concept = target.scene.heading || topic;
    const detail = target.scene.narration?.split('.').slice(0, 2).join('.') || '';

    const pattern = PATTERNS[patternIdx];
    const { contradiction, resolution } = pattern(concept, detail);

    loops.push({
      contradictionLine: contradiction,
      resolutionLine: resolution,
      plantSceneIndex: plantIndex,
      targetSceneIndex: target.index,
    });
  }

  return loops;
}

/**
 * Inject open loops into scene narrations.
 * Appends contradiction to plant scene, prepends resolution to target scene.
 * Returns a NEW array — does not mutate input.
 */
export function injectOpenLoops(scenes: Scene[], topic: string, sessionNumber: number): Scene[] {
  const loops = generateOpenLoops(scenes, topic, sessionNumber);
  if (loops.length === 0) return scenes;

  const modified = scenes.map(s => ({ ...s })); // shallow clone

  for (const loop of loops) {
    const plant = modified[loop.plantSceneIndex];
    const target = modified[loop.targetSceneIndex];

    if (plant && plant.narration) {
      plant.narration = `${plant.narration} ${loop.contradictionLine}`;
    }
    if (target && target.narration) {
      target.narration = `${loop.resolutionLine} ${target.narration}`;
    }
  }

  return modified;
}
