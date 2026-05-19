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
import { Lottie } from '@remotion/lottie';
import type { LottieAnimationData } from '@remotion/lottie';
import type { QuizQuestion } from '../lib/quiz-content';
import { FONTS } from '../lib/theme';
import { AnimatedBox } from '../components/viz/AnimatedBox';
import { AnimatedArrow } from '../components/viz/AnimatedArrow';

const FPS = 30;
const TOTAL_DURATION_S = 25;
const TOTAL_FRAMES = FPS * TOTAL_DURATION_S;

// Phase timings (in frames at 30fps)
// Hook: 0-2s | Question+Options: 2-6s | Flash cut: 6-6.5s | Explain: 6.5-20s | Loop trigger: 20-25s
const HOOK_END = 2 * FPS;           // 60 frames — 0-2s
const QUESTION_END = 6 * FPS;       // 180 frames — 2-6s
const FLASH_END = QUESTION_END + 15; // 195 frames — 6-6.5s (15 frames = 0.5s)
const EXPLAIN_END = 20 * FPS;       // 600 frames — 6.5-20s
// LOOP_END = TOTAL_FRAMES          // 750 frames — 20-25s

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
  // All diagrams centered for 1080-wide, positioned in top area (~y: 280-480)
  const configs: Record<string, DiagramConfig> = {
    kafka: {
      nodes: [
        { label: 'Producer', x: 180, y: 320, width: 180, height: 70, color: 'blue' },
        { label: 'Kafka Broker', x: 540, y: 320, width: 200, height: 70, color: 'orange' },
        { label: 'Consumer', x: 900, y: 320, width: 180, height: 70, color: 'green' },
      ],
      arrows: [
        { from: { x: 270, y: 320 }, to: { x: 440, y: 320 }, label: 'publish' },
        { from: { x: 640, y: 320 }, to: { x: 810, y: 320 }, label: 'consume' },
      ],
    },
    'api-gateway': {
      nodes: [
        { label: 'Client', x: 540, y: 250, width: 160, height: 65, color: 'blue' },
        { label: 'API Gateway', x: 540, y: 370, width: 200, height: 70, color: 'orange' },
        { label: 'Auth', x: 250, y: 470, width: 140, height: 60, color: 'red' },
        { label: 'Service A', x: 540, y: 470, width: 160, height: 60, color: 'green' },
        { label: 'Service B', x: 830, y: 470, width: 160, height: 60, color: 'teal' },
      ],
      arrows: [
        { from: { x: 540, y: 283 }, to: { x: 540, y: 335 } },
        { from: { x: 440, y: 405 }, to: { x: 320, y: 440 } },
        { from: { x: 540, y: 405 }, to: { x: 540, y: 440 } },
        { from: { x: 640, y: 405 }, to: { x: 760, y: 440 } },
      ],
    },
    'load-balancing': {
      nodes: [
        { label: 'Clients', x: 540, y: 250, width: 160, height: 65, color: 'blue' },
        { label: 'Load Balancer', x: 540, y: 370, width: 210, height: 70, color: 'gold' },
        { label: 'Server 1', x: 250, y: 470, width: 160, height: 60, color: 'green' },
        { label: 'Server 2', x: 540, y: 470, width: 160, height: 60, color: 'green' },
        { label: 'Server 3', x: 830, y: 470, width: 160, height: 60, color: 'green' },
      ],
      arrows: [
        { from: { x: 540, y: 283 }, to: { x: 540, y: 335 } },
        { from: { x: 435, y: 405 }, to: { x: 320, y: 440 } },
        { from: { x: 540, y: 405 }, to: { x: 540, y: 440 } },
        { from: { x: 645, y: 405 }, to: { x: 760, y: 440 } },
      ],
    },
    database: {
      nodes: [
        { label: 'Application', x: 540, y: 260, width: 190, height: 65, color: 'blue' },
        { label: 'Primary DB', x: 370, y: 400, width: 180, height: 65, color: 'orange' },
        { label: 'Replica DB', x: 720, y: 400, width: 180, height: 65, color: 'teal' },
      ],
      arrows: [
        { from: { x: 445, y: 293 }, to: { x: 370, y: 368 }, label: 'write' },
        { from: { x: 635, y: 293 }, to: { x: 720, y: 368 }, label: 'read' },
        { from: { x: 460, y: 400 }, to: { x: 630, y: 400 }, label: 'replicate' },
      ],
    },
  };

  // Default fallback: simple client-server diagram
  return configs[topic] || {
    nodes: [
      { label: 'Client', x: 300, y: 330, width: 170, height: 70, color: 'blue' },
      { label: 'Server', x: 780, y: 330, width: 170, height: 70, color: 'green' },
    ],
    arrows: [
      { from: { x: 385, y: 330 }, to: { x: 695, y: 330 }, label: 'request' },
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

// ── Get specific hook — extracts impressive stat from explanation ────
function getSpecificHook(quiz: QuizQuestion): string {
  // Topic-specific overrides for known high-performing hooks
  const topicHooks: Record<string, string> = {
    kafka: 'LinkedIn serves\n7 TRILLION messages/day\nwith THIS setting',
  };
  if (topicHooks[quiz.topic]) return topicHooks[quiz.topic];

  // Extract most impressive number from explanation to build a specific hook
  const bigMatch = quiz.explanation.match(/(\d[\d,.]*\s*(?:trillion|billion|million|thousand))\s+([\w\s]+?)(?:\.|,|and)/i);
  if (bigMatch) {
    const num = bigMatch[1].trim().toUpperCase();
    const ctx = bigMatch[2].trim();
    return `${num}\n${ctx}\nwith THIS setting`;
  }

  // Look for company names + dramatic context
  const companyMatch = quiz.explanation.match(/(Google|Netflix|Uber|LinkedIn|Meta|Amazon|Stripe|Cloudflare)\s+[\w\s]+?(?:\.|,)/i);
  if (companyMatch) {
    const company = companyMatch[0].replace(/[.,]$/, '').trim();
    if (company.length < 50) return `${company}\nbecause of THIS`;
  }

  // Fallback to original hookText
  return quiz.hookText;
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
}> = ({ label, text, index, revealed, isCorrect, compact = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entryFrame = HOOK_END + index * 6;
  const s = spring({
    frame: Math.max(0, frame - entryFrame),
    fps,
    config: { stiffness: 200, damping: 14, mass: 0.5 },
  });

  // After reveal: correct glows green, wrong fades
  const revealAge = frame - FLASH_END;
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
  const fontSize = compact ? 28 : 32;

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
}> = ({ phrases, startFrame, bigStat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Each phrase gets ~3 seconds (90 frames), big stat gets 2s (60 frames)
  const bigStatDuration = bigStat ? 60 : 0;
  const phraseDuration = 90;

  return (
    <div style={{
      position: 'absolute', top: 950, left: 50, right: 50,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {/* Big stat number — 2 seconds, centered, HUGE */}
      {bigStat && (() => {
        const statEntry = startFrame + 10;
        const age = frame - statEntry;
        if (age < 0) return null;
        const s = spring({ frame: age, fps, config: { stiffness: 160, damping: 12, mass: 0.6 } });
        const fadeOut = interpolate(age, [bigStatDuration - 15, bigStatDuration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <div style={{
            opacity: interpolate(s, [0, 1], [0, 1]) * fadeOut,
            transform: `scale(${interpolate(s, [0, 1], [0.5, 1])})`,
            textAlign: 'center',
            marginBottom: 8,
          }}>
            <span style={{
              fontSize: 90, fontFamily: FONTS.heading, fontWeight: 900,
              color: YELLOW,
              textShadow: `0 0 40px rgba(251, 191, 36, 0.4)`,
              letterSpacing: -2,
            }}>
              {bigStat.number}
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

// ── Loop Trigger (Zeigarnik effect — incomplete thought) ────────────
const LoopTrigger: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const age = frame - startFrame;
  if (age < 0) return null;

  // 0-1s: "But wait..."
  // 1-2.5s: "Most tutorials teach you the WRONG default..."
  // 2.5-5s: hard cut to black (loop)

  const phase1End = 1 * fps;       // 30 frames
  const phase2End = 2.5 * fps;     // 75 frames
  // Phase 3: black until end

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
              fontSize: 48, fontFamily: FONTS.heading, fontWeight: 800,
              color: TEXT, lineHeight: 1.3,
            }}>
              Most tutorials teach you the{' '}
              <span style={{ color: ACCENT, textDecoration: 'underline' }}>WRONG</span>
              {' '}default...
            </span>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // Hard cut to black — the video loops
  return (
    <AbsoluteFill style={{ zIndex: 55, backgroundColor: '#000000' }} />
  );
};

// ══════════════════════════════════════════════════════════════════════
// ── Main Composition ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════
export const QuizShort: React.FC<QuizShortProps> = ({ quiz, audioFile }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isHookPhase = frame < HOOK_END;
  const isQuestionPhase = frame >= HOOK_END && frame < QUESTION_END;
  const isFlashPhase = frame >= QUESTION_END && frame < FLASH_END;
  const isExplainPhase = frame >= FLASH_END && frame < EXPLAIN_END;
  const isLoopPhase = frame >= EXPLAIN_END;
  const isRevealed = frame >= FLASH_END;
  const showDiagram = frame >= HOOK_END;

  const keyPhrases = useMemo(() => extractKeyPhrases(quiz.explanation), [quiz.explanation]);
  const bigStat = useMemo(() => extractBigStat(quiz.explanation), [quiz.explanation]);
  const hookText = useMemo(() => getSpecificHook(quiz), [quiz]);

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

          {/* Warning triangle Lottie */}
          <LottieOverlay
            file="lottie/warning-triangle.json"
            style={{
              width: 200, height: 200,
              top: 280, left: '50%',
              transform: 'translateX(-50%)',
              opacity: 0.6,
            }}
          />

          {/* Hook text — uses specific hook */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {(() => {
              const s = spring({ frame, fps, config: { stiffness: 180, damping: 12, mass: 0.7 } });
              const lines = hookText.split('\n');
              return (
                <div style={{
                  transform: `scale(${interpolate(s, [0, 1], [0.6, 1])})`,
                  opacity: interpolate(s, [0, 1], [0, 1]),
                  textAlign: 'center',
                  padding: '0 50px',
                }}>
                  {lines.map((line, i) => (
                    <div key={i} style={{
                      fontSize: 88,
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
            width: 140, height: 140, borderRadius: '50%',
            overflow: 'hidden',
            border: `4px solid ${ACCENT}`,
            boxShadow: `0 0 30px rgba(255, 68, 68, 0.4)`,
          }}>
            <Img src={avatarSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>

          {/* Red accent bars — top and bottom */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 6,
            background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
          }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 6,
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
              />
            ))}
          </div>

          {/* ═══════════════════════════════════════════════════════════
              Phase 3: FLASH CUT (6-6.5s) — BLACK → WHITE → Reveal
              ═══════════════════════════════════════════════════════════ */}
          <FlashCut startFrame={QUESTION_END} />

          {/* ═══════════════════════════════════════════════════════════
              Phase 4: REVEAL + EXPLAIN (6.5-20s) — Confetti, key phrases
              ═══════════════════════════════════════════════════════════ */}
          {isExplainPhase && (
            <>
              {/* Confetti burst on reveal */}
              {frame - FLASH_END < 60 && (
                <LottieOverlay
                  file="lottie/confetti.json"
                  style={{
                    width: 600, height: 600,
                    top: 400, left: '50%',
                    transform: 'translateX(-50%)',
                    opacity: interpolate(frame - FLASH_END, [0, 10, 50, 60], [0, 0.8, 0.6, 0]),
                  }}
                  loop={false}
                />
              )}

              {/* Green flash on reveal */}
              <DramaticFlash triggerFrame={FLASH_END} color="rgba(16, 185, 129, 0.3)" />

              {/* Key phrases + big stat */}
              <KeyPhraseReveal
                phrases={keyPhrases}
                startFrame={FLASH_END}
                bigStat={bigStat}
              />
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
          Phase 5: LOOP TRIGGER (20-25s) — Zeigarnik effect
          ═══════════════════════════════════════════════════════════════ */}
      <LoopTrigger startFrame={EXPLAIN_END} />

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

      {/* ── BGM ── */}
      <Audio src={staticFile('audio/bgm/warm-ambient.mp3')} volume={0.06} loop />

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
export function calculateQuizShortMetadata() {
  return {
    durationInFrames: TOTAL_FRAMES,
    fps: FPS,
    width: 1080,
    height: 1920,
  };
}

export default QuizShort;
