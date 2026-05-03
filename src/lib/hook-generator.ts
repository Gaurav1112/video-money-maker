/**
 * hook-generator.ts  —  REWRITTEN for RANK 12 (shock-hook formula)
 *
 * Changes from previous version:
 *   1. All 20 hook formulas now follow the shock-hook pattern
 *      (persona in danger + specific number + implied wrongness)
 *   2. Determinism upgraded: djb2(topic) XOR fibonacci spread —
 *      no longer relies on sessionNumber so title stays stable
 *      even if session numbering changes
 *   3. Hinglish variants added (formulas 15–19) for @GuruSishya-India
 *      audience (Hindi-medium engineering colleges)
 *   4. Mid-video CTA injected into every spokenHook at the 40–60% mark
 *      → "Full roadmap on guru-sishya.in — link in bio"
 *
 * Backward-compatible: generateDualHook() signature unchanged.
 *
 * Channel evidence (channel-shorts.tsv):
 *   944 views → "90% Engineers Are Preparing WRONG"
 *   812 views → "90% Get Kafka Producers WRONG"
 *     4 views → "Caching in 60 Seconds Flat"
 */

import type { Scene } from '../types';
import { getTopicExample } from './topic-examples';
import { djb2Hash } from './title-templates';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface HookResult {
  /** On-screen text overlay — max 8 words, ≥1 SHOUTED word */
  textHook: string;
  /** Narrated hook — 1–2 sentences including mid-video CTA anchor */
  spokenHook: string;
}

// ─── CTA constants ────────────────────────────────────────────────────────────

const CTA_URL = 'guru-sishya.in';

/** CTA injected at the 40–60% timestamp of every script. */
const MID_VIDEO_CTA =
  `Want the full roadmap? Visit ${CTA_URL} — link in bio.`;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getKeyConcept(scenes: Scene[], sessionTitle?: string): string {
  const textScene = scenes.find((s) => s.type === 'text' && s.heading);
  return textScene?.heading ?? sessionTitle ?? 'this concept';
}

type HookFormula = (
  topic: string,
  scenes: Scene[],
  sessionTitle?: string,
) => HookResult;

// ─── Shock-hook formula registry ─────────────────────────────────────────────
//
// Each formula follows: [persona in danger] + [specific number/stat] + [wrongness]
// English formulas: 0–14  |  Hinglish formulas: 15–19

const SHOCK_HOOK_FORMULAS: HookFormula[] = [
  // ── 0: Classic 90% WRONG (proven #1 performer on @GuruSishya-India) ────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `90% Engineers Get ${topic} WRONG`,
      spokenHook: `90% of engineers preparing for interviews get ${topic} completely wrong. They memorise surface definitions but ${ex.company} doesn't hire for definitions — they test whether you can design it at ${ex.scale}. In the next few minutes I'll show you exactly what the top 10% say. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 1: Hiring rejection ────────────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `Why Devs FAIL ${topic} Interviews`,
      spokenHook: `I've seen hundreds of candidates fail the ${topic} round at ${ex.company}. Not because they don't know ${topic} — but because they answer it the WRONG way. I'm going to show you the answer that actually gets offers. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 2: ₹ Cost anchor ──────────────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${topic} Mistake Costing You ₹50LPA`,
      spokenHook: `One wrong decision about ${topic} is costing you 50 lakhs per annum in package. The candidate who knows how ${ex.company} handles ${ex.useCase} with ${topic} gets the senior offer. The one who doesn't? Back to the waiting list. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 3: FAANG filter ───────────────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `FAANG Asks This ${topic} Q. Most FAIL.`,
      spokenHook: `FAANG interviewers use ${topic} as a filter question. Most candidates FAIL it — not because it's hard, but because they've never seen how ${ex.company} actually solves it at ${ex.scale}. Let me show you. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 4: Recruiter gate ────────────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `1 Thing Recruiters Check in ${topic}`,
      spokenHook: `Recruiters at ${ex.company} told me there is exactly one thing they check in every ${topic} answer before moving a candidate to the next round. 9 out of 10 candidates miss it. Here it is. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 5: Warning / STOP ────────────────────────────────────────────────────
  (topic, scenes, title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `STOP Using ${topic} Like This`,
      spokenHook: `STOP. If you are explaining ${getKeyConcept(scenes, title)} the way most tutorials teach it, you are actively hurting your interview score. ${ex.company} engineers do it completely differently at ${ex.scale}. Here's the right way. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 6: Stat bomb ─────────────────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `3 in 4 Devs Get ${topic} WRONG`,
      spokenHook: `3 out of every 4 developers I tested got ${topic} wrong in a simulated interview. The mistake? They described the theory but couldn't connect it to ${ex.company}'s real-world problem of ${ex.useCase}. This video fixes that. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 7: Call out ──────────────────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `Are YOU Getting ${topic} WRONG?`,
      spokenHook: `Be honest — if someone asked you RIGHT NOW how ${ex.company} uses ${topic} to handle ${ex.scale}, could you answer in 30 seconds? If there's any hesitation, you're losing offers. Let me fix that. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 8: Consequence ───────────────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `WRONG ${topic} Answer = No Offer Letter`,
      spokenHook: `A WRONG answer on ${topic} doesn't just cost you points — it ends the interview. I watched a ${ex.company} interviewer reject a candidate who had 5 years experience just because they made one specific ${topic} mistake. I'll show you that mistake and how to avoid it. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 9: Specificity shock ─────────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `The ${topic} Q That FAILs 9/10 Candidates`,
      spokenHook: `This exact ${topic} question fails 9 out of 10 candidates at ${ex.company}. The question sounds simple: "${ex.useCase} — how would you design it?" But the answer that gets you hired requires knowing one specific detail about ${topic} that no tutorial covers. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 10: Salary anchor ────────────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${topic}: 8LPA vs 45LPA Answer`,
      spokenHook: `Same experience. Same college. One candidate explains ${topic} the way textbooks do — 8 lakhs per annum offer. Another explains how ${ex.company} uses it for ${ex.useCase} at ${ex.scale} — 45 lakhs per annum offer. In this video I'll show you the 45 LPA answer. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 11: Confession / correction ──────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `I Was WRONG About ${topic} For 4 Years`,
      spokenHook: `For 4 years I taught ${topic} the WRONG way. Then I saw ${ex.company}'s actual production architecture — ${ex.solution} — and realised my explanation would have failed their interview. Let me give you the version that actually gets you hired. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 12: Myth-buster ───────────────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${topic} Is NOT What You Think`,
      spokenHook: `Everything you've been told about ${topic} is incomplete. ${ex.company} engineers know that real ${topic} at ${ex.scale} has three hidden traps. Trap number two has caused production outages at four different unicorns. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 13: "Don't" warning ──────────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `Don't Learn ${topic} Without Knowing This`,
      spokenHook: `Don't spend another hour on ${topic} until you know this one thing: how ${ex.company} actually uses it for ${ex.useCase}. Without that context, you'll memorise the WRONG mental model and fail the interview anyway. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 14: Before/after transformation ──────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `NEVER Lose a ${topic} Interview Again`,
      spokenHook: `One of my students was failing every ${topic} round. After learning exactly how ${ex.company} designs it for ${ex.useCase}, they walked into their next interview and got a 45 LPA offer. You're going to learn the same thing right now. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 15: Hinglish — 90% WRONG ─────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `90% devs ka ${topic} WRONG hai`,
      spokenHook: `90% devs ${topic} galat padhte hain. ${ex.company} interview mein jo question aata hai — uska answer kisi course mein NAHI milega. Main aaj woh exact answer dene wala hoon. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 16: Hinglish — cost anchor ────────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${topic} galti = ₹50LPA chhin jaata hai`,
      spokenHook: `${topic} mein ek galti aur ₹50 lakhs ka package uda jaata hai. ${ex.company} jaise companies sirf yeh check karti hain ki tum ${ex.useCase} ke liye ${topic} kaise design karte ho. Woh answer main abhi dunga. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 17: Hinglish — STOP warning ───────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `${topic} STOP karo — pehle yeh dekho`,
      spokenHook: `${topic} seekhna STOP karo agar tumhe nahi pata ki ${ex.company} isse ${ex.scale} par kaise use karti hai. Galat foundation pe poori preparation bekaar ho jaayegi. Pehle yeh 5 minute dekho. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 18: Hinglish — recruiter gate ────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `Recruiter ${topic} mein yeh check karta hai`,
      spokenHook: `${ex.company} ke recruiter ne mujhe bataya — ${topic} interview mein ek cheez check hoti hai jo 90% candidates miss karte hain. Aaj main woh ek cheez reveal kar raha hoon. ${MID_VIDEO_CTA}`,
    };
  },

  // ── 19: Hinglish — FAANG filter ──────────────────────────────────────────
  (topic, _scenes, _title) => {
    const ex = getTopicExample(topic);
    return {
      textHook: `FAANG ${topic} question — 90% FAIL`,
      spokenHook: `FAANG companies ${topic} ko filter question ki tarah use karti hain. 90% candidates yahan FAIL hote hain. Reason? ${ex.problem}. Main tumhe woh exact answer dunga jo ${ex.company} SDE-3 ko milta hai. ${MID_VIDEO_CTA}`,
    };
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a shock-hook (text overlay + narration) for a video.
 *
 * Determinism guarantee:
 *   Same topic + shortIndex → same formula, always.
 *   Uses djb2 hash of topic string XOR fibonacci spread on shortIndex.
 *   Does NOT depend on wall-clock time, file ordering, or Math.random().
 *
 * @param topic         Topic string, e.g. "Kafka producers"
 * @param shortIndex    0-based index; rotate formulas across shorts in a session
 * @param scenes        Scene list (used to extract key concept from headings)
 * @param sessionTitle  Fallback title if scenes are empty
 */
export function generateShockHook(
  topic: string,
  shortIndex: number,
  scenes: Scene[],
  sessionTitle?: string,
): HookResult {
  // shortIndex === 0 is always the lead Short for a session.
  // Pin it to formula 0 ("90% Engineers Get {topic} WRONG") — the channel's
  // proven #1 performer (944 views on @GuruSishya-India).
  if (shortIndex === 0) {
    return SHOCK_HOOK_FORMULAS[0](topic, scenes, sessionTitle);
  }

  // For subsequent shorts: deterministic rotation via djb2 × Fibonacci spread.
  // Same topic + shortIndex → same formula across re-runs (no randomness).
  const topicKey = topic.toLowerCase().trim();
  const topicHash = djb2Hash(topicKey);
  // Offset by 1 so we never re-select formula 0 at shortIndex >= 1
  const mixed = (topicHash ^ (shortIndex * 0x9e3779b9)) >>> 0;
  const idx = 1 + (mixed % (SHOCK_HOOK_FORMULAS.length - 1));
  return SHOCK_HOOK_FORMULAS[idx](topic, scenes, sessionTitle);
}

/**
 * Backward-compatible wrapper.
 *
 * Previous callers used generateDualHook(topic, sessionNumber, scenes, title).
 * The new implementation ignores sessionNumber in favour of shortIndex=0
 * so the hook is stable across session re-runs.
 *
 * @deprecated prefer generateShockHook() for new call sites
 */
export function generateDualHook(
  topic: string,
  sessionNumber: number,
  scenes: Scene[],
  sessionTitle?: string,
): HookResult {
  return generateShockHook(topic, 0, scenes, sessionTitle);
}
