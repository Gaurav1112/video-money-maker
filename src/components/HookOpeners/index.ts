/**
 * index.ts — barrel export for HookOpeners
 */
export { QuestionHook } from './QuestionHook';
export { StatBomb } from './StatBomb';
export { ControversyTake } from './ControversyTake';
export { BeforeAfter } from './BeforeAfter';
export { ProblemTeaser } from './ProblemTeaser';
export { UrgencyCountdown } from './UrgencyCountdown';
export type { HookOpenerProps } from './types';

/** Ordered list used by CinematicOpener to map hash index → component */
export const HOOK_STYLE_NAMES = [
  'questionHook',
  'statBomb',
  'controversyTake',
  'beforeAfter',
  'problemTeaser',
  'urgencyCountdown',
] as const;

export type HookStyleName = typeof HOOK_STYLE_NAMES[number];
export const HOOK_STYLE_COUNT = HOOK_STYLE_NAMES.length; // 6
