/**
 * UrgencyCountdown.tsx
 *
 * Style 5 — "Urgency Countdown"
 * A countdown from 3 to 0, each beat punctuating a key reason to keep watching.
 * The countdown creates forward momentum — viewers psychologically complete it.
 * Used by top creators (MrBeast, Veritasium) for reveal-format hooks.
 * (Source: expert-findings.md "MrBeast: countdown + reveal = highest first-30s retention")
 *
 * Duration: 90 frames @ 30fps = 3.0 s (hard cap)
 * Beat 1 (0–28f):   "3" — reason 1
 * Beat 2 (29–58f):  "2" — reason 2
 * Beat 3 (59–80f):  "1" — reason 3 / topic reveal
 * Phase 4 (81–90f): Exit → topic title slams in center
 */

import React from 'react';
import { AbsoluteFill, interpolate, spring } from 'remotion';
import { COLORS, FONTS } from '../../lib/theme';
import type { HookOpenerProps } from './types';

function extractReasons(hookText: string, topic: string): [string, string, string] {
  const parts = hookText
    .split(/[,;]|and |but /)
    .map((s) => s.trim())
    .filter((s) => s.length > 4);
  return [
    parts[0] || `Why ${topic} matters`,
    parts[1] || `Where ${topic} breaks`,
    parts[2] || `The fix that works`,
  ];
}

/** A single countdown beat */
const CountdownBeat: React.FC<{
  frame: number;
  fps: number;
  startFrame: number;
  endFrame: number;
  number: number;
  reason: string;
  accentColor: string;
}> = ({ frame, fps, startFrame, endFrame, number, reason, accentColor }) => {
  const localFrame = frame - startFrame;
  const duration = endFrame - startFrame;

  const numScale = spring({
    frame: Math.max(0, localFrame),
    fps,
    from: 3,
    to: 1,
    durationInFrames: 12,
    config: { damping: 10, stiffness: 180 },
  });

  const op = interpolate(
    frame,
    [startFrame, startFrame + 4, endFrame - 6, endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const reasonY = interpolate(frame, [startFrame + 8, startFrame + 18], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const reasonOp = interpolate(frame, [startFrame + 8, startFrame + 16, endFrame - 6, endFrame], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Progress bar for this beat
  const barWidth = interpolate(frame, [startFrame, endFrame], [100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (frame < startFrame || frame > endFrame) return null;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', opacity: op }}>
      {/* Big countdown number */}
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: 200,
        fontWeight: 900,
        color: accentColor,
        lineHeight: 1,
        transform: `scale(${numScale})`,
        opacity: 0.2,
        position: 'absolute',
        userSelect: 'none',
      }}>
        {number}
      </div>

      {/* Reason text */}
      <div style={{
        fontFamily: FONTS.heading,
        fontSize: 52,
        fontWeight: 800,
        color: '#FFFFFF',
        textAlign: 'center',
        paddingLeft: 80,
        paddingRight: 80,
        opacity: reasonOp,
        transform: `translateY(${reasonY}px)`,
        zIndex: 1,
        maxWidth: 1100,
        lineHeight: 1.2,
      }}>
        {reason}
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: 60,
        left: '10%',
        right: '10%',
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
      }}>
        <div style={{
          height: '100%',
          width: `${barWidth}%`,
          backgroundColor: accentColor,
          transition: 'none',
        }} />
      </div>
    </AbsoluteFill>
  );
};

export const UrgencyCountdown: React.FC<HookOpenerProps> = ({ frame, fps, topic, hookText }) => {
  const [r1, r2, r3] = extractReasons(hookText, topic);

  const exitOp = interpolate(frame, [80, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const colors = [COLORS.red, COLORS.gold, COLORS.teal] as const;

  return (
    <AbsoluteFill style={{ backgroundColor: '#0C0A15', opacity: exitOp, overflow: 'hidden' }}>
      {/* Beat 3 */}
      <CountdownBeat
        frame={frame} fps={fps}
        startFrame={0} endFrame={28}
        number={3} reason={r1}
        accentColor={colors[0]}
      />
      {/* Beat 2 */}
      <CountdownBeat
        frame={frame} fps={fps}
        startFrame={29} endFrame={58}
        number={2} reason={r2}
        accentColor={colors[1]}
      />
      {/* Beat 1 */}
      <CountdownBeat
        frame={frame} fps={fps}
        startFrame={59} endFrame={80}
        number={1} reason={r3}
        accentColor={colors[2]}
      />

      {/* Topic slam at end */}
      {frame >= 59 && (
        <div style={{
          position: 'absolute',
          bottom: 100,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: FONTS.heading,
          fontSize: 28,
          fontWeight: 700,
          color: COLORS.textOnDark,
          letterSpacing: 4,
          textTransform: 'uppercase',
          opacity: interpolate(frame, [59, 68], [0, 0.7], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          {topic}
        </div>
      )}
    </AbsoluteFill>
  );
};
