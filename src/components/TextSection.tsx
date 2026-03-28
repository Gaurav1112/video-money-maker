import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, stagger, springIn } from '../lib/animations';

interface TextSectionProps {
  heading: string;
  bullets: string[];
  startFrame?: number;
}

// Rotating accent colors for bullet number badges
const BULLET_COLORS = [
  COLORS.saffron,
  COLORS.teal,
  COLORS.indigo,
  COLORS.gold,
  COLORS.saffron,
  COLORS.teal,
];

const TextSection: React.FC<TextSectionProps> = ({
  heading,
  bullets,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();

  const headingOpacity = fadeIn(frame, startFrame);
  const headingY = slideUp(frame, startFrame, 60);

  // Progressive underline on heading
  const underlineWidth = interpolate(
    frame,
    [startFrame + 10, startFrame + 40],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // TUTORIAL FEEL: Stagger bullets with MORE delay so they appear one at a time
  // Each bullet gets 25 frames (almost 1 second) of exclusive screen time
  const BULLET_STAGGER = 25;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #0C0A15 0%, #0E0B1A 50%, #0C0A15 100%)`,
        justifyContent: 'center',
        padding: '80px 100px',
        fontFamily: FONTS.text,
      }}
    >
      {/* Subtle indigo gradient orb */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          right: '-5%',
          width: 500,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.indigo}08, transparent 70%)`,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Left accent line (Fireship-style) */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: '15%',
          bottom: '15%',
          width: 3,
          background: `linear-gradient(180deg, transparent, ${COLORS.saffron}40, ${COLORS.saffron}20, transparent)`,
          borderRadius: 2,
        }}
      />

      {/* Heading with progressive underline */}
      <div style={{ marginBottom: 40, position: 'relative' }}>
        <div
          style={{
            opacity: headingOpacity,
            transform: `translateY(${headingY}px)`,
            fontSize: SIZES.heading2,
            fontWeight: 700,
            color: COLORS.saffron,
            fontFamily: FONTS.heading,
            paddingBottom: 12,
          }}
        >
          {heading}
        </div>
        {/* Animated underline */}
        <div
          style={{
            width: `${underlineWidth}%`,
            maxWidth: 300,
            height: 3,
            background: `linear-gradient(90deg, ${COLORS.saffron}, ${COLORS.gold}80)`,
            borderRadius: 2,
          }}
        />
      </div>

      {/* Card-style bullets with number badges - appear ONE AT A TIME */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {bullets.map((bullet, index) => {
          const itemStart = stagger(index, startFrame + 20, BULLET_STAGGER);
          const itemSpring = springIn(frame, itemStart);
          const itemY = slideUp(frame, itemStart, 30, 12);
          const accentColor = BULLET_COLORS[index % BULLET_COLORS.length];

          // Focus indicator: current bullet gets a glow
          const nextBulletStart = stagger(index + 1, startFrame + 20, BULLET_STAGGER);
          const isCurrent = frame >= itemStart && frame < nextBulletStart;
          const focusGlow = isCurrent
            ? interpolate(
                Math.sin(frame * 0.1),
                [-1, 1],
                [0.5, 1],
              )
            : 0.7;

          return (
            <div
              key={index}
              style={{
                opacity: itemSpring * (isCurrent ? 1 : focusGlow),
                transform: `translateY(${itemY}px) scale(${isCurrent ? 1.01 : 1})`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                backgroundColor: `${COLORS.darkAlt}`,
                borderRadius: 10,
                padding: '18px 24px',
                borderLeft: `4px solid ${accentColor}`,
                boxShadow: isCurrent
                  ? `0 2px 20px ${accentColor}22, 0 0 0 1px ${accentColor}15`
                  : `0 2px 12px ${COLORS.dark}88`,
                transition: 'box-shadow 0.2s ease',
              }}
            >
              {/* Number badge */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: accentColor + '20',
                  color: accentColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: SIZES.caption,
                  fontWeight: 700,
                  fontFamily: FONTS.code,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                {index + 1}
              </div>
              <div
                style={{
                  fontSize: SIZES.body,
                  color: COLORS.white,
                  lineHeight: 1.5,
                }}
              >
                {bullet}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export default TextSection;
