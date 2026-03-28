import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, stagger, springIn } from '../lib/animations';

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

  // Animated border drawing effect
  const borderProgress = interpolate(
    frame,
    [15, 80],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Play indicator pulse
  const playPulse = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [0.4, 1],
  );
  const playScale = interpolate(
    frame,
    [0, 20, 40],
    [0, 1.2, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Generate star field particles (more and varied)
  const STAR_COUNT = 30;

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

      {/* Dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: `${COLORS.dark}E0`,
        }}
      />

      {/* Animated star/particle field */}
      {Array.from({ length: STAR_COUNT }).map((_, i) => {
        const seed = i * 137.508; // golden angle for distribution
        const baseX = ((seed * 7.31) % 100);
        const baseY = ((seed * 3.97) % 100);
        const driftX = Math.sin(frame * 0.008 + i * 0.7) * 3;
        const driftY = Math.cos(frame * 0.006 + i * 1.1) * 2;
        const twinkle = interpolate(
          Math.sin(frame * 0.05 + i * 1.3),
          [-1, 1],
          [0.05, i < 8 ? 0.6 : 0.3],
        );
        const size = i < 5 ? 3 : i < 12 ? 2 : 1;
        const starColor = i % 5 === 0 ? COLORS.saffron
          : i % 5 === 1 ? COLORS.gold
          : i % 5 === 2 ? COLORS.teal
          : i % 5 === 3 ? COLORS.indigo
          : COLORS.white;

        return (
          <div
            key={`star-${i}`}
            style={{
              position: 'absolute',
              left: `${baseX + driftX}%`,
              top: `${baseY + driftY}%`,
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: starColor,
              opacity: twinkle,
              boxShadow: i < 8 ? `0 0 ${size * 3}px ${starColor}66` : 'none',
              zIndex: 1,
            }}
          />
        );
      })}

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

      {/* Secondary glow orb */}
      <div
        style={{
          position: 'absolute',
          bottom: '15%',
          right: '5%',
          width: 400,
          height: 250,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.indigo}12, transparent 70%)`,
          opacity: glowIntensity * 0.6,
          filter: 'blur(50px)',
        }}
      />

      {/* Animated border that draws around content area */}
      <div
        style={{
          position: 'absolute',
          left: 40,
          top: 40,
          right: 40,
          bottom: 40,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {/* Top border */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: `${Math.min(borderProgress * 4, 1) * 100}%`,
          height: 2,
          background: `linear-gradient(90deg, ${COLORS.saffron}66, ${COLORS.gold}44)`,
          borderRadius: 1,
        }} />
        {/* Right border */}
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: 2,
          height: `${Math.max(0, Math.min((borderProgress - 0.25) * 4, 1)) * 100}%`,
          background: `linear-gradient(180deg, ${COLORS.gold}44, ${COLORS.teal}33)`,
          borderRadius: 1,
        }} />
        {/* Bottom border */}
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: `${Math.max(0, Math.min((borderProgress - 0.5) * 4, 1)) * 100}%`,
          height: 2,
          background: `linear-gradient(270deg, ${COLORS.teal}33, ${COLORS.indigo}33)`,
          borderRadius: 1,
          transformOrigin: 'right',
        }} />
        {/* Left border */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0,
          width: 2,
          height: `${Math.max(0, Math.min((borderProgress - 0.75) * 4, 1)) * 100}%`,
          background: `linear-gradient(0deg, ${COLORS.indigo}33, ${COLORS.saffron}44)`,
          borderRadius: 1,
          transformOrigin: 'bottom',
        }} />
        {/* Corner dots */}
        {borderProgress > 0.05 && (
          <div style={{
            position: 'absolute', top: -3, left: -3,
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: COLORS.saffron,
            opacity: 0.5,
            boxShadow: `0 0 8px ${COLORS.saffron}66`,
          }} />
        )}
        {borderProgress > 0.3 && (
          <div style={{
            position: 'absolute', top: -3, right: -3,
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: COLORS.gold,
            opacity: 0.4,
            boxShadow: `0 0 8px ${COLORS.gold}66`,
          }} />
        )}
        {borderProgress > 0.55 && (
          <div style={{
            position: 'absolute', bottom: -3, right: -3,
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: COLORS.teal,
            opacity: 0.4,
            boxShadow: `0 0 8px ${COLORS.teal}66`,
          }} />
        )}
        {borderProgress > 0.8 && (
          <div style={{
            position: 'absolute', bottom: -3, left: -3,
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: COLORS.indigo,
            opacity: 0.4,
            boxShadow: `0 0 8px ${COLORS.indigo}66`,
          }} />
        )}
      </div>

      {/* Pulsing PLAY indicator - top right */}
      <div
        style={{
          position: 'absolute',
          top: 70,
          right: 80,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: playPulse * fadeIn(frame, 5),
          transform: `scale(${playScale})`,
          zIndex: 3,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: COLORS.red,
            boxShadow: `0 0 ${12 * playPulse}px ${COLORS.red}88`,
          }}
        />
        <span
          style={{
            fontSize: SIZES.caption,
            fontFamily: FONTS.code,
            fontWeight: 700,
            color: COLORS.white,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          guru-sishya.in
        </span>
      </div>

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

      {/* Topic name - cinematic with glow */}
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
          textShadow: `0 0 ${80 * glowIntensity}px ${COLORS.saffron}55, 0 0 ${160 * glowIntensity}px ${COLORS.saffron}22, 0 2px 4px ${COLORS.dark}`,
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

      {/* Divider line - animated width with glow */}
      <div
        style={{
          width: fadeIn(frame, 30) * 200,
          height: 3,
          background: `linear-gradient(90deg, ${COLORS.saffron}, ${COLORS.gold})`,
          marginBottom: 40,
          borderRadius: 2,
          position: 'relative',
          zIndex: 2,
          boxShadow: `0 0 12px ${COLORS.saffron}44`,
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
