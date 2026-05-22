import { describe, it, expect } from 'vitest';
import {
  capNarrationPlan,
  padNarrationPlan,
  type OpinionNarrationScene,
} from '../opinion-piece-parser';

/** Word count of an entire narration plan. */
function planWords(plan: OpinionNarrationScene[]): number {
  return plan.reduce((n, s) => n + s.narration.split(/\s+/).filter(Boolean).length, 0);
}

/** Build a scene whose narration has `sentences` sentences of `wordsEach` words. */
function makeScene(
  type: OpinionNarrationScene['type'],
  sentences: number,
  wordsEach: number
): OpinionNarrationScene {
  const sentence = Array.from({ length: wordsEach }, (_, i) => `w${i}`).join(' ');
  return { type, narration: Array.from({ length: sentences }, () => `${sentence}.`).join(' ') };
}

describe('capNarrationPlan', () => {
  it('returns an under-budget plan unchanged', () => {
    const plan: OpinionNarrationScene[] = [makeScene('hook', 2, 10), makeScene('lesson', 2, 10)]; // 40 words total, well under 900
    const out = capNarrationPlan(plan, 900);
    expect(out).toEqual(plan);
  });

  it('truncates an over-budget plan to at most the word budget', () => {
    const plan: OpinionNarrationScene[] = [
      makeScene('hook', 40, 20),
      makeScene('cons', 40, 20),
      makeScene('lesson', 40, 20),
    ]; // 2400 words total
    const out = capNarrationPlan(plan, 900);
    expect(planWords(out)).toBeLessThanOrEqual(900);
    expect(planWords(out)).toBeGreaterThan(0);
  });

  it('truncates only at sentence boundaries (no mid-word / mid-sentence cut)', () => {
    const plan: OpinionNarrationScene[] = [makeScene('hook', 100, 20)]; // 2000 words
    const out = capNarrationPlan(plan, 300);
    for (const scene of out) {
      const trimmed = scene.narration.trim();
      expect(trimmed.endsWith('.')).toBe(true);
      // every retained chunk is a full sentence of 20 words
      for (const sentence of trimmed.split('.').filter((s) => s.trim())) {
        expect(sentence.trim().split(/\s+/)).toHaveLength(20);
      }
    }
  });

  it('keeps every scene present (does not drop scene entries)', () => {
    const plan: OpinionNarrationScene[] = [
      makeScene('hook', 30, 20),
      makeScene('pros', 30, 20),
      makeScene('question', 30, 20),
    ];
    const out = capNarrationPlan(plan, 600);
    expect(out.map((s) => s.type)).toEqual(['hook', 'pros', 'question']);
  });

  it('is deterministic — same input yields same output', () => {
    const plan: OpinionNarrationScene[] = [makeScene('hook', 50, 15), makeScene('cons', 50, 15)];
    const a = capNarrationPlan(plan, 500);
    const b = capNarrationPlan(plan, 500);
    expect(a).toEqual(b);
  });

  it('defaults to a 900-word budget when no max is given', () => {
    const plan: OpinionNarrationScene[] = [makeScene('hook', 100, 20)]; // 2000 words
    const out = capNarrationPlan(plan);
    expect(planWords(out)).toBeLessThanOrEqual(900);
  });
});

describe('padNarrationPlan', () => {
  it('returns an at/above-floor plan unchanged', () => {
    const plan: OpinionNarrationScene[] = [makeScene('hook', 30, 20)]; // 600 words
    const out = padNarrationPlan(plan, 500);
    expect(out).toEqual(plan);
  });

  it('pads a terse plan up toward the word floor', () => {
    const plan: OpinionNarrationScene[] = [
      makeScene('hook', 2, 5),
      makeScene('pros', 2, 5),
      makeScene('lesson', 2, 5),
    ]; // 30 words total
    const out = padNarrationPlan(plan, 60);
    expect(planWords(out)).toBeGreaterThan(planWords(plan));
  });

  it('keeps every scene present when padding', () => {
    const plan: OpinionNarrationScene[] = [makeScene('hook', 1, 4), makeScene('cons', 1, 4)];
    const out = padNarrationPlan(plan, 80);
    expect(out.map((s) => s.type)).toEqual(['hook', 'cons']);
  });

  it('is deterministic — same input yields same output', () => {
    const plan: OpinionNarrationScene[] = [makeScene('hook', 1, 4), makeScene('lesson', 1, 4)];
    expect(padNarrationPlan(plan, 100)).toEqual(padNarrationPlan(plan, 100));
  });

  it('terminates even when the floor exceeds the elaboration bank', () => {
    const plan: OpinionNarrationScene[] = [makeScene('hook', 1, 3)];
    // floor far above what the fixed bank can supply — must not loop forever
    const out = padNarrationPlan(plan, 100000);
    expect(out).toHaveLength(1);
  });
});
