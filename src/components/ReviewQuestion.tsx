import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, Easing } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, springIn, springScale } from '../lib/animations';

interface ReviewQuestionProps {
  question: string;
  answer: string;
  startFrame?: number;
  revealDelay?: number;
}

/**
 * ReviewQuestion — Quiz-show style scene.
 * Question appears with spotlight focus, countdown timer (3, 2, 1),
 * then answer slides up with a green checkmark "ding" effect.
 */
const ReviewQuestion: React.FC<ReviewQuestionProps> = ({
  question = '',
  answer = '',
  startFrame = 0,
  revealDelay = 90,
}) => {
  const frame = useCurrentFrame();

  // === QUESTION PHASE ===
  const questionOpacity = fadeIn(frame, startFrame, 20);
  const questionY = slideUp(frame, startFrame, 50, 30);
  const questionScale = interpolate(
    frame,
    [startFrame, startFrame + 20, startFrame + 35],
    [0.95, 1.02, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // === SPOTLIGHT OVERLAY ===
  // Darkens edges, focuses attention on question area
  const spotlightOpacity = interpolate(
    frame,
    [startFrame + 5, startFrame + 25],
    [0, 0.5],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // === THINK ABOUT IT ===
  const thinkStart = startFrame + 25;
  const thinkOpacity = fadeIn(frame, thinkStart, 15);

  // === COUNTDOWN: 3, 2, 1 ===
  const countdownStart = startFrame + 40;
  const countdownDuration = revealDelay - 40; // total countdown time
  const countPerNumber = countdownDuration / 3;

  const getCountdownNumber = (): number | null => {
    if (frame < countdownStart) return null;
    const elapsed = frame - countdownStart;
    if (elapsed < countPerNumber) return 3;
    if (elapsed < countPerNumber * 2) return 2;
    if (elapsed < countPerNumber * 3) return 1;
    return null;
  };

  const countdownNumber = getCountdownNumber();
  const countdownVisible = countdownNumber !== null;

  // Each number gets its own spring animation
  const getCountdownScale = () => {
    if (!countdownNumber) return 0;
    const numberIndex = 3 - countdownNumber;
    const numberStart = countdownStart + numberIndex * countPerNumber;
    return springIn(frame, numberStart);
  };

  const countdownScale = getCountdownScale();

  // Countdown ring progress (shrinks from full circle to empty)
  const ringProgress = interpolate(
    frame,
    [countdownStart, startFrame + revealDelay],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // === ANSWER REVEAL ===
  const answerStart = startFrame + revealDelay;
  const answerOpacity = fadeIn(frame, answerStart, 15);
  const answerY = slideUp(frame, answerStart, 60, 25);

  // Green checkmark "ding" effect
  const checkmarkSpring = springIn(frame, answerStart + 5);
  const checkmarkScale = springScale(frame, answerStart + 5);

  // Flash on answer reveal
  const revealFlash = interpolate(
    frame,
    [answerStart, answerStart + 4, answerStart + 12],
    [0, 0.15, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Answer glow
  const answerGlow = interpolate(
    frame,
    [answerStart, answerStart + 20, answerStart + 60],
    [0, 0.6, 0.3],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Question mark icon pulse
  const qPulse = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [0.8, 1.2],
  );

  // Dismiss countdown and think text after answer
  const preAnswerFade = frame >= answerStart
    ? interpolate(frame, [answerStart, answerStart + 10], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: 'transparent', // Background layer handles this
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px 100px',
        fontFamily: FONTS.text,
      }}
    >
      {/* Spotlight overlay — dims edges */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 60% 50% at 50% 45%, transparent 0%, ${COLORS.dark}${frame > answerStart ? 'CC' : 'AA'} 100%)`,
          opacity: spotlightOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Reveal flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: COLORS.teal,
          opacity: revealFlash,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      <div style={{ maxWidth: 950, width: '100%', position: 'relative', zIndex: 2 }}>
        {/* Question mark icon */}
        <div
          style={{
            position: 'absolute',
            top: -50,
            right: -20,
            fontSize: 80,
            fontWeight: 900,
            color: COLORS.saffron,
            opacity: questionOpacity * 0.15 * preAnswerFade,
            transform: `scale(${qPulse})`,
            fontFamily: FONTS.heading,
          }}
        >
          ?
        </div>

        {/* Question label */}
        <div
          style={{
            opacity: questionOpacity,
            fontSize: SIZES.caption,
            fontWeight: 700,
            color: COLORS.saffron,
            textTransform: 'uppercase',
            letterSpacing: 3,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 24,
              height: 3,
              backgroundColor: COLORS.saffron,
              borderRadius: 2,
            }}
          />
          REVIEW QUESTION
        </div>

        {/* Question text with focus effect */}
        <div
          style={{
            opacity: questionOpacity,
            transform: `translateY(${questionY}px) scale(${questionScale})`,
            fontSize: SIZES.heading3 + 2,
            fontWeight: 600,
            color: COLORS.white,
            lineHeight: 1.5,
            marginBottom: 40,
            textShadow: `0 0 40px ${COLORS.saffron}11`,
          }}
        >
          {question}
        </div>

        {/* Think about it + Countdown timer */}
        <div
          style={{
            opacity: thinkOpacity * preAnswerFade,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 24,
            marginBottom: 40,
            height: 80,
          }}
        >
          {/* Think text */}
          <div
            style={{
              fontSize: SIZES.body,
              color: COLORS.gray,
              fontStyle: 'italic',
            }}
          >
            Think about it...
          </div>

          {/* Countdown circle */}
          {countdownVisible && (
            <div
              style={{
                position: 'relative',
                width: 64,
                height: 64,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Background ring */}
              <svg
                width={64}
                height={64}
                style={{ position: 'absolute', transform: 'rotate(-90deg)' }}
              >
                <circle
                  cx={32}
                  cy={32}
                  r={28}
                  fill="none"
                  stroke={`${COLORS.gray}22`}
                  strokeWidth={3}
                />
                <circle
                  cx={32}
                  cy={32}
                  r={28}
                  fill="none"
                  stroke={COLORS.saffron}
                  strokeWidth={3}
                  strokeDasharray={`${ringProgress * 176} 176`}
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 4px ${COLORS.saffron}66)`,
                  }}
                />
              </svg>

              {/* Number */}
              <div
                style={{
                  fontSize: SIZES.heading3,
                  fontWeight: 800,
                  color: COLORS.saffron,
                  fontFamily: FONTS.code,
                  opacity: countdownScale,
                  transform: `scale(${countdownScale})`,
                  textShadow: `0 0 12px ${COLORS.saffron}44`,
                }}
              >
                {countdownNumber}
              </div>
            </div>
          )}
        </div>

        {/* === ANSWER SECTION === */}
        <div
          style={{
            opacity: answerOpacity,
            transform: `translateY(${answerY}px)`,
          }}
        >
          {/* Divider with glow */}
          <div
            style={{
              height: 2,
              background: `linear-gradient(90deg, transparent, ${COLORS.teal}66, transparent)`,
              marginBottom: 28,
              boxShadow: `0 0 ${20 * answerGlow}px ${COLORS.teal}44`,
            }}
          />

          {/* Answer header with checkmark ding */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 16,
            }}
          >
            {/* Animated checkmark */}
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: `${COLORS.teal}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: checkmarkSpring,
                transform: `scale(${checkmarkScale})`,
                boxShadow: `0 0 ${16 * answerGlow}px ${COLORS.teal}44`,
              }}
            >
              <span
                style={{
                  color: COLORS.teal,
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                &#10003;
              </span>
            </div>

            <div
              style={{
                fontSize: SIZES.bodySmall,
                fontWeight: 700,
                color: COLORS.teal,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              Answer
            </div>
          </div>

          {/* Answer text */}
          <div
            style={{
              fontSize: SIZES.body,
              color: COLORS.teal,
              lineHeight: 1.7,
              paddingLeft: 50,
              borderLeft: `3px solid ${COLORS.teal}44`,
            }}
          >
            {answer}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default ReviewQuestion;
