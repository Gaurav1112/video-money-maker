import { describe, it, expect } from 'vitest';
import { validateQuizzes } from '../lib/quiz-validator';
import type { QuizQuestion } from '../../src/lib/quiz-content';

const good: QuizQuestion = {
  topic: 'kafka',
  hookText: 'h',
  spokenHook: 'h',
  question: 'q?',
  options: ['a', 'b', 'c'],
  correctIndex: 0,
  explanation: 'e',
  twist: 't',
  endQuestion: 'eq?',
  title: 'Short title',
};

describe('validateQuizzes', () => {
  it('passes well-formed quizzes', () => {
    expect(validateQuizzes([good])).toEqual([]);
  });
  it('flags title > 60 chars', () => {
    const bad = { ...good, title: 'x'.repeat(61) };
    const errs = validateQuizzes([bad]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatch(/title.*61.*60/);
  });
  it('flags options length != 3', () => {
    const bad = { ...good, options: ['a', 'b'] as any };
    expect(validateQuizzes([bad])).toContainEqual(expect.stringMatching(/options/));
  });
  it('flags empty endQuestion', () => {
    const bad = { ...good, endQuestion: '' };
    expect(validateQuizzes([bad])).toContainEqual(expect.stringMatching(/endQuestion/));
  });
});
