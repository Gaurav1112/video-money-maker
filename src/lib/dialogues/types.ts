/**
 * Dialogue System Types
 * Cross-language cartoon dialogue management for 7 Indian languages.
 */

export type DialogueLanguage = 'hindi' | 'english' | 'telugu' | 'tamil' | 'kannada' | 'marathi' | 'bengali';

export type DialogueEmotion =
  | 'greeting'
  | 'surprise'
  | 'anger'
  | 'fear'
  | 'happiness'
  | 'sadness'
  | 'thinking'
  | 'narration'
  | 'moral'
  | 'catchphrase'
  | 'filler'
  | 'encouragement'
  | 'challenge'
  | 'boast'
  | 'apology'
  | 'gratitude'
  | 'confusion'
  | 'determination'
  | 'celebration'
  | 'warning';

export type DialogueIntensity = 'low' | 'medium' | 'high';

export type DialogueGender = 'male' | 'female' | 'any';

export type CharacterArchetype =
  | 'hero'
  | 'villain'
  | 'mentor'
  | 'comic'
  | 'child'
  | 'narrator'
  | 'sidekick'
  | 'elder'
  | 'mother'
  | 'father'
  | 'friend'
  | 'rival'
  | 'any';

export interface DialogueLine {
  /** The actual dialogue text with optional {variables} */
  text: string;
  /** Primary emotion/category */
  emotion: DialogueEmotion;
  /** Emotional intensity */
  intensity: DialogueIntensity;
  /** Gender suitability */
  gender: DialogueGender;
  /** Character archetype suitability */
  archetype: CharacterArchetype;
  /** Usage context description */
  context: string;
  /** Template variables that can be injected */
  variables: string[];
}

export interface DialogueBank {
  language: DialogueLanguage;
  /** ISO language code for TTS */
  isoCode: string;
  /** Display name */
  displayName: string;
  /** All dialogue lines for this language */
  lines: DialogueLine[];
}

export interface DialogueQuery {
  language: DialogueLanguage;
  emotion: DialogueEmotion;
  intensity?: DialogueIntensity;
  gender?: DialogueGender;
  archetype?: CharacterArchetype;
  /** Deterministic seed: episode + scene + character index */
  seed: number;
  /** Optional variable substitutions */
  variables?: Record<string, string>;
}

export interface DialogueResult {
  line: DialogueLine;
  /** Final text with variables substituted */
  renderedText: string;
}
