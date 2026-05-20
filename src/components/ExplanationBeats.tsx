// src/components/ExplanationBeats.tsx
//
// v3: walks through ALL sentences in quiz.explanation, one per beat, across
// the EXPLAIN phase (typically 50s). Replaces the previous KeyPhraseReveal
// which only showed 3 extracted phrases.
//
// Each sentence renders as a large card (60px) with spring entry + fade exit.
// Power words (NEVER/ALWAYS/WRONG/$10M/TRILLION/etc.) get a saffron scale pop.
// The optional bigStat is rendered as a 2s prefix beat at the start.
//
// Deterministic: only useCurrentFrame and pre-computed sentence array.

import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { FONTS } from '../lib/theme';

interface Props {
  text: string;
  startFrame: number;
  durationFrames: number;
  bigStat: { number: string; context: string } | null;
}

const TEXT = '#FFFFFF';
const SAFFRON = '#FBBF24';
const CYAN = '#22D3EE';
const MUTED = '#94A3B8';

// Split into sentences. Handles `. `, `! `, `? ` and trailing periods.
function splitSentences(text: string): string[] {
  const raw = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  // Merge fragments shorter than 25 chars into the previous sentence to avoid
  // micro-beats from abbreviations.
  const merged: string[] = [];
  for (const s of raw) {
    if (merged.length && s.length < 25) {
      merged[merged.length - 1] += ' ' + s;
    } else {
      merged.push(s);
    }
  }
  return merged;
}

const POWER_WORD_RE = /\b(NOT|NEVER|WRONG|LOST|EVERY|ALWAYS|ALL|ONLY|MOST|CRITICAL|ZERO|NONE|TRILLION|BILLION|MILLION|FAIL|FAILED|CRASHED|SAVED|FIXED)\b|\$[\d,]+\s*[MB]?/g;

// Highlight power words inside a sentence. Returns React nodes.
const renderHighlighted = (sentence: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  POWER_WORD_RE.lastIndex = 0;
  while ((m = POWER_WORD_RE.exec(sentence)) !== null) {
    if (m.index > last) parts.push(sentence.slice(last, m.index));
    parts.push(
      <span key={`p-${m.index}`} style={{
        color: SAFFRON,
        fontWeight: 900,
        textShadow: `0 0 22px rgba(251, 191, 36, 0.5)`,
        display: 'inline-block',
        transform: 'scale(1.05)',
      }}>
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < sentence.length) parts.push(sentence.slice(last));
  return parts;
};

// ── Big-stat animated counter (2s prefix beat) ──────────────────────
const BigStatBeat: React.FC<{
  bigStat: { number: string; context: string };
  startFrame: number;
  durationFrames: number;
}> = ({ bigStat, startFrame, durationFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const age = frame - startFrame;
  if (age < 0 || age >= durationFrames) return null;

  const s = spring({ frame: age, fps, config: { stiffness: 160, damping: 12, mass: 0.6 } });
  const fadeOut = interpolate(age, [durationFrames - 12, durationFrames], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Parse "12,345 foo" into prefix + number + suffix for the tick-up.
  const parseMatch = bigStat.number.match(/^([^\d]*)([\d,.]+)(.*)$/);
  let displayValue = bigStat.number;
  let countPulse = 1;
  if (parseMatch) {
    const [, prefix, rawNum, suffix] = parseMatch;
    const target = parseFloat(rawNum.replace(/,/g, ''));
    const isInt = !rawNum.includes('.');
    const tickFrames = Math.min(45, Math.round(durationFrames * 0.6));
    const value = interpolate(age, [0, tickFrames], [0, target], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    let formatted = isInt ? String(Math.round(value)) : value.toFixed(1);
    if (isInt && rawNum.includes(',')) formatted = Number(formatted).toLocaleString('en-US');
    displayValue = `${prefix}${formatted}${suffix}`;
    if (age >= tickFrames && age <= tickFrames + 12) {
      countPulse = age <= tickFrames + 6
        ? interpolate(age, [tickFrames, tickFrames + 6], [1, 1.08])
        : interpolate(age, [tickFrames + 6, tickFrames + 12], [1.08, 1]);
    }
  }

  return (
    <div style={{
      opacity: interpolate(s, [0, 1], [0, 1]) * fadeOut,
      transform: `scale(${interpolate(s, [0, 1], [0.5, 1]) * countPulse})`,
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 110, fontFamily: FONTS.heading, fontWeight: 900,
        color: SAFFRON, letterSpacing: -3,
        textShadow: `0 0 50px rgba(251, 191, 36, 0.5)`,
      }}>
        {displayValue}
      </div>
      <div style={{
        fontSize: 30, fontFamily: FONTS.text, fontWeight: 600,
        color: MUTED, textTransform: 'uppercase', letterSpacing: 3,
        marginTop: 8,
      }}>
        {bigStat.context}
      </div>
    </div>
  );
};

export const ExplanationBeats: React.FC<Props> = ({
  text, startFrame, durationFrames, bigStat,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Hooks must run unconditionally — pre-compute before any early return.
  const sentences = useMemo(() => splitSentences(text), [text]);
  const age = frame - startFrame;
  if (age < 0 || age >= durationFrames) return null;
  const statFrames = bigStat ? Math.round(fps * 2) : 0; // 2s
  const beatsSpan = Math.max(1, durationFrames - statFrames);
  const beatDur = Math.max(1, Math.floor(beatsSpan / Math.max(1, sentences.length)));

  // Current sentence index based on age.
  const ageAfterStat = age - statFrames;
  const sentenceIdx = ageAfterStat < 0 ? -1 : Math.min(sentences.length - 1, Math.floor(ageAfterStat / beatDur));

  return (
    <div style={{
      position: 'absolute',
      top: 880,
      left: 50,
      right: 50,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 18,
    }}>
      {/* Big stat beat: first 2s */}
      {bigStat && (
        <BigStatBeat bigStat={bigStat} startFrame={startFrame} durationFrames={statFrames} />
      )}

      {/* One sentence at a time */}
      {sentenceIdx >= 0 && (() => {
        const beatStart = startFrame + statFrames + sentenceIdx * beatDur;
        const beatAge = frame - beatStart;
        const s = spring({
          frame: Math.max(0, beatAge),
          fps,
          config: { stiffness: 170, damping: 16, mass: 0.5 },
        });
        const fadeOut = interpolate(
          beatAge,
          [beatDur - 10, beatDur],
          [1, 0.7],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
        return (
          <div
            key={sentenceIdx}
            style={{
              opacity: interpolate(s, [0, 1], [0, 1]) * fadeOut,
              transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
              fontSize: 48,
              fontFamily: FONTS.heading,
              fontWeight: 800,
              color: TEXT,
              lineHeight: 1.25,
              textAlign: 'center',
              padding: '20px 28px',
              borderLeft: `4px solid ${CYAN}`,
              borderRight: `4px solid ${CYAN}`,
              backgroundColor: 'rgba(20, 20, 40, 0.78)',
              backdropFilter: 'blur(12px)',
              borderRadius: 16,
              boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
              maxWidth: 980,
            }}
          >
            {renderHighlighted(sentences[sentenceIdx])}
          </div>
        );
      })()}

      {/* Beat progress dots — bottom indicator */}
      <div style={{
        display: 'flex', gap: 10, marginTop: 12,
      }}>
        {sentences.map((_, i) => (
          <div key={i} style={{
            width: i === sentenceIdx ? 26 : 12,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === sentenceIdx ? CYAN : 'rgba(34, 211, 238, 0.25)',
            transition: 'width 0.2s',
          }} />
        ))}
      </div>
    </div>
  );
};

export default ExplanationBeats;
