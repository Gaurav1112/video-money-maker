/**
 * QuestionHook.tsx
 *
 * Style 0 — "Question Hook"
 * Throws a compelling unanswered question at the viewer in the first 3 seconds.
 * Pattern-interrupt: question appears, then sub-questions stack in, viewer brain
 * locks in to find the answer → watch time spikes.
 *
 * Duration: 90 frames @ 30fps = 3.0 s (hard cap)
 * Phase 1 (0–15f):   White flash → dark BG fades in
 * Phase 2 (16–55f):  Big question scales + fades in, pulsing glow
 * Phase 3 (56–80f):  Two tease bullets slide in from left
 * Phase 4 (81–90f):  Whole frame fades to black (hand-off to content)
 */

import React from 'react';
import { AbsoluteFill, interpolate, spring } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';
import type { HookOpenerProps } from './types';

export const QuestionHook: React.FC<HookOpenerProps> = ({ frame, fps, topic, hookText }) => {
  // ── Phase 1: flash ──────────────────────────────────────────────────────────
  const flashOp = interpolate(frame, [0, 3, 12, 18], [1, 1, 0, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase 2: question text ──────────────────────────────────────────────────
  const qScale = spring({ frame: Math.max(0, frame - 16), fps, from: 2.2, to: 1, durationInFrames: 22, config: { damping: 14, stiffness: 160 } });
  const qOp = interpolate(frame, [16, 22, 72, 80], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Glow pulse
  const glow = interpolate(frame, [22, 40, 55], [0, 1, 0.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase 3: bullet teasers ──────────────────────────────────────────────────
  const bullet1X = interpolate(frame, [56, 68], [-300, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3), // ease-out cubic
  });
  const bullet2X = interpolate(frame, [64, 76], [-300, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const bulletOp = interpolate(frame, [56, 62, 72, 80], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Phase 4: exit ────────────────────────────────────────────────────────────
  const exitOp = interpolate(frame, [80, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Derive teasers from hookText (split on punctuation / OR take first two chunks)
  const teaserParts = hookText
    .replace(/[?.!]/g, '|')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  const teaser1 = teaserParts[1] || `Why ${topic}?`;
  const teaser2 = teaserParts[2] || 'And when does it fail?';

  const question = teaserParts[0] ? `${teaserParts[0]}?` : `What is ${topic}?`;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0C0A15',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        opacity: exitOp,
        overflow: 'hidden',
      }}
    >
      {/* Flash overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#FFFFFF', opacity: flashOp, zIndex: 10 }} />

      {/* Thin horizontal rule */}
      <div style={{
        position: 'absolute',
        top: '44%',
        left: '10%',
        right: '10%',
        height: 2,
        background: `linear-gradient(90deg, transparent, ${COLORS.saffron}, transparent)`,
        opacity: qOp * 0.4,
      }} />

      {/* Big question */}
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: 64,
        fontWeight: 900,
        color: COLORS.textOnDark,
        textAlign: 'center',
        paddingLeft: 80,
        paddingRight: 80,
        transform: `scale(${qScale})`,
        opacity: qOp,
        lineHeight: 1.1,
        textShadow: `0 0 ${40 * glow}px ${COLORS.saffron}80`,
      }}>
        {question}
      </div>

      {/* Sub-teasers */}
      <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 14, opacity: bulletOp }}>
        {[{ text: teaser1, x: bullet1X }, { text: teaser2, x: bullet2X }].map(({ text, x }, i) => (
          <div key={i} style={{
            fontFamily: FONTS.text,
            fontSize: 30,
            color: COLORS.saffron,
            transform: `translateX(${x}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ opacity: 0.7 }}>▶</span>
            {text}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
