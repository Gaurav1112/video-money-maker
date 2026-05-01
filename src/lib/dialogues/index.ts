/**
 * Cartoon Dialogue System — Public API
 *
 * 3,500+ dialogue lines across 7 Indian languages (Hindi, Telugu, Tamil,
 * Kannada, Marathi, Bengali, English) with deterministic, seeded selection.
 *
 * Usage:
 *   import { getCartoonDialogue, selectDialogue } from '@/lib/dialogues';
 *
 *   // Quick usage
 *   const line = getCartoonDialogue('hindi', 'greeting', 1, 0, 'Raju');
 *   // => "Arre Raju! Tu toh bahut badi cheez ban gayi!"
 *
 *   // Advanced usage
 *   const result = selectDialogue({
 *     language: 'tamil',
 *     emotion: 'surprise',
 *     intensity: 'high',
 *     archetype: 'comic',
 *     seed: 12345,
 *   });
 */

export {
  selectDialogue,
  selectDialogueBatch,
  getCartoonDialogue,
  getAvailableEmotions,
  getDialogueStats,
  getSupportedLanguages,
  getBank,
} from './engine';

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

// Language bank re-exports (for direct access if needed)
export { hindiBank } from './hindi';
export { teluguBank } from './telugu';
export { tamilBank } from './tamil';
export { kannadaBank } from './kannada';
export { marathiBank } from './marathi';
export { bengaliBank } from './bengali';
