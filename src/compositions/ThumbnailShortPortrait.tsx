import React from 'react';
import { AbsoluteFill } from 'remotion';

export interface ThumbnailShortPortraitProps {
  topic: string;
  subtitle?: string;
}

export const ThumbnailShortPortrait: React.FC<ThumbnailShortPortraitProps> = ({ topic, subtitle }) => {
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 60px',
      }}
    >
      <div
        style={{
          fontSize: 96,
          fontWeight: 900,
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.1,
          fontFamily: 'Inter, sans-serif',
          textShadow: '0 4px 24px rgba(0,0,0,0.8)',
          letterSpacing: '-2px',
        }}
      >
        {topic}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 48,
            fontWeight: 600,
            color: '#a0a0ff',
            textAlign: 'center',
            marginTop: 40,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {subtitle}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          fontSize: 36,
          color: '#ffffff80',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        #Shorts • 60 sec
      </div>
    </AbsoluteFill>
  );
};
