import { describe, it, expect } from 'vitest';
import { buildFirstComment } from '../lib/engagement';
import type { QuizQuestion } from '../../src/lib/quiz-content';

const baseQuiz: QuizQuestion = {
  topic: 'kafka',
  hookText: 'h',
  spokenHook: 'h',
  question: 'q?',
  options: ['a', 'b', 'c'],
  correctIndex: 0,
  explanation: 'e',
  twist: 't',
  endQuestion: 'Kafka or RabbitMQ for your use case? Comment.',
  title: 'Short title',
};

describe('buildFirstComment', () => {
  it('returns a reply-baiting comment ending with a 👇 prompt', () => {
    const c = buildFirstComment(baseQuiz);
    expect(c.trim().endsWith('👇')).toBe(true);
    expect(c).toContain('?');
  });

  it('is deterministic across repeated calls', () => {
    expect(buildFirstComment(baseQuiz)).toBe(buildFirstComment(baseQuiz));
  });

  it('does not double-append the prompt when endQuestion already ends in 👇', () => {
    const quiz = { ...baseQuiz, endQuestion: 'SQL or NoSQL? 👇' };
    const c = buildFirstComment(quiz);
    expect(c.match(/👇/g)?.length).toBe(1);
    expect(c.trim().endsWith('👇')).toBe(true);
  });

  it('still produces a usable prompt for a non-binary endQuestion', () => {
    const quiz = { ...baseQuiz, endQuestion: 'Comment your worst N+1 story.' };
    const c = buildFirstComment(quiz);
    expect(c.trim().endsWith('👇')).toBe(true);
    expect(c.length).toBeGreaterThan(0);
  });
});
