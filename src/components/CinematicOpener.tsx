/**
 * CinematicOpener.tsx — REWRITTEN (Rank #4 fix)
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  BUG (before): selectStyle() returned 0 unconditionally.                   │
 * │  All 784 sessions opened identically → "copy-paste factory" signal.         │
 * │                                                                             │
 * │  FIX (after):  FNV-1a hash of topic slug → stable index in [0, 5].         │
 * │  Same topic → same style on every render. Different topics → different.     │
 * │  durationInFrames capped at MAX_OPENER_FRAMES = 90 (3 s @ 30 fps).         │
 * │  Original 20 legacy styles (150 frames / 5 s) are NOT used; all 6 new     │
 * │  styles complete their animation within 90 frames.                          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Style map (hash index → component):
 *   0 — QuestionHook      poses an unresolved question the viewer wants answered
 *   1 — StatBomb          drops a shocking statistic at full-screen scale
 *   2 — ControversyTake   bold counter-intuitive claim + breaking-news framing
 *   3 — BeforeAfter       split-screen wipe: wrong/slow → correct/fast
 *   4 — ProblemTeaser     relatable failure scenario → promise of fix
 *   5 — UrgencyCountdown  3-beat countdown, each beat = key reason to keep watching
 *
 * Retention rationale:
 *   - Nielsen/TikTok data: viewers decide stay/leave in 0–3 seconds.
 *   - Every second of non-learning content before frame 1 increases cognitive
 *     offload (Architecture Expert, expert-debate.md). A 30-second logo animation
 *     is a departure trigger, not a hook.
 *   - Pattern interrupts in the first 90 frames (3s) achieve 40% better retention
 *     vs. text-only hooks (Striver × Kunal Kushwaha lens, expert-findings.md).
 *   - Variety per-topic prevents the "copy-paste factory" signal YouTube's
 *     algorithm uses to classify duplicate content (MKBHD, expert-findings.md).
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { hashSelect, topicSlug } from '../lib/hash-select';
import {
  QuestionHook,
  StatBomb,
  ControversyTake,
  BeforeAfter,
  ProblemTeaser,
  UrgencyCountdown,
  HOOK_STYLE_COUNT,
  HOOK_STYLE_NAMES,
  type HookStyleName,
} from './HookOpeners';

// ── Duration contract ────────────────────────────────────────────────────────
/** Hard maximum: 90 frames = 3.0 s @ 30 fps. NEVER exceed this. */
export const MAX_OPENER_FRAMES = 90;

/** Minimum safe duration (allows all phases to complete). */
export const MIN_OPENER_FRAMES = 60;

// ── Style selection ──────────────────────────────────────────────────────────
/**
 * selectStyle — deterministic, hash-based style picker.
 *
 * Returns the same index every time the same topic is rendered.
 * Uses FNV-1a 32-bit hash (no Math.random, no Date.now, no external state).
 *
 * @param topic   Raw topic string ("Load Balancing", "CAP Theorem", etc.)
 * @returns       Integer in [0, HOOK_STYLE_COUNT)  i.e. [0, 5]
 */
export function selectStyle(topic: string): number {
  return hashSelect(topicSlug(topic), HOOK_STYLE_COUNT);
}

/**
 * getStyleName — human-readable style name for the given topic.
 * Useful for logging / metadata.
 */
export function getStyleName(topic: string): HookStyleName {
  return HOOK_STYLE_NAMES[selectStyle(topic)];
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface CinematicOpenerProps {
  /** Topic display string, e.g. "Load Balancing" */
  topic: string;
  /** Used only for metadata / analytics; does NOT affect style selection */
  sessionNumber: number;
  /** Primary hook text from session content */
  hookText: string;
  /** Spoken narration text (reserved for future audio integration) */
  hookNarration: string;
  /**
   * Requested duration in frames.
   * Will be clamped to [MIN_OPENER_FRAMES, MAX_OPENER_FRAMES].
   * Pass 90 (the default) unless you have a specific override.
   */
  durationInFrames: number;
}

// ── Component ────────────────────────────────────────────────────────────────
export const CinematicOpener: React.FC<CinematicOpenerProps> = ({
  topic,
  sessionNumber: _sessionNumber,
  hookText,
  hookNarration: _hookNarration,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Clamp duration — defence-in-depth so callers can't accidentally pass 150+
  const dur = Math.min(
    Math.max(durationInFrames, MIN_OPENER_FRAMES),
    MAX_OPENER_FRAMES
  );

  // Hash-based style selection: same topic → always same style
  const styleIndex = selectStyle(topic);

  const props = { topic, hookText, frame, fps, dur };

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {styleIndex === 0 && <QuestionHook {...props} />}
      {styleIndex === 1 && <StatBomb {...props} />}
      {styleIndex === 2 && <ControversyTake {...props} />}
      {styleIndex === 3 && <BeforeAfter {...props} />}
      {styleIndex === 4 && <ProblemTeaser {...props} />}
      {styleIndex === 5 && <UrgencyCountdown {...props} />}
    </AbsoluteFill>
  );
};

export default CinematicOpener;
