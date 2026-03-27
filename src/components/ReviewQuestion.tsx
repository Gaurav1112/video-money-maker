import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp } from '../lib/animations';

interface ReviewQuestionProps {
  question: string;
  answer: string;
  startFrame?: number;
  revealDelay?: number;
}

const ReviewQuestion: React.FC<ReviewQuestionProps> = ({
  question,
  answer,
  startFrame = 0,
  revealDelay = 90,
}) => {
  const frame = useCurrentFrame();

  const questionOpacity = fadeIn(frame, startFrame);
  const questionY = slideUp(frame, startFrame, 50);

  const thinkOpacity = fadeIn(frame, startFrame + 20);

  const answerStart = startFrame + revealDelay;
  const answerOpacity = fadeIn(frame, answerStart);
  const answerY = slideUp(frame, answerStart, 40);

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
      <div style={{ maxWidth: 900, width: '100%' }}>
        {/* Question */}
        <div
          style={{
            opacity: questionOpacity,
            transform: `translateY(${questionY}px)`,
            fontSize: SIZES.heading3,
            fontWeight: 600,
            color: COLORS.white,
            lineHeight: 1.5,
            marginBottom: 40,
          }}
        >
          {question}
        </div>

        {/* Think about it */}
        <div
          style={{
            opacity: thinkOpacity * (1 - answerOpacity),
            fontSize: SIZES.body,
            color: COLORS.gray,
            fontStyle: 'italic',
            textAlign: 'center',
            marginBottom: 40,
          }}
        >
          Think about it...
        </div>

        {/* Answer */}
        <div
          style={{
            opacity: answerOpacity,
            transform: `translateY(${answerY}px)`,
            borderTop: `2px solid ${COLORS.teal}44`,
            paddingTop: 32,
          }}
        >
          <div
            style={{
              fontSize: SIZES.bodySmall,
              fontWeight: 700,
              color: COLORS.teal,
              marginBottom: 12,
              textTransform: 'uppercase' as const,
              letterSpacing: 2,
            }}
          >
            Answer
          </div>
          <div
            style={{
              fontSize: SIZES.body,
              color: COLORS.teal,
              lineHeight: 1.6,
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
