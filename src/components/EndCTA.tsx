/**
 * EndCTA.tsx — End-screen Call-To-Action component
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  DEPRECATED FOR SHORTS / TIKTOK / IG REELS                  ║
 * ║                                                                  ║
 * ║  This component is a LOOP-KILLER for short-form content.         ║
 * ║  A static end-screen stops the auto-loop and acts as a scroll    ║
 * ║  trigger — viewers swipe away because nothing is happening.      ║
 * ║                                                                  ║
 * ║  FOR SHORTS USE:                                                 ║
 * ║    <LoopableShort> from src/components/LoopableShort.tsx         ║
 * ║    + verbal CTA "Sign up at guru-sishya.in" at frame ~780        ║
 * ║                                                                  ║
 * ║  This component is kept for:                                     ║
 * ║    ✅ Long-form YouTube videos (10+ minutes)                     ║
 * ║    ✅ Thumbnail-card end-screens in the YouTube player           ║
 * ║    ✅ Any composition where loop-ability is NOT the goal         ║
 * ║                                                                  ║
 * ║  Evidence: expert-findings.md "Loop-ability 2/10"               ║
 * ║            expert-debate.md   "RANK 7 — Kill the Static EndCTA" ║
 * ║            ViralShort.tsx:464-518 (the source of the problem)    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Migration path:
 *   1. In ViralShort.tsx, add prop:  hideEndCTA?: boolean
 *   2. Conditionally render: {!hideEndCTA && <EndCTA ... />}
 *   3. Wrap ViralShort in <LoopableShort> with hideEndCTA={true}
 *   4. See INTEGRATION.md for full wiring steps
 */

import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EndCTAProps {
  /**
   * Primary CTA line.
   * Long-form example: "Follow @guru_sishya.in for more"
   * NOT used in Shorts — use LoopableShort + verbal CTA instead.
   */
  ctaText?: string;
  /**
   * Secondary URL / handle line.
   * Long-form example: "guru-sishya.in"
   */
  urlText?: string;
  /** Background colour — should match the composition's colour palette. */
  bgColor?: string;
  /** Accent colour for the primary CTA text. */
  accentColor?: string;
  /**
   * @deprecated Use LoopableShort for Shorts/TikTok/IG Reels.
   * This flag is here to make the deprecation visible at the call-site.
   * Setting shortsMode={true} throws in development to force migration.
   */
  shortsMode?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * EndCTA — static end-screen for LONG-FORM content only.
 *
 * @deprecated For Shorts/TikTok/Reels use LoopableShort (src/components/LoopableShort.tsx).
 */
export const EndCTA: React.FC<EndCTAProps> = ({
  ctaText = 'Follow @guru_sishya.in',
  urlText = 'guru-sishya.in',
  bgColor = '#0A0A0A',
  accentColor = '#F5A623',
  shortsMode = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Hard-fail in development if someone wires EndCTA into a Shorts composition.
  if (shortsMode && process.env.NODE_ENV !== 'production') {
    throw new Error(
      '[EndCTA] shortsMode={true} is explicitly forbidden. ' +
      'Use <LoopableShort> + verbal CTA "Sign up at guru-sishya.in" instead. ' +
      'See src/components/LoopableShort.tsx and INTEGRATION.md.',
    );
  }

  // Fade + scale spring — same as the original ViralShort.tsx:464-518 behaviour.
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scale = spring({
    frame,
    fps,
    from: 0.92,
    to: 1.0,
    durationInFrames: 20,
    config: { damping: 14, stiffness: 160 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        opacity,
      }}
    >
      <span
        style={{
          fontFamily: '"Space Grotesk", "Inter", sans-serif',
          fontWeight: 800,
          fontSize: 52,
          color: accentColor,
          textAlign: 'center',
          letterSpacing: '-1px',
          transform: `scale(${scale.toFixed(4)})`,
          transformOrigin: 'center center',
          textShadow: `0 0 32px ${accentColor}66`,
          padding: '0 48px',
        }}
      >
        {ctaText}
      </span>
      <span
        style={{
          fontFamily: '"Space Grotesk", "Inter", sans-serif',
          fontWeight: 500,
          fontSize: 32,
          color: 'rgba(245,243,239,0.7)',
          textAlign: 'center',
          letterSpacing: '0.5px',
        }}
      >
        {urlText}
      </span>
    </AbsoluteFill>
  );
};

export default EndCTA;
