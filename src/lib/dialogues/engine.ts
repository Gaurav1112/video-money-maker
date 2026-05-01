/**
 * Expert 7: Dr. Cartoon Dialogue Architect — Cross-Language Dialogue Engine
 *
 * Deterministic, seeded dialogue selection across 7 Indian languages.
 * Same episode + scene + character index = same dialogue every time.
 *
 * Selection algorithm:
 *   1. Filter by language, emotion, and optional intensity/gender/archetype
 *   2. Hash (episode * 10000 + scene * 100 + charIndex) with a simple PRNG
 *   3. Use hash modulo filtered-count to pick the line
 *   4. Substitute {variables} from query
 *
 * This guarantees deterministic, reproducible output (no Math.random).
 */

import {
  DialogueBank,
  DialogueEmotion,
  DialogueIntensity,
  DialogueGender,
  CharacterArchetype,
  DialogueLanguage,
  DialogueLine,
  DialogueQuery,
  DialogueResult,
} from './types';

import { hindiBank } from './hindi';
import { teluguBank } from './telugu';
import { tamilBank } from './tamil';
import { kannadaBank } from './kannada';
import { marathiBank } from './marathi';
import { bengaliBank } from './bengali';

// ============================================================
// Registry
// ============================================================

const banks: Record<DialogueLanguage, DialogueBank> = {
  hindi: hindiBank,
  english: hindiBank, // fallback to Hindi for English — replace with English bank when ready
  telugu: teluguBank,
  tamil: tamilBank,
  kannada: kannadaBank,
  marathi: marathiBank,
  bengali: bengaliBank,
};

// ============================================================
// Deterministic hash (mulberry32-derived, seeded PRNG)
// ============================================================

function deterministicHash(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0);
}

/**
 * Build a composite seed from episode/scene/character indices.
 * Ensures different scenes in same episode pick different lines.
 */
function buildSeed(episode: number, scene: number, charIndex: number = 0): number {
  return episode * 100_000 + scene * 1_000 + charIndex;
}

// ============================================================
// Filter
// ============================================================

function filterLines(
  lines: DialogueLine[],
  emotion: DialogueEmotion,
  intensity?: DialogueIntensity,
  gender?: DialogueGender,
  archetype?: CharacterArchetype,
): DialogueLine[] {
  return lines.filter((l) => {
    if (l.emotion !== emotion) return false;
    if (intensity && l.intensity !== intensity) return false;
    if (gender && gender !== 'any' && l.gender !== 'any' && l.gender !== gender) return false;
    if (archetype && archetype !== 'any' && l.archetype !== 'any' && l.archetype !== archetype) return false;
    return true;
  });
}

// ============================================================
// Variable substitution
// ============================================================

function substituteVariables(text: string, variables?: Record<string, string>): string {
  if (!variables) return text;
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    // Handle both {name} and name formats
    const bracketKey = key.startsWith('{') ? key : `{${key}}`;
    result = result.replace(new RegExp(bracketKey.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  return result;
}

// ============================================================
// Public API
// ============================================================

/**
 * Select a single dialogue line deterministically.
 *
 * @param query - Language, emotion, optional filters, seed, and variable substitutions.
 * @returns The selected line with rendered text, or null if no match.
 */
export function selectDialogue(query: DialogueQuery): DialogueResult | null {
  const bank = banks[query.language];
  if (!bank) return null;

  const filtered = filterLines(
    bank.lines,
    query.emotion,
    query.intensity,
    query.gender,
    query.archetype,
  );

  if (filtered.length === 0) {
    // Fallback: relax filters (drop archetype, then intensity, then gender)
    const relaxed = filterLines(bank.lines, query.emotion);
    if (relaxed.length === 0) return null;
    const hash = deterministicHash(query.seed);
    const idx = hash % relaxed.length;
    const line = relaxed[idx];
    return {
      line,
      renderedText: substituteVariables(line.text, query.variables),
    };
  }

  const hash = deterministicHash(query.seed);
  const idx = hash % filtered.length;
  const line = filtered[idx];

  return {
    line,
    renderedText: substituteVariables(line.text, query.variables),
  };
}

/**
 * Select N distinct dialogue lines for a batch (e.g., multiple characters in a scene).
 */
export function selectDialogueBatch(
  baseQuery: Omit<DialogueQuery, 'seed'>,
  count: number,
  baseSeed: number,
): DialogueResult[] {
  const results: DialogueResult[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < count; i++) {
    const seed = baseSeed + i * 7; // offset to avoid collisions
    const result = selectDialogue({ ...baseQuery, seed });
    if (result && !usedIndices.has(result.line.text.length)) {
      results.push(result);
      usedIndices.add(result.line.text.length);
    } else if (result) {
      results.push(result);
    }
  }

  return results;
}

/**
 * Get all available emotions for a language.
 */
export function getAvailableEmotions(language: DialogueLanguage): DialogueEmotion[] {
  const bank = banks[language];
  if (!bank) return [];
  const emotions = new Set<DialogueEmotion>();
  for (const line of bank.lines) {
    emotions.add(line.emotion);
  }
  return Array.from(emotions);
}

/**
 * Get dialogue count per emotion for a language.
 */
export function getDialogueStats(language: DialogueLanguage): Record<string, number> {
  const bank = banks[language];
  if (!bank) return {};
  const stats: Record<string, number> = { total: bank.lines.length };
  for (const line of bank.lines) {
    stats[line.emotion] = (stats[line.emotion] || 0) + 1;
  }
  return stats;
}

/**
 * Get all supported languages.
 */
export function getSupportedLanguages(): DialogueLanguage[] {
  return Object.keys(banks) as DialogueLanguage[];
}

/**
 * Get the dialogue bank for a language (for advanced usage).
 */
export function getBank(language: DialogueLanguage): DialogueBank | null {
  return banks[language] || null;
}

/**
 * Convenience: select dialogue for a cartoon scene.
 *
 * @param language - Target language
 * @param emotion - Scene emotion
 * @param episode - Episode number (for determinism)
 * @param scene - Scene index (for determinism)
 * @param characterName - Optional character name for {name} substitution
 * @param archetype - Optional character archetype filter
 */
export function getCartoonDialogue(
  language: DialogueLanguage,
  emotion: DialogueEmotion,
  episode: number,
  scene: number,
  characterName?: string,
  archetype?: CharacterArchetype,
): string {
  const seed = buildSeed(episode, scene);
  const variables: Record<string, string> = {};
  if (characterName) variables['{name}'] = characterName;

  const result = selectDialogue({
    language,
    emotion,
    seed,
    archetype,
    variables,
  });

  return result?.renderedText ?? '';
}

// Re-export types
export type {
  DialogueLanguage,
  DialogueEmotion,
  DialogueIntensity,
  DialogueGender,
  CharacterArchetype,
  DialogueLine,
  DialogueBank,
  DialogueQuery,
  DialogueResult,
} from './types';
