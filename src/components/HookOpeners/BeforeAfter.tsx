/**
 * BeforeAfter.tsx
 *
 * Style 3 — "Before / After"
 * Split-screen: LEFT = red/wrong state (naive code, slow system), RIGHT = green/fixed state.
 * A vertical wipe reveals the after-state at frame 50. The contrast is visceral.
 * (Source: expert-debate.md "ComparisonSlide — Left=wrong/red, Right=right/green, wipe at midpoint")
 *
 * Duration: 90 frames @ 30fps = 3.0 s (hard cap)
 * Phase 1 (0–12f):   Fade in split
 * Phase 2 (13–50f):  Before panel visible, "BEFORE" label animates in
 * Phase 3 (51–80f):  Wipe reveals AFTER panel, "AFTER" label animates in
 * Phase 4 (81–90f):  Exit fade
 */

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';
import type { HookOpenerProps } from './types';

function extractBeforeAfter(hookText: string, topic: string): { before: string; after: string } {
  const parts = hookText.split(/\bvs\.?\b|\bbut\b|\bthen\b/i);
  return {
    before: parts[0]?.trim() || `O(n²) ${topic}`,
    after: parts[1]?.trim() || `O(1) ${topic}`,
  };
}

export const BeforeAfter: React.FC<HookOpenerProps> = ({ frame, fps: _fps, topic, hookText }) => {
  const { before, after } = extractBeforeAfter(hookText, topic);

  // ── Global fade-in ────────────────────────────────────────────────────────────
  const bgOp = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── BEFORE label ──────────────────────────────────────────────────────────────
  const beforeLabelY = interpolate(frame, [13, 25], [-40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const beforeLabelOp = interpolate(frame, [13, 22, 55, 62], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Wipe reveal ──────────────────────────────────────────────────────────────
  // wipe from 0% width at frame 50 to 50% at frame 72
  const wipeWidth = interpolate(frame, [50, 72], [0, 50], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  // ── AFTER label ──────────────────────────────────────────────────────────────
  const afterLabelY = interpolate(frame, [56, 70], [-40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const afterLabelOp = interpolate(frame, [56, 66, 72, 80], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Exit ─────────────────────────────────────────────────────────────────────
  const exitOp = interpolate(frame, [80, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: bgOp * exitOp, overflow: 'hidden' }}>
      {/* BEFORE panel — left half */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '50%',
        height: '100%',
        backgroundColor: '#1A0005',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: 40,
        paddingRight: 20,
      }}>
        {/* BEFORE badge */}
        <div style={{
          backgroundColor: COLORS.red,
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 8,
          paddingBottom: 8,
          fontFamily: FONTS.heading,
          fontSize: 22,
          fontWeight: 900,
          color: '#FFFFFF',
          letterSpacing: 3,
          textTransform: 'uppercase',
          marginBottom: 24,
          opacity: beforeLabelOp,
          transform: `translateY(${beforeLabelY}px)`,
        }}>
          ✗ BEFORE
        </div>

        <div style={{
          fontFamily: FONTS.heading,
          fontSize: 42,
          fontWeight: 800,
          color: '#FF6B6B',
          textAlign: 'center',
          lineHeight: 1.2,
          opacity: beforeLabelOp,
        }}>
          {before}
        </div>

        {/* Subtle X mark */}
        <div style={{
          fontSize: 80,
          color: COLORS.red,
          opacity: beforeLabelOp * 0.3,
          marginTop: 20,
          lineHeight: 1,
        }}>✕</div>
      </div>

      {/* AFTER panel — right half, revealed by wipe */}
      <div style={{
        position: 'absolute',
        right: 0,
        top: 0,
        width: `${wipeWidth}%`,
        height: '100%',
        backgroundColor: '#00150A',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {/* Inner container keeps text centered regardless of clip width */}
        <div style={{
          width: `${(50 / Math.max(wipeWidth, 0.1)) * 100}%`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          paddingLeft: 20,
          paddingRight: 40,
        }}>
          <div style={{
            backgroundColor: COLORS.teal,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 8,
            paddingBottom: 8,
            fontFamily: FONTS.heading,
            fontSize: 22,
            fontWeight: 900,
            color: '#FFFFFF',
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 24,
            opacity: afterLabelOp,
            transform: `translateY(${afterLabelY}px)`,
          }}>
            ✓ AFTER
          </div>

          <div style={{
            fontFamily: FONTS.heading,
            fontSize: 42,
            fontWeight: 800,
            color: '#6BFFB8',
            textAlign: 'center',
            lineHeight: 1.2,
            opacity: afterLabelOp,
          }}>
            {after}
          </div>

          <div style={{
            fontSize: 80,
            color: COLORS.teal,
            opacity: afterLabelOp * 0.3,
            marginTop: 20,
            lineHeight: 1,
          }}>✓</div>
        </div>
      </div>

      {/* Vertical divider */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: 0,
        width: 4,
        height: '100%',
        backgroundColor: '#FFFFFF',
        opacity: 0.15,
        transform: 'translateX(-50%)',
      }} />

      {/* Topic chip — top center */}
      <div style={{
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: FONTS.heading,
        fontSize: 22,
        fontWeight: 700,
        color: '#FFFFFF',
        opacity: bgOp * 0.7,
        textTransform: 'uppercase',
        letterSpacing: 3,
      }}>
        {topic}
      </div>
    </AbsoluteFill>
  );
};
