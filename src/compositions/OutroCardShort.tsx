import React from 'react';
import { AbsoluteFill } from 'remotion';

export interface OutroCardShortProps {
  topic?: string;
  ctaText?: string;
}

export const OutroCardShort: React.FC<OutroCardShortProps> = ({
  topic,
  ctaText = 'Follow for daily tech in 60 seconds',
}) => {
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, #141e30 0%, #243b55 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 60px',
      }}
    >
      {topic && (
        <div style={{ fontSize: 48, fontWeight: 700, color: '#ffffff', textAlign: 'center', marginBottom: 48, fontFamily: 'Inter, sans-serif' }}>
          {topic}
        </div>
      )}
      <div style={{ fontSize: 64, fontWeight: 900, color: '#4fc3f7', textAlign: 'center', lineHeight: 1.2, fontFamily: 'Inter, sans-serif' }}>
        {ctaText}
      </div>
      <div style={{ position: 'absolute', bottom: 100, fontSize: 32, color: '#ffffff60', fontFamily: 'Inter, sans-serif' }}>
        👍 Like · 🔔 Subscribe · 💬 Comment
      </div>
    </AbsoluteFill>
  );
};
