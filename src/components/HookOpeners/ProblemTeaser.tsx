/**
 * ProblemTeaser.tsx
 *
 * Style 4 — "Problem Teaser"
 * Opens by presenting a relatable real-world failure scenario. The viewer's
 * pattern-recognition fires ("that's happened to me!") and they stay to find the fix.
 * (Source: expert-findings.md "Striver/Kunal lens: hook must be visual + auditory
 * + unresolved question, first 3s or viewers leave")
 *
 * Duration: 90 frames @ 30fps = 3.0 s (hard cap)
 * Phase 1 (0–10f):   Black fade in
 * Phase 2 (11–50f):  System error / failure visual + problem text types in
 * Phase 3 (51–75f):  "In this session..." promise teaser fades in
 * Phase 4 (76–90f):  Exit fade
 */

import React from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';
import type { HookOpenerProps } from './types';

function extractProblem(hookText: string, topic: string): { problem: string; promise: string } {
  const sentences = hookText.split(/[.!?]/).map((s) => s.trim()).filter(Boolean);
  return {
    problem: sentences[0] || `Your ${topic} is breaking under load`,
    promise: sentences[1] || `In this session: exactly why — and how to fix it`,
  };
}

/** Animated "ERROR" log lines that appear one by one */
const LogLines: React.FC<{ frame: number; topic: string }> = ({ frame, topic }) => {
  const lines = [
    `[ERROR] ${topic}: connection timeout after 30s`,
    `[WARN]  retry 1/3 failed — backing off`,
    `[ERROR] ${topic}: upstream service unreachable`,
    `[FATAL] request dropped — queue full (10000 items)`,
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      {lines.map((line, i) => {
        const startF = 16 + i * 8;
        const op = interpolate(frame, [startF, startF + 4, 70, 78], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const isError = line.startsWith('[ERROR') || line.startsWith('[FATAL');
        return (
          <div key={i} style={{
            fontFamily: FONTS.code,
            fontSize: 20,
            color: isError ? '#FF6B6B' : '#FFA500',
            opacity: op,
            lineHeight: 1.4,
          }}>
            {line}
          </div>
        );
      })}
    </div>
  );
};

export const ProblemTeaser: React.FC<HookOpenerProps> = ({ frame, fps: _fps, topic, hookText }) => {
  const { problem, promise } = extractProblem(hookText, topic);

  const bgOp = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Problem headline
  const probOp = interpolate(frame, [11, 18, 58, 66], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const probY = interpolate(frame, [11, 22], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  // Promise teaser
  const promiseOp = interpolate(frame, [51, 62, 70, 78], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const promiseY = interpolate(frame, [51, 64], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  // Red pulsing border
  const borderOp = interpolate(frame, [11, 16, 55, 60], [0, 0.6, 0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Pulse
  const pulse = interpolate(frame % 15, [0, 7, 14], [0.4, 0.8, 0.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const exitOp = interpolate(frame, [78, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0008',
        justifyContent: 'center',
        alignItems: 'flex-start',
        flexDirection: 'column',
        padding: 80,
        opacity: bgOp * exitOp,
        overflow: 'hidden',
      }}
    >
      {/* Pulsing red border */}
      <div style={{
        position: 'absolute',
        inset: 0,
        border: `3px solid ${COLORS.red}`,
        opacity: borderOp * pulse,
      }} />

      {/* Corner "SYSTEM FAILURE" chip */}
      <div style={{
        position: 'absolute',
        top: 40,
        left: 40,
        backgroundColor: COLORS.red,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 6,
        paddingBottom: 6,
        fontFamily: FONTS.heading,
        fontSize: 18,
        fontWeight: 900,
        color: '#FFFFFF',
        letterSpacing: 2,
        textTransform: 'uppercase',
        opacity: borderOp,
      }}>
        ⚠ SYSTEM FAILURE
      </div>

      {/* Problem headline */}
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: 52,
        fontWeight: 900,
        color: '#FFFFFF',
        lineHeight: 1.2,
        opacity: probOp,
        transform: `translateY(${probY}px)`,
        marginBottom: 32,
        maxWidth: 1100,
      }}>
        {problem}
      </div>

      {/* Error log lines */}
      <LogLines frame={frame} topic={topic} />

      {/* Promise teaser */}
      <div style={{
        marginTop: 32,
        fontFamily: FONTS.text,
        fontSize: 28,
        color: COLORS.teal,
        opacity: promiseOp,
        transform: `translateY(${promiseY}px)`,
        fontWeight: 600,
      }}>
        → {promise}
      </div>
    </AbsoluteFill>
  );
};
