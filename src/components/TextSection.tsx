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

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        justifyContent: 'center',
        padding: '80px 100px',
        fontFamily: FONTS.text,
      }}
    >
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

      {/* Card-style bullets with number badges */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {bullets.map((bullet, index) => {
          const itemStart = stagger(index, startFrame + 20, 8); // Faster stagger: 8 frames
          const itemSpring = springIn(frame, itemStart);
          const itemY = slideUp(frame, itemStart, 30, 12);
          const accentColor = BULLET_COLORS[index % BULLET_COLORS.length];

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
                padding: '18px 24px',
                borderLeft: `4px solid ${accentColor}`,
                boxShadow: `0 2px 12px ${COLORS.dark}88`,
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
