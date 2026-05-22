/**
 * scripts/lib/engagement.ts — Feature 010, Part B
 *
 * Turns a quiz into a short, reply-baiting first comment for the channel
 * owner to auto-post. The goal: a one-tap binary question that maximizes
 * early reply velocity (a documented Shorts feed promotion signal).
 *
 * Pure and deterministic — no `Math.random`, no I/O, no LLM.
 */
import type { QuizQuestion } from '../../src/lib/quiz-content';

const PROMPT = '👇';

/**
 * Detect a binary "X or Y" framing in the prompt (mirrors EndCardCTA's
 * parseDebate). Returns the two sides, or null when not binary.
 */
function parseBinary(text: string): { left: string; right: string } | null {
  const qIdx = text.indexOf('?');
  const slice = qIdx >= 0 ? text.slice(0, qIdx) : text;
  const m = slice.match(/^(.+?)\s+or\s+(.+?)(?:\?|\.|$)/i);
  if (!m) return null;
  const left = m[1].trim();
  const right = m[2]
    .trim()
    .replace(/[?.!]+$/, '')
    .trim();
  if (!left || !right) return null;
  return { left, right };
}

/**
 * Build the channel-owner first comment for a quiz.
 *
 * - If `endQuestion` is binary ("X or Y?"), restate it as a crisp A/B vote.
 * - Otherwise, take the question itself and append a generic reply bait.
 * - Always ends with a "👇" prompt; never double-appends one.
 */
export function buildFirstComment(quiz: QuizQuestion): string {
  const eq = (quiz.endQuestion || '').trim();
  const binary = parseBinary(eq);

  let body: string;
  if (binary) {
    // Crisp one-tap vote. "Comment A or B 👇" is the highest-velocity ask.
    body = `${binary.left} OR ${binary.right}? Comment A or B`;
  } else if (eq.includes('?')) {
    // Keep the creator's own question, strip any trailing "Comment." filler.
    const cleaned = eq
      .replace(/\s*comment[^?]*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    body = `${cleaned} — tell me below`;
  } else {
    // No real question: fall back to a topic-anchored reply bait.
    const topic = (quiz.topic || 'this').trim();
    body = `Did you already know this ${topic} trick? YES or NO`;
  }

  // Guarantee exactly one trailing prompt.
  body = body.replace(new RegExp(`\\s*${PROMPT}\\s*$`), '').trim();
  return `${body} ${PROMPT}`;
}
