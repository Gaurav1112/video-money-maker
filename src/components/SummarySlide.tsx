import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, stagger, springIn, springScale } from '../lib/animations';

interface SummarySlideProps {
  takeaways?: string[];
  topic?: string;
  sessionNumber?: number;
  nextTopic?: string;
  startFrame?: number;
  endFrame?: number;
}

const SummarySlide: React.FC<SummarySlideProps> = ({
  takeaways = [],
  topic = 'this topic',
  sessionNumber = 1,
  nextTopic,
  startFrame = 0,
  endFrame,
}) => {
  const frame = useCurrentFrame();

  // Default takeaways so the slide is never blank
  const displayTakeaways =
    takeaways && takeaways.length > 0
      ? takeaways
      : [
          `You learned the fundamentals of ${topic}`,
          `You can now explain ${topic} clearly in interviews`,
          `Practice quizzes and flashcards at guru-sishya.in`,
        ];

  // Celebration flash at start
  const flashOpacity = interpolate(
    frame,
    [startFrame, startFrame + 5, startFrame + 15],
    [0, 0.4, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Heading animations
  const headingSpring = springIn(frame, startFrame);
  const headingY = slideUp(frame, startFrame, 60);

  // Checkmark stagger — each item appears 18 frames after the previous
  const checkmarkDelay = 18;

  // Badge appears after all takeaways
  const badgeStart = startFrame + 20 + displayTakeaways.length * checkmarkDelay;
  const badgeSpring = springIn(frame, badgeStart);
  const badgeY = slideUp(frame, badgeStart, 40);

  // CTA appears after badge
  const ctaStart = badgeStart + 20;
  const ctaSpring = springIn(frame, ctaStart);
  const ctaScale = springScale(frame, ctaStart);

  // Pulse glow on CTA
  const ctaPulse = interpolate(
    Math.sin((frame - ctaStart) * 0.07),
    [-1, 1],
    [0.98, 1.02],
  );

  // Confetti
  const showConfetti = frame > startFrame + 5;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        fontFamily: FONTS.text,
        overflow: 'hidden',
      }}
    >
      {/* Celebration flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: COLORS.gold,
          opacity: flashOpacity,
          zIndex: 10,
        }}
      />

      {/* Confetti particles */}
      {showConfetti &&
        Array.from({ length: 24 }).map((_, i) => {
          const confettiColors = [
            COLORS.saffron,
            COLORS.gold,
            COLORS.teal,
            COLORS.indigo,
            COLORS.white,
          ];
          const startX = 10 + (i * 7.5) % 80;
          const speed = 1.5 + (i % 3) * 0.5;
          const yProgress = interpolate(
            frame - startFrame - 5,
            [0, 200],
            [-10, 120],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          const x = startX + Math.sin(frame * 0.03 + i * 2) * 8;
          const rotation = frame * speed * 3 + i * 45;
          const confettiOpacity = interpolate(
            frame - startFrame - 5,
            [0, 20, 100, 160],
            [0, 0.9, 0.6, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${x}%`,
                top: `${yProgress}%`,
                width: i % 2 === 0 ? 8 : 12,
                height: i % 2 === 0 ? 12 : 4,
                backgroundColor: confettiColors[i % confettiColors.length],
                opacity: confettiOpacity,
                transform: `rotate(${rotation}deg)`,
                borderRadius: i % 3 === 0 ? '50%' : 2,
                zIndex: 5,
              }}
            />
          );
        })}

      {/* Background glow orb */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          width: 900,
          height: 700,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.gold}12 0%, ${COLORS.saffron}06 40%, transparent 70%)`,
          transform: 'translateX(-50%)',
          filter: 'blur(80px)',
          zIndex: 1,
        }}
      />

      {/* ── MAIN CONTENT ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 6,
          padding: '56px 96px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: 0,
        }}
      >
        {/* ── TOP LABEL: "Session X Complete" ── */}
        <div
          style={{
            opacity: headingSpring,
            transform: `translateY(${headingY}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 34,
              transform: `scale(${springScale(frame, startFrame + 5)})`,
              filter: `drop-shadow(0 0 10px ${COLORS.gold}88)`,
              lineHeight: 1,
            }}
          >
            🏆
          </div>
          <div
            style={{
              fontSize: SIZES.bodySmall,
              fontWeight: 700,
              color: COLORS.gold,
              textTransform: 'uppercase' as const,
              letterSpacing: 3,
            }}
          >
            Session {sessionNumber} Complete
          </div>
        </div>

        {/* ── HEADING: "Key Takeaways" ── */}
        <div
          style={{
            opacity: headingSpring,
            transform: `translateY(${headingY}px)`,
            fontSize: SIZES.heading2,
            fontWeight: 800,
            color: COLORS.saffron,
            marginBottom: 36,
            fontFamily: FONTS.heading,
            lineHeight: 1.15,
            letterSpacing: -0.5,
          }}
        >
          Key Takeaways
        </div>

        {/* ── TAKEAWAY ITEMS ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            flex: 1,
          }}
        >
          {displayTakeaways.map((takeaway, index) => {
            const itemStart = stagger(index, startFrame + checkmarkDelay, 18);
            const itemSpring = springIn(frame, itemStart);
            const checkScale = springScale(frame, itemStart);
            const itemY = slideUp(frame, itemStart, 30);

            return (
              <div
                key={index}
                style={{
                  opacity: itemSpring,
                  transform: `translateY(${itemY}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  backgroundColor: `${COLORS.darkAlt}`,
                  borderRadius: 12,
                  padding: '20px 28px',
                  border: `1px solid ${COLORS.teal}30`,
                  borderLeft: `4px solid ${COLORS.teal}`,
                  boxShadow: `0 2px 24px ${COLORS.teal}10`,
                }}
              >
                {/* Animated checkmark circle */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: COLORS.teal + '25',
                    border: `2px solid ${COLORS.teal}80`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transform: `scale(${checkScale})`,
                  }}
                >
                  <span
                    style={{
                      color: COLORS.teal,
                      fontSize: 20,
                      fontWeight: 900,
                      lineHeight: 1,
                    }}
                  >
                    ✓
                  </span>
                </div>

                {/* Takeaway text */}
                <div
                  style={{
                    fontSize: SIZES.body,
                    color: COLORS.white,
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}
                >
                  {takeaway}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── MASTERY BADGE ── */}
        <div
          style={{
            opacity: badgeSpring,
            transform: `translateY(${badgeY}px)`,
            marginTop: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            backgroundColor: `${COLORS.gold}12`,
            border: `2px solid ${COLORS.gold}50`,
            borderRadius: 16,
            padding: '18px 28px',
            boxShadow: `0 4px 32px ${COLORS.gold}20`,
          }}
        >
          {/* Shield / badge icon */}
          <div
            style={{
              fontSize: 42,
              lineHeight: 1,
              filter: `drop-shadow(0 0 10px ${COLORS.gold}66)`,
              transform: `scale(${springScale(frame, badgeStart + 5)})`,
            }}
          >
            🛡️
          </div>
          <div>
            <div
              style={{
                fontSize: SIZES.bodySmall,
                fontWeight: 700,
                color: COLORS.gold,
                textTransform: 'uppercase' as const,
                letterSpacing: 2,
                marginBottom: 4,
              }}
            >
              Topic Mastery Unlocked
            </div>
            <div
              style={{
                fontSize: SIZES.body,
                fontWeight: 600,
                color: COLORS.white,
              }}
            >
              You've completed{' '}
              <span style={{ color: COLORS.saffron }}>{topic}</span>
              {' '}— Session {sessionNumber}
            </div>
          </div>
        </div>

        {/* ── CTA BUTTON ── */}
        <div
          style={{
            opacity: ctaSpring,
            transform: `scale(${frame > ctaStart ? ctaPulse : ctaScale})`,
            marginTop: 24,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${COLORS.saffron} 0%, ${COLORS.gold} 100%)`,
              color: '#0C0A15',
              padding: '18px 56px',
              borderRadius: 50,
              fontSize: SIZES.body,
              fontWeight: 800,
              fontFamily: FONTS.text,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: `0 6px 30px ${COLORS.saffron}55`,
              letterSpacing: 0.5,
            }}
          >
            {/* Arrow icon */}
            <span style={{ fontSize: SIZES.body + 4 }}>🎯</span>
            Practice now →&nbsp;
            <span
              style={{
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              www.guru-sishya.in
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default SummarySlide;
