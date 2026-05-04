/**
 * src/data/hook-rotator.ts — deterministic template rotation
 *
 * Why this exists
 * ───────────────
 * Panel-10 Audience + Distribution flagged that all ~37 system-design
 * entries use the same `hookHinglish` template ("Kal Amazon interview
 * hai? Ye {name} mistake mat karna 🔥") and the same `shortTitle`
 * template ("90% of Engineers Get {name} WRONG 😳"). On the YT shelf,
 * 37 thumbnails reading "90% of Engineers Get X WRONG" trigger
 * shelf-fatigue and ICP burnout (Striver-audience persona scored 4.0).
 *
 * Rather than hand-rewriting 110 JSON entries (high-touch, hard to
 * maintain), this module rotates each topic across a small CATEGORY-
 * AWARE pool of templates using a deterministic hash of the slug.
 * Same slug → same hook every time (byte-determinism preserved); but
 * across the bank you now see 5 different system-design templates,
 * 5 different DSA templates, etc.
 *
 * Bonus side-effects
 * ──────────────────
 * - Strips trailing "tricks/tips/patterns" from `name` when used inside
 *   templates that already carry that word (P0-B Striver: bug where
 *   "Bit Manipulation Tricks" + " trick" → "Tricks trick").
 * - Avoids "WRONG 😳" suffix on names ending with "Right/First/
 *   Explained/Last" by skipping those template indices.
 * - Cycles company name across {Amazon, Google, Microsoft, Netflix,
 *   Atlassian, Razorpay, Flipkart, Swiggy} via the same hash so DSA
 *   hooks don't all read "Amazon loves this".
 */

import type { TopicBankEntry } from './topic-bank-loader.js';

const COMPANIES = [
  'Amazon', 'Google', 'Microsoft', 'Netflix', 'Atlassian',
  'Razorpay', 'Flipkart', 'Swiggy',
];

/** FNV-1a 32-bit hash. Pure, deterministic, no deps. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Strip trailing plural/singular noise so templates can re-add it cleanly. */
function trimTrailingNoise(name: string): string {
  return name
    .replace(/\s+(tricks?|tips?|patterns?|techniques?|hacks?)\s*$/i, '')
    .trim();
}

/** Returns true if appending " WRONG" produces a grammatically broken phrase. */
function isWrongSuffixUngrammatical(name: string): boolean {
  return /(right|first|last|explained|formula|wrong|guide|cheatsheet)\s*$/i.test(name);
}

const SYSTEM_DESIGN_HINGLISH: ((n: string, c: string) => string)[] = [
  (n, c) => `Kal ${c} interview hai? Ye ${n} sambhal lo 🔥`,
  (n) => `Senior dev bhi ${n} galat samajhte hain — sach yahaan hai 👀`,
  (n, c) => `${c} SDE-2 round: ${n} ka real answer 💡`,
  (n) => `Pichle hafte 3 logo ko isi wajah se reject kiya — ${n}`,
  (n) => `${n}: jo college mein nahi sikhaya jaata 🎯`,
  // Panel-11 Aud P0 (Apna College): campus-placement framing for the
  // tier-2/3 student segment. Different urgency frame (preparation, not
  // panic) — keeps company credibility but speaks to the ICP that hasn't
  // booked their FAANG slot yet.
  (n) => `Campus placement mein ${n} zaroor aata hai — ab shortcut time 📚`,
];

const DSA_HINGLISH: ((n: string, c: string) => string)[] = [
  (n, c) => `${c} loves this ${n} pattern. 90% log fail hote hain 💀`,
  (n) => `${n}: O(n²) se O(n) banao 30 second mein 🚀`,
  // Panel-11 Aud P1 (Kunal): "Striver ke baad" namechecked another
  // creator inside Kunal's ICP pool — replaced with Kunal's casual
  // register so this template reads as Kunal-coded, not Striver-coded.
  (n) => `Bhai, ${n} — ek baar theek se dekho 👀`,
  (n, c) => `Leetcode pattern jo ${c} har round me pucchti hai — ${n}`,
  (n, c) => `Ye ${n} yad rakho, ${c} mein chalega 💡`,
];

const BEHAVIORAL_HINGLISH: ((n: string, c: string) => string)[] = [
  (n) => `${n} ka jawab tumhe pehle se ready rakhna chahiye 🎯`,
  (n) => `Hiring manager ye sun ke filter karta hai — ${n} 👀`,
  (n) => `${n}: STAR format mein 60 second mein 🔥`,
];

const DB_INTERNALS_HINGLISH: ((n: string, c: string) => string)[] = [
  (n) => `${n}: production crash hone se pehle samajh lo 💀`,
  (n) => `Senior backend bhi galat samajhta hai — ${n} 👀`,
  (n) => `${n}: query 100x fast karne ka secret 🚀`,
  // Panel-11 Aud P1 (Harkirat): asymmetric pool — db-internals had 3
  // templates vs 5 elsewhere, lower variety ceiling. Added two with
  // 100xDevs/modern-stack credibility signals.
  (n) => `Jo ${n} nahi jaanta, uska Node backend prod me fail hoga 💀`,
  (n) => `100x engineers ke liye: ${n} ka fast path 🚀`,
];

const SYSTEM_DESIGN_TITLE: ((n: string, c: string) => string)[] = [
  (n) => `90% of Engineers Get ${n} WRONG 😳`,
  (n) => `${n}: How Senior Engineers Actually Think 🔥`,
  (n, c) => `Real ${c} SDE-2 Answer for ${n} 💡`,
  (n) => `${n} — Stop Memorizing, Start Understanding 🎯`,
  // Panel-11 Aud P0 (Apna College): "₹30LPA" was tone-deaf for the
  // tier-2/3 fresher ICP whose aspirational frame is a first job, not a
  // mid-level salary band. Reframed to fresher/first-job loss.
  (n) => `The ${n} Mistake That Costs Freshers Their First Offer 💀`,
];

const DSA_TITLE: ((n: string, c: string) => string)[] = [
  (n, c) => `${c}'s Favorite ${n} Pattern 🚀`,
  (n) => `${n}: O(n²) → O(n) in 30 Seconds 💡`,
  // Panel-11 Aud P0 (Striver): previous "Striver Won't Tell You This"
  // was an adversarial brand-jacking template that would fire on ~20%
  // of DSA slugs and generate negative signal from Striver's high-
  // loyalty audience. Replaced with a competitive-but-non-adversarial
  // framing that keeps the urgency without naming a competitor.
  (n) => `Crack ${n} Before Your Next Attempt 💡`,
  (n, c) => `Master ${n} Like a ${c} SDE-3 🎯`,
  (n) => `${n}: The DSA Pattern Recruiters Test 💀`,
];

const BEHAVIORAL_TITLE: ((n: string, c: string) => string)[] = [
  (n) => `Nail ${n} in Your Next Interview 🎯`,
  (n) => `How to Answer ${n} Like a Hired Candidate 🔥`,
  (n) => `${n}: The 60-Second STAR Framework 💡`,
];

const DB_INTERNALS_TITLE: ((n: string, c: string) => string)[] = [
  (n) => `${n}: The Production Crash You Don't Know About 💀`,
  (n) => `Make Queries 100× Faster: ${n} 🚀`,
  (n) => `${n} Explained for ₹40LPA Backend Roles 💡`,
];

function poolForCategory(
  category: string | undefined,
  kind: 'hinglish' | 'title',
): { pool: ((n: string, c: string) => string)[]; isSystemDesignTitle: boolean } {
  const cat = (category ?? '').toLowerCase();
  if (kind === 'hinglish') {
    if (cat === 'system-design') return { pool: SYSTEM_DESIGN_HINGLISH, isSystemDesignTitle: false };
    if (cat === 'dsa') return { pool: DSA_HINGLISH, isSystemDesignTitle: false };
    if (cat === 'behavioral') return { pool: BEHAVIORAL_HINGLISH, isSystemDesignTitle: false };
    if (cat === 'db-internals') return { pool: DB_INTERNALS_HINGLISH, isSystemDesignTitle: false };
    return { pool: SYSTEM_DESIGN_HINGLISH, isSystemDesignTitle: false };
  }
  if (cat === 'system-design') return { pool: SYSTEM_DESIGN_TITLE, isSystemDesignTitle: true };
  if (cat === 'dsa') return { pool: DSA_TITLE, isSystemDesignTitle: false };
  if (cat === 'behavioral') return { pool: BEHAVIORAL_TITLE, isSystemDesignTitle: false };
  if (cat === 'db-internals') return { pool: DB_INTERNALS_TITLE, isSystemDesignTitle: false };
  // Default fallback: system-design pool, but mark the WRONG-suffix
  // guard active because the title at index 0 of SYSTEM_DESIGN_TITLE
  // is the "WRONG 😳" template that needs the ungrammatical-suffix skip.
  return { pool: SYSTEM_DESIGN_TITLE, isSystemDesignTitle: true };
}

export interface RotatedHook {
  hookHinglish: string;
  shortTitle: string;
  /** Which template indices fired (for debug/test stability). */
  hinglishIdx: number;
  titleIdx: number;
}

/**
 * Returns a deterministically-rotated `hookHinglish` + `shortTitle`
 * derived from the bank entry's category and slug. When the original
 * fields exist they are IGNORED because they are template-stamped at
 * source — the rotator's pool already covers their format and adds
 * 4 more variants per category.
 *
 * The same slug always produces the same output (byte-determinism).
 *
 * Also handles two latent grammar bugs in the original bank:
 *  - "{name} trick" doubling when name ends with "tricks/tips/patterns"
 *    (DSA category) — strip trailing noise before interpolation.
 *  - "{name} WRONG 😳" producing "Right WRONG"/"Explained WRONG" when
 *    name ends with words that already imply correctness — skip the
 *    title index 0 for those entries.
 */
export function rotateBankHook(entry: TopicBankEntry): RotatedHook {
  const cleanName = trimTrailingNoise(entry.name);
  const company = COMPANIES[fnv1a(`${entry.slug}|company`) % COMPANIES.length] as string;

  // Panel-12/13 Hejlsberg P1: previously used `tPool === SYSTEM_DESIGN_TITLE`
  // reference-identity to decide whether to apply the WRONG-suffix
  // guard. Fragile under future bundler dedup or pool re-export. Now
  // poolForCategory returns an explicit boolean alongside the array.
  const { pool: hPool } = poolForCategory(entry.category, 'hinglish');
  const { pool: tPool, isSystemDesignTitle } = poolForCategory(entry.category, 'title');

  const hinglishIdx = fnv1a(`${entry.slug}|h`) % hPool.length;

  // For title pool: if name would produce "Right WRONG"/"Explained WRONG",
  // shift past index 0 (the "WRONG" template).
  let titleIdx = fnv1a(`${entry.slug}|t`) % tPool.length;
  if (titleIdx === 0 && isSystemDesignTitle && isWrongSuffixUngrammatical(entry.name)) {
    titleIdx = 1;
  }

  // Panel-12/13 Hejlsberg P1: replaced `as` casts with non-null
  // assertions so the call-site stays correct under the future
  // `noUncheckedIndexedAccess: true` tsconfig flag. hinglishIdx and
  // titleIdx are derived from `% pool.length` so are guaranteed
  // in-range whenever the pool is non-empty (compile-time invariant
  // of the pool definitions above).
  const hookHinglish = hPool[hinglishIdx]!(cleanName, company);
  const shortTitle = tPool[titleIdx]!(cleanName, company);
  return { hookHinglish, shortTitle, hinglishIdx, titleIdx };
}
