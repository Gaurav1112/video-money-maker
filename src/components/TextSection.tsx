import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { useSync } from '../hooks/useSync';
import type { AnimationCue } from '../types';

interface TextSectionProps {
  heading?: string;
  bullets?: string[];
  content?: string;
  narration?: string;
  startFrame?: number;
  endFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: AnimationCue[];
}

// --- Mood detection ---
const MOOD_KEYWORDS = {
  problem: ['problem', 'issue', 'fail', 'error', 'bug', 'crash', 'wrong', 'bad', 'slow', 'expensive', 'complex', 'difficult', 'challenge', 'risk', 'danger', 'warning', 'critical', 'broken', 'lost', 'miss'],
  solution: ['solution', 'solve', 'fix', 'improve', 'fast', 'efficient', 'optimize', 'better', 'benefit', 'advantage', 'clean', 'elegant', 'simple', 'power', 'scalab', 'robust'],
  stat: ['million', 'billion', 'thousand', 'percent', 'crore', 'lakh', '%', '10x', '100x', '50x', '99.9'],
} as const;

function detectMood(sentence: string): 'problem' | 'solution' | 'stat' | 'neutral' {
  const lower = sentence.toLowerCase();
  // Check for numbers first — stats are the most visually impactful
  const hasNumber = /\d[\d,.]*[%xX]?(\s*(million|billion|thousand|crore|lakh))?/gi.test(sentence);
  if (hasNumber && MOOD_KEYWORDS.stat.some(k => lower.includes(k))) return 'stat';
  if (hasNumber) return 'stat';
  if (MOOD_KEYWORDS.problem.some(k => lower.includes(k))) return 'problem';
  if (MOOD_KEYWORDS.solution.some(k => lower.includes(k))) return 'solution';
  return 'neutral';
}

function getMoodGradient(mood: string): string {
  switch (mood) {
    case 'problem': return `radial-gradient(ellipse at 50% 80%, ${COLORS.red}12 0%, transparent 70%)`;
    case 'solution': return `radial-gradient(ellipse at 50% 80%, ${COLORS.teal}12 0%, transparent 70%)`;
    case 'stat': return `radial-gradient(ellipse at 50% 80%, ${COLORS.gold}10 0%, transparent 70%)`;
    default: return 'none';
  }
}

function getMoodAccent(mood: string): string {
  switch (mood) {
    case 'problem': return COLORS.red;
    case 'solution': return COLORS.teal;
    case 'stat': return COLORS.gold;
    default: return COLORS.saffron;
  }
}

// --- Number extraction & formatting ---
function extractNumbers(sentence: string): string[] {
  const matches = sentence.match(/\d[\d,.]*[%xX]?(\s*(million|billion|thousand|crore|lakh|ms|MB|GB|TB|KB))?/gi);
  return matches || [];
}

function extractKeyPhrase(sentence: string): string | null {
  // Pull out quoted phrases
  const quoted = sentence.match(/"([^"]+)"/);
  if (quoted) return quoted[1];
  // Look for meaningful multi-word phrases after connector words (must be 3+ words to qualify)
  const named = sentence.match(/(?:called|known as|is a|means|is the)\s+([A-Z][a-zA-Z]+(?:\s+[A-Za-z]+){2,})/);
  if (named) return named[1].trim();
  // Look for strong conceptual phrases: 3+ capitalised/important words in sequence
  const multiWord = sentence.match(/(?:[A-Z][a-zA-Z]+\s){2,}[A-Z][a-zA-Z]+/);
  if (multiWord) return multiWord[0].trim();
  return null;
}

// --- Keyword detection for highlighting ---
const HIGHLIGHT_WORDS = new Set([
  'important', 'key', 'critical', 'essential', 'fundamental', 'core',
  'always', 'never', 'must', 'every', 'all', 'only', 'best', 'worst',
  'first', 'last', 'main', 'primary', 'major', 'biggest', 'fastest',
  'remember', 'note', 'notice', 'observe', 'imagine', 'think',
]);

function shouldHighlight(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (HIGHLIGHT_WORDS.has(clean)) return true;
  // Highlight words that start with uppercase mid-sentence (proper nouns / tech terms)
  if (/^[A-Z][a-z]/.test(word) && word.length > 2) return true;
  // Highlight technical terms (camelCase, contains dots, all caps)
  if (/[a-z][A-Z]/.test(word) || /\./.test(word) || (/^[A-Z]{2,}$/.test(word) && word.length > 1)) return true;
  return false;
}

// --- Animated number counter ---
function AnimatedNumber({ value, frame, fps, delay }: { value: string; frame: number; fps: number; delay: number }) {
  const numericPart = parseFloat(value.replace(/[^0-9.]/g, ''));
  const suffix = value.replace(/[\d,.]/g, '').trim();
  const isPercentage = value.includes('%');
  const hasDecimal = value.includes('.');

  const countProgress = interpolate(
    frame - delay,
    [0, fps * 0.8],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Eased count-up
  const eased = 1 - Math.pow(1 - countProgress, 3); // easeOutCubic
  const currentNum = numericPart * eased;

  let display: string;
  if (isNaN(numericPart)) {
    display = value;
  } else if (hasDecimal) {
    const decimalPlaces = (value.split('.')[1] || '').replace(/[^0-9]/g, '').length;
    display = currentNum.toFixed(decimalPlaces);
  } else {
    display = Math.round(currentNum).toLocaleString();
  }

  if (isPercentage) display += '%';
  else if (suffix) display += ' ' + suffix;

  return <>{display}</>;
}

// =============================
// MAIN COMPONENT
// =============================
const TextSection: React.FC<TextSectionProps> = ({
  heading = '',
  bullets = [],
  content = '',
  narration = '',
  startFrame = 0,
  endFrame = 300,
  sceneIndex,
  sceneStartFrame,
  animationCues,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sync = useSync(sceneIndex ?? 0, sceneStartFrame ?? startFrame);
  const sceneDuration = endFrame - startFrame;

  // --- Parse narration into sentences ---
  const displayText = narration || content || '';
  const sentences = displayText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && s.length < 200);

  const displaySentences = sentences.length >= 2
    ? sentences.slice(0, 8)
    : bullets.length > 0
      ? bullets
      : ['...'];

  // --- Timing: which sentence is active ---
  const framesPerSentence = Math.max(fps * 1.5, Math.floor(sceneDuration / (displaySentences.length + 0.5)));
  const activeSentenceIndex = Math.min(
    displaySentences.length - 1,
    Math.floor(frame / framesPerSentence),
  );
  const sentenceLocalFrame = frame - activeSentenceIndex * framesPerSentence;

  const currentSentence = displaySentences[activeSentenceIndex] || '';
  const mood = detectMood(currentSentence);
  const moodAccent = getMoodAccent(mood);
  const numbers = extractNumbers(currentSentence);
  const keyPhrase = extractKeyPhrase(currentSentence);
  // A hero number must be meaningful: contains a digit and either a suffix (x, %, ms, MB…) or
  // is accompanied by a magnitude word ("million", "billion", etc.) — plain single-digit counts don't qualify.
  const hasHeroNumber = numbers.length > 0 && /\d[\d,.]*([%xX]|(\s*(million|billion|thousand|crore|lakh|ms|MB|GB|TB|KB))|\d{3,})/.test(numbers[0]);

  // --- Current narration word for karaoke ---
  const currentWord = sync.currentWord?.toLowerCase() || '';

  // =========================
  // ANIMATIONS
  // =========================

  // Heading entrance
  const headingY = interpolate(frame, [0, 20], [40, 0], { extrapolateRight: 'clamp' });
  const headingOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // Underline sweep
  const underlineWidth = interpolate(frame, [8, 35], [0, 280], { extrapolateRight: 'clamp' });

  // Sentence spring-in
  const sentenceSpring = spring({
    frame: sentenceLocalFrame,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });

  // Sentence slide from bottom
  const sentenceY = interpolate(sentenceSpring, [0, 1], [60, 0]);
  const sentenceOpacity = interpolate(sentenceSpring, [0, 1], [0, 1]);

  // Hero number / key phrase zoom
  const heroSpring = spring({
    frame: Math.max(0, sentenceLocalFrame - 8),
    fps,
    config: { damping: 12, stiffness: 80, mass: 1.2 },
  });
  const heroScale = interpolate(heroSpring, [0, 1], [0.3, 1]);
  const heroOpacity = interpolate(heroSpring, [0, 1], [0, 1]);

  // Glow pulse for hero element
  const glowPulse = Math.sin(frame * 0.08) * 0.3 + 0.7;

  // Background mood transition
  const moodOpacity = interpolate(sentenceLocalFrame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' });

  // --- Render sentence with word highlighting ---
  function renderHighlightedSentence(text: string, isCurrent: boolean, fontSize: number) {
    const words = text.split(/\s+/);
    return words.map((word, wi) => {
      const isSpoken = isCurrent && currentWord && word.toLowerCase().includes(currentWord);
      const isHighlight = shouldHighlight(word);
      const isNumber = /\d/.test(word);

      let color = isCurrent ? COLORS.white : `${COLORS.white}50`;
      let weight = isCurrent ? 500 : 400;
      let wordScale = 1;

      if (isCurrent && isSpoken) {
        color = COLORS.gold;
        weight = 700;
        wordScale = 1.05;
      } else if (isCurrent && isNumber) {
        color = COLORS.gold;
        weight = 800;
      } else if (isCurrent && isHighlight) {
        color = COLORS.saffron;
        weight = 700;
      }

      return (
        <span
          key={wi}
          style={{
            color,
            fontWeight: weight,
            display: 'inline-block',
            transform: `scale(${wordScale})`,
            transition: 'transform 0.1s',
          }}
        >
          {word}{' '}
        </span>
      );
    });
  }

  // --- History sentences (past) ---
  const historySentences = displaySentences.slice(0, activeSentenceIndex);

  return (
    <AbsoluteFill
      style={{
        background: 'transparent',
        fontFamily: FONTS.text,
        overflow: 'hidden',
      }}
    >
      {/* ===== MOOD BACKGROUND OVERLAY ===== */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: getMoodGradient(mood),
          opacity: moodOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* ===== DECORATIVE ELEMENTS ===== */}
      {/* Vertical accent line — left edge, pulsing */}
      <div
        style={{
          position: 'absolute',
          left: 20,
          top: '5%',
          bottom: '5%',
          width: 3,
          background: `linear-gradient(180deg, transparent, ${moodAccent}80, ${moodAccent}40, transparent)`,
          borderRadius: 2,
          opacity: 0.6 + glowPulse * 0.4,
        }}
      />

      {/* Horizontal accent — top, sweeping */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: interpolate(frame, [0, 40], [0, 100], { extrapolateRight: 'clamp' }) + '%',
          height: 2,
          background: `linear-gradient(90deg, ${moodAccent}60, transparent)`,
        }}
      />

      {/* ===== TOP ZONE: Heading + History + Current Sentence (30%) ===== */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 50,
          right: 30,
          height: '30%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          gap: 10,
        }}
      >
        {/* Heading */}
        <div
          style={{
            transform: `translateY(${headingY}px)`,
            opacity: headingOpacity,
          }}
        >
          <div
            style={{
              fontSize: SIZES.heading3,
              fontWeight: 800,
              color: COLORS.saffron,
              fontFamily: FONTS.heading,
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}
          >
            {heading}
          </div>
          <div
            style={{
              width: underlineWidth,
              height: 3,
              background: `linear-gradient(90deg, ${COLORS.saffron}, ${COLORS.gold}80, transparent)`,
              borderRadius: 2,
              marginTop: 6,
            }}
          />
        </div>

        {/* History — faded small past sentences */}
        {historySentences.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              marginTop: 8,
              maxHeight: 100,
              overflow: 'hidden',
            }}
          >
            {historySentences.slice(-2).map((s, i) => {
              const age = historySentences.length - i; // 1 = most recent past, 2 = older
              const fadeOpacity = interpolate(age, [1, 2], [0.25, 0.08], { extrapolateRight: 'clamp' });
              return (
                <div
                  key={i}
                  style={{
                    fontSize: 15,
                    color: COLORS.white,
                    opacity: fadeOpacity,
                    lineHeight: 1.4,
                    fontFamily: FONTS.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {s.length > 80 ? s.slice(0, 77) + '...' : s}
                </div>
              );
            })}
          </div>
        )}

        {/* Current Sentence — LARGE, animated slide-in */}
        <div
          style={{
            marginTop: historySentences.length > 0 ? 10 : 20,
            transform: `translateY(${sentenceY}px)`,
            opacity: sentenceOpacity,
          }}
        >
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.45,
              fontFamily: FONTS.text,
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            {renderHighlightedSentence(currentSentence, true, 34)}
          </div>
        </div>
      </div>

      {/* ===== BOTTOM ZONE: Hero Number / Key Phrase / Big Impact (70%) ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 50,
          right: 30,
          height: '58%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* BIG NUMBER — when a stat is detected */}
        {hasHeroNumber && (
          <div
            style={{
              transform: `scale(${heroScale})`,
              opacity: heroOpacity,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: numbers[0].replace(/[^0-9.]/g, '').length > 6 ? 72 : 96,
                fontWeight: 900,
                color: COLORS.gold,
                fontFamily: FONTS.heading,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                textShadow: `0 0 ${40 * glowPulse}px ${COLORS.gold}50, 0 0 ${80 * glowPulse}px ${COLORS.gold}20`,
                filter: `brightness(${1 + glowPulse * 0.15})`,
              }}
            >
              <AnimatedNumber
                value={numbers[0]}
                frame={sentenceLocalFrame}
                fps={fps}
                delay={8}
              />
            </div>
            {/* Unit / context label below the number */}
            {numbers[0].match(/[a-zA-Z%]+/) && (
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  color: `${COLORS.gold}90`,
                  fontFamily: FONTS.heading,
                  marginTop: 8,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {numbers[0].match(/[a-zA-Z%]+/)?.[0]}
              </div>
            )}
          </div>
        )}

        {/* KEY PHRASE — when no number but a named concept */}
        {!hasHeroNumber && keyPhrase && (
          <div
            style={{
              transform: `scale(${heroScale})`,
              opacity: heroOpacity,
              textAlign: 'center',
              padding: '0 20px',
            }}
          >
            <div
              style={{
                fontSize: keyPhrase.length > 20 ? 48 : 64,
                fontWeight: 800,
                color: COLORS.saffron,
                fontFamily: FONTS.heading,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                textShadow: `0 0 ${30 * glowPulse}px ${COLORS.saffron}30`,
              }}
            >
              {keyPhrase}
            </div>
          </div>
        )}

        {/* FALLBACK: show the full current sentence centred, large */}
        {!hasHeroNumber && !keyPhrase && (
          <div
            style={{
              transform: `scale(${heroScale})`,
              opacity: heroOpacity * 0.85,
              textAlign: 'center',
              padding: '0 30px',
            }}
          >
            <div
              style={{
                fontSize: currentSentence.length > 80 ? 36 : 40,
                fontWeight: 600,
                color: COLORS.white,
                fontFamily: FONTS.text,
                lineHeight: 1.4,
                letterSpacing: '-0.01em',
              }}
            >
              {renderHighlightedSentence(currentSentence, true, currentSentence.length > 80 ? 36 : 40)}
            </div>
          </div>
        )}

        {/* Progress dots — which sentence we're on */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          {displaySentences.map((_, i) => {
            const isActive = i === activeSentenceIndex;
            const isPast = i < activeSentenceIndex;
            return (
              <div
                key={i}
                style={{
                  width: isActive ? 28 : 8,
                  height: 8,
                  borderRadius: 4,
                  background: isActive
                    ? moodAccent
                    : isPast
                      ? `${COLORS.white}30`
                      : `${COLORS.white}12`,
                  transition: 'width 0.3s',
                  boxShadow: isActive ? `0 0 12px ${moodAccent}50` : 'none',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* ===== SCENE PROGRESS BAR — thin line at bottom ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: `${Math.min(100, (frame / sceneDuration) * 100)}%`,
          height: 2,
          background: `linear-gradient(90deg, ${moodAccent}80, ${moodAccent})`,
        }}
      />
    </AbsoluteFill>
  );
};

export default TextSection;
