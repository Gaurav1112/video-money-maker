import type { QuizQuestion } from '../../src/lib/quiz-content';

export const MAX_TITLE_LEN = 60;

export function validateQuizzes(quizzes: QuizQuestion[]): string[] {
  const errors: string[] = [];
  for (const [i, q] of quizzes.entries()) {
    const ref = `[${i}] ${q.topic} "${q.title.slice(0, 30)}"`;
    if (q.title.length > MAX_TITLE_LEN) {
      errors.push(`${ref}: title is ${q.title.length} chars, max ${MAX_TITLE_LEN}`);
    }
    if (q.options.length !== 3) {
      errors.push(`${ref}: options.length is ${q.options.length}, expected 3`);
    }
    if (!q.endQuestion?.trim()) {
      errors.push(`${ref}: endQuestion is empty`);
    }
  }
  return errors;
}
