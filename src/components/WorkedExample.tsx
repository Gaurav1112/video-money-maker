// src/components/WorkedExample.tsx
//
// v3: 30-second BEFORE/AFTER split-screen scenario. Renders during the WORKED
// EXAMPLE phase (80-110s in the 120s baseline).
//
// Inputs: a scenario string + before + after. If a derived/fallback story is
// not viable, the parent passes only `twistFallback` and we render the twist
// as a single dramatic line.
//
// Layout:
//   ┌──────────────────────────────────────┐
//   │   <scenario one-liner, big>          │
//   ├────────────────┬─────────────────────┤
//   │   BEFORE       │       AFTER         │
//   │   (red panel)  │   (green panel)     │
//   │   <text>       →   <text>            │
//   └────────────────┴─────────────────────┘
//
// Deterministic, frame-driven.

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import type { WorkedExample as WorkedExampleData } from '../lib/quiz-content';
import { FONTS } from '../lib/theme';

interface Props {
  data: WorkedExampleData | null; // null → fallback path
  twistFallback?: string; // used when data is null
  startFrame: number;
  durationFrames: number;
}

const RED = '#FF4444';
const GREEN = '#10B981';
const TEXT = '#FFFFFF';
const MUTED = '#94A3B8';

// ── Heuristic derivation from explanation ───────────────────────────
export function deriveWorkedExample(
  explanation: string,
  options: string[],
  correctIndex: number
): WorkedExampleData | null {
  // Find first company / product name (capitalized).
  const companyRe =
    /\b(LinkedIn|Netflix|Uber|Google|Amazon|Stripe|GitHub|Shopify|Discord|Instagram|WhatsApp|Twitter|Facebook|YouTube|GitLab|Spotify|Reddit|TikTok|Microsoft|Apple)\b/;
  const compMatch = explanation.match(companyRe);
  const scenario = compMatch ? `${compMatch[0]} learned the hard way` : 'A real production story';

  const sentences = explanation
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const before = sentences.find((s) =>
    /\b(lost|lose|losing|crashed|crash|failed|fail|wrong|broken|outage|down|deleted|leak|stale|bug|gone|forget|drop|silently)\b/i.test(
      s
    )
  );
  const correctAnswer = options[correctIndex] ?? '';
  const after =
    sentences.find((s) =>
      /\b(fixed|saved|works|solved|safe|durable|stable|recovered|reduced|cut|uses|processes|handles)\b/i.test(
        s
      )
    ) ?? (correctAnswer ? `Switch to: ${correctAnswer}` : (sentences[sentences.length - 1] ?? ''));

  if (!before) return null;
  return { scenario, before, after };
}

export const WorkedExample: React.FC<Props> = ({
  data,
  twistFallback,
  startFrame,
  durationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const age = frame - startFrame;
  if (age < 0 || age >= durationFrames) return null;

  const s = spring({
    frame: Math.max(0, age),
    fps,
    config: { stiffness: 160, damping: 18, mass: 0.7 },
  });
  const opacity = interpolate(s, [0, 1], [0, 1]);
  const fadeOut = interpolate(age, [durationFrames - 15, durationFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Fallback: single dramatic line (twist) ──
  if (!data) {
    const line = (twistFallback ?? '').trim();
    if (!line) return null;
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 26,
          backgroundColor: 'rgba(8, 8, 14, 0.92)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 60px',
        }}
      >
        <div
          style={{
            opacity: opacity * fadeOut,
            transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
            fontSize: 56,
            fontFamily: FONTS.heading,
            fontWeight: 800,
            color: TEXT,
            textAlign: 'center',
            lineHeight: 1.3,
            textShadow: '0 0 40px rgba(0,0,0,0.6)',
            maxWidth: 920,
          }}
        >
          {line}
        </div>
      </div>
    );
  }

  // ── BEFORE / AFTER split ──
  // Stagger the two panels: BEFORE in 0-8 frames, AFTER in 18-26 frames.
  const beforeAge = age;
  const afterAge = age - 18;
  const beforeS = spring({
    frame: Math.max(0, beforeAge),
    fps,
    config: { stiffness: 170, damping: 16, mass: 0.6 },
  });
  const afterS = spring({
    frame: Math.max(0, afterAge),
    fps,
    config: { stiffness: 170, damping: 16, mass: 0.6 },
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 26,
        backgroundColor: 'rgba(8, 8, 14, 0.94)',
        padding: '90px 50px 130px',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        opacity: fadeOut,
      }}
    >
      {/* Scenario header */}
      <div
        style={{
          textAlign: 'center',
          opacity: interpolate(beforeS, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(beforeS, [0, 1], [-20, 0])}px)`,
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontFamily: FONTS.text,
            fontWeight: 700,
            color: '#22D3EE',
            textTransform: 'uppercase',
            letterSpacing: 4,
            marginBottom: 10,
          }}
        >
          REAL WORLD
        </div>
        <div
          style={{
            fontSize: 56,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: TEXT,
            lineHeight: 1.1,
            letterSpacing: -1,
            textShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {data.scenario}
        </div>
      </div>

      {/* Split panels */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 24,
          alignItems: 'stretch',
          position: 'relative',
        }}
      >
        {/* BEFORE panel */}
        <div
          style={{
            flex: 1,
            backgroundColor: 'rgba(255, 68, 68, 0.12)',
            border: `3px solid ${RED}`,
            borderRadius: 18,
            padding: '24px 24px',
            boxShadow: `0 0 30px rgba(255, 68, 68, 0.3)`,
            opacity: interpolate(beforeS, [0, 1], [0, 1]),
            transform: `translateX(${interpolate(beforeS, [0, 1], [-60, 0])}px)`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              color: RED,
              textTransform: 'uppercase',
              letterSpacing: 2,
              marginBottom: 16,
              textShadow: `0 0 16px rgba(255, 68, 68, 0.5)`,
            }}
          >
            X BEFORE
          </div>
          <div
            style={{
              fontSize: 32,
              fontFamily: FONTS.text,
              fontWeight: 600,
              color: TEXT,
              lineHeight: 1.35,
              flex: 1,
            }}
          >
            {data.before}
          </div>
        </div>

        {/* Arrow */}
        <div
          style={{
            alignSelf: 'center',
            fontSize: 80,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: '#FBBF24',
            opacity: interpolate(afterS, [0, 1], [0, 1]),
            transform: `scale(${interpolate(afterS, [0, 1], [0.5, 1])})`,
            textShadow: '0 0 30px rgba(251, 191, 36, 0.6)',
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: -28,
            marginTop: -56,
            zIndex: 2,
          }}
        >
          ➜
        </div>

        {/* AFTER panel */}
        <div
          style={{
            flex: 1,
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: `3px solid ${GREEN}`,
            borderRadius: 18,
            padding: '24px 24px',
            boxShadow: `0 0 30px rgba(16, 185, 129, 0.3)`,
            opacity: interpolate(afterS, [0, 1], [0, 1]),
            transform: `translateX(${interpolate(afterS, [0, 1], [60, 0])}px)`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              color: GREEN,
              textTransform: 'uppercase',
              letterSpacing: 2,
              marginBottom: 16,
              textShadow: `0 0 16px rgba(16, 185, 129, 0.5)`,
            }}
          >
            OK AFTER
          </div>
          <div
            style={{
              fontSize: 32,
              fontFamily: FONTS.text,
              fontWeight: 600,
              color: TEXT,
              lineHeight: 1.35,
              flex: 1,
            }}
          >
            {data.after}
          </div>
        </div>
      </div>

      {/* Bottom subtitle */}
      <div
        style={{
          textAlign: 'center',
          fontSize: 22,
          fontFamily: FONTS.text,
          fontWeight: 600,
          color: MUTED,
          letterSpacing: 2,
          opacity: interpolate(afterS, [0, 1], [0, 1]) * fadeOut,
        }}
      >
        ONE CONFIG LINE — MILLIONS SAVED
      </div>
    </div>
  );
};

export default WorkedExample;
