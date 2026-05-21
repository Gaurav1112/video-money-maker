// Shared hook-text builder used by both QuizShort.tsx (composition) and
// QuizThumbnail.tsx (still-frame thumbnail).
// Deterministic, no LLM — same quiz → same hook text always.

import type { QuizQuestion } from './quiz-content';

/**
 * Topic-specific overrides for known high-performing hooks.
 * Hand-tuned because the auto-extracted hook sometimes lands on the wrong stat.
 */
const TOPIC_HOOKS: Record<string, string> = {
  kafka: 'LinkedIn serves\n7 TRILLION messages/day\nwith THIS setting',
};

/**
 * Build the on-screen hook text for a quiz.
 *
 * Priority:
 * 1. Topic-specific override from TOPIC_HOOKS
 * 2. Largest extracted "<NUMBER UNIT> <CONTEXT>" pattern from explanation
 * 3. "<COMPANY> ... because of THIS" if a known company is mentioned
 * 4. Falls back to quiz.hookText (the hand-written tagline)
 */
export function getSpecificHook(quiz: QuizQuestion): string {
  if (TOPIC_HOOKS[quiz.topic]) return TOPIC_HOOKS[quiz.topic];

  const bigMatch = quiz.explanation.match(
    /(\d[\d,.]*\s*(?:trillion|billion|million|thousand))\s+([\w\s]+?)(?:\.|,|and)/i,
  );
  if (bigMatch) {
    const num = bigMatch[1].trim().toUpperCase();
    const ctx = bigMatch[2].trim();
    return `${num}\n${ctx}\nwith THIS setting`;
  }

  const companyMatch = quiz.explanation.match(
    /(Google|Netflix|Uber|LinkedIn|Meta|Amazon|Stripe|Cloudflare)\s+[\w\s]+?(?:\.|,)/i,
  );
  if (companyMatch) {
    const company = companyMatch[0].replace(/[.,]$/, '').trim();
    if (company.length < 50) return `${company}\nbecause of THIS`;
  }

  return quiz.hookText;
}

/**
 * "Company + dramatic context" hook formula — extracted from the fallback branch
 * of getSpecificHook so it can be invoked as a stand-alone variant.
 *
 * Used as variant C when variants A and B collapse to the same hook text.
 */
export function getCompanyDramaticHook(quiz: QuizQuestion): string {
  const companyMatch = quiz.explanation.match(
    /(Google|Netflix|Uber|LinkedIn|Meta|Amazon|Stripe|Cloudflare|GitHub|Twitter)\s+[\w\s]+?(?:\.|,)/i,
  );
  if (companyMatch) {
    const company = companyMatch[0].replace(/[.,]$/, '').trim();
    if (company.length < 50) return `${company}\nbecause of THIS`;
  }
  return quiz.hookText; // final fallback
}

export type HookFormula = 'specific_stat' | 'wrong_answer_first' | 'company_dramatic';

export const ALL_HOOK_FORMULAS: HookFormula[] = [
  'specific_stat',
  'wrong_answer_first',
  'company_dramatic',
];

export interface HookResult {
  hookText: string;
  spokenHook: string;
}

/**
 * Apply a named hook formula to a quiz and return both on-screen and spoken hook.
 * spokenHook is always the original quiz.spokenHook — only on-screen text varies
 * between formulas so the audio track is identical (cached) across variants.
 */
export function applyHook(quiz: QuizQuestion, formula: HookFormula): HookResult {
  let hookText: string;
  switch (formula) {
    case 'specific_stat':
      hookText = getSpecificHook(quiz);
      break;
    case 'wrong_answer_first':
      hookText = getWrongAnswerHook(quiz);
      break;
    case 'company_dramatic':
      hookText = getCompanyDramaticHook(quiz);
      break;
  }
  return { hookText, spokenHook: quiz.spokenHook };
}

/**
 * "Wrong-answer-first" hook variant — opens by stating one of the WRONG options
 * as definitive fact, triggering cognitive dissonance. Alternates with the
 * standard hook based on quiz index parity (deterministic A/B).
 */
export function getWrongAnswerHook(quiz: QuizQuestion): string {
  // Pick the first wrong option as the "false statement"
  const wrongIndex = quiz.options.findIndex((_, i) => i !== quiz.correctIndex);
  if (wrongIndex < 0) return getSpecificHook(quiz);
  const wrong = quiz.options[wrongIndex];
  return `"${wrong}"\nFALSE.\nHere's why.`;
}

/**
 * Pick hook for a given quiz + slot (e.g. quiz index, day of year).
 * Even slot → standard specific hook. Odd slot → wrong-answer-first hook.
 * Deterministic same input → same output.
 */
export function pickHook(quiz: QuizQuestion, slot: number): string {
  return slot % 2 === 0 ? getSpecificHook(quiz) : getWrongAnswerHook(quiz);
}
