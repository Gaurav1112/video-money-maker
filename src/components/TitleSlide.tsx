import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, slideUp, scaleIn, stagger, slideIn } from '../lib/animations';

interface TitleSlideProps {
  topic: string;
  sessionNumber: number;
  title: string;
  objectives: string[];
  language?: string; // 'python' | 'java' etc.
}

const TitleSlide: React.FC<TitleSlideProps> = ({
  topic,
  sessionNumber,
  title,
  objectives,
  language,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        padding: 80,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {/* Background accent circle */}
      <div
        style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.saffron}15, transparent)`,
          opacity: fadeIn(frame, 0, 60),
        }}
      />

      {/* Session badge */}
      <div
        style={{
          opacity: fadeIn(frame, 5),
          transform: `translateY(${slideUp(frame, 5, 30)}px)`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
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

      {/* Topic name */}
      <div
        style={{
          fontSize: SIZES.heading1,
          fontFamily: FONTS.heading,
          fontWeight: 800,
          color: COLORS.saffron,
          lineHeight: 1.1,
          marginBottom: 16,
          opacity: fadeIn(frame, 10),
          transform: `translateY(${slideUp(frame, 10, 40)}px) scale(${scaleIn(frame, 10)})`,
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
        }}
      >
        {title}
      </div>

      {/* Divider line */}
      <div
        style={{
          width: fadeIn(frame, 30) * 200,
          height: 3,
          backgroundColor: COLORS.saffron,
          marginBottom: 40,
          borderRadius: 2,
        }}
      />

      {/* Objectives */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          const delay = stagger(idx, 40, 12);
          return (
            <div
              key={idx}
              style={{
                fontSize: SIZES.body,
                fontFamily: FONTS.text,
                color: COLORS.white,
                opacity: fadeIn(frame, delay),
                transform: `translateX(${slideIn(frame, delay, 40)}px)`,
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
