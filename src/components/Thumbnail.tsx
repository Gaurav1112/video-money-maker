import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';

interface ThumbnailProps {
  topic: string;
  sessionNumber: number;
  category: string;
  language: string;
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  topic,
  sessionNumber,
  category,
  language,
}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONTS.text,
      }}
    >
      {/* Saffron accent glow */}
      <div
        style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.saffron}33 0%, transparent 70%)`,
        }}
      />

      {/* Bottom accent line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: COLORS.saffron,
        }}
      />

      {/* Topic name */}
      <div
        style={{
          fontSize: SIZES.heading1 + 8,
          fontWeight: 800,
          color: COLORS.saffron,
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: 1000,
          padding: '0 60px',
          fontFamily: FONTS.heading,
        }}
      >
        {topic}
      </div>

      {/* Badges row */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          marginTop: 40,
          position: 'absolute',
          bottom: 40,
        }}
      >
        <div
          style={{
            fontSize: SIZES.bodySmall,
            fontWeight: 700,
            color: COLORS.white,
            backgroundColor: COLORS.saffron,
            padding: '8px 20px',
            borderRadius: 8,
          }}
        >
          Session {sessionNumber}
        </div>

        <div
          style={{
            fontSize: SIZES.bodySmall,
            fontWeight: 700,
            color: COLORS.white,
            backgroundColor: COLORS.indigo,
            padding: '8px 20px',
            borderRadius: 8,
          }}
        >
          {category}
        </div>

        <div
          style={{
            fontSize: SIZES.bodySmall,
            fontWeight: 700,
            color: COLORS.dark,
            backgroundColor: COLORS.teal,
            padding: '8px 20px',
            borderRadius: 8,
          }}
        >
          {language}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default Thumbnail;
