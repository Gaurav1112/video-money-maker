import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, Easing } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, springIn, springScale, pulseGlow } from '../lib/animations';

interface ReviewQuestionProps {
  question: string;
  answer: string;
  /** Frame this scene starts at (absolute). Default: 0 */
  startFrame?: number;
  /** Frame this scene ends at (absolute). Used to auto-derive answer reveal at 50% mark. */
  endFrame?: number;
  /** Override: explicit delay (in frames) before answer reveals. Ignored when endFrame is provided. */
  revealDelay?: number;
}

/**
 * ReviewQuestion — KBC-style quiz challenge scene.
 *
 * Layout:
 *   1. "REVIEW QUESTION" badge slides in
 *   2. Question text appears LARGE (30px) with a subtle spotlight
 *   3. "Think about it…" italic prompt + animated saffron countdown ring (3 → 2 → 1)
 *   4. At 50% of scene duration → answer slides up with a teal checkmark "ding"
 *   5. "guru-sishya.in" CTA pinned to the bottom
 */
const ReviewQuestion: React.FC<ReviewQuestionProps> = ({
  question = 'What is the time complexity of binary search?',
  answer = 'O(log n) — each step halves the search space.',
  startFrame = 0,
  endFrame,
  revealDelay: revealDelayProp,
}) => {
  const frame = useCurrentFrame();

  // Derive reveal timing: prefer endFrame (50% of scene), else fall back to prop, else 90 frames
  const sceneDuration = endFrame != null ? endFrame - startFrame : 180;
  const revealDelay =
    revealDelayProp != null
      ? revealDelayProp
      : Math.round(sceneDuration * 0.5);

  // ─── QUESTION PHASE ────────────────────────────────────────────────────────
  const questionOpacity = fadeIn(frame, startFrame, 20);
  const questionY = slideUp(frame, startFrame, 40, 28);
  const questionScale = interpolate(
    frame,
    [startFrame, startFrame + 20, startFrame + 35],
    [0.96, 1.03, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ─── SPOTLIGHT ─────────────────────────────────────────────────────────────
  const spotlightOpacity = interpolate(
    frame,
    [startFrame + 5, startFrame + 25],
    [0, 0.45],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ─── "THINK ABOUT IT…" ─────────────────────────────────────────────────────
  const thinkStart = startFrame + 25;
  const thinkOpacity = fadeIn(frame, thinkStart, 15);

  // Dots pulse: animate ellipsis dots while user is thinking
  const dotCount = Math.floor(((frame - thinkStart) / 15) % 4); // cycles 0→1→2→3→0
  const thinkDots = '.'.repeat(Math.max(0, dotCount));

  // ─── COUNTDOWN: 3 → 2 → 1 ─────────────────────────────────────────────────
  const countdownStart = startFrame + 40;
  const countdownEnd = startFrame + revealDelay;
  const countdownDuration = Math.max(1, countdownEnd - countdownStart);
  const countPerNumber = countdownDuration / 3;

  const getCountdownNumber = (): number | null => {
    if (frame < countdownStart || frame >= countdownEnd) return null;
    const elapsed = frame - countdownStart;
    if (elapsed < countPerNumber) return 3;
    if (elapsed < countPerNumber * 2) return 2;
    return 1;
  };

  const countdownNumber = getCountdownNumber();
  const countdownVisible = countdownNumber !== null;

  const getCountdownScale = () => {
    if (!countdownNumber) return 0;
    const numberIndex = 3 - countdownNumber;
    const numberStart = countdownStart + numberIndex * countPerNumber;
    return springIn(frame, numberStart);
  };

  const countdownScale = getCountdownScale();

  // Ring progress — full circle when countdown starts, empty when it ends
  const ringProgress = interpolate(
    frame,
    [countdownStart, countdownEnd],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ─── FADE PRE-ANSWER ELEMENTS WHEN ANSWER REVEALS ─────────────────────────
  const answerStart = startFrame + revealDelay;
  const preAnswerFade =
    frame >= answerStart
      ? interpolate(frame, [answerStart, answerStart + 10], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  // ─── ANSWER REVEAL ─────────────────────────────────────────────────────────
  const answerOpacity = fadeIn(frame, answerStart, 15);
  const answerY = slideUp(frame, answerStart, 50, 22);

  const checkmarkSpring = springIn(frame, answerStart + 5);
  const checkmarkScale = springScale(frame, answerStart + 5);

  // White flash on reveal
  const revealFlash = interpolate(
    frame,
    [answerStart, answerStart + 4, answerStart + 14],
    [0, 0.12, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Teal glow under answer
  const answerGlow = interpolate(
    frame,
    [answerStart, answerStart + 20, answerStart + 60],
    [0, 0.7, 0.35],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ─── CTA (guru-sishya.in) ─────────────────────────────────────────────────
  // Appears slightly after the answer
  const ctaOpacity = fadeIn(frame, answerStart + 20, 20);
  const ctaGlow = pulseGlow(frame, 0.07, 0.4, 0.9);

  // ─── QUESTION MARK WATERMARK ──────────────────────────────────────────────
  const qPulse = interpolate(Math.sin(frame * 0.1), [-1, 1], [0.85, 1.15]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'transparent',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 100px 100px',
        fontFamily: FONTS.text,
      }}
    >
      {/* ── Spotlight vignette ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 65% 55% at 50% 44%, transparent 0%, ${COLORS.dark}BB 100%)`,
          opacity: spotlightOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* ── Reveal flash ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: COLORS.white,
          opacity: revealFlash,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* ── Main content card ── */}
      <div style={{ maxWidth: 960, width: '100%', position: 'relative', zIndex: 2 }}>

        {/* Faint watermark "?" */}
        <div
          style={{
            position: 'absolute',
            top: -60,
            right: -30,
            fontSize: 120,
            fontWeight: 900,
            color: COLORS.saffron,
            opacity: questionOpacity * 0.08 * preAnswerFade,
            transform: `scale(${qPulse})`,
            fontFamily: FONTS.heading,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          ?
        </div>

        {/* ── Badge: REVIEW QUESTION ── */}
        <div
          style={{
            opacity: questionOpacity,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 28,
              height: 3,
              backgroundColor: COLORS.saffron,
              borderRadius: 2,
              boxShadow: `0 0 8px ${COLORS.saffron}88`,
            }}
          />
          <span
            style={{
              fontSize: SIZES.caption,
              fontWeight: 800,
              color: COLORS.saffron,
              textTransform: 'uppercase' as const,
              letterSpacing: 3.5,
            }}
          >
            Review Question
          </span>
          <div
            style={{
              width: 28,
              height: 3,
              backgroundColor: COLORS.saffron,
              borderRadius: 2,
              boxShadow: `0 0 8px ${COLORS.saffron}88`,
            }}
          />
        </div>

        {/* ── Question text ── */}
        <div
          style={{
            opacity: questionOpacity,
            transform: `translateY(${questionY}px) scale(${questionScale})`,
            fontSize: 30,                         // explicitly 30px — large & clear
            fontWeight: 700,
            color: COLORS.white,
            lineHeight: 1.55,
            marginBottom: 36,
            textShadow: `0 2px 24px ${COLORS.saffron}18`,
          }}
        >
          {question}
        </div>

        {/* ── Think about it + Countdown ── */}
        <div
          style={{
            opacity: thinkOpacity * preAnswerFade,
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            marginBottom: 36,
            height: 72,
          }}
        >
          {/* Italic prompt */}
          <div
            style={{
              fontSize: SIZES.bodySmall,
              color: COLORS.gray,
              fontStyle: 'italic',
              letterSpacing: 0.5,
            }}
          >
            Think about it{thinkDots}
          </div>

          {/* Saffron countdown ring */}
          {countdownVisible && (
            <div
              style={{
                position: 'relative',
                width: 68,
                height: 68,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg
                width={68}
                height={68}
                style={{ position: 'absolute', transform: 'rotate(-90deg)' }}
              >
                {/* Track */}
                <circle
                  cx={34}
                  cy={34}
                  r={29}
                  fill="none"
                  stroke={`${COLORS.saffron}22`}
                  strokeWidth={4}
                />
                {/* Progress arc */}
                <circle
                  cx={34}
                  cy={34}
                  r={29}
                  fill="none"
                  stroke={COLORS.saffron}
                  strokeWidth={4}
                  strokeDasharray={`${ringProgress * 182} 182`}
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 6px ${COLORS.saffron}99)`,
                  }}
                />
              </svg>

              {/* Number inside ring */}
              <div
                style={{
                  fontSize: SIZES.heading3,
                  fontWeight: 900,
                  color: COLORS.saffron,
                  fontFamily: FONTS.code,
                  opacity: countdownScale,
                  transform: `scale(${countdownScale})`,
                  textShadow: `0 0 16px ${COLORS.saffron}66`,
                  lineHeight: 1,
                }}
              >
                {countdownNumber}
              </div>
            </div>
          )}
        </div>

        {/* ── Answer Section ── */}
        <div
          style={{
            opacity: answerOpacity,
            transform: `translateY(${answerY}px)`,
          }}
        >
          {/* Glowing divider */}
          <div
            style={{
              height: 2,
              background: `linear-gradient(90deg, transparent, ${COLORS.teal}77, transparent)`,
              marginBottom: 24,
              boxShadow: `0 0 ${Math.round(18 * answerGlow)}px ${COLORS.teal}55`,
            }}
          />

          {/* Answer header row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 14,
            }}
          >
            {/* Checkmark badge */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: `${COLORS.teal}22`,
                border: `2px solid ${COLORS.teal}55`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: checkmarkSpring,
                transform: `scale(${checkmarkScale})`,
                boxShadow: `0 0 ${Math.round(14 * answerGlow)}px ${COLORS.teal}55`,
                flexShrink: 0,
              }}
            >
              <span style={{ color: COLORS.teal, fontSize: 22, fontWeight: 800 }}>
                ✓
              </span>
            </div>

            <span
              style={{
                fontSize: SIZES.bodySmall,
                fontWeight: 800,
                color: COLORS.teal,
                textTransform: 'uppercase' as const,
                letterSpacing: 2.5,
              }}
            >
              Answer
            </span>
          </div>

          {/* Answer text */}
          <div
            style={{
              fontSize: SIZES.body,             // 28px — matches question weight
              fontWeight: 500,
              color: COLORS.teal,
              lineHeight: 1.65,
              paddingLeft: 52,
              borderLeft: `3px solid ${COLORS.teal}44`,
            }}
          >
            {answer}
          </div>
        </div>
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
          Practice more →
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
