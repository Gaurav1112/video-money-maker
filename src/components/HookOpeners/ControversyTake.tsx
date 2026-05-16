/**
 * ControversyTake.tsx
 *
 * Style 2 — "Controversy Take"
 * Opens with a bold, possibly counter-intuitive claim rendered like a breaking-news
 * chyron. The cognitive dissonance compels viewers to stay and hear the argument.
 * (Source: expert-debate.md, RANK 4 expert panel; expert-findings.md "MKBHD: controversy
 * thumbnails drive 3-5x more comments and 40% longer watch sessions")
 *
 * Duration: 90 frames @ 30fps = 3.0 s (hard cap)
 * Phase 1 (0–8f):    Red warning flash
 * Phase 2 (9–55f):   "BREAKING" ticker + claim text types in
 * Phase 3 (56–80f):  Counter-point teaser fades in below
 * Phase 4 (81–90f):  Exit fade
 */

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';
import type { HookOpenerProps } from './types';

/** Generate a controversy framing from the hookText */
function extractClaim(hookText: string, topic: string): { claim: string; counter: string } {
  const sentences = hookText.split(/[.!?]/).map((s) => s.trim()).filter(Boolean);
  return {
    claim: sentences[0] || `Most engineers get ${topic} wrong`,
    counter: sentences[1] || `Here's what they're missing...`,
  };
}

export const ControversyTake: React.FC<HookOpenerProps> = ({ frame, fps: _fps, topic, hookText }) => {
  const { claim, counter } = extractClaim(hookText, topic);

  // ── Phase 1: red flash ────────────────────────────────────────────────────────
  const flashOp = interpolate(frame, [0, 3, 8, 12], [1, 1, 0.3, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── BREAKING ticker ──────────────────────────────────────────────────────────
  const tickerOp = interpolate(frame, [9, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Red bar slide-in from left
  const barX = interpolate(frame, [9, 20], [-200, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 4),
  });

  // ── Claim typewriter ─────────────────────────────────────────────────────────
  const charsToShow = Math.floor(
    interpolate(frame, [20, 55], [0, claim.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const claimOp = interpolate(frame, [20, 24, 72, 80], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // cursor blink
  const cursorVisible = frame % 6 < 3 && charsToShow < claim.length;

  // ── Counter teaser ───────────────────────────────────────────────────────────
  const counterY = interpolate(frame, [56, 70], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const counterOp = interpolate(frame, [56, 64, 72, 80], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Exit ─────────────────────────────────────────────────────────────────────
  const exitOp = interpolate(frame, [80, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0C0008',
        justifyContent: 'center',
        alignItems: 'flex-start',
        flexDirection: 'column',
        paddingLeft: 80,
        paddingRight: 80,
        opacity: exitOp,
        overflow: 'hidden',
      }}
    >
      {/* Red flash overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: COLORS.red, opacity: flashOp * 0.85, zIndex: 10 }} />

      {/* Diagonal red accent stripe */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `linear-gradient(135deg, ${COLORS.red}18 0%, transparent 50%)`,
      }} />

      {/* BREAKING badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 28,
        opacity: tickerOp,
        transform: `translateX(${barX}px)`,
      }}>
        <div style={{
          backgroundColor: COLORS.red,
          paddingLeft: 18,
          paddingRight: 18,
          paddingTop: 6,
          paddingBottom: 6,
          fontFamily: FONTS.heading,
          fontSize: 22,
          fontWeight: 900,
          color: '#FFFFFF',
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}>
          UNPOPULAR OPINION
        </div>
        <div style={{
          fontFamily: FONTS.text,
          fontSize: 20,
          color: COLORS.red,
          letterSpacing: 2,
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>
          {topic}
        </div>
      </div>

      {/* Claim typewriter */}
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: 58,
        fontWeight: 900,
        color: '#FFFFFF',
        lineHeight: 1.15,
        opacity: claimOp,
        maxWidth: 1100,
      }}>
        {claim.slice(0, charsToShow)}
        {cursorVisible && (
          <span style={{ color: COLORS.red, marginLeft: 2 }}>|</span>
        )}
      </div>

      {/* Counter teaser */}
      <div style={{
        fontFamily: FONTS.text,
        fontSize: 30,
        color: COLORS.red,
        marginTop: 24,
        opacity: counterOp,
        transform: `translateY(${counterY}px)`,
        fontStyle: 'italic',
      }}>
        {counter}
      </div>
    </AbsoluteFill>
  );
};
