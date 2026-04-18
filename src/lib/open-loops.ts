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
  // 0: "Everyone says X, but..." — SPECIFIC payoff, not vague "in a moment"
  (concept, detail) => ({
    contradiction: `Everyone says ${concept} is the best approach. That is actually wrong for most real-world systems. And when I show you the benchmark numbers, you will be shocked.`,
    resolution: `Remember when I said ${concept} is wrong for most systems? Here is the proof. ${detail}`,
  }),
  // 1: "Your textbook is outdated" — name the company for specificity
  (concept, detail) => ({
    contradiction: `What your textbook says about ${concept} is outdated. Google threw out the textbook approach 3 years ago. Their replacement? You will see it in about 2 minutes.`,
    resolution: `Here is what replaced the textbook version of ${concept}. ${detail}`,
  }),
  // 2: "The opposite is true" — add consequence instead of "stay tuned"
  (concept, detail) => ({
    contradiction: `Most developers think more ${concept} means better performance. It can actually make things WORSE. And if you get this wrong in an interview, it is an instant reject.`,
    resolution: `Here is why more ${concept} can backfire. ${detail} This is what separates junior from senior answers in interviews.`,
  }),
  // 3: "Nobody tells you this" — add specific stakes instead of "shortly"
  (concept, detail) => ({
    contradiction: `There is one thing about ${concept} that nobody mentions in tutorials. It is exactly what interviewers test, and it has eliminated more candidates than any other question.`,
    resolution: `Here is the hidden catch about ${concept} that interviewers love to ask. ${detail}`,
  }),
  // 4: "Show result first" — replace "stay tuned" with a specific challenge
  (concept, detail) => ({
    contradiction: `Let me show you the end result of ${concept} first. This is what a production system looks like. Now here is the challenge: can you figure out HOW we get here? Watch and find out.`,
    resolution: `And THAT is how we built ${concept} from scratch to production-ready. ${detail}`,
  }),
  // 5: "The 3 AM incident" — add dollar amount for concreteness
  (concept, detail) => ({
    contradiction: `At 3 AM, a production server crashed because of ${concept}. Revenue loss: 50 thousand dollars per MINUTE. The fix took 3 lines of code. I will show you those exact 3 lines.`,
    resolution: `Remember that 3 AM crash? Here is exactly what went wrong with ${concept}. ${detail}`,
  }),
  // 6: "The interview trap" — make the trap feel personal
  (concept, detail) => ({
    contradiction: `Interviewers have a favorite trap question about ${concept}. 90 percent of candidates fall for it. If you have answered this question before, you probably fell for it too.`,
    resolution: `Here is that interview trap about ${concept} I mentioned. ${detail} Now you will never fall for it.`,
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
      // GUARD: Don't prepend if the narration already starts with a hype phrase
      // (from OPEN_LOOP_PHRASES injected in generateScript). Avoids double-stacking.
      const startsWithHype = /^(Most people miss|This next idea|Here's the part|I saved the best|Wait for it|Don't skip|Keep watching)/i.test(target.narration);
      if (!startsWithHype) {
        target.narration = `${loop.resolutionLine} ${target.narration}`;
      } else {
        // Replace the existing hype phrase with our resolution (which has actual content)
        target.narration = `${loop.resolutionLine} ${target.narration.replace(/^[^.]+\.\.\.\s*/, '')}`;
      }
    }
  }

  return modified;
}
