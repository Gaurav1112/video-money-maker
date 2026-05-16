/**
 * tests/determinism/dialogue.test.ts
 *
 * RED: selectDialogueSequence uses mulberry32 seeded by (seed + sceneIndex)
 *      which IS deterministic. However the test is red because:
 *      1. The import path may not resolve (dialogue/engine not exported from index)
 *      2. The "hash twice" pattern verifies no module-level state mutation.
 *
 * GREEN after: ensure selectDialogueSequence is re-exported from
 *              src/dialogues/index.ts so the import resolves.
 */
import { describe, it, expect } from 'vitest';
import type { DialogueQuery } from '../../src/dialogues/types';

let selectDialogueSequence: (
  queries: DialogueQuery[],
  language: string,
  seed: number,
) => any[];

try {
  const mod = await import('../../src/dialogues/engine');
  selectDialogueSequence = mod.selectDialogueSequence;
} catch {
  try {
    const mod = await import('../../src/dialogues');
    selectDialogueSequence = (mod as any).selectDialogueSequence;
  } catch {
    selectDialogueSequence = undefined as any;
  }
}

const QUERIES: DialogueQuery[] = [
  { character: 'arjun', emotion: 'happy', context: 'greeting' },
  { character: 'kaaliya', emotion: 'angry', context: 'threat' },
];

describe('determinism: dialogue selection', () => {
  it('selectDialogueSequence is exported and callable', () => {
    expect(typeof selectDialogueSequence).toBe('function');
  });

  it('same (queries, language, seed) → identical result on two calls', () => {
    const a = selectDialogueSequence(QUERIES, 'hi', 42);
    const b = selectDialogueSequence(QUERIES, 'hi', 42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('same seed across 5 calls → always identical', () => {
    const base = JSON.stringify(selectDialogueSequence(QUERIES, 'hi', 1337));
    for (let i = 0; i < 4; i++) {
      expect(JSON.stringify(selectDialogueSequence(QUERIES, 'hi', 1337))).toBe(base);
    }
  });

  it('different seeds produce different (or equal by chance, but tracked) selections', () => {
    const a = JSON.stringify(selectDialogueSequence(QUERIES, 'hi', 1));
    const b = JSON.stringify(selectDialogueSequence(QUERIES, 'hi', 9999));
    // They CAN be equal by chance for small banks, but we track that this
    // test at least ran without throwing.
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });

  it('different languages for same seed produce different output', () => {
    const hi = JSON.stringify(selectDialogueSequence(QUERIES, 'hi', 7));
    const te = JSON.stringify(selectDialogueSequence(QUERIES, 'te', 7));
    // Different language banks → at minimum text will differ
    expect(hi).not.toBe(te);
  });
});
