import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideIn, scaleIn } from '../lib/animations';

interface InterviewInsightProps {
  insight: string;
  tip: string;
  startFrame?: number;
}

const InterviewInsight: React.FC<InterviewInsightProps> = ({
  insight,
  tip,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();

  const opacity = fadeIn(frame, startFrame);
  const xOffset = slideIn(frame, startFrame, -300);
  const scale = scaleIn(frame, startFrame);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px 100px',
        fontFamily: FONTS.text,
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateX(${-xOffset}px) scale(${scale})`,
          border: `3px solid ${COLORS.gold}`,
          borderRadius: 16,
          padding: '48px 56px',
          maxWidth: 900,
          width: '100%',
          backgroundColor: `${COLORS.darkAlt}`,
          boxShadow: `0 0 40px ${COLORS.gold}22`,
        }}
      >
        <div
          style={{
            fontSize: SIZES.heading3,
            fontWeight: 700,
            color: COLORS.gold,
            marginBottom: 28,
            fontFamily: FONTS.heading,
          }}
        >
          Interview Insight
        </div>

        <div
          style={{
            fontSize: SIZES.body + 2,
            color: COLORS.white,
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {insight}
        </div>

        <div
          style={{
            fontSize: SIZES.body,
            color: COLORS.teal,
            lineHeight: 1.5,
            fontStyle: 'italic',
            borderTop: `1px solid ${COLORS.gold}44`,
            paddingTop: 20,
          }}
        >
          {tip}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default InterviewInsight;
