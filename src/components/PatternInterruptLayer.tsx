import React from 'react';
import {
  useCurrentFrame, AbsoluteFill, interpolate, Easing,
  spring, useVideoConfig, Sequence, Audio, staticFile,
} from 'remotion';
import { COLORS, FONTS } from '../lib/theme';
import { sfxDuration } from '../lib/sfx-durations';
import { isTechTerm } from '../lib/tech-terms';
import type { WordTimestamp, SceneType } from '../types';
import type { VideoStyle } from '../lib/video-styles';

type InterruptType = 'zoom' | 'callout' | 'colorPulse' | 'sfxHit' | 'opacityCut';

interface Interrupt {
  type: InterruptType;
  frame: number;       // absolute frame within the scene
  keyword?: string;    // for zoom + callout
}

interface PatternInterruptLayerProps {
  wordTimestamps: WordTimestamp[];
  sceneType: SceneType;
  narration: string;
  style: VideoStyle;
  fps: number;
  sceneDurationFrames: number;
}

const INTERRUPT_TYPES: InterruptType[] = ['zoom', 'callout', 'colorPulse', 'sfxHit', 'opacityCut'];

function computeInterrupts(
  wordTimestamps: WordTimestamp[],
  narration: string,
  style: VideoStyle,
  fps: number,
  sceneDuration: number,
): Interrupt[] {
  const intervalMin = style.id === 'viral' ? 4 : 6;
  const intervalMax = style.id === 'viral' ? 6 : 8;
  const avgInterval = ((intervalMin + intervalMax) / 2) * fps;

  // Find keyword positions (tech terms, ALL CAPS, numbers)
  const words = narration.split(/\s+/);
  const keywordFrames: Array<{ frame: number; word: string }> = [];
  words.forEach((word, i) => {
    const isKeyword = isTechTerm(word) ||
      (word.replace(/[^a-zA-Z]/g, '').length >= 2 && word === word.toUpperCase()) ||
      /\d{2,}/.test(word);
    if (isKeyword && wordTimestamps[i]) {
      keywordFrames.push({ frame: Math.round(wordTimestamps[i].start * fps), word });
    }
  });

  const interrupts: Interrupt[] = [];
  let nextTrigger = Math.round(avgInterval);
  let typeIndex = 0;

  while (nextTrigger < sceneDuration - fps) { // stop 1s before scene end
    // Check if a keyword is near this trigger point (within 1s)
    const nearbyKeyword = keywordFrames.find(
      kf => Math.abs(kf.frame - nextTrigger) < fps
    );

    let type: InterruptType;
    if (nearbyKeyword && (typeIndex % 5 === 0 || typeIndex % 5 === 1)) {
      // Keyword found → use zoom or callout
      type = typeIndex % 2 === 0 ? 'zoom' : 'callout';
    } else {
      type = INTERRUPT_TYPES[typeIndex % INTERRUPT_TYPES.length];
    }

    // No two consecutive same type
    if (interrupts.length > 0 && interrupts[interrupts.length - 1].type === type) {
      typeIndex++;
      type = INTERRUPT_TYPES[typeIndex % INTERRUPT_TYPES.length];
    }

    interrupts.push({
      type,
      frame: nearbyKeyword ? nearbyKeyword.frame : nextTrigger,
      keyword: nearbyKeyword?.word,
    });

    nextTrigger += Math.round(avgInterval);
    typeIndex++;
  }

  return interrupts;
}

export const PatternInterruptLayer: React.FC<PatternInterruptLayerProps> = ({
  wordTimestamps,
  sceneType,
  narration,
  style,
  fps,
  sceneDurationFrames,
}) => {
  const frame = useCurrentFrame();

  const interrupts = React.useMemo(
    () => computeInterrupts(wordTimestamps, narration, style, fps, sceneDurationFrames),
    [wordTimestamps, narration, style, fps, sceneDurationFrames],
  );

  // Find active interrupt
  const activeInterrupt = interrupts.find(
    int => frame >= int.frame && frame < int.frame + 30 // max 1s window
  );

  if (!activeInterrupt) return null;

  const age = frame - activeInterrupt.frame;

  switch (activeInterrupt.type) {
    case 'zoom': {
      // NOTE: Zoom interrupt cannot scale sibling content from an overlay.
      // Instead, we render a brief "flash zoom" visual cue — a translucent
      // expanding circle that draws the eye inward, simulating a zoom feel.
      const half = 9; // 18 frames total
      if (age > 18) return null;
      const ringScale = age < half
        ? interpolate(age, [0, half], [0.8, 1.3], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' })
        : interpolate(age, [half, 18], [1.3, 1.5], { easing: Easing.out(Easing.cubic), extrapolateRight: 'clamp' });
      const ringOpacity = interpolate(age, [0, 3, 15, 18], [0, 0.2, 0.1, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill style={{ pointerEvents: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{
            width: 400, height: 400, borderRadius: '50%',
            border: `3px solid ${COLORS.saffron}`,
            transform: `scale(${ringScale})`,
            opacity: ringOpacity,
            boxShadow: `0 0 40px ${COLORS.saffron}30`,
          }} />
        </AbsoluteFill>
      );
    }

    case 'callout': {
      if (age > 30 || !activeInterrupt.keyword) return null;
      const calloutSpring = spring({ frame: age, fps, config: { damping: 12, stiffness: 200, mass: 0.5 } });
      const calloutOpacity = interpolate(age, [0, 5, 22, 30], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: 80, right: 60,
            background: `${COLORS.saffron}EE`, borderRadius: 999,
            padding: '8px 24px',
            transform: `scale(${interpolate(calloutSpring, [0, 1], [0.5, 1])})`,
            opacity: calloutOpacity,
            boxShadow: `0 4px 20px ${COLORS.saffron}44`,
          }}>
            <span style={{
              fontSize: 22, fontFamily: FONTS.heading, fontWeight: 800,
              color: COLORS.textOnDark, textTransform: 'uppercase', letterSpacing: 1,
            }}>
              {activeInterrupt.keyword}
            </span>
          </div>
        </AbsoluteFill>
      );
    }

    case 'colorPulse': {
      if (age > 9) return null;
      const pulseOpacity = interpolate(age, [0, 3, 9], [0, 0.15, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      });
      return (
        <AbsoluteFill style={{
          background: `radial-gradient(circle at center, ${COLORS.saffron}40, transparent 70%)`,
          opacity: pulseOpacity, pointerEvents: 'none',
        }} />
      );
    }

    case 'sfxHit': {
      // Render audio-only interrupt
      return (
        <Sequence from={activeInterrupt.frame} durationInFrames={sfxDuration('whoosh-in')}>
          <Audio src={staticFile('audio/sfx/whoosh-in.wav')} volume={0.35} />
        </Sequence>
      );
    }

    case 'opacityCut': {
      if (age > 3) return null;
      return (
        <AbsoluteFill style={{ backgroundColor: 'rgba(0,0,0,0.08)', pointerEvents: 'none' }} />
      );
    }

    default:
      return null;
  }
};
