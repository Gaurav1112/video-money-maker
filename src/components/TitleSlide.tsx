import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, stagger, springIn, springScale } from '../lib/animations';

interface TitleSlideProps {
  topic: string;
  sessionNumber: number;
  title: string;
  objectives: string[];
  language?: string;
}

const TitleSlide: React.FC<TitleSlideProps> = ({
  topic,
  sessionNumber,
  title,
  objectives,
  language,
}) => {
  const frame = useCurrentFrame();

  // Animated gradient rotation
  const gradientAngle = interpolate(frame, [0, 300], [0, 360], {
    extrapolateRight: 'extend',
  });

  // Topic pulse: scale 1.0 -> 1.02 -> 1.0
  const topicScale = interpolate(
    frame,
    [10, 30, 50, 70],
    [0.92, 1.02, 1.0, 1.0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Session badge slide from left
  const badgeSlide = interpolate(
    frame,
    [5, 25],
    [-200, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Lens flare glow intensity
  const glowIntensity = interpolate(
    frame,
    [10, 40, 80],
    [0, 1, 0.5],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        padding: 80,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Animated gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: -200,
          background: `conic-gradient(from ${gradientAngle}deg at 70% 30%, ${COLORS.saffron}08, ${COLORS.indigo}06, ${COLORS.teal}05, ${COLORS.saffron}08)`,
        }}
      />

      {/* Dark overlay to keep text readable */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: `${COLORS.dark}E0`,
        }}
      />

      {/* Lens flare / glow behind title */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '10%',
          width: 700,
          height: 300,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.saffron}18, transparent 70%)`,
          opacity: glowIntensity,
          filter: 'blur(40px)',
        }}
      />

      {/* Sparkle particles around topic name */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const px = interpolate(
          frame + i * 50,
          [0, 200],
          [15 + i * 12, 70 - i * 5],
          { extrapolateRight: 'extend' },
        );
        const py = interpolate(
          frame + i * 80,
          [0, 250],
          [25 + i * 5, 55 - i * 3],
          { extrapolateRight: 'extend' },
        );
        const sparkleOpacity = interpolate(
          frame,
          [10 + i * 5, 30 + i * 5, 60 + i * 5],
          [0, 0.4, 0.15],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        );
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${((px % 80) + 80) % 80 + 5}%`,
              top: `${((py % 50) + 50) % 50 + 15}%`,
              width: i % 2 === 0 ? 3 : 5,
              height: i % 2 === 0 ? 3 : 5,
              borderRadius: '50%',
              backgroundColor: [COLORS.saffron, COLORS.gold, COLORS.teal, COLORS.indigo, COLORS.gold, COLORS.saffron][i],
              opacity: sparkleOpacity,
              zIndex: 1,
            }}
          />
        );
      })}

      {/* Session badge - slides in from left */}
      <div
        style={{
          opacity: fadeIn(frame, 5),
          transform: `translateX(${badgeSlide}px)`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            backgroundColor: COLORS.saffron,
            color: COLORS.white,
            padding: '8px 20px',
            borderRadius: 6,
            fontSize: SIZES.caption,
            fontFamily: FONTS.text,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Session {sessionNumber}
        </div>
        {language && (
          <div
            style={{
              backgroundColor: COLORS.teal + '20',
              color: COLORS.teal,
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: SIZES.caption,
              fontFamily: FONTS.code,
              fontWeight: 600,
            }}
          >
            {language.toUpperCase()}
          </div>
        )}
      </div>

      {/* Topic name - pulses on reveal */}
      <div
        style={{
          fontSize: SIZES.heading1,
          fontFamily: FONTS.heading,
          fontWeight: 800,
          color: COLORS.saffron,
          lineHeight: 1.1,
          marginBottom: 16,
          opacity: fadeIn(frame, 10),
          transform: `scale(${topicScale})`,
          transformOrigin: 'left center',
          textShadow: `0 0 ${60 * glowIntensity}px ${COLORS.saffron}33`,
          position: 'relative',
          zIndex: 2,
        }}
      >
        {topic}
      </div>

      {/* Subtitle / Title */}
      <div
        style={{
          fontSize: SIZES.heading3,
          fontFamily: FONTS.text,
          fontWeight: 400,
          color: COLORS.gray,
          marginBottom: 50,
          opacity: fadeIn(frame, 20),
          transform: `translateY(${slideUp(frame, 20, 30)}px)`,
          position: 'relative',
          zIndex: 2,
        }}
      >
        {title}
      </div>

      {/* Divider line - animated width */}
      <div
        style={{
          width: fadeIn(frame, 30) * 200,
          height: 3,
          background: `linear-gradient(90deg, ${COLORS.saffron}, ${COLORS.gold})`,
          marginBottom: 40,
          borderRadius: 2,
          position: 'relative',
          zIndex: 2,
        }}
      />

      {/* Objectives */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 2 }}>
        <div
          style={{
            fontSize: SIZES.bodySmall,
            fontFamily: FONTS.text,
            color: COLORS.gray,
            textTransform: 'uppercase',
            letterSpacing: 2,
            opacity: fadeIn(frame, 35),
          }}
        >
          What You'll Learn
        </div>
        {objectives.map((obj, idx) => {
          const delay = stagger(idx, 40, 10);
          const itemSpring = springIn(frame, delay);
          return (
            <div
              key={idx}
              style={{
                fontSize: SIZES.body,
                fontFamily: FONTS.text,
                color: COLORS.white,
                opacity: itemSpring,
                transform: `translateX(${(1 - itemSpring) * 40}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: COLORS.gold,
                  flexShrink: 0,
                  boxShadow: `0 0 8px ${COLORS.gold}44`,
                }}
              />
              {obj}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export default TitleSlide;
