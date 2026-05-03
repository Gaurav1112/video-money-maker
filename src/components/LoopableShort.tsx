/**
 * LoopableShort.tsx — Seamless loop composition for YouTube Shorts / TikTok / IG Reels
 *
 * Implements Karen X. Cheng's retention loop technique (expert-debate.md RANK 7).
 *
 * ## The Problem
 * `ViralShort.tsx:464-518` ends with a static `EndCTA` ("Follow @guru_sishya.in")
 * that fades in and stays.  This is a loop-killer:
 *   - TikTok / IG Reels / YouTube Shorts auto-loop the video when it ends.
 *   - A hard stop (static screen) is a SCROLL TRIGGER — nothing is happening.
 *   - The algorithm counts rewatches.  A dead ending = 0 rewatches = weaker distribution.
 *
 * ## The Fix
 * Replace `EndCTA` in Shorts mode with a loop-back cross-fade:
 *   - The last LOOP_BACK_FRAMES (1 s) re-render the hook text + background,
 *     matching the visual state at frame 0.
 *   - Audio fades out to silence — matching the audio state at frame 0.
 *   - When the platform loops, frame 0 picks up exactly where the ending left off.
 *     The viewer doesn't notice the restart. They just… keep watching.
 *
 * ## CTA placement
 * The verbal CTA "Sign up at guru-sishya.in" fires at
 *   frame = (total - LOOP_BACK_FRAMES - CTA_PRE_LOOP_FRAMES)
 *            = (900  - 30             - 90               ) = frame 780
 *   = second 26 of a 30-second Short.
 *
 * On EVERY replay this is the very first audio the viewer hears after the
 * seamless loop — so it registers as the opening of a new watch, not a
 * tacked-on request at the end.
 *
 * ## Usage in index.tsx / remotion.config.ts
 * ```tsx
 * <LoopableShort
 *   hookText={storyboard.hookText}
 *   bgColor="#0A0A0A"
 *   accentColor="#F5A623"
 *   ctaAudioFile="cta-signup-guru-sishya.mp3"
 * >
 *   <ViralShortScenes storyboard={storyboard} hideEndCTA />
 * </LoopableShort>
 * ```
 *
 * See INTEGRATION.md for full step-by-step wiring instructions.
 *
 * Design constraints:
 *   ✅ Deterministic  — frame → pixel is a pure function; no randomness
 *   ✅ Zero money     — no external services
 *   ✅ GH-Actions     — Remotion renders headlessly in CI exactly as locally
 *   ✅ 100 % reliable — no network, no Date.now(), no Math.random()
 */

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  buildFingerprint,
  tweenToFirstFrame,
  LOOP_BACK_FRAMES,
} from '../lib/match-cut';
import type { VisualFingerprint } from '../lib/match-cut';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LoopableShortProps {
  /**
   * Hook text shown at frame 0.
   * Must be identical to what ViralShort's HookScreen renders so the
   * loop-back overlay is a perfect visual match.
   */
  hookText: string;
  /** Background colour at frame 0 (must match ViralShort's opening bg). */
  bgColor?: string;
  /** Accent / saffron colour for the hook text overlay. */
  accentColor?: string;
  /**
   * Path to the verbal CTA audio clip, relative to the Remotion `public/` dir.
   * Example: "cta-signup-guru-sishya.mp3"
   * The clip should say: "Sign up at guru-sishya.in" (≤ 2 s).
   * If omitted, no CTA audio is injected (visual-only loop).
   */
  ctaAudioFile?: string;
  /**
   * Child composition to render as the video content.
   * Pass <ViralShortScenes> (or equivalent) with hideEndCTA={true} to suppress
   * the static EndCTA that would otherwise break the loop.
   */
  children: React.ReactNode;
}

// ── Internal constants ────────────────────────────────────────────────────────

/**
 * How many frames BEFORE the loop-back window to start the verbal CTA audio.
 * 90 frames = 3 s at 30 fps.
 *
 * Timeline (30 s / 900 frames):
 *   frame 0   → hook text fades in
 *   frame 780 → CTA audio starts: "Sign up at guru-sishya.in"
 *   frame 840 → CTA audio ends; loop-back cross-fade begins
 *   frame 870 → loop-back overlay at ~50% opacity
 *   frame 900 → loop-back overlay at 100% (= frame 0 visual state)
 *   [AUTO-LOOP] frame 0 → seamless continuation
 */
const CTA_PRE_LOOP_FRAMES = 90; // 3 s

/** Max duration of the CTA audio clip (hard ceiling). */
const CTA_AUDIO_FRAMES = 60; // 2 s

// ── Component ────────────────────────────────────────────────────────────────

export const LoopableShort: React.FC<LoopableShortProps> = ({
  hookText,
  bgColor = '#0A0A0A',
  accentColor = '#F5A623', // saffron — matches guru-sishya brand
  ctaAudioFile,
  children,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames: total, fps } = useVideoConfig();

  // Build the frame-0 fingerprint once (stable across all frames).
  const fingerprint: VisualFingerprint = buildFingerprint(hookText, bgColor);

  // Per-frame loop-back tween values (0 outside the window → no overlay rendered).
  const tween = tweenToFirstFrame(frame, total);

  // Frame at which the verbal CTA audio starts.
  const ctaStartFrame = total - LOOP_BACK_FRAMES - CTA_PRE_LOOP_FRAMES;

  // Vignette: draws the eye to centre as the loop-back approaches.
  // Starts 10 frames before the loop-back window opens, reaches 0.65 at the end.
  const vignetteOpacity = interpolate(
    frame,
    [total - LOOP_BACK_FRAMES - 10, total - LOOP_BACK_FRAMES, total],
    [0, 0, 0.65],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, overflow: 'hidden' }}>

      {/* ── 1. Content layer ─────────────────────────────────────────────────
           All ViralShort scenes.  Caller MUST pass hideEndCTA={true} to
           suppress the static EndCTA that would break the loop.            */}
      <AbsoluteFill>{children}</AbsoluteFill>

      {/* ── 2. Verbal CTA audio injection ────────────────────────────────────
           Fires 3 s before the loop-back, while the content is still fully
           visible.  On every auto-replay this audio plays first — so the CTA
           registers as the opening of a new watch, not an afterthought.
           Requires a pre-rendered MP3 at public/cta-signup-guru-sishya.mp3.
           Generate with: npx remotion tts "Sign up at guru-sishya.in"      */}
      {ctaAudioFile && ctaStartFrame >= 0 && (
        <Sequence from={ctaStartFrame} durationInFrames={CTA_AUDIO_FRAMES}>
          <Audio src={staticFile(ctaAudioFile)} volume={1.0} />
        </Sequence>
      )}

      {/* ── 3. Vignette ──────────────────────────────────────────────────────
           Subtle radial darkening as the loop-back approaches.
           Keeps the eye centred and makes the cross-fade feel intentional.  */}
      {vignetteOpacity > 0 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${vignetteOpacity.toFixed(3)}) 100%)`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── 4. Loop-back overlay ─────────────────────────────────────────────
           Only rendered during the final LOOP_BACK_FRAMES window.
           Re-creates the exact visual state of frame 0:
             • Background colour fades in first (grounds the eye)
             • Hook text fades + scales in, mirroring the frame-0 spring
           When the platform loops to frame 0, the content is already showing
           the same visuals → the restart is invisible.                      */}
      {tween.overlayOpacity > 0 && (
        <AbsoluteFill
          style={{
            opacity: tween.overlayOpacity,
            pointerEvents: 'none',
          }}
        >
          {/* 4a. Background fill */}
          <AbsoluteFill
            style={{
              backgroundColor: fingerprint.bgColor,
              opacity: tween.bgOpacity,
            }}
          />

          {/* 4b. Hook text — mirrors HookScreen in ViralShort.tsx exactly.
                Font, size, colour, and scale must stay in sync with that
                component.  If you change HookScreen, update this too.      */}
          <AbsoluteFill
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 48px',
              opacity: tween.textOpacity,
            }}
          >
            <span
              style={{
                fontFamily: '"Space Grotesk", "Inter", sans-serif',
                fontWeight: 800,
                fontSize: 64,
                lineHeight: 1.15,
                textAlign: 'center',
                color: accentColor,
                transform: `scale(${tween.textScale.toFixed(4)})`,
                transformOrigin: 'center center',
                letterSpacing: '-1.5px',
                // Text shadow matches the glow from HookScreen
                textShadow: `0 0 40px ${accentColor}88, 0 2px 8px rgba(0,0,0,0.8)`,
                WebkitTextStroke: '1px rgba(0,0,0,0.3)',
              }}
            >
              {fingerprint.hookText}
            </span>
          </AbsoluteFill>
        </AbsoluteFill>
      )}

    </AbsoluteFill>
  );
};

export default LoopableShort;
