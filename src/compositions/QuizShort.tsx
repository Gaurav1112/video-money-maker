// src/compositions/QuizShort.tsx
// Visually rich quiz short — Fireship-grade with diagrams, Lottie, animated boxes
// v2: 25s, flash cut, loop trigger, tighter pacing
import React, { useMemo } from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Audio,
  staticFile,
  interpolate,
  spring,
  Img,
  Sequence,
} from 'remotion';
import type { CalculateMetadataFunction } from 'remotion';
import { Lottie } from '@remotion/lottie';
import type { LottieAnimationData } from '@remotion/lottie';
import type { QuizQuestion } from '../lib/quiz-content';
import { pickHook } from '../lib/quiz-hook';
import { FONTS } from '../lib/theme';
import EndCardCTA from '../components/EndCardCTA';
import CaptionOverlay from '../components/CaptionOverlay';
import { AnimatedBox } from '../components/viz/AnimatedBox';
import { AnimatedArrow } from '../components/viz/AnimatedArrow';
import CodeSnippetPanel from '../components/CodeSnippetPanel';
import ExplanationBeats from '../components/ExplanationBeats';
import WorkedExample, { deriveWorkedExample } from '../components/WorkedExample';

const FPS = 30;
const DEFAULT_DURATION_S = 120; // v3 baseline (was 25s)

// v3: ABSOLUTE phase boundaries in seconds. Total = 120s baseline. The middle
// three phases (code, explain, example) absorb slack when audio is longer.
//
//   HOOK            0    → 3.5s   (was 2s)
//   QUESTION        3.5  → 13s    (longer; lets viewer read options properly)
//   FLASH           13   → 13.5s
//   ANSWER SPLASH   13.5 → 14s    (the .5s of FLASH plus 15-frame splash)
//   CODE SNIPPET    14   → 30s    (NEW)
//   EXPLAIN BEATS   30   → 80s    (was 3 phrases, now full sentences)
//   WORKED EXAMPLE  80   → 110s   (NEW)
//   LOOP TRIGGER    110  → 116s
//   END CTA         116  → 120s
const HOOK_END_S = 3.5;
const QUESTION_END_S = 13;
const FLASH_END_S = 13.5;
const ANSWER_SPLASH_END_S = 14;
const CODE_END_S = 30;
const EXPLAIN_END_S = 80;
const EXAMPLE_END_S = 110;
const LOOP_END_S = 116;
const END_CTA_DURATION_S = 4; // last 4s of total

// Colors — dark theme for Shorts (proven higher retention)
const BG_DARK = '#0A0A12';
const BG_GRADIENT = 'radial-gradient(ellipse at 50% 30%, #1a1a2e 0%, #0A0A12 70%)';
const TEXT = '#FFFFFF';
const ACCENT = '#FF4444';
const CORRECT = '#10B981';
const WRONG_DIM = 'rgba(255, 68, 68, 0.15)';
const MUTED = '#94A3B8';
const OPTION_BG = '#141425';
const OPTION_BORDER = '#2a2a4a';
const YELLOW = '#FBBF24';
const CYAN = '#22D3EE';

interface QuizShortProps {
  quiz: QuizQuestion;
  audioFile?: string;
  /** Total narration duration in seconds. Drives composition length. */
  audioDurationSec?: number;
  wordTimestamps?: Array<{ word: string; start: number; end: number }>;
}

// ── Topic to Diagram Mapping ────────────────────────────────────────
interface DiagramNode {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface DiagramConfig {
  nodes: DiagramNode[];
  arrows: { from: { x: number; y: number }; to: { x: number; y: number }; label?: string }[];
}

function getTopicDiagram(topic: string): DiagramConfig {
  // v3: shifted down ~130px so diagram occupies y: 380-700 (visual center)
  // instead of y: 250-470 (top quarter). Frees top area for question card and
  // pushes diagram into the safe zone between question (top) and options (mid).
  const configs: Record<string, DiagramConfig> = {
    kafka: {
      nodes: [
        { label: 'Producer', x: 180, y: 450, width: 180, height: 70, color: 'blue' },
        { label: 'Kafka Broker', x: 540, y: 450, width: 200, height: 70, color: 'orange' },
        { label: 'Consumer', x: 900, y: 450, width: 180, height: 70, color: 'green' },
      ],
      arrows: [
        { from: { x: 270, y: 450 }, to: { x: 440, y: 450 }, label: 'publish' },
        { from: { x: 640, y: 450 }, to: { x: 810, y: 450 }, label: 'consume' },
      ],
    },
    'api-gateway': {
      nodes: [
        { label: 'Client', x: 540, y: 380, width: 160, height: 65, color: 'blue' },
        { label: 'API Gateway', x: 540, y: 500, width: 200, height: 70, color: 'orange' },
        { label: 'Auth', x: 250, y: 600, width: 140, height: 60, color: 'red' },
        { label: 'Service A', x: 540, y: 600, width: 160, height: 60, color: 'green' },
        { label: 'Service B', x: 830, y: 600, width: 160, height: 60, color: 'teal' },
      ],
      arrows: [
        { from: { x: 540, y: 413 }, to: { x: 540, y: 465 } },
        { from: { x: 440, y: 535 }, to: { x: 320, y: 570 } },
        { from: { x: 540, y: 535 }, to: { x: 540, y: 570 } },
        { from: { x: 640, y: 535 }, to: { x: 760, y: 570 } },
      ],
    },
    'load-balancing': {
      nodes: [
        { label: 'Clients', x: 540, y: 380, width: 160, height: 65, color: 'blue' },
        { label: 'Load Balancer', x: 540, y: 500, width: 210, height: 70, color: 'gold' },
        { label: 'Server 1', x: 250, y: 600, width: 160, height: 60, color: 'green' },
        { label: 'Server 2', x: 540, y: 600, width: 160, height: 60, color: 'green' },
        { label: 'Server 3', x: 830, y: 600, width: 160, height: 60, color: 'green' },
      ],
      arrows: [
        { from: { x: 540, y: 413 }, to: { x: 540, y: 465 } },
        { from: { x: 435, y: 535 }, to: { x: 320, y: 570 } },
        { from: { x: 540, y: 535 }, to: { x: 540, y: 570 } },
        { from: { x: 645, y: 535 }, to: { x: 760, y: 570 } },
      ],
    },
    database: {
      nodes: [
        { label: 'Application', x: 540, y: 390, width: 190, height: 65, color: 'blue' },
        { label: 'Primary DB', x: 370, y: 530, width: 180, height: 65, color: 'orange' },
        { label: 'Replica DB', x: 720, y: 530, width: 180, height: 65, color: 'teal' },
      ],
      arrows: [
        { from: { x: 445, y: 423 }, to: { x: 370, y: 498 }, label: 'write' },
        { from: { x: 635, y: 423 }, to: { x: 720, y: 498 }, label: 'read' },
        { from: { x: 460, y: 530 }, to: { x: 630, y: 530 }, label: 'replicate' },
      ],
    },
  };

  // Default fallback: simple client-server diagram (also shifted by 130)
  return configs[topic] || {
    nodes: [
      { label: 'Client', x: 300, y: 460, width: 170, height: 70, color: 'blue' },
      { label: 'Server', x: 780, y: 460, width: 170, height: 70, color: 'green' },
    ],
    arrows: [
      { from: { x: 385, y: 460 }, to: { x: 695, y: 460 }, label: 'request' },
    ],
  };
}

// ── Extract key phrases from explanation (max 3 for tighter pacing) ──
function extractKeyPhrases(explanation: string): string[] {
  const phrases: string[] = [];

  // Extract numbers/stats (e.g., "7 trillion messages per day", "$10M")
  const numberPatterns = explanation.match(/\d[\d,.]*\s*(?:trillion|billion|million|thousand|Gbps|%|ms|seconds?|minutes?|hours?)?(?:\s+\w+){0,4}/gi);
  if (numberPatterns) {
    for (const match of numberPatterns.slice(0, 1)) {
      phrases.push(match.trim());
    }
  }

  // Extract sentences with strong signal words
  const sentences = explanation.split(/\.\s+/);
  for (const s of sentences) {
    if (phrases.length >= 3) break;
    if (/NOT|NEVER|WRONG|LOST|EVERY|ALWAYS|CRITICAL|MOST|ONLY/i.test(s) && s.length < 80) {
      const cleaned = s.replace(/^(The\s+)?/i, '').trim();
      if (cleaned && !phrases.some(p => p.includes(cleaned.slice(0, 20)))) {
        phrases.push(cleaned);
      }
    }
  }

  // Fill up to 2 if we don't have enough
  if (phrases.length < 2) {
    const firstSentence = sentences[0]?.trim();
    if (firstSentence) phrases.push(firstSentence);
  }

  return phrases.slice(0, 3);
}

// ── Extract the big stat number from explanation ────────────────────
function extractBigStat(explanation: string): { number: string; context: string } | null {
  const match = explanation.match(/(\d[\d,.]*\s*(?:trillion|billion|million|thousand|Gbps|%)?)\s+([\w\s]+?)(?:\.|,|and)/i);
  if (match) {
    return { number: match[1].trim(), context: match[2].trim() };
  }
  return null;
}

// getSpecificHook moved to src/lib/quiz-hook.ts (shared with QuizThumbnail).

// Feature P8: deterministic hash for A/B hook rotation.
// Same quiz → same slot → same hook variant. Balanced across the bank
// without needing to thread the explicit bank index through props.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── Pulsing Red Vignette ─────────────────────────────────────────────
const PulsingVignette: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame * 0.15), [-1, 1], [0.3, 0.7]);
  return (
    <div style={{
      position: 'absolute', inset: 0,
      boxShadow: `inset 0 0 120px rgba(255, 40, 40, ${pulse})`,
      pointerEvents: 'none',
      zIndex: 5,
    }} />
  );
};

// ── Option Card (enhanced) ──────────────────────────────────────────
const OptionCard: React.FC<{
  label: string; text: string; index: number;
  revealed: boolean; isCorrect: boolean;
  compact?: boolean;
  hookEnd: number;
  flashEnd: number;
}> = ({ label, text, index, revealed, isCorrect, compact = false, hookEnd, flashEnd }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entryFrame = hookEnd + index * 6;
  const s = spring({
    frame: Math.max(0, frame - entryFrame),
    fps,
    config: { stiffness: 200, damping: 14, mass: 0.5 },
  });

  // After reveal: correct glows green, wrong fades
  const revealAge = frame - flashEnd;
  const revealProgress = revealed
    ? interpolate(revealAge, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
    : 0;

  const bgColor = revealed
    ? (isCorrect
      ? `rgba(16, 185, 129, ${interpolate(revealProgress, [0, 1], [0.1, 0.25])})`
      : WRONG_DIM)
    : OPTION_BG;

  const borderColor = revealed
    ? (isCorrect ? CORRECT : 'rgba(255, 68, 68, 0.3)')
    : OPTION_BORDER;

  const textOpacity = revealed && !isCorrect
    ? interpolate(revealProgress, [0, 1], [1, 0.35])
    : 1;

  const badgeBg = revealed && isCorrect
    ? CORRECT
    : revealed && !isCorrect
      ? 'rgba(255, 68, 68, 0.4)'
      : 'rgba(255,255,255,0.08)';

  const py = compact ? 14 : 18;
  // Auto-fit: shrink long options (>28 chars) to 26/24 instead of 32/28.
  const longText = text.length > 28;
  const fontSize = longText
    ? (compact ? 22 : 26)
    : (compact ? 28 : 32);

  return (
    <div style={{
      opacity: interpolate(s, [0, 1], [0, 1]),
      transform: `translateX(${interpolate(s, [0, 1], [80, 0])}px) scale(${interpolate(s, [0, 1], [0.9, 1])})`,
      backgroundColor: bgColor,
      border: `2px solid ${borderColor}`,
      borderRadius: 16,
      padding: `${py}px 20px`,
      marginBottom: compact ? 10 : 14,
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: revealed && isCorrect
        ? `0 0 30px rgba(16, 185, 129, 0.3), 0 4px 20px rgba(0,0,0,0.3)`
        : '0 4px 20px rgba(0,0,0,0.2)',
      transition: 'background-color 0.3s',
    }}>
      {/* Letter badge */}
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: badgeBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontFamily: FONTS.heading, fontWeight: 800,
        color: TEXT,
        flexShrink: 0,
      }}>
        {label}
      </div>
      <span style={{
        fontSize, fontFamily: FONTS.text, fontWeight: 600,
        color: TEXT, flex: 1, opacity: textOpacity,
        lineHeight: 1.2,
        // Long options wrap to 2 lines instead of overflowing the card width.
        whiteSpace: 'normal', wordBreak: 'break-word',
      }}>
        {text}
      </span>
      {/* Checkmark or X */}
      {revealed && (
        <span style={{
          fontSize: 28, opacity: revealProgress,
          color: isCorrect ? CORRECT : ACCENT,
        }}>
          {isCorrect ? '\u2713' : '\u2717'}
        </span>
      )}
    </div>
  );
};

// ── Key Phrase Reveal (tighter: max 3 phrases, 3s each) ──────────────
const KeyPhraseReveal: React.FC<{
  phrases: string[];
  startFrame: number;
  bigStat: { number: string; context: string } | null;
  beatAlignFrames?: number;
}> = ({ phrases, startFrame, bigStat, beatAlignFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Each phrase gets ~3 seconds (90 frames), big stat gets 2s (60 frames)
  const bigStatDuration = bigStat ? 60 : 0;
  const phraseDuration = beatAlignFrames ?? 90;

  return (
    <div style={{
      position: 'absolute', top: 950, left: 50, right: 50,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {/* Big stat number — 2 seconds, centered, HUGE, animated tick-up */}
      {bigStat && (() => {
        const statEntry = startFrame + 10;
        const age = frame - statEntry;
        if (age < 0) return null;
        const s = spring({ frame: age, fps, config: { stiffness: 160, damping: 12, mass: 0.6 } });
        const fadeOut = interpolate(age, [bigStatDuration - 15, bigStatDuration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

        // Parse the number: prefix + numeric + suffix
        const parseMatch = bigStat.number.match(/^([^\d]*)([\d,.]+)(.*)$/);
        let displayValue: string;
        let countCompletePulse = 1;
        if (parseMatch) {
          const prefix = parseMatch[1];
          const digitGroup = parseMatch[2].replace(/,/g, '');
          const suffix = parseMatch[3];
          const targetValue = parseFloat(digitGroup);
          const isInteger = !digitGroup.includes('.');

          const tickProgress = interpolate(age, [0, 45], [0, targetValue], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          let formatted: string;
          if (isInteger) {
            formatted = String(Math.round(tickProgress));
          } else {
            formatted = tickProgress.toFixed(1);
          }

          // If original had thousands separators, re-add them when integer
          if (isInteger && parseMatch[2].includes(',')) {
            formatted = Number(formatted).toLocaleString('en-US');
          }

          displayValue = `${prefix}${formatted}${suffix}`;

          // Scale pulse when count completes: frames 45 → 52 → 60 → scale 1 → 1.08 → 1
          if (age >= 45 && age <= 60) {
            countCompletePulse = age <= 52
              ? interpolate(age, [45, 52], [1, 1.08], { extrapolateRight: 'clamp' })
              : interpolate(age, [52, 60], [1.08, 1], { extrapolateRight: 'clamp' });
          }
        } else {
          displayValue = bigStat.number;
        }

        return (
          <div style={{
            opacity: interpolate(s, [0, 1], [0, 1]) * fadeOut,
            transform: `scale(${interpolate(s, [0, 1], [0.5, 1]) * countCompletePulse})`,
            textAlign: 'center',
            marginBottom: 8,
          }}>
            <span style={{
              fontSize: 90, fontFamily: FONTS.heading, fontWeight: 900,
              color: YELLOW,
              textShadow: `0 0 40px rgba(251, 191, 36, 0.4)`,
              letterSpacing: -2,
            }}>
              {displayValue}
            </span>
            <br />
            <span style={{
              fontSize: 28, fontFamily: FONTS.text, fontWeight: 600,
              color: MUTED, textTransform: 'uppercase', letterSpacing: 2,
            }}>
              {bigStat.context}
            </span>
          </div>
        );
      })()}

      {/* Key phrases — staggered entry, max 3, 3s each */}
      {phrases.map((phrase, i) => {
        const phraseStart = startFrame + bigStatDuration + i * phraseDuration + 15;
        const age = frame - phraseStart;
        if (age < 0) return null;
        const s = spring({ frame: age, fps, config: { stiffness: 180, damping: 14, mass: 0.5 } });

        // Highlight key words in the phrase
        const highlighted = phrase.replace(
          /(NOT|NEVER|WRONG|LOST|EVERY|ALWAYS|ALL|ONLY|MOST|CRITICAL|ZERO|NONE)/gi,
          '\u00AB$1\u00BB'
        );
        const parts = highlighted.split(/\u00AB|\u00BB/);

        return (
          <div key={i} style={{
            opacity: interpolate(s, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
            fontSize: 30, fontFamily: FONTS.text, fontWeight: 600,
            color: TEXT, lineHeight: 1.35,
            padding: '10px 16px',
            borderLeft: `3px solid ${CYAN}`,
            backgroundColor: 'rgba(34, 211, 238, 0.06)',
            borderRadius: '0 8px 8px 0',
          }}>
            {parts.map((part, j) => (
              <span key={j} style={{
                color: j % 2 === 1 ? YELLOW : TEXT,
                fontWeight: j % 2 === 1 ? 900 : 600,
              }}>
                {part}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
};

// ── Per-beat background pulse (re-engagement signal) ─────────────────
const BeatBackground: React.FC<{
  beatIndex: number;
  beatStartFrame: number;
  beatDurationFrames: number;
}> = ({ beatIndex, beatStartFrame, beatDurationFrames }) => {
  const frame = useCurrentFrame();
  const age = frame - beatStartFrame;
  if (age < 0 || age > beatDurationFrames) return null;
  const colors = ['rgba(34, 211, 238, 0.12)', 'rgba(251, 191, 36, 0.12)', 'rgba(255, 68, 68, 0.12)'];
  const color = colors[beatIndex % colors.length];
  const opacity = interpolate(age, [0, 8, beatDurationFrames - 10, beatDurationFrames], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: `radial-gradient(ellipse at 50% 70%, ${color} 0%, transparent 60%)`,
      opacity,
      pointerEvents: 'none',
      zIndex: 6,
    }} />
  );
};

// ── Animated Grid Background ─────────────────────────────────────────
const GridBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const gridOffset = (frame * 0.3) % 40;
  return (
    <div style={{
      position: 'absolute', inset: 0, opacity: 0.04,
      backgroundImage: `
        linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
      `,
      backgroundSize: '40px 40px',
      backgroundPosition: `${gridOffset}px ${gridOffset}px`,
      pointerEvents: 'none',
    }} />
  );
};

// ── Scan Line Effect ────────────────────────────────────────────────
const ScanLine: React.FC = () => {
  const frame = useCurrentFrame();
  const y = (frame * 4) % 1920;
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: y, height: 2,
      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
      pointerEvents: 'none', zIndex: 50,
    }} />
  );
};

// ── Topic Diagram Component ──────────────────────────────────────────
const TopicDiagram: React.FC<{
  topic: string;
  entryFrame: number;
  opacity?: number;
  scale?: number;
  yOffset?: number;
}> = ({ topic, entryFrame, opacity = 1, scale = 1, yOffset = 0 }) => {
  const diagram = useMemo(() => getTopicDiagram(topic), [topic]);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      opacity,
      transform: `scale(${scale}) translateY(${yOffset}px)`,
      pointerEvents: 'none',
    }}>
      {/* Nodes */}
      {diagram.nodes.map((node, i) => (
        <AnimatedBox
          key={node.label}
          label={node.label}
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          color={node.color}
          entryFrame={entryFrame + i * 8}
        />
      ))}
      {/* Arrows */}
      {diagram.arrows.map((arrow, i) => (
        <AnimatedArrow
          key={i}
          from={arrow.from}
          to={arrow.to}
          label={arrow.label}
          startFrame={entryFrame + diagram.nodes.length * 8 + i * 6}
          color="rgba(255,255,255,0.5)"
        />
      ))}
    </div>
  );
};

// ── SFX helper ───────────────────────────────────────────────────────
const Sfx: React.FC<{ name: string; from: number; durationFrames?: number; volume?: number }> = ({
  name, from, durationFrames = 30, volume = 1,
}) => (
  <Sequence from={from} durationInFrames={durationFrames}>
    <Audio src={staticFile(`audio/sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);

// ── Lottie Wrapper (loads from staticFile) ───────────────────────────
const LottieOverlay: React.FC<{
  file: string;
  style?: React.CSSProperties;
  loop?: boolean;
  playbackRate?: number;
}> = ({ file, style = {}, loop = true, playbackRate = 1 }) => {
  const [animationData, setAnimationData] = React.useState<LottieAnimationData | null>(null);

  React.useEffect(() => {
    fetch(staticFile(file))
      .then(r => r.json())
      .then(data => setAnimationData(data))
      .catch(() => {/* silently fail — visual nice-to-have */});
  }, [file]);

  if (!animationData) return null;

  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      playbackRate={playbackRate}
      style={{
        position: 'absolute',
        ...style,
      }}
    />
  );
};

// ── Dramatic Flash ──────────────────────────────────────────────────
const DramaticFlash: React.FC<{ triggerFrame: number; color?: string }> = ({
  triggerFrame, color = ACCENT,
}) => {
  const frame = useCurrentFrame();
  const age = frame - triggerFrame;
  if (age < 0 || age > 15) return null;
  const opacity = interpolate(age, [0, 3, 15], [0.6, 0.4, 0]);
  return (
    <div style={{
      position: 'absolute', inset: 0,
      backgroundColor: color,
      opacity,
      pointerEvents: 'none',
      zIndex: 40,
    }} />
  );
};

// ── Flash Cut Effect (replaces countdown) ───────────────────────────
// 15 frames total: 5 BLACK → 5 WHITE → 5 reveal (handled by next phase)
const FlashCut: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const age = frame - startFrame;
  if (age < 0 || age >= 15) return null;

  if (age < 5) {
    // Frames 1-5: BLACK
    return (
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: '#000000',
        zIndex: 60,
      }} />
    );
  } else if (age < 10) {
    // Frames 6-10: WHITE flash
    const whiteOpacity = interpolate(age, [5, 7, 10], [1, 0.9, 0.3]);
    return (
      <div style={{
        position: 'absolute', inset: 0,
        backgroundColor: '#FFFFFF',
        opacity: whiteOpacity,
        zIndex: 60,
      }} />
    );
  }
  // Frames 11-15: fade to transparent (reveal)
  const fadeOut = interpolate(age, [10, 15], [0.3, 0]);
  return (
    <div style={{
      position: 'absolute', inset: 0,
      backgroundColor: '#FFFFFF',
      opacity: fadeOut,
      zIndex: 60,
    }} />
  );
};

// ── Feature B: Sticky Question Strip ─────────────────────────────────
const StickyQuestionStrip: React.FC<{ question: string; startFrame: number }> = ({
  question, startFrame,
}) => {
  const frame = useCurrentFrame();
  const age = frame - startFrame;
  if (age < 0) return null;
  const slide = interpolate(age, [0, 15], [-100, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      height: 70,
      backgroundColor: 'rgba(10, 10, 18, 0.88)',
      backdropFilter: 'blur(20px)',
      borderBottom: '2px solid rgba(251, 191, 36, 0.3)',
      zIndex: 80,
      transform: `translateY(${slide}%)`,
      display: 'flex',
      alignItems: 'center',
      padding: '14px 70px',
    }}>
      <span style={{
        fontSize: 22,
        fontFamily: FONTS.heading,
        fontWeight: 700,
        color: '#fff',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        width: '100%',
      }}>
        {`❓ ${question}`}
      </span>
    </div>
  );
};

// ── Feature C: Countdown Timer ───────────────────────────────────────
const CountdownTimer: React.FC<{ startFrame: number; durationFrames: number }> = ({
  startFrame, durationFrames,
}) => {
  const frame = useCurrentFrame();
  const age = frame - startFrame;
  if (age < 0 || age > durationFrames) return null;

  const size = 120;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = Math.min(1, age / durationFrames);
  const dashOffset = circumference * progress;

  // Compute seconds remaining (3...2...1...0)
  const totalSeconds = Math.ceil(durationFrames / 30);
  const elapsedSeconds = age / 30;
  const remainingSeconds = Math.max(0, Math.ceil(totalSeconds - elapsedSeconds));

  // Ring color transitions: cyan → yellow at midpoint → red in final second
  let strokeColor = '#22D3EE';
  if (progress >= 0.5 && progress < (durationFrames - 30) / durationFrames) {
    strokeColor = '#FBBF24';
  } else if (age >= durationFrames - 30) {
    strokeColor = '#FF4444';
  }

  // Pulse on each second change — pulse triggered when crossing a second boundary
  const secondFrame = age % 30;
  const pulseScale = interpolate(secondFrame, [0, 6, 12], [1.15, 1.0, 1.0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });

  return (
    <div style={{
      position: 'absolute',
      top: 110,
      right: 30,
      width: size,
      height: size,
      zIndex: 82,
    }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="rgba(10, 10, 18, 0.6)"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        {/* Drain ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 8px ${strokeColor})` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 42,
        fontFamily: FONTS.heading,
        fontWeight: 900,
        color: strokeColor,
        transform: `scale(${pulseScale})`,
        textShadow: `0 0 12px ${strokeColor}`,
      }}>
        {remainingSeconds}
      </div>
    </div>
  );
};

// ── Feature P1: Emoji Burst Layer ────────────────────────────────────
// Float a large emoji over the explain phase at the moment specific power
// words are spoken. Deterministic positions cycle to avoid overlap.
const EMOJI_POSITIONS: Array<{ top: string; left: string }> = [
  { top: '18%', left: '12%' },   // top-left
  { top: '18%', left: '70%' },   // top-right
  { top: '38%', left: '8%' },    // middle-left
  { top: '38%', left: '74%' },   // middle-right
  { top: '58%', left: '14%' },   // lower-left
  { top: '58%', left: '68%' },   // lower-right
];

// Order matters: longer/more specific patterns first so $10M wins over generic numbers.
const POWER_WORD_RULES: Array<{ re: RegExp; emoji: string }> = [
  { re: /\$[\d,]+\s*[MB]\b/i, emoji: '💰' },
  { re: /\b(?:WRONG|FAIL|FAILED)\b/, emoji: '💀' },
  { re: /\b(?:LOST|LOSE|LOSING)\b/, emoji: '💸' },
  { re: /\b(?:TRILLION|BILLION)\b/i, emoji: '🚀' },
  { re: /\b(?:CRITICAL|URGENT|DANGER)\b/, emoji: '⚠️' },
  { re: /\b(?:NEVER|ZERO)\b/, emoji: '❌' },
  { re: /\b(?:ALWAYS|EVERY)\b/, emoji: '✅' },
  { re: /\bKAFKA\b/i, emoji: '📨' },
  { re: /\b(?:BUG|CRASH|OUTAGE)\b/i, emoji: '💥' },
];

function matchPowerEmoji(word: string): string | null {
  for (const rule of POWER_WORD_RULES) {
    if (rule.re.test(word)) return rule.emoji;
  }
  return null;
}

const EmojiBurstLayer: React.FC<{
  wordTimestamps: Array<{ word: string; start: number; end: number }>;
  audioOffsetFrames?: number;
}> = ({ wordTimestamps, audioOffsetFrames = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pre-compute matches (deterministic).
  const matches = useMemo(() => {
    const out: Array<{ emoji: string; startFrame: number; posIndex: number }> = [];
    let idx = 0;
    for (const wt of wordTimestamps) {
      const emoji = matchPowerEmoji(wt.word);
      if (!emoji) continue;
      out.push({
        emoji,
        startFrame: Math.round(wt.start * fps) + audioOffsetFrames,
        posIndex: idx % EMOJI_POSITIONS.length,
      });
      idx++;
    }
    return out;
  }, [wordTimestamps, fps, audioOffsetFrames]);

  return (
    <>
      {matches.map((m, i) => {
        const age = frame - m.startFrame;
        if (age < 0 || age >= 18) return null;
        const pos = EMOJI_POSITIONS[m.posIndex];
        // Spring scale 0 → 1.2 → 1 → 0 across 18 frames.
        let scale: number;
        if (age < 6) {
          scale = interpolate(age, [0, 6], [0, 1.2]);
        } else if (age < 12) {
          scale = interpolate(age, [6, 12], [1.2, 1]);
        } else {
          scale = interpolate(age, [12, 18], [1, 0]);
        }
        const opacity = interpolate(age, [0, 3, 14, 18], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        return (
          <div
            key={`emoji-${i}-${m.startFrame}`}
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              fontSize: 200,
              lineHeight: 1,
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              opacity,
              pointerEvents: 'none',
              zIndex: 33,
              textShadow: '0 0 30px rgba(0,0,0,0.5)',
              filter: 'drop-shadow(0 0 12px rgba(0,0,0,0.4))',
            }}
          >
            {m.emoji}
          </div>
        );
      })}
    </>
  );
};

// ── Feature H: Answer Splash Card ────────────────────────────────────
const AnswerSplashCard: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const age = frame - startFrame;
  if (age < 0 || age >= 15) return null;

  const s = spring({ frame: age, fps, config: { stiffness: 200, damping: 12, mass: 0.5 } });
  // Scale from 0.5 → 1.1 → 1.0 over 15 frames
  const scale = age < 8
    ? interpolate(s, [0, 1], [0.5, 1.1])
    : interpolate(age, [8, 15], [1.1, 1.0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: 'rgba(16, 185, 129, 0.92)',
      zIndex: 65,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <span style={{
        fontSize: 140,
        fontFamily: FONTS.heading,
        fontWeight: 900,
        color: '#fff',
        textTransform: 'uppercase',
        letterSpacing: -3,
        textShadow: '0 8px 30px rgba(0,0,0,0.5), 0 0 60px rgba(0,0,0,0.3)',
        transform: `scale(${scale})`,
      }}>
        {'▼ ANSWER'}
      </span>
    </AbsoluteFill>
  );
};

// ── Loop Trigger (Zeigarnik effect — incomplete thought) ────────────
const LoopTrigger: React.FC<{ startFrame: number; twistText: string }> = ({ startFrame, twistText }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const age = frame - startFrame;
  if (age < 0) return null;

  // 0-1s: "But wait..."
  // 1-2.5s: per-quiz twist line (was hardcoded — now uses quiz.twist)

  const phase1End = 1 * fps;       // 30 frames
  const phase2End = 2.5 * fps;     // 75 frames

  // Truncate twist to one screen-readable sentence. Highlight first ALL-CAPS
  // power-word found (WRONG / NEVER / NOT / EVERY / ONLY etc).
  const sentence = (twistText.split(/[.!?]/)[0] ?? twistText).trim();
  const truncated = sentence.length > 90 ? sentence.slice(0, 87) + '...' : sentence;
  const powerWordMatch = truncated.match(/\b(NOT|NEVER|WRONG|LOST|EVERY|ALWAYS|ALL|ONLY|MOST|CRITICAL|ZERO|NONE)\b/);
  const before = powerWordMatch ? truncated.slice(0, powerWordMatch.index) : truncated;
  const power = powerWordMatch ? powerWordMatch[0] : '';
  const after = powerWordMatch ? truncated.slice((powerWordMatch.index ?? 0) + power.length) : '';

  if (age < phase1End) {
    // "But wait..."
    const s = spring({ frame: age, fps, config: { stiffness: 250, damping: 12, mass: 0.4 } });
    return (
      <AbsoluteFill style={{ zIndex: 55 }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundColor: 'rgba(10, 10, 18, 0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 72, fontFamily: FONTS.heading, fontWeight: 900,
            color: YELLOW,
            opacity: interpolate(s, [0, 1], [0, 1]),
            transform: `scale(${interpolate(s, [0, 1], [0.5, 1.05])})`,
            textShadow: `0 0 40px rgba(251, 191, 36, 0.5)`,
          }}>
            But wait...
          </span>
        </div>
      </AbsoluteFill>
    );
  }

  if (age < phase2End) {
    // "Most tutorials teach you the WRONG default..."
    const textAge = age - phase1End;
    const s = spring({ frame: textAge, fps, config: { stiffness: 200, damping: 14, mass: 0.5 } });
    return (
      <AbsoluteFill style={{ zIndex: 55 }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundColor: 'rgba(10, 10, 18, 0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 60px',
        }}>
          <div style={{
            opacity: interpolate(s, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(s, [0, 1], [20, 0])}px)`,
            textAlign: 'center',
          }}>
            <span style={{
              fontSize: 44, fontFamily: FONTS.heading, fontWeight: 800,
              color: TEXT, lineHeight: 1.3,
            }}>
              {before}
              {power && (
                <span style={{ color: ACCENT, textDecoration: 'underline' }}>{power}</span>
              )}
              {after}
            </span>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  return null;
};

// ══════════════════════════════════════════════════════════════════════
// ── Main Composition ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
export const QuizShort: React.FC<QuizShortProps> = ({ quiz, audioFile, wordTimestamps }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: TOTAL_FRAMES } = useVideoConfig();

  // v3: ABSOLUTE phase boundaries (not ratios). Hook/question/flash/loop/cta
  // do NOT scale with total length. The slack between baseline 120s and actual
  // audio length is absorbed by the middle three phases (code, explain, example).
  const HOOK_END = Math.round(HOOK_END_S * fps);
  const QUESTION_END = Math.round(QUESTION_END_S * fps);
  const FLASH_END = Math.round(FLASH_END_S * fps);
  const ANSWER_SPLASH_END = Math.round(ANSWER_SPLASH_END_S * fps);
  // Baseline boundaries for middle three phases.
  const BASE_CODE_END = Math.round(CODE_END_S * fps);
  const BASE_EXPLAIN_END = Math.round(EXPLAIN_END_S * fps);
  const BASE_EXAMPLE_END = Math.round(EXAMPLE_END_S * fps);
  // Loop/end-cta are anchored to the END of the composition, NOT the baseline.
  const END_CTA_FRAMES = Math.round(END_CTA_DURATION_S * fps);
  const LOOP_DURATION = Math.round((LOOP_END_S - EXAMPLE_END_S) * fps); // 6s
  const END_CTA_START = TOTAL_FRAMES - END_CTA_FRAMES;
  const LOOP_START_FRAME = END_CTA_START - LOOP_DURATION;
  // Stretch the middle phases proportionally to fill (TOTAL - hook/question/flash/loop/cta).
  const FIXED_HEAD = ANSWER_SPLASH_END; // 14s of fixed head
  const FIXED_TAIL = LOOP_DURATION + END_CTA_FRAMES; // 10s of fixed tail
  const middleAvailable = Math.max(1, TOTAL_FRAMES - FIXED_HEAD - FIXED_TAIL);
  const baseMiddle = BASE_EXAMPLE_END - FIXED_HEAD; // 96s baseline middle
  const stretch = middleAvailable / baseMiddle;
  const CODE_END = FIXED_HEAD + Math.round((BASE_CODE_END - FIXED_HEAD) * stretch);
  const EXPLAIN_END = FIXED_HEAD + Math.round((BASE_EXPLAIN_END - FIXED_HEAD) * stretch);
  const EXAMPLE_END = FIXED_HEAD + middleAvailable;

  const isHookPhase = frame < HOOK_END;
  const isQuestionPhase = frame >= HOOK_END && frame < QUESTION_END;
  const isFlashPhase = frame >= QUESTION_END && frame < FLASH_END;
  const isAnswerSplashPhase = frame >= FLASH_END && frame < ANSWER_SPLASH_END;
  const isCodePhase = frame >= ANSWER_SPLASH_END && frame < CODE_END;
  const isExplainPhase = frame >= CODE_END && frame < EXPLAIN_END;
  const isExamplePhase = frame >= EXPLAIN_END && frame < EXAMPLE_END;
  const isLoopPhase = frame >= LOOP_START_FRAME && frame < END_CTA_START;
  const isEndCtaPhase = frame >= END_CTA_START;
  const isRevealed = frame >= FLASH_END;
  // Diagram hidden during code phase and worked-example phase — those phases
  // have their own visual content. Visible during question + explain only.
  const showDiagram =
    frame >= HOOK_END && (isQuestionPhase || isFlashPhase || isAnswerSplashPhase || isExplainPhase);

  // v3: keyPhrases/KeyPhraseReveal are kept defined above but no longer rendered;
  // ExplanationBeats now walks the full explanation sentence-by-sentence.
  const bigStat = useMemo(() => extractBigStat(quiz.explanation), [quiz.explanation]);
  const hookText = useMemo(() => pickHook(quiz, hashStr(quiz.title + quiz.topic)), [quiz]);

  const avatarSrc = staticFile('images/guru-avatar-crop.png');

  // Diagram fades to background during explain/loop
  const diagramOpacity = isExplainPhase || isLoopPhase
    ? interpolate(frame, [FLASH_END, FLASH_END + 30], [1, 0.2], { extrapolateRight: 'clamp' })
    : 1;

  return (
    <AbsoluteFill style={{ background: BG_GRADIENT, width: 1080, height: 1920 }}>
      {/* Animated grid background */}
      <GridBackground />
      <ScanLine />

      {/* Feature B: Sticky question strip — visible from HOOK_END onwards */}
      <StickyQuestionStrip question={quiz.question} startFrame={HOOK_END} />

      {/* Feature C: Countdown timer — fills question phase */}
      <CountdownTimer
        startFrame={HOOK_END + 30}
        durationFrames={Math.max(1, QUESTION_END - HOOK_END - 30)}
      />

      {/* ═══════════════════════════════════════════════════════════════
          Phase 1: HOOK (0-2s) — Lottie + bold text + avatar + vignette
          ═══════════════════════════════════════════════════════════════ */}
      {isHookPhase && (
        <AbsoluteFill style={{ zIndex: 10 }}>
          <PulsingVignette />

          {/* Fire Lottie behind text */}
          <LottieOverlay
            file="lottie/fire.json"
            style={{
              width: 500, height: 500,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -60%)',
              opacity: 0.35,
            }}
            playbackRate={0.8}
          />

          {/* Hook text — uses specific hook */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {(() => {
              const s = spring({ frame, fps, config: { stiffness: 180, damping: 12, mass: 0.7 } });
              // Frame 0 must be fully opaque so in-feed previews show readable text
              const opacity = interpolate(s, [0, 1], [1, 1]);
              const scale = interpolate(s, [0, 1], [0.95, 1]);
              const lines = hookText.split('\n');
              // Auto-fit font size by line count (88/70/58 for 1-2, 3, 4+ lines)
              const autoFontSize = lines.length <= 2 ? 88 : lines.length === 3 ? 70 : 58;
              return (
                <div style={{
                  transform: `scale(${scale})`,
                  opacity,
                  textAlign: 'center',
                  padding: '0 50px',
                }}>
                  {lines.map((line, i) => (
                    <div key={i} style={{
                      fontSize: autoFontSize,
                      fontFamily: FONTS.heading,
                      fontWeight: 900,
                      color: i === 0 ? TEXT : ACCENT,
                      lineHeight: 1.05,
                      textTransform: 'uppercase',
                      textShadow: '0 4px 30px rgba(0,0,0,0.8), 0 0 60px rgba(255,68,68,0.3)',
                      letterSpacing: -2,
                    }}>
                      {line}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Avatar in hook — bottom center for thumbnail */}
          <div style={{
            position: 'absolute', bottom: 350, left: '50%',
            transform: 'translateX(-50%)',
            width: 110, height: 110, borderRadius: '50%',
            overflow: 'hidden',
            border: `3px solid ${ACCENT}`,
            boxShadow: `0 0 20px rgba(255, 68, 68, 0.4)`,
          }}>
            <Img src={avatarSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          {/* Red accent bar — top only (declutter) */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 6,
            background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
          }} />
        </AbsoluteFill>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          Phase 2+: Question + Diagram visible from 2s onward
          ═══════════════════════════════════════════════════════════════ */}
      {showDiagram && (
        <AbsoluteFill style={{ zIndex: 10 }}>

          {/* ── Topic Diagram (visible throughout) ── */}
          <TopicDiagram
            topic={quiz.topic}
            entryFrame={HOOK_END}
            opacity={diagramOpacity}
            yOffset={-80}
          />

          {/* ── Question text with frosted glass card ── */}
          {(() => {
            const qAge = frame - HOOK_END;
            const qSpring = spring({ frame: qAge, fps, config: { stiffness: 200, damping: 16, mass: 0.5 } });
            return (
              <div style={{
                position: 'absolute', top: 80, left: 40, right: 40,
                opacity: interpolate(qSpring, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(qSpring, [0, 1], [-30, 0])}px)`,
              }}>
                <div style={{
                  background: 'rgba(20, 20, 40, 0.85)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: 20,
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '24px 28px',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
                }}>
                  {/* Topic badge */}
                  <div style={{
                    fontSize: 14, fontFamily: FONTS.heading, fontWeight: 700,
                    color: CYAN, textTransform: 'uppercase', letterSpacing: 3,
                    marginBottom: 10,
                  }}>
                    {quiz.topic.replace(/-/g, ' ')}
                  </div>
                  <div style={{
                    fontSize: 34, fontFamily: FONTS.heading, fontWeight: 700,
                    color: TEXT, lineHeight: 1.25,
                  }}>
                    {quiz.question}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Options (below diagram area) ── */}
          <div style={{
            position: 'absolute',
            top: isExplainPhase || isLoopPhase ? 520 : 560,
            left: 40, right: 40,
          }}>
            {quiz.options.map((opt, i) => (
              <OptionCard
                key={i}
                label={String.fromCharCode(65 + i)}
                text={opt}
                index={i}
                revealed={isRevealed}
                isCorrect={i === quiz.correctIndex}
                compact={isExplainPhase || isLoopPhase}
                hookEnd={HOOK_END}
                flashEnd={FLASH_END}
              />
            ))}
          </div>

          {/* ═══════════════════════════════════════════════════════════
              Phase 3: FLASH CUT (6-6.5s) — BLACK → WHITE → Reveal
              ═══════════════════════════════════════════════════════════ */}
          <FlashCut startFrame={QUESTION_END} />

          {/* Feature H: ANSWER splash card — 15 frames at FLASH_END */}
          <AnswerSplashCard startFrame={FLASH_END} />

          {/* ═══════════════════════════════════════════════════════════
              Phase 4 + 6: REVEAL flash (right after FLASH_END) and
              EXPLAIN BEATS (30-80s). Confetti + green flash anchored to
              ANSWER_SPLASH_END so they still fire on reveal.
              ═══════════════════════════════════════════════════════════ */}
          {(isAnswerSplashPhase || isCodePhase) && (
            <>
              {/* Confetti burst on reveal */}
              {frame - ANSWER_SPLASH_END >= 0 && frame - ANSWER_SPLASH_END < 60 && (
                <LottieOverlay
                  file="lottie/confetti.json"
                  style={{
                    width: 600, height: 600,
                    top: 400, left: '50%',
                    transform: 'translateX(-50%)',
                    opacity: interpolate(frame - ANSWER_SPLASH_END, [0, 10, 50, 60], [0, 0.8, 0.6, 0]),
                  }}
                  loop={false}
                />
              )}
              {/* Green flash on reveal */}
              <DramaticFlash triggerFrame={ANSWER_SPLASH_END} color="rgba(16, 185, 129, 0.3)" />
            </>
          )}

          {isExplainPhase && (
            <>
              {/* v3: full sentence-by-sentence walk-through */}
              <ExplanationBeats
                text={quiz.explanation}
                startFrame={CODE_END}
                durationFrames={Math.max(1, EXPLAIN_END - CODE_END)}
                bigStat={bigStat}
              />

              {/* Per-beat background pulses — recycle 3 beats across the span */}
              {[0, 1, 2].map(i => {
                const beatDur = Math.floor((EXPLAIN_END - CODE_END) / 3);
                return (
                  <BeatBackground
                    key={`beat-${i}`}
                    beatIndex={i}
                    beatStartFrame={CODE_END + i * beatDur}
                    beatDurationFrames={beatDur}
                  />
                );
              })}

              {/* Feature P1: Emoji bursts on power words (TRILLION/WRONG/$10M etc).
                  Renders within explain phase; uses absolute wordTimestamps so
                  timing is exact. zIndex 33 sits above captions, below answer splash. */}
              {wordTimestamps && wordTimestamps.length > 0 && (
                <EmojiBurstLayer wordTimestamps={wordTimestamps} />
              )}

              {/* Burned-in hormozi captions during explain phase.
                  wordTimestamps are absolute (start=0 is start of full narration:
                  spokenHook + question + explanation + twist). CaptionOverlay's
                  `text` is only the explanation, so we slice the timestamps to
                  the explanation window and rebase to zero, AND set startFrame
                  to the audio position where the explanation actually begins. */}
              {wordTimestamps && wordTimestamps.length > 0 && (() => {
                const prefixWords = `${quiz.spokenHook} ${quiz.question}`.split(/\s+/).filter(Boolean).length;
                const explanationWords = quiz.explanation.split(/\s+/).filter(Boolean).length;
                const slice = wordTimestamps.slice(prefixWords, prefixWords + explanationWords);
                if (slice.length === 0) return null;
                const offsetSec = slice[0].start;
                const rebased = slice.map(wt => ({
                  word: wt.word, start: wt.start - offsetSec, end: wt.end - offsetSec,
                }));
                const captionStartFrame = Math.round(offsetSec * fps);
                return (
                  <div style={{
                    // v3: moved from bottom:380 (collided with options at top:560-855)
                    // to bottom:170 (safe zone below options, above progress bar).
                    position: 'absolute', bottom: 170, left: 0, right: 0, zIndex: 30,
                  }}>
                    <CaptionOverlay
                      text={quiz.explanation}
                      startFrame={captionStartFrame}
                      durationInFrames={EXPLAIN_END - captionStartFrame}
                      wordTimestamps={rebased}
                      captionMode="hormozi"
                    />
                  </div>
                );
              })()}
            </>
          )}

          {/* Avatar — bottom right during question/explain phases */}
          {!isLoopPhase && (
            <div style={{
              position: 'absolute', bottom: 200, right: 30,
              width: 100, height: 100, borderRadius: '50%',
              overflow: 'hidden',
              border: `3px solid rgba(255,255,255,0.1)`,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}>
              <Img src={avatarSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          Phase 5: CODE SNIPPET (14-30s) — wrong vs right typewriter
          Renders only if the quiz has a codeSnippet payload.
          ═══════════════════════════════════════════════════════════════ */}
      {quiz.codeSnippet && (
        <CodeSnippetPanel
          snippet={quiz.codeSnippet}
          startFrame={ANSWER_SPLASH_END}
          durationFrames={Math.max(1, CODE_END - ANSWER_SPLASH_END)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          Phase 7: WORKED EXAMPLE (80-110s) — BEFORE/AFTER scenario
          Uses quiz.workedExample if provided; otherwise derives heuristically
          from the explanation, with the twist as a final fallback.
          ═══════════════════════════════════════════════════════════════ */}
      {isExamplePhase && (() => {
        const derived = quiz.workedExample ?? deriveWorkedExample(
          quiz.explanation, quiz.options as unknown as string[], quiz.correctIndex,
        );
        return (
          <WorkedExample
            data={derived}
            twistFallback={quiz.twist}
            startFrame={EXPLAIN_END}
            durationFrames={Math.max(1, EXAMPLE_END - EXPLAIN_END)}
          />
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════
          Phase 8: LOOP TRIGGER (last 6s before CTA) + END CTA (last 4s)
          v3: anchored to the END of composition, not after explain.
          ═══════════════════════════════════════════════════════════════ */}
      <LoopTrigger startFrame={LOOP_START_FRAME} twistText={quiz.twist} />
      <EndCardCTA
        endQuestion={quiz.endQuestion}
        startFrame={END_CTA_START}
        durationFrames={END_CTA_FRAMES}
      />

      {/* ── Audio ── */}
      {audioFile && (
        <Audio
          src={staticFile(`audio/${audioFile}`)}
          volume={(f) => {
            const fadeIn = interpolate(f, [0, 6], [0, 1], { extrapolateRight: 'clamp' });
            const fadeOut = interpolate(f, [TOTAL_FRAMES - 15, TOTAL_FRAMES], [1, 0], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });
            return fadeIn * fadeOut;
          }}
        />
      )}

      {/* ── BGM with sidechain ducking during narration ──
          Drops to 0.025 when a word is being spoken (within ±0.15s),
          rises to 0.09 during silence so the gap-fill effect is felt. */}
      <Audio
        src={staticFile('audio/bgm/study-pad.mp3')}
        loop
        volume={(f) => {
          if (!wordTimestamps || wordTimestamps.length === 0) return 0.06;
          const sec = f / fps;
          const speaking = wordTimestamps.some(wt => sec >= wt.start - 0.05 && sec <= wt.end + 0.15);
          return speaking ? 0.025 : 0.09;
        }}
      />

      {/* ── SFX cues ── */}
      <Sfx name="whoosh-in" from={0} volume={0.8} />
      <Sfx name="tension-build" from={HOOK_END} durationFrames={QUESTION_END - HOOK_END} volume={0.4} />
      <Sfx name="impact" from={FLASH_END - 5} durationFrames={20} volume={1.0} />
      <Sfx name="success-chime" from={FLASH_END} volume={0.7} />
      <Sfx name="riser" from={Math.max(0, FLASH_END + 5)} durationFrames={45} volume={0.5} />
      <Sfx name="swoosh" from={Math.max(0, LOOP_START_FRAME - 10)} durationFrames={20} volume={0.8} />

      {/* ── Channel logo bug (top-right, always visible) ── */}
      <div style={{
        position: 'absolute', top: 28, right: 28,
        zIndex: 95,
        padding: '6px 12px',
        borderRadius: 8,
        backgroundColor: 'rgba(10, 10, 18, 0.55)',
        border: '1px solid rgba(251, 191, 36, 0.4)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{
          fontSize: 16, fontFamily: FONTS.heading, fontWeight: 900,
          color: YELLOW, letterSpacing: 1.5, textTransform: 'uppercase',
        }}>
          guru-sishya
        </span>
      </div>

      {/* ── Progress bar ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        backgroundColor: 'rgba(255,255,255,0.06)', zIndex: 90,
      }}>
        <div style={{
          width: `${(frame / TOTAL_FRAMES) * 100}%`, height: '100%',
          background: `linear-gradient(90deg, ${ACCENT}, ${YELLOW})`,
          borderRadius: '0 2px 2px 0',
          boxShadow: `0 0 10px ${ACCENT}66`,
        }} />
      </div>
    </AbsoluteFill>
  );
};

// ── Metadata ────────────────────────────────────────────────────────
// v3: enforces a 120s baseline. Audio shorter than 120s -> composition is
// still 120s (fadeOut handles the silent tail). Audio longer -> composition
// grows to fit (audio + 1s tail).
export const calculateQuizShortMetadata: CalculateMetadataFunction<Record<string, unknown>> = ({ props }) => {
  const seconds = (props.audioDurationSec as number | undefined) ?? 0;
  const baselineFrames = DEFAULT_DURATION_S * FPS;
  const audioFrames = Math.ceil(seconds * FPS) + FPS; // audio + 1s tail
  return {
    durationInFrames: Math.max(baselineFrames, audioFrames),
    fps: FPS,
    width: 1080,
    height: 1920,
  };
};

export default QuizShort;
