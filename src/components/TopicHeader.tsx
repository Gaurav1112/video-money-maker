import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';

interface TopicHeaderProps {
  topic: string;
  sessionNumber: number;
  language: string;
}

const TopicHeader: React.FC<TopicHeaderProps> = ({
  topic,
  sessionNumber,
  language,
}) => {
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 32px',
          backgroundColor: `${COLORS.dark}DD`,
          fontFamily: FONTS.text,
        }}
      >
        <div
          style={{
            fontSize: SIZES.caption,
            color: COLORS.gray,
            fontWeight: 500,
          }}
        >
          {topic}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div
            style={{
              fontSize: SIZES.caption,
              color: COLORS.saffron,
              fontWeight: 600,
              backgroundColor: `${COLORS.saffron}22`,
              padding: '4px 12px',
              borderRadius: 6,
            }}
          >
            Session {sessionNumber}
          </div>

          <div
            style={{
              fontSize: SIZES.caption,
              color: COLORS.teal,
              fontWeight: 600,
              backgroundColor: `${COLORS.teal}22`,
              padding: '4px 12px',
              borderRadius: 6,
            }}
          >
            {language}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default TopicHeader;
