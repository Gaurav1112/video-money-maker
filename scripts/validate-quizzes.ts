#!/usr/bin/env npx tsx
import { QUIZ_BANK } from '../src/lib/quiz-content';
import { validateQuizzes } from './lib/quiz-validator';

const errors = validateQuizzes(QUIZ_BANK);
if (errors.length) {
  console.error(`Validation failed (${errors.length} errors):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log(`✓ All ${QUIZ_BANK.length} quizzes valid.`);
