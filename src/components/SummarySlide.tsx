import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, stagger } from '../lib/animations';

interface SummarySlideProps {
  takeaways: string[];
  topic: string;
  startFrame?: number;
}

const SummarySlide: React.FC<SummarySlideProps> = ({
  takeaways,
  topic,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();

  const headingOpacity = fadeIn(frame, startFrame);
  const headingY = slideUp(frame, startFrame, 50);

  const topicOpacity = fadeIn(frame, startFrame + 30 + takeaways.length * 15);

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
          color: COLORS.gold,
          marginBottom: 48,
          fontFamily: FONTS.heading,
        }}
      >
        Key Takeaways
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {takeaways.map((takeaway, index) => {
          const itemStart = stagger(index, startFrame + 20, 15);
          const itemOpacity = fadeIn(frame, itemStart);
          const itemY = slideUp(frame, itemStart, 30);

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
                  fontSize: SIZES.body,
                  color: COLORS.teal,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                &#10003;
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

      <div
        style={{
          opacity: topicOpacity,
          position: 'absolute',
          bottom: 60,
          left: 100,
          fontSize: SIZES.bodySmall,
          color: COLORS.gray,
        }}
      >
        {topic}
      </div>
    </AbsoluteFill>
  );
};

export default SummarySlide;
