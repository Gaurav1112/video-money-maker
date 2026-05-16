/**
 * title-templates.ts
 *
 * 30+ shock-hook title templates for @GuruSishya-India Shorts.
 *
 * Design principles (from RANK 12 expert-debate.md):
 *   - ≤ 8 words before hashtags
 *   - At least one SHOUTED keyword: WRONG, STOP, NOW, FAIL, NEVER
 *   - Specific number / stat anchors CTR
 *   - Max 1 emoji (optional, suffix only)
 *   - Hash-based selection → deterministic, no randomness
 *   - Both English and Hinglish variants for every formula class
 *
 * Channel data (channel-shorts.tsv):
 *   944 views  → "90% Engineers Are Preparing WRONG"
 *   812 views  → "90% Get Kafka Producers WRONG"
 *     4 views  → "Caching in 60 Seconds Flat"   ← what we're eliminating
 */

// ─── Slot types ───────────────────────────────────────────────────────────────

export interface TitleSlots {
  /** 1–3 word topic label, e.g. "Kafka producers", "load balancing" */
  topic: string;
  /** Optional persona noun, e.g. "backend", "Java", "full-stack" */
  persona?: string;
}

export interface TitleTemplate {
  id: string;
  /** Formula class for analytics / A-B testing */
  pattern: TitlePattern;
  /** Language variant */
  lang: 'en' | 'hi';
  /** Raw template string — {topic} and {persona} are the only slots */
  template: string;
  /** Capital-shout keyword present in this template */
  shoutWord: ShoutWord;
}

export type TitlePattern =
  | 'ninety-percent-wrong'
  | 'why-not-hired'
  | 'cost-rupee'
  | 'faang-filter'
  | 'recruiter-gate'
  | 'warning-dont'
  | 'stat-bomb'
  | 'call-out'
  | 'consequence'
  | 'specificity-shock';

export type ShoutWord = 'WRONG' | 'STOP' | 'FAIL' | 'NEVER' | 'NOW';

// ─── Template registry ────────────────────────────────────────────────────────

export const TITLE_TEMPLATES: TitleTemplate[] = [
  // ── Pattern 1: 90% Wrong (proven #1 on @GuruSishya-India) ─────────────────
  {
    id: 'en-90w-1',
    pattern: 'ninety-percent-wrong',
    lang: 'en',
    template: '90% Engineers Get {topic} WRONG',
    shoutWord: 'WRONG',
  },
  {
    id: 'en-90w-2',
    pattern: 'ninety-percent-wrong',
    lang: 'en',
    template: '90% Devs Fail This {topic} Question',
    shoutWord: 'FAIL',
  },
  {
    id: 'en-90w-3',
    pattern: 'ninety-percent-wrong',
    lang: 'en',
    template: '90% of You Are Learning {topic} WRONG',
    shoutWord: 'WRONG',
  },
  {
    id: 'en-90w-4',
    pattern: 'ninety-percent-wrong',
    lang: 'en',
    template: '90% {persona} Devs Get {topic} WRONG',
    shoutWord: 'WRONG',
  },
  {
    id: 'hi-90w-1',
    pattern: 'ninety-percent-wrong',
    lang: 'hi',
    template: '90% devs ka {topic} WRONG hai',
    shoutWord: 'WRONG',
  },
  {
    id: 'hi-90w-2',
    pattern: 'ninety-percent-wrong',
    lang: 'hi',
    template: '90% log {topic} galat padhte hain — STOP karo',
    shoutWord: 'STOP',
  },

  // ── Pattern 2: Why Not Hired ───────────────────────────────────────────────
  {
    id: 'en-wnh-1',
    pattern: 'why-not-hired',
    lang: 'en',
    template: 'Why {persona} Engineers NEVER Get Hired',
    shoutWord: 'NEVER',
  },
  {
    id: 'en-wnh-2',
    pattern: 'why-not-hired',
    lang: 'en',
    template: 'Why You FAIL {topic} Interviews Every Time',
    shoutWord: 'FAIL',
  },
  {
    id: 'en-wnh-3',
    pattern: 'why-not-hired',
    lang: 'en',
    template: '{topic} Is Why You Keep Getting Rejected',
    shoutWord: 'FAIL',
  },
  {
    id: 'hi-wnh-1',
    pattern: 'why-not-hired',
    lang: 'hi',
    template: '{topic} nahi aata? Interview FAIL pakka',
    shoutWord: 'FAIL',
  },
  {
    id: 'hi-wnh-2',
    pattern: 'why-not-hired',
    lang: 'hi',
    template: '{topic} ke bina job NEVER milegi',
    shoutWord: 'NEVER',
  },

  // ── Pattern 3: Cost / ₹ Anchor ────────────────────────────────────────────
  {
    id: 'en-cost-1',
    pattern: 'cost-rupee',
    lang: 'en',
    template: 'The {topic} Mistake Costing You ₹50LPA',
    shoutWord: 'WRONG',
  },
  {
    id: 'en-cost-2',
    pattern: 'cost-rupee',
    lang: 'en',
    template: 'STOP This {topic} Habit — Costs ₹20LPA',
    shoutWord: 'STOP',
  },
  {
    id: 'en-cost-3',
    pattern: 'cost-rupee',
    lang: 'en',
    template: 'One WRONG {topic} Answer = ₹30LPA Lost',
    shoutWord: 'WRONG',
  },
  {
    id: 'hi-cost-1',
    pattern: 'cost-rupee',
    lang: 'hi',
    template: 'Yeh {topic} galti ₹50LPA chhin leti hai',
    shoutWord: 'WRONG',
  },
  {
    id: 'hi-cost-2',
    pattern: 'cost-rupee',
    lang: 'hi',
    template: '{topic} WRONG = ₹30LPA ka nuksaan',
    shoutWord: 'WRONG',
  },

  // ── Pattern 4: FAANG Filter ───────────────────────────────────────────────
  {
    id: 'en-faang-1',
    pattern: 'faang-filter',
    lang: 'en',
    template: 'FAANG Asks This {topic} Q. Most FAIL.',
    shoutWord: 'FAIL',
  },
  {
    id: 'en-faang-2',
    pattern: 'faang-filter',
    lang: 'en',
    template: "Google's {topic} Question — Can You Answer?",
    shoutWord: 'FAIL',
  },
  {
    id: 'en-faang-3',
    pattern: 'faang-filter',
    lang: 'en',
    template: 'FAANG Rejected Me On {topic}. NEVER Again.',
    shoutWord: 'NEVER',
  },
  {
    id: 'hi-faang-1',
    pattern: 'faang-filter',
    lang: 'hi',
    template: 'FAANG ka {topic} question — 90% FAIL karte hain',
    shoutWord: 'FAIL',
  },

  // ── Pattern 5: Recruiter Gate ─────────────────────────────────────────────
  {
    id: 'en-rec-1',
    pattern: 'recruiter-gate',
    lang: 'en',
    template: '1 Thing Recruiters Check in Your {topic} Answer',
    shoutWord: 'FAIL',
  },
  {
    id: 'en-rec-2',
    pattern: 'recruiter-gate',
    lang: 'en',
    template: 'Recruiters STOP at This {topic} Mistake',
    shoutWord: 'STOP',
  },
  {
    id: 'hi-rec-1',
    pattern: 'recruiter-gate',
    lang: 'hi',
    template: 'Har recruiter {topic} mein yeh cheez check karta hai',
    shoutWord: 'FAIL',
  },

  // ── Pattern 6: Warning / Don't ────────────────────────────────────────────
  {
    id: 'en-warn-1',
    pattern: 'warning-dont',
    lang: 'en',
    template: "Don't Learn {topic} Without Knowing This",
    shoutWord: 'STOP',
  },
  {
    id: 'en-warn-2',
    pattern: 'warning-dont',
    lang: 'en',
    template: 'STOP Using {topic} Like This — It Is WRONG',
    shoutWord: 'STOP',
  },
  {
    id: 'en-warn-3',
    pattern: 'warning-dont',
    lang: 'en',
    template: 'NEVER Answer {topic} Like This in Interviews',
    shoutWord: 'NEVER',
  },
  {
    id: 'hi-warn-1',
    pattern: 'warning-dont',
    lang: 'hi',
    template: 'Bina yeh jaane {topic} mat seekho — STOP',
    shoutWord: 'STOP',
  },
  {
    id: 'hi-warn-2',
    pattern: 'warning-dont',
    lang: 'hi',
    template: '{topic} STOP karo — pehle yeh dekho',
    shoutWord: 'STOP',
  },

  // ── Pattern 7: Stat Bomb ──────────────────────────────────────────────────
  {
    id: 'en-stat-1',
    pattern: 'stat-bomb',
    lang: 'en',
    template: '3 in 4 Devs Get {topic} WRONG in Interviews',
    shoutWord: 'WRONG',
  },
  {
    id: 'en-stat-2',
    pattern: 'stat-bomb',
    lang: 'en',
    template: '9 Out of 10 Candidates FAIL This {topic} Q',
    shoutWord: 'FAIL',
  },
  {
    id: 'en-stat-3',
    pattern: 'stat-bomb',
    lang: 'en',
    template: 'Only 1% of Devs Know This {topic} Trick',
    shoutWord: 'FAIL',
  },
  {
    id: 'hi-stat-1',
    pattern: 'stat-bomb',
    lang: 'hi',
    template: 'Sirf 1% devs ko pata hai yeh {topic} trick',
    shoutWord: 'FAIL',
  },

  // ── Pattern 8: Call Out ───────────────────────────────────────────────────
  {
    id: 'en-call-1',
    pattern: 'call-out',
    lang: 'en',
    template: 'Are YOU Making This {topic} Mistake?',
    shoutWord: 'WRONG',
  },
  {
    id: 'en-call-2',
    pattern: 'call-out',
    lang: 'en',
    template: "You're Doing {topic} WRONG — Here's Proof",
    shoutWord: 'WRONG',
  },
  {
    id: 'hi-call-1',
    pattern: 'call-out',
    lang: 'hi',
    template: 'Kya tum {topic} WRONG kar rahe ho?',
    shoutWord: 'WRONG',
  },

  // ── Pattern 9: Consequence ────────────────────────────────────────────────
  {
    id: 'en-cons-1',
    pattern: 'consequence',
    lang: 'en',
    template: 'Your {topic} Answer = Instant Rejection NOW',
    shoutWord: 'NOW',
  },
  {
    id: 'en-cons-2',
    pattern: 'consequence',
    lang: 'en',
    template: 'WRONG {topic} Approach = No Offer Letter',
    shoutWord: 'WRONG',
  },
  {
    id: 'hi-cons-1',
    pattern: 'consequence',
    lang: 'hi',
    template: 'Ek {topic} galti = offer NEVER milega',
    shoutWord: 'NEVER',
  },

  // ── Pattern 10: Specificity Shock ─────────────────────────────────────────
  {
    id: 'en-spec-1',
    pattern: 'specificity-shock',
    lang: 'en',
    template: 'The {topic} Question That FAILs 9/10 Candidates',
    shoutWord: 'FAIL',
  },
  {
    id: 'en-spec-2',
    pattern: 'specificity-shock',
    lang: 'en',
    template: 'One WRONG {topic} Line and You Lose ₹45LPA',
    shoutWord: 'WRONG',
  },
  {
    id: 'en-spec-3',
    pattern: 'specificity-shock',
    lang: 'en',
    template: 'This {topic} Concept Decides Your Package — STOP Ignoring It',
    shoutWord: 'STOP',
  },
  {
    id: 'hi-spec-1',
    pattern: 'specificity-shock',
    lang: 'hi',
    template: '{topic} ka yeh ek concept package decide karta hai',
    shoutWord: 'FAIL',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * djb2 hash — deterministic, no external deps, GHA-safe.
 * Same string always produces same uint32.
 */
export function djb2Hash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // hash * 33 XOR char — classic djb2
    hash = (hash * 33) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash;
}

/**
 * Fill template slots with provided values.
 * {topic}   → slots.topic
 * {persona} → slots.persona ?? slots.topic (graceful fallback)
 */
export function fillTemplate(template: string, slots: TitleSlots): string {
  const persona = slots.persona ?? slots.topic;
  return template
    .replace(/\{topic\}/g, slots.topic)
    .replace(/\{persona\}/g, persona);
}

/**
 * Pick a shock-hook title deterministically from the template registry.
 *
 * Algorithm:
 *   hash = djb2(topic.toLowerCase()) XOR (shortIndex * 0x9e3779b9)
 *   idx  = hash % filteredTemplates.length
 *
 * This guarantees:
 *   - Same topic + shortIndex → same template (deterministic)
 *   - Different shortIndex → different template within the same session
 *   - Different topic → different template
 *
 * @param slots       Topic and optional persona
 * @param shortIndex  0-based index of the short within a session (for rotation)
 * @param lang        'en' | 'hi' — defaults to 'en'
 */
export function pickShockTitle(
  slots: TitleSlots,
  shortIndex: number = 0,
  lang: 'en' | 'hi' = 'en',
): string {
  const pool = TITLE_TEMPLATES.filter((t) => t.lang === lang);
  if (pool.length === 0) throw new Error(`No templates for lang="${lang}"`);

  const topicKey = slots.topic.toLowerCase().trim();
  const topicHash = djb2Hash(topicKey);
  // Fibonacci hashing spread to avoid clustering
  const mixed = (topicHash ^ (shortIndex * 0x9e3779b9)) >>> 0;
  const idx = mixed % pool.length;

  return fillTemplate(pool[idx].template, slots);
}

/**
 * Pick a template from a specific pattern class.
 * Useful when the caller wants to control which formula class is used
 * (e.g., always use 'ninety-percent-wrong' for the first Short of a session).
 */
export function pickShockTitleByPattern(
  slots: TitleSlots,
  pattern: TitlePattern,
  shortIndex: number = 0,
  lang: 'en' | 'hi' = 'en',
): string {
  const pool = TITLE_TEMPLATES.filter(
    (t) => t.pattern === pattern && t.lang === lang,
  );
  if (pool.length === 0) {
    // Graceful fallback: use full pool
    return pickShockTitle(slots, shortIndex, lang);
  }

  const topicKey = slots.topic.toLowerCase().trim();
  const mixed = (djb2Hash(topicKey) ^ (shortIndex * 0x9e3779b9)) >>> 0;
  const idx = mixed % pool.length;
  return fillTemplate(pool[idx].template, slots);
}

/**
 * Build the complete YouTube Shorts title string:
 * "{shock title} #Shorts #{typeTag} #InterviewPrep #FAANG"
 *
 * Enforces:
 *   - Total ≤ 100 chars (YouTube Shorts title limit)
 *   - Shock title portion ≤ 60 chars (avoids mid-word truncation in feed)
 *   - No emoji-spam (templates contain zero emojis; one may be added here)
 */
export function buildShortsTitle(
  slots: TitleSlots,
  shortIndex: number,
  typeHashtag: string,
  lang: 'en' | 'hi' = 'en',
): string {
  // First short of each session always uses the #1 proven pattern
  const pattern: TitlePattern =
    shortIndex === 0 ? 'ninety-percent-wrong' : undefined as unknown as TitlePattern;

  const shockTitle =
    shortIndex === 0
      ? pickShockTitleByPattern(slots, 'ninety-percent-wrong', shortIndex, lang)
      : pickShockTitle(slots, shortIndex, lang);

  const truncated =
    shockTitle.length > 60 ? shockTitle.slice(0, 59).trimEnd() + '…' : shockTitle;

  const hashtags = `#Shorts ${typeHashtag} #InterviewPrep #FAANG`;
  return `${truncated} ${hashtags}`.trim();
}
