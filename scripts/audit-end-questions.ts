#!/usr/bin/env npx tsx
/**
 * scripts/audit-end-questions.ts — Feature 010, Part B
 *
 * Scans QUIZ_BANK and flags `endQuestion` entries that are NOT strong
 * comment-driving prompts. A strong prompt is binary or openable: it asks an
 * actual question the viewer can answer in one tap or one line.
 *
 * Report-only. This script NEVER rewrites quiz content — rewriting weak
 * prompts is content work for a human. It just surfaces the list so those
 * rewrites can be prioritized.
 *
 * CLI:  npx tsx scripts/audit-end-questions.ts
 */
import { QUIZ_BANK } from '../src/lib/quiz-content';

/** A prompt is "weak" if it has no question mark, or is a bare filler ask. */
export function isWeakEndQuestion(eq: string): boolean {
  const t = (eq || '').trim();
  if (!t) return true;
  // No actual question.
  if (!t.includes('?')) return true;
  // Bare filler: "Comment below." / "Comment your answer." with no question.
  const beforeQ = t.slice(0, t.indexOf('?')).trim();
  if (beforeQ.length < 8) return true;
  return false;
}

function main(): void {
  const weak: { index: number; topic: string; endQuestion: string }[] = [];
  QUIZ_BANK.forEach((q, i) => {
    if (isWeakEndQuestion(q.endQuestion)) {
      weak.push({ index: i, topic: q.topic, endQuestion: q.endQuestion });
    }
  });

  console.log(`endQuestion audit — ${QUIZ_BANK.length} quizzes scanned`);
  console.log(`weak / non-openable prompts: ${weak.length}`);
  console.log('');
  if (weak.length === 0) {
    console.log('All endQuestion entries are strong (binary/openable). Nothing to rewrite.');
    return;
  }
  console.log('Weak entries (rewrite by hand — this script does NOT edit content):');
  for (const w of weak) {
    console.log(`  [#${w.index}] (${w.topic}) "${w.endQuestion}"`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('audit-end-questions.ts')) {
  main();
}
