import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDailyQuiz, resolveTopicLock, LOCK_EXPIRES } from '../quiz-content';

const ORIGINAL_ENV = process.env.QUIZ_TOPIC_LOCK;

describe('resolveTopicLock', () => {
  it('returns undefined when env is "off"', () => {
    expect(resolveTopicLock(new Date('2026-05-25T00:00:00Z'), 'off')).toBeUndefined();
  });

  it('returns the explicit env value when set and non-off', () => {
    expect(resolveTopicLock(new Date('2026-05-25T00:00:00Z'), 'redis')).toBe('redis');
  });

  it('returns "kafka" by default when env is unset and date is on or before LOCK_EXPIRES', () => {
    expect(resolveTopicLock(new Date('2026-05-25T00:00:00Z'), undefined)).toBe('kafka');
    expect(resolveTopicLock(LOCK_EXPIRES, undefined)).toBe('kafka');
  });

  it('returns undefined when env is unset and date is after LOCK_EXPIRES', () => {
    const after = new Date(LOCK_EXPIRES.getTime() + 24 * 60 * 60 * 1000);
    expect(resolveTopicLock(after, undefined)).toBeUndefined();
  });

  it('still honours an explicit env override after LOCK_EXPIRES', () => {
    const after = new Date(LOCK_EXPIRES.getTime() + 24 * 60 * 60 * 1000);
    expect(resolveTopicLock(after, 'database')).toBe('database');
  });
});

describe('getDailyQuiz', () => {
  beforeEach(() => {
    delete process.env.QUIZ_TOPIC_LOCK;
  });
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.QUIZ_TOPIC_LOCK;
    } else {
      process.env.QUIZ_TOPIC_LOCK = ORIGINAL_ENV;
    }
  });

  it('returns a kafka quiz inside the lock window without overrides', () => {
    const quiz = getDailyQuiz(new Date('2026-05-25T00:00:00Z'));
    expect(quiz.topic).toBe('kafka');
  });

  it('returns a kafka quiz on the lock expiry boundary', () => {
    const quiz = getDailyQuiz(LOCK_EXPIRES);
    expect(quiz.topic).toBe('kafka');
  });

  it('returns any quiz after lock expiry (does not crash)', () => {
    const after = new Date(LOCK_EXPIRES.getTime() + 5 * 24 * 60 * 60 * 1000);
    const quiz = getDailyQuiz(after);
    expect(quiz).toBeDefined();
    expect(typeof quiz.topic).toBe('string');
  });

  it('honors explicit QUIZ_TOPIC_LOCK env', () => {
    process.env.QUIZ_TOPIC_LOCK = 'redis';
    const quiz = getDailyQuiz(new Date('2026-05-25T00:00:00Z'));
    expect(quiz.topic).toBe('redis');
  });

  it('disables the lock when QUIZ_TOPIC_LOCK=off', () => {
    process.env.QUIZ_TOPIC_LOCK = 'off';
    // We can not predict which topic but it must not throw.
    const quiz = getDailyQuiz(new Date('2026-05-25T00:00:00Z'));
    expect(quiz).toBeDefined();
  });

  it('explicit topicFilter argument wins over env', () => {
    process.env.QUIZ_TOPIC_LOCK = 'redis';
    const quiz = getDailyQuiz(new Date('2026-05-25T00:00:00Z'), 'database');
    expect(quiz.topic).toBe('database');
  });

  it('falls back to unfiltered rotation when topicFilter matches no quizzes', () => {
    const quiz = getDailyQuiz(new Date('2026-05-25T00:00:00Z'), 'nosuchtopic');
    expect(quiz).toBeDefined();
  });

  it('is deterministic for the same date + filter combo', () => {
    const a = getDailyQuiz(new Date('2026-05-25T00:00:00Z'), 'kafka');
    const b = getDailyQuiz(new Date('2026-05-25T00:00:00Z'), 'kafka');
    expect(a.title).toBe(b.title);
  });
});
