/**
 * StatBomb.tsx
 *
 * Style 1 — "Stat Bomb"
 * Drops a shocking statistic at full-screen scale. Zero-to-hero number animation
 * followed by context text. MrBeast's data shows single-number hooks average
 * 2× thumbnail CTR vs. abstract titles. (Source: expert-findings.md, MrBeast lens)
 *
 * Duration: 90 frames @ 30fps = 3.0 s (hard cap)
 * Phase 1 (0–10f):   Black fade-in
 * Phase 2 (11–55f):  Giant stat number counts up, colour flash at peak
 * Phase 3 (56–80f):  Context label fades + slides in from below
 * Phase 4 (81–90f):  Exit fade to black
 */

import React from 'react';
import { AbsoluteFill, interpolate, spring } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';
import type { HookOpenerProps } from './types';

/** Pull the first number-like token from hookText, e.g. "99.99% uptime" → 9999 */
function extractStat(hookText: string): { display: string; suffix: string; label: string } {
  const match = hookText.match(/(\d[\d,.]*)(%|\sx|\sms|\ss|\+)?/);
  if (match) {
    const raw = match[1].replace(/,/g, '');
    const num = parseFloat(raw);
    const suffix = match[2]?.trim() ?? '';
    const label = hookText.replace(match[0], '').replace(/^[^a-zA-Z]+/, '').slice(0, 60);
    return { display: isNaN(num) ? raw : raw, suffix, label: label || hookText.slice(0, 60) };
  }
  return { display: '99.9', suffix: '%', label: hookText.slice(0, 60) };
}

export const StatBomb: React.FC<HookOpenerProps> = ({ frame, fps, topic, hookText }) => {
  const stat = extractStat(hookText);

  // ── fade in ──────────────────────────────────────────────────────────────────
  const bgOp = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ── number scale-in ──────────────────────────────────────────────────────────
  const numScale = spring({ frame: Math.max(0, frame - 10), fps, from: 4, to: 1, durationInFrames: 24, config: { damping: 12, stiffness: 120 } });
  const numOp = interpolate(frame, [10, 16, 72, 80], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Count-up animation: map frame [10→50] to [0→final number] for display
  const rawNum = parseFloat(stat.display.replace(/,/g, ''));
  const isNumeric = !isNaN(rawNum);
  const countedNum = isNumeric
    ? Math.round(interpolate(frame, [10, 50], [0, rawNum], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
    : stat.display;
  const displayStr = isNumeric ? countedNum.toLocaleString() : stat.display;

  // Color flash at peak of number
  const flashBright = interpolate(frame, [48, 50, 55], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── context label ─────────────────────────────────────────────────────────────
  const labelY = interpolate(frame, [56, 70], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const labelOp = interpolate(frame, [56, 66, 72, 80], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── exit ─────────────────────────────────────────────────────────────────────
  const exitOp = interpolate(frame, [80, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const accentColor = `hsl(${(interpolate(frame, [10, 50], [200, 30], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))}, 90%, 60%)`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#07060F',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        opacity: bgOp * exitOp,
        overflow: 'hidden',
      }}
    >
      {/* Radial glow behind number */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 50% 45%, ${COLORS.saffron}${Math.round(flashBright * 25).toString(16).padStart(2, '0')} 0%, transparent 55%)`,
      }} />

      {/* Topic label — small, top-center */}
      <div style={{
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: FONTS.text,
        fontSize: 24,
        fontWeight: 600,
        color: COLORS.textOnDark,
        opacity: numOp * 0.6,
        letterSpacing: 4,
        textTransform: 'uppercase',
      }}>
        {topic}
      </div>

      {/* Giant stat */}
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: 160,
        fontWeight: 900,
        color: frame >= 48 && frame <= 55 ? accentColor : COLORS.textOnDark,
        transform: `scale(${numScale})`,
        opacity: numOp,
        lineHeight: 1,
        letterSpacing: -4,
        textShadow: flashBright > 0.1 ? `0 0 80px ${COLORS.saffron}90` : 'none',
      }}>
        {displayStr}
        <span style={{ fontSize: 72, color: COLORS.saffron }}>{stat.suffix}</span>
      </div>

      {/* Context label */}
      <div style={{
        fontFamily: FONTS.text,
        fontSize: 32,
        color: COLORS.textOnDark,
        opacity: labelOp,
        transform: `translateY(${labelY}px)`,
        textAlign: 'center',
        paddingLeft: 80,
        paddingRight: 80,
        marginTop: 16,
        maxWidth: 900,
        lineHeight: 1.3,
      }}>
        {stat.label}
      </div>
    </AbsoluteFill>
  );
};
