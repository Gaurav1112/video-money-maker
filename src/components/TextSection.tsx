import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, stagger } from '../lib/animations';

interface TextSectionProps {
  heading: string;
  bullets: string[];
  startFrame?: number;
}

const TextSection: React.FC<TextSectionProps> = ({
  heading,
  bullets,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();

  const headingOpacity = fadeIn(frame, startFrame);
  const headingY = slideUp(frame, startFrame, 60);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        justifyContent: 'center',
        padding: '80px 100px',
        fontFamily: FONTS.text,
      }}
    >
      <div
        style={{
          opacity: headingOpacity,
          transform: `translateY(${headingY}px)`,
          fontSize: SIZES.heading2,
          fontWeight: 700,
          color: COLORS.saffron,
          marginBottom: 40,
          fontFamily: FONTS.heading,
        }}
      >
        {heading}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {bullets.map((bullet, index) => {
          const itemStart = stagger(index, startFrame + 20, 15);
          const itemOpacity = fadeIn(frame, itemStart);
          const itemY = slideUp(frame, itemStart, 40);

          return (
            <div
              key={index}
              style={{
                opacity: itemOpacity,
                transform: `translateY(${itemY}px)`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: COLORS.gold,
                  marginTop: 10,
                  flexShrink: 0,
                }}
              />
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
