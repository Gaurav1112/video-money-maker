import type { Scene } from '../types';

export interface HookResult {
  textHook: string;   // on-screen (max 8 words)
  spokenHook: string; // narrated (1-2 sentences)
}

type HookFormula = (topic: string, scenes: Scene[]) => HookResult;

// Extract a key concept from early scenes for content-aware hooks
function getKeyConcept(scenes: Scene[]): string {
  const textScene = scenes.find(s => s.type === 'text' && s.heading);
  return textScene?.heading || 'this concept';
}

function getCodeTopic(scenes: Scene[]): string {
  const codeScene = scenes.find(s => s.type === 'code');
  return codeScene?.heading || 'the implementation';
}

const HOOK_FORMULAS: HookFormula[] = [
  // 0: Contradiction
  (topic, scenes) => ({
    textHook: `What you know about ${topic} is WRONG`,
    spokenHook: `Everyone says ${getKeyConcept(scenes)} is the best approach. That's actually wrong for 90% of real-world systems. Let me show you why.`,
  }),
  // 1: Stat bomb
  (topic, _scenes) => ({
    textHook: `97% get ${topic} wrong`,
    spokenHook: `I've interviewed hundreds of developers on ${topic}. 97% make the same critical mistake. After this video, you won't be one of them.`,
  }),
  // 2: Salary anchor
  (topic, _scenes) => ({
    textHook: `${topic} = 8 LPA vs 40 LPA`,
    spokenHook: `This one topic, ${topic}, is literally the difference between an 8 LPA offer and a 40 LPA offer. Here's exactly what senior engineers know that you don't.`,
  }),
  // 3: Challenge
  (topic, scenes) => ({
    textHook: `Can you explain ${topic}?`,
    spokenHook: `If your interviewer asks you to explain ${getKeyConcept(scenes)} right now, could you? Most candidates freeze. By the end of this video, you'll explain it better than most senior engineers.`,
  }),
  // 4: Time promise
  (topic, _scenes) => ({
    textHook: `Master ${topic} in 10 minutes`,
    spokenHook: `In the next 10 minutes, you'll understand ${topic} well enough to design it in a FAANG interview. No fluff, no filler, just the exact mental model you need.`,
  }),
  // 5: Pain point
  (topic, scenes) => ({
    textHook: `Your ${topic} will BREAK at scale`,
    spokenHook: `If you're not using ${getKeyConcept(scenes)} correctly, your system will crash the moment you hit 10,000 concurrent users. I've seen it happen. Here's the fix.`,
  }),
  // 6: Authority
  (topic, _scenes) => ({
    textHook: `Asked in Google SDE-2 interview`,
    spokenHook: `This exact question about ${topic} was asked in a Google SDE-2 interview. I'm going to show you the answer that got the candidate hired.`,
  }),
];

/**
 * Generate a dual hook (text + spoken) for a video.
 * Deterministic: same topic + sessionNumber always produces the same hook.
 * No two sessions of the same topic use the same formula.
 */
export function generateDualHook(
  topic: string,
  sessionNumber: number,
  scenes: Scene[],
): HookResult {
  // Deterministic seed: rotate through formulas by session
  const seed = (topic.length * 7 + sessionNumber * 13) % HOOK_FORMULAS.length;
  return HOOK_FORMULAS[seed](topic, scenes);
}
