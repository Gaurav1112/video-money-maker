/**
 * match-cut.ts — First-frame fingerprint extraction and loop-back tween utility
 *
 * A "match cut" in film is when the last frame of one shot visually matches
 * the first frame of the next — the eye reads it as continuous even though
 * the context changed.  Applied to Shorts/TikTok/Reels auto-loops: if
 * frame (total-1) matches frame 0 the platform's loop is invisible to the
 * viewer → AVD climbs past 100% → rewatch signal fires.
 *
 * This module:
 *   1. Encodes the frame-0 visual state as a deterministic VisualFingerprint.
 *   2. Provides tweenToFirstFrame() — per-frame values that cross-fade the
 *      composition back to frame-0 state during the final LOOP_BACK_FRAMES.
 *   3. Provides audioFingerprintAtFrame() — the expected audio envelope at any
 *      frame, used by tests to assert that frame-0 ≈ frame-(total-1) within ε.
 *
 * Design constraints:
 *   ✅ Deterministic  — same inputs → same output on every machine / CI run
 *   ✅ Zero money     — no external APIs, no network calls
 *   ✅ GH-Actions     — pure TypeScript, no native binaries
 *   ✅ 100 % reliable — no randomness, no Date.now(), no Math.random()
 */

import { interpolate } from 'remotion';

// ── Constants ────────────────────────────────────────────────────────────────

/** Frames at the END that mirror the opening — the loop-back window.
 *  30 frames = 1.0 s at 30 fps.  Must equal or exceed HOOK_INTRO_FRAMES so
 *  the last frame and the first frame are at the same point in the
 *  intro-animation easing curve (both at their steady-state opacity = 1). */
export const LOOP_BACK_FRAMES = 30;

/** Frames at the START that define the "first-frame" fingerprint.
 *  Matches HOOK_FRAMES in ViralShort.tsx — keep in sync if that constant changes. */
export const HOOK_INTRO_FRAMES = 30;

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * VisualFingerprint — the canonical frame-0 visual descriptor.
 * Built once per render from composition props; passed to tweenToFirstFrame().
 */
export interface VisualFingerprint {
  /** Hook text rendered at frame 0 */
  hookText: string;
  /** Background colour at frame 0 (CSS hex / rgb string) */
  bgColor: string;
  /** Opacity of the hook overlay at steady-state (after intro spring) */
  steadyOpacity: number;
  /** Scale of the hook text at steady-state */
  steadyScale: number;
  /** Horizontal offset from centre in px (0 = centred) */
  translateX: number;
  /** Vertical offset from centre in px (0 = centred) */
  translateY: number;
}

/**
 * LoopTweenValues — per-frame values to drive the loop-back overlay.
 * All values are in [0, 1] and are 0 outside the loop-back window.
 */
export interface LoopTweenValues {
  /** Opacity of the entire loop-back overlay layer */
  overlayOpacity: number;
  /** Scale of the hook text inside the overlay (mirrors frame-0 spring) */
  textScale: number;
  /** Opacity of the hook text itself within the overlay */
  textOpacity: number;
  /** Opacity of the background fill inside the overlay */
  bgOpacity: number;
}

/**
 * AudioFingerprint — lightweight descriptor of the audio envelope at a frame.
 * Used in tests to assert that frame-0 ≈ frame-(total-1) within ε.
 */
export interface AudioFingerprint {
  /** Normalised volume level 0–1 (0 = silence, 1 = full) */
  rmsNorm: number;
  /** Stereo pan: -1 (full left) → 0 (centre) → +1 (full right) */
  pan: number;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * buildFingerprint — encode the frame-0 visual state from composition props.
 *
 * Call this ONCE at render-time (outside the per-frame render function) and
 * pass the result into tweenToFirstFrame() on every frame.
 *
 * @param hookText  The hook text string shown at frame 0
 * @param bgColor   CSS background colour at frame 0 (default: near-black)
 */
export function buildFingerprint(
  hookText: string,
  bgColor: string = '#0A0A0A',
): VisualFingerprint {
  return {
    hookText,
    bgColor,
    steadyOpacity: 1,
    steadyScale: 1.0,
    translateX: 0,
    translateY: 0,
  };
}

/**
 * tweenToFirstFrame — compute loop-back overlay values for a given frame.
 *
 * During the final LOOP_BACK_FRAMES window the overlay fades in, recreating
 * the same visual state as frame 0 so the auto-loop is seamless.
 * Outside that window all returned values are 0 (overlay invisible, no cost).
 *
 * Easing: ease-in-cubic — slow start that accelerates into the loop-back,
 * matching the feel of "the video is about to start again".
 *
 * @param frame  Current Remotion frame (from useCurrentFrame())
 * @param total  durationInFrames of the composition
 */
export function tweenToFirstFrame(
  frame: number,
  total: number,
): LoopTweenValues {
  const loopStart = total - LOOP_BACK_FRAMES;

  // Outside the loop-back window — zero cost, no overlay rendered.
  if (frame < loopStart) {
    return { overlayOpacity: 0, textScale: 0.9, textOpacity: 0, bgOpacity: 0 };
  }

  // Linear progress 0 → 1 within the loop-back window.
  const progress = interpolate(frame, [loopStart, total], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ease-in-cubic: progress^3 — ramps up gently so the cross-fade isn't jarring.
  const eased = progress * progress * progress;

  // Background arrives slightly ahead of the text (grounds the eye first).
  const bgOpacity = interpolate(progress, [0, 0.45, 1], [0, 0.80, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Text scale mirrors the frame-0 spring: starts at 0.9, lands at 1.0.
  const textScale = interpolate(eased, [0, 1], [0.9, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Text opacity lags the background by ~40% of the window.
  const textOpacity = interpolate(progress, [0, 0.35, 1], [0, 0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return {
    overlayOpacity: eased,
    textScale,
    textOpacity,
    bgOpacity,
  };
}

/**
 * audioFingerprintAtFrame — expected audio envelope state at a given frame.
 *
 * Frame 0 and frame (total-1) must both evaluate to ≈ { rmsNorm: 0, pan: 0 }
 * because both sit at a fade boundary:
 *   • Frame 0: audio is fading IN from silence (intro)
 *   • Frame (total-1): audio is fading OUT to silence (loop-back)
 *
 * The tests assert |rmsNorm[0] - rmsNorm[total-1]| < ε.
 *
 * @param frame  Current frame
 * @param total  durationInFrames
 */
export function audioFingerprintAtFrame(
  frame: number,
  total: number,
): AudioFingerprint {
  // Intro fade-in: 0 → 1 over the first 8 frames.
  const introRms = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Outro fade-out: 1 → 0 over the last LOOP_BACK_FRAMES.
  const outroRms = interpolate(frame, [total - LOOP_BACK_FRAMES, total], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Both envelopes apply independently; take the minimum (whichever is more restrictive).
  const rmsNorm = Math.min(introRms, outroRms);

  // Always centred — no stereo panning in this composition.
  return { rmsNorm, pan: 0 };
}
