import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, spring } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, springIn, springScale, pulseGlow } from '../lib/animations';

interface ReviewQuestionProps {
  question: string;
  answer: string;
  /** Frame this scene starts at (absolute). Default: 0 */
  startFrame?: number;
  /** Frame this scene ends at (absolute). Used to auto-derive phase timing. */
  endFrame?: number;
  /** Override: explicit delay (in frames) before answer reveals. Ignored when endFrame is provided. */
  revealDelay?: number;
  /** Optional quiz options. If not provided, auto-generated from the answer. */
  quizOptions?: string[];
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Shuffle an array deterministically based on the question string.
 */
function shuffleOptions(options: string[], seed: string): string[] {
  const arr = [...options];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    hash = ((hash << 5) - hash + i) | 0;
    const j = Math.abs(hash) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build 4 quiz options. If quizOptions provided, use those (pad/trim to 4).
 * Otherwise generate from answer + fillers.
 */
function buildOptions(answer: string, quizOptions?: string[]): string[] {
  if (quizOptions && quizOptions.length >= 4) {
    return quizOptions.slice(0, 4);
  }
  if (quizOptions && quizOptions.length > 0) {
    const fillers = ['None of the above', 'All of the above', 'It depends', 'Not enough info'];
    const result = [...quizOptions];
    let fi = 0;
    while (result.length < 4 && fi < fillers.length) {
      if (!result.includes(fillers[fi])) result.push(fillers[fi]);
      fi++;
    }
    return result.slice(0, 4);
  }
  // Auto-generate: answer + 3 fillers
  const fillers = ['None of the above', 'All of the above', 'It depends'];
  return [answer, ...fillers];
}

/**
 * Truncate text to max length with ellipsis.
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '\u2026';
}

/**
 * Corner origins for staggered fly-in: top-left, top-right, bottom-left, bottom-right
 */
const CORNER_OFFSETS: Array<{ x: number; y: number }> = [
  { x: -120, y: -80 },
  { x: 120, y: -80 },
  { x: -120, y: 80 },
  { x: 120, y: 80 },
];

/**
 * ReviewQuestion — Game show quiz scene.
 *
 * Phases:
 *   1 (0-15%):   "POP QUIZ!" slams in with spring scale
 *   2 (15-30%):  Question text fades in at top
 *   3 (30-60%):  4 option cards fly in from corners (2x2 grid)
 *   4 (60-75%):  Countdown timer (SVG circle drains, 3-2-1)
 *   5 (75-100%): Correct answer highlighted green, wrong dim, explanation fades in
 */
const ReviewQuestion: React.FC<ReviewQuestionProps> = ({
  question = 'What is the time complexity of binary search?',
  answer = 'O(log n) -- each step halves the search space.',
  startFrame = 0,
  endFrame,
  revealDelay: _revealDelayProp,
  quizOptions,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;

  const sceneDuration = endFrame != null ? endFrame - startFrame : 180;

  // Phase boundaries (in frames relative to startFrame)
  const phase1End = Math.round(sceneDuration * 0.15);
  const phase2End = Math.round(sceneDuration * 0.30);
  const phase3End = Math.round(sceneDuration * 0.60);
  const phase4End = Math.round(sceneDuration * 0.75);
  // phase5 = 75-100%

  // Build and shuffle options
  const rawOptions = buildOptions(answer, quizOptions);
  const options = shuffleOptions(rawOptions, question);
  const correctIndex = options.findIndex(
    (o) => o.trim().toLowerCase() === answer.trim().toLowerCase(),
  );

  // ─── PHASE 1: "POP QUIZ!" ───────────────────────────────────────────────
  const popQuizStart = startFrame;
  const popQuizScale = spring({
    frame: Math.max(0, frame - popQuizStart),
    fps,
    from: 0.5,
    to: 1.0,
    config: { damping: 8, stiffness: 200, mass: 0.6 },
  });
  const popQuizOpacity = interpolate(
    frame,
    [popQuizStart, popQuizStart + 8],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  // Fade out pop quiz after phase 1
  const popQuizFade = interpolate(
    frame,
    [startFrame + phase1End - 5, startFrame + phase1End],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ─── PHASE 2: Question text ─────────────────────────────────────────────
  const questionStart = startFrame + phase1End;
  const questionOpacity = fadeIn(frame, questionStart, 15);
  const questionY = slideUp(frame, questionStart, 30, 20);

  // ─── PHASE 3: Option cards ──────────────────────────────────────────────
  const optionsStart = startFrame + phase2End;
  const optionsDuration = phase3End - phase2End;

  // ─── PHASE 4: Countdown ─────────────────────────────────────────────────
  const countdownStart = startFrame + phase3End;
  const countdownDuration = phase4End - phase3End;
  const countPerNumber = Math.max(1, Math.floor(countdownDuration / 3));

  const getCountdownNumber = (): number | null => {
    if (frame < countdownStart || frame >= startFrame + phase4End) return null;
    const elapsed = frame - countdownStart;
    if (elapsed < countPerNumber) return 3;
    if (elapsed < countPerNumber * 2) return 2;
    return 1;
  };
  const countdownNumber = getCountdownNumber();

  // SVG circle timer
  const circleRadius = 32;
  const circumference = 2 * Math.PI * circleRadius;
  const ringProgress = interpolate(
    frame,
    [countdownStart, startFrame + phase4End],
    [0, circumference],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const countdownOpacity = interpolate(
    frame,
    [countdownStart, countdownStart + 5],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const countdownScale = countdownNumber
    ? spring({
        frame: Math.max(0, frame - (countdownStart + (3 - countdownNumber) * countPerNumber)),
        fps,
        config: { damping: 10, stiffness: 180, mass: 0.5 },
      })
    : 0;

  // ─── PHASE 5: Reveal ───────────────────────────────────────────────────
  const revealStart = startFrame + phase4End;
  const revealOpacity = fadeIn(frame, revealStart, 12);
  const isRevealed = frame >= revealStart;

  // Explanation text
  const explanationOpacity = fadeIn(frame, revealStart + 15, 20);
  const explanationY = slideUp(frame, revealStart + 15, 20, 15);

  // CTA
  const ctaStart = revealStart + 30;
  const ctaOpacity = fadeIn(frame, ctaStart, 20);
  const ctaGlow = pulseGlow(frame, 0.07, 0.4, 0.9);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'transparent',
        fontFamily: FONTS.text,
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: '50px 80px 80px',
      }}
    >
      {/* ── Phase 1: POP QUIZ! ── */}
      {frame < startFrame + phase2End + 10 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 20,
            opacity: popQuizOpacity * popQuizFade,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: COLORS.saffron,
              fontFamily: FONTS.heading,
              transform: `scale(${popQuizScale})`,
              textShadow: `0 0 40px ${COLORS.saffron}88, 0 4px 20px ${COLORS.dark}`,
              letterSpacing: 6,
            }}
          >
            POP QUIZ!
          </div>
        </div>
      )}

      {/* ── Main content area ── */}
      <div style={{ maxWidth: 1000, width: '100%', position: 'relative', zIndex: 2 }}>
        {/* ── Phase 2: Question text ── */}
        <div
          style={{
            opacity: questionOpacity,
            transform: `translateY(${questionY}px)`,
            fontSize: 28,
            fontWeight: 700,
            color: COLORS.white,
            lineHeight: 1.5,
            marginBottom: 32,
            marginTop: 20,
            textShadow: `0 2px 16px ${COLORS.dark}`,
          }}
        >
          {question}
        </div>

        {/* ── Phase 3: 2x2 option grid ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 20,
            marginBottom: 30,
          }}
        >
          {options.map((option, idx) => {
            const staggerDelay = idx * 6;
            const cardStart = optionsStart + staggerDelay;

            // Fly-in from corner
            const flyProgress = spring({
              frame: Math.max(0, frame - cardStart),
              fps,
              config: { damping: 12, stiffness: 120, mass: 0.7 },
            });
            const corner = CORNER_OFFSETS[idx];
            const cardX = interpolate(flyProgress, [0, 1], [corner.x, 0]);
            const cardY = interpolate(flyProgress, [0, 1], [corner.y, 0]);
            const cardOpacity = interpolate(flyProgress, [0, 0.3], [0, 1], {
              extrapolateRight: 'clamp',
            });

            // Reveal state
            const isCorrect = idx === correctIndex;
            const revealBg = isRevealed
              ? isCorrect
                ? `${COLORS.teal}30`
                : `${COLORS.darkAlt}`
              : `${COLORS.darkAlt}`;
            const revealBorder = isRevealed
              ? isCorrect
                ? `2px solid ${COLORS.teal}`
                : `1px solid ${COLORS.gray}20`
              : `1px solid ${COLORS.gray}30`;
            const revealTextOpacity = isRevealed && !isCorrect ? 0.3 : 1;
            const revealFilter = isRevealed && !isCorrect ? 'grayscale(80%)' : 'none';

            // Letter badge color
            const letterBg = isRevealed && isCorrect ? COLORS.teal : COLORS.saffron;

            return (
              <div
                key={idx}
                style={{
                  opacity: cardOpacity,
                  transform: `translate(${cardX}px, ${cardY}px)`,
                  backgroundColor: revealBg,
                  border: revealBorder,
                  borderRadius: 14,
                  padding: '18px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  filter: revealFilter,
                  transition: 'none',
                  boxShadow: isRevealed && isCorrect
                    ? `0 0 24px ${COLORS.teal}44`
                    : `0 2px 12px ${COLORS.dark}40`,
                }}
              >
                {/* Letter badge */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: `${letterBg}22`,
                    border: `2px solid ${letterBg}66`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      color: letterBg,
                      fontSize: 20,
                      fontWeight: 800,
                      fontFamily: FONTS.code,
                    }}
                  >
                    {OPTION_LETTERS[idx]}
                  </span>
                </div>

                {/* Option text */}
                <span
                  style={{
                    fontSize: SIZES.bodySmall,
                    fontWeight: 600,
                    color: COLORS.white,
                    lineHeight: 1.4,
                    opacity: revealTextOpacity,
                  }}
                >
                  {truncate(option, 60)}
                </span>

                {/* Checkmark on correct answer */}
                {isRevealed && isCorrect && (
                  <div
                    style={{
                      marginLeft: 'auto',
                      flexShrink: 0,
                      opacity: revealOpacity,
                      transform: `scale(${springScale(frame, revealStart + 5)})`,
                    }}
                  >
                    <svg width={28} height={28} viewBox="0 0 28 28">
                      <circle cx={14} cy={14} r={13} fill={`${COLORS.teal}33`} stroke={COLORS.teal} strokeWidth={2} />
                      <path
                        d="M8 14.5 L12 18.5 L20 10"
                        fill="none"
                        stroke={COLORS.teal}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Phase 4: Countdown timer ── */}
        {frame >= countdownStart && frame < startFrame + phase4End + 5 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24,
              opacity: countdownOpacity * (isRevealed ? 0 : 1),
            }}
          >
            <div
              style={{
                position: 'relative',
                width: 80,
                height: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width={80}
                height={80}
                style={{ position: 'absolute', transform: 'rotate(-90deg)' }}
              >
                {/* Track */}
                <circle
                  cx={40}
                  cy={40}
                  r={circleRadius}
                  fill="none"
                  stroke={`${COLORS.saffron}22`}
                  strokeWidth={4}
                />
                {/* Depleting arc */}
                <circle
                  cx={40}
                  cy={40}
                  r={circleRadius}
                  fill="none"
                  stroke={COLORS.saffron}
                  strokeWidth={4}
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={ringProgress}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 8px ${COLORS.saffron}88)` }}
                />
              </svg>

              {/* Number */}
              <div
                style={{
                  fontSize: SIZES.heading3,
                  fontWeight: 900,
                  color: COLORS.saffron,
                  fontFamily: FONTS.code,
                  transform: `scale(${countdownScale})`,
                  textShadow: `0 0 16px ${COLORS.saffron}66`,
                  lineHeight: 1,
                }}
              >
                {countdownNumber}
              </div>
            </div>
          </div>
        )}

        {/* ── Phase 5: Answer explanation ── */}
        {isRevealed && (
          <div
            style={{
              opacity: explanationOpacity,
              transform: `translateY(${explanationY}px)`,
              marginTop: 8,
            }}
          >
            <div
              style={{
                height: 2,
                background: `linear-gradient(90deg, transparent, ${COLORS.teal}77, transparent)`,
                marginBottom: 18,
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: `${COLORS.teal}22`,
                  border: `2px solid ${COLORS.teal}55`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <span style={{ color: COLORS.teal, fontSize: 18, fontWeight: 800 }}>
                  {'\u2713'}
                </span>
              </div>
              <div
                style={{
                  fontSize: SIZES.bodySmall,
                  fontWeight: 500,
                  color: COLORS.teal,
                  lineHeight: 1.55,
                }}
              >
                {answer}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── CTA: guru-sishya.in ── pinned to bottom ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 36,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 10,
          opacity: ctaOpacity,
          zIndex: 5,
        }}
      >
        <span
          style={{
            fontSize: SIZES.bodySmall,
            color: COLORS.gray,
            fontWeight: 500,
          }}
        >
          Practice more {'\u2192'}
        </span>
        <span
          style={{
            fontSize: SIZES.bodySmall,
            fontWeight: 800,
            color: COLORS.gold,
            letterSpacing: 0.8,
            textShadow: `0 0 ${Math.round(12 * ctaGlow)}px ${COLORS.gold}88`,
          }}
        >
          guru-sishya.in
        </span>
      </div>
    </AbsoluteFill>
  );
};

export default ReviewQuestion;
