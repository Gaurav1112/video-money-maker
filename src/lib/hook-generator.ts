import type { Scene } from '../types';
import { getTopicExample } from './topic-examples';

export interface HookResult {
  textHook: string;   // on-screen (max 8 words)
  spokenHook: string; // narrated (1-2 sentences)
}

type HookFormula = (topic: string, scenes: Scene[], sessionTitle?: string) => HookResult;

// Extract a key concept from early scenes for content-aware hooks.
// RETENTION FIX: When scenes is empty (common at call site), use sessionTitle
// as fallback instead of the generic "this concept" which kills curiosity.
function getKeyConcept(scenes: Scene[], sessionTitle?: string): string {
  const textScene = scenes.find(s => s.type === 'text' && s.heading);
  return textScene?.heading || sessionTitle || 'this concept';
}

function getCodeTopic(scenes: Scene[], sessionTitle?: string): string {
  const codeScene = scenes.find(s => s.type === 'code');
  return codeScene?.heading || sessionTitle || 'the implementation';
}

const HOOK_FORMULAS: HookFormula[] = [
  // 0: Contradiction — with specific company reference
  (topic, scenes, title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `What you know about ${topic} is WRONG`,
      spokenHook: `Everyone says ${getKeyConcept(scenes, title)} is the best approach. ${ex.company} tried that and it caused ${ex.problem}. I'll show you what actually works at ${ex.scale}.`,
    };
  },
  // 1: Stat bomb — with interview count and specific failure
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `347 devs failed this ${topic} Q`,
      spokenHook: `I interviewed 347 developers on ${topic}. 97% made the exact same mistake that got them rejected at ${ex.company}. After this video, you won't be one of them.`,
    };
  },
  // 2: Salary anchor — with exact package numbers
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${topic} = 8 LPA vs 45 LPA`,
      spokenHook: `A developer who can't explain ${topic}? 8 LPA. A developer who can design ${ex.company}'s ${topic} system handling ${ex.scale}? 45 LPA. Same experience, same college. Let me show you the difference.`,
    };
  },
  // 3: Challenge — with countdown pressure
  (topic, scenes, title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `Explain ${topic} in 30 seconds?`,
      spokenHook: `Imagine you're in the ${ex.company} interview room. The interviewer says "Explain ${getKeyConcept(scenes, title)} in 30 seconds." 87% of candidates freeze right here. By the end of this video, you'll nail it in 15 seconds flat.`,
    };
  },
  // 4: Time promise — with exact duration and credibility
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${topic} in 7 min 42 sec`,
      spokenHook: `In exactly 7 minutes and 42 seconds, you'll understand ${topic} better than engineers with 5 years of experience. How? Because I'll show you how ${ex.company} actually implements it at ${ex.scale}. No fluff. Let's go.`,
    };
  },
  // 5: Pain point — with exact crash scenario
  (topic, scenes, title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${topic} CRASHES at 10K users`,
      spokenHook: `Your ${getKeyConcept(scenes, title)} will crash at exactly 10,000 concurrent users. That's what happened to a startup I consulted for — ${ex.problem}, and they lost 2.3 crore in revenue in one weekend. Here's the fix ${ex.company} uses.`,
    };
  },
  // 6: Authority — with specific interview round detail
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${ex.company} SDE-3 round 4 question`,
      spokenHook: `This exact ${topic} question was asked in ${ex.company}'s SDE-3 round 4 interview last month. The candidate who answered it correctly got a 52 LPA offer. I'm going to show you the exact answer.`,
    };
  },
  // 7: Show result first — with production scale numbers
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${ex.company}'s REAL architecture`,
      spokenHook: `Let me show you the end result first. THIS is ${ex.company}'s actual production ${topic} architecture that ${ex.useCase}, handling ${ex.scale}. Now let me show you exactly how to build it, component by component.`,
    };
  },
  // 8: Consequence — with exact dollar/rupee loss
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `₹100 crore lost in 47 minutes`,
      spokenHook: `In 2024, a company lost 100 crore rupees in 47 minutes because they got ${topic} wrong. Their system had ${ex.problem}. In this video, I'll make sure you never make that mistake.`,
    };
  },
  // 9: Myth buster — with specific trap count
  (topic, scenes, title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `3 deadly ${topic} traps`,
      spokenHook: `I reviewed 200+ ${topic} implementations on GitHub. ${getKeyConcept(scenes, title)} has exactly 3 hidden traps that even ${ex.company} engineers fall for. Trap number 2 has caused outages at 4 different unicorns.`,
    };
  },
  // 10: Speed run — with word-count credibility
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${topic} faster than any course`,
      spokenHook: `I'm going to explain ${topic} in 312 seconds — faster and better than any 3-hour Udemy course. This is exactly how ${ex.company} ${ex.useCase}. Zero fluff. Let's go.`,
    };
  },
  // 11: Confession — with specific year and realization
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `I was WRONG about ${topic}`,
      spokenHook: `For 4 years, I thought I understood ${topic}. Then I saw how ${ex.company} actually does it — ${ex.solution} — and I realized I'd been teaching it wrong. Let me save you those 4 years right now.`,
    };
  },
  // 12: Prediction — with hiring trend data
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${topic} interview: 2026 changed`,
      spokenHook: `In 2026, ${ex.company}, Google, and Amazon changed how they ask ${topic} questions. 73% of candidates still prepare the old way and get rejected. Here's the new pattern they follow.`,
    };
  },
  // 13: Before/After — with measurable transformation
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `From confused to 45 LPA offer`,
      spokenHook: `Before this video, ${topic} seems like an impossible interview topic. After this video, you'll whiteboard ${ex.company}'s exact architecture from memory — the same answer that got my student a 45 LPA offer.`,
    };
  },
  // 14: Direct address — with urgency and specifics
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `YOUR interview is in 2 weeks`,
      spokenHook: `Stop scrolling. If you have an interview coming up and you can't explain how ${ex.company} handles ${ex.scale} using ${topic}, this is the most important 10 minutes of your prep. Every second counts.`,
    };
  },
  // 15: Student success story (English)
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `This got someone into ${ex.company}`,
      spokenHook: `One of my students cracked the ${ex.company} interview with just this one concept. ${topic}. They got a 45 LPA offer. Let me show you exactly how.`,
    };
  },
  // 16: Simplicity promise
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${topic} made EASY in 5 min`,
      spokenHook: `Everyone says ${topic} is hard. I'll make it so simple in 5 minutes that you'll be able to teach it to someone else. ${ex.company} uses this daily at ${ex.scale}. Let's go.`,
    };
  },
  // 17: Warning masterclass
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `WARNING: ${topic} MASTERCLASS`,
      spokenHook: `Warning: after this video, no interviewer can stop you on ${topic}. Full masterclass — ${ex.company} level architecture handling ${ex.scale}. Let's go.`,
    };
  },
  // 18: Money hook
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `Want 40 LPA? Learn ${topic}`,
      spokenHook: `Want a 40 LPA package? You need to know ${topic}. Simple as that. ${ex.company} handles ${ex.scale} with exactly this. Let me teach you step by step.`,
    };
  },
  // 19: Freeze test
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `Don't FREEZE on ${topic}`,
      spokenHook: `If a ${topic} question comes up in your interview and you freeze, this video is your lifeline. ${ex.company} asks this exact question. Let's make sure you nail it.`,
    };
  },
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
  sessionTitle?: string,
): HookResult {
  // Deterministic seed: rotate through formulas by session
  const seed = (topic.length * 7 + sessionNumber * 13) % HOOK_FORMULAS.length;
  return HOOK_FORMULAS[seed](topic, scenes, sessionTitle);
}
