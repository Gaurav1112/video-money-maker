import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, stagger, springIn, springScale, bounceIn } from '../lib/animations';

interface SummarySlideProps {
  takeaways: string[];
  topic: string;
  sessionNumber?: number;
  nextTopic?: string;
  startFrame?: number;
}

const SummarySlide: React.FC<SummarySlideProps> = ({
  takeaways = [],
  topic = '',
  sessionNumber = 1,
  nextTopic,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();

  // Celebration flash at start
  const flashOpacity = interpolate(
    frame,
    [startFrame, startFrame + 5, startFrame + 15],
    [0, 0.3, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const headingSpring = springIn(frame, startFrame);
  const headingY = slideUp(frame, startFrame, 60);

  // Checkmark animation stagger
  const checkmarkDelay = 20;

  // Subscribe button animation
  const subscribeStart = startFrame + 30 + takeaways.length * 15;
  const subscribeSpring = springIn(frame, subscribeStart);
  const subscribePulse = interpolate(
    Math.sin((frame - subscribeStart) * 0.08),
    [-1, 1],
    [0.97, 1.03],
  );

  // Branding reveal
  const brandStart = subscribeStart + 20;
  const brandOpacity = fadeIn(frame, brandStart);

  // Next lesson teaser
  const nextStart = brandStart + 15;
  const nextOpacity = fadeIn(frame, nextStart);
  const nextSlide = slideUp(frame, nextStart, 30);

  // Confetti particles
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

      {/* Confetti particles - more and varied */}
      {showConfetti && Array.from({ length: 24 }).map((_, i) => {
        const confettiColors = [COLORS.saffron, COLORS.gold, COLORS.teal, COLORS.indigo, COLORS.white];
        const speed = 1.5 + (i % 3) * 0.5;
        const startX = 10 + (i * 7.5) % 80;
        const y = interpolate(
          frame - startFrame - 5,
          [0, 200],
          [-10, 120],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
        const x = startX + Math.sin(frame * 0.03 + i * 2) * 8;
        const rotation = frame * speed * 3 + i * 45;
        const confettiOpacity = interpolate(
          frame - startFrame - 5,
          [0, 20, 120, 180],
          [0, 0.8, 0.6, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
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

      {/* Background gradient orb */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          width: 800,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.gold}08, transparent 70%)`,
          transform: 'translateX(-50%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          zIndex: 6,
          padding: '60px 100px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Completion badge */}
        <div
          style={{
            opacity: headingSpring,
            transform: `translateY(${headingY}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 12,
          }}
        >
          {/* Trophy icon */}
          <div
            style={{
              fontSize: 36,
              transform: `scale(${springScale(frame, startFrame + 5)})`,
              filter: `drop-shadow(0 0 12px ${COLORS.gold}66)`,
            }}
          >
            &#127942;
          </div>
          <div
            style={{
              fontSize: SIZES.bodySmall,
              fontWeight: 700,
              color: COLORS.gold,
              textTransform: 'uppercase',
              letterSpacing: 3,
            }}
          >
            Session {sessionNumber} Complete
          </div>
        </div>

        {/* Main heading */}
        <div
          style={{
            opacity: headingSpring,
            transform: `translateY(${headingY}px)`,
            fontSize: SIZES.heading2,
            fontWeight: 700,
            color: COLORS.white,
            marginBottom: 40,
            fontFamily: FONTS.heading,
            lineHeight: 1.2,
          }}
        >
          Key Takeaways
        </div>

        {/* Takeaways with animated checkmarks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
          {takeaways.map((takeaway, index) => {
            const itemStart = stagger(index, startFrame + checkmarkDelay, 12);
            const itemSpring = springIn(frame, itemStart);
            const checkScale = springScale(frame, itemStart);
            const itemY = slideUp(frame, itemStart, 25);

            return (
              <div
                key={index}
                style={{
                  opacity: itemSpring,
                  transform: `translateY(${itemY}px)`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  backgroundColor: `${COLORS.darkAlt}`,
                  borderRadius: 10,
                  padding: '16px 24px',
                  borderLeft: `3px solid ${COLORS.teal}`,
                }}
              >
                {/* Animated checkmark */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: COLORS.teal + '20',
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
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  >
                    &#10003;
                  </span>
                </div>
                <div
                  style={{
                    fontSize: SIZES.body,
                    color: COLORS.white,
                    lineHeight: 1.5,
                  }}
                >
                  {takeaway}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom section: branding + subscribe + next */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginTop: 32,
          }}
        >
          {/* Left: Branding */}
          <div style={{ opacity: brandOpacity }}>
            {/* Guru Sishya logo text */}
            <div
              style={{
                fontSize: SIZES.heading3,
                fontWeight: 800,
                fontFamily: FONTS.heading,
                marginBottom: 6,
              }}
            >
              <span style={{ color: COLORS.saffron }}>Guru</span>
              <span style={{ color: COLORS.gold }}> Sishya</span>
            </div>
            <div
              style={{
                fontSize: SIZES.caption,
                color: COLORS.gray,
                fontWeight: 400,
              }}
            >
              guru-sishya.in
            </div>
          </div>

          {/* Center: Subscribe button */}
          <div
            style={{
              opacity: subscribeSpring,
              transform: `scale(${frame > subscribeStart ? subscribePulse : 0.8})`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, #FF0000, #CC0000)`,
                color: COLORS.white,
                padding: '14px 40px',
                borderRadius: 8,
                fontSize: SIZES.body,
                fontWeight: 700,
                fontFamily: FONTS.text,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: `0 4px 20px rgba(255, 0, 0, 0.3)`,
              }}
            >
              {/* Play button icon */}
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '10px solid white',
                  borderTop: '6px solid transparent',
                  borderBottom: '6px solid transparent',
                }}
              />
              SUBSCRIBE
            </div>
            <div
              style={{
                fontSize: SIZES.caption,
                color: COLORS.gray,
                fontWeight: 500,
              }}
            >
              Daily interview prep tutorials
            </div>
          </div>

          {/* Right: Next lesson teaser */}
          {nextTopic ? (
            <div
              style={{
                opacity: nextOpacity,
                transform: `translateY(${nextSlide}px)`,
                textAlign: 'right',
              }}
            >
              <div
                style={{
                  fontSize: SIZES.caption,
                  color: COLORS.gray,
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                  marginBottom: 6,
                }}
              >
                Up Next
              </div>
              <div
                style={{
                  fontSize: SIZES.body,
                  color: COLORS.saffron,
                  fontWeight: 600,
                }}
              >
                {nextTopic}
              </div>
            </div>
          ) : (
            <div
              style={{
                opacity: nextOpacity,
                transform: `translateY(${nextSlide}px)`,
                textAlign: 'right',
              }}
            >
              <div
                style={{
                  fontSize: SIZES.caption,
                  color: COLORS.gray,
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                  marginBottom: 6,
                }}
              >
                Practice this topic
              </div>
              <div
                style={{
                  fontSize: SIZES.body,
                  color: COLORS.teal,
                  fontWeight: 600,
                }}
              >
                {topic}
              </div>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default SummarySlide;
