import React from 'react';
import { AbsoluteFill } from 'remotion';

export interface HookCardShortProps {
  hookText: string;
  topic?: string;
}

export const HookCardShort: React.FC<HookCardShortProps> = ({ hookText, topic }) => {
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 60px',
      }}
    >
      {topic && (
        <div style={{ fontSize: 36, color: '#ffffff99', fontFamily: 'Inter, sans-serif', marginBottom: 32, textAlign: 'center' }}>
          {topic}
        </div>
      )}
      <div style={{ fontSize: 72, fontWeight: 900, color: '#ffffff', textAlign: 'center', lineHeight: 1.15, fontFamily: 'Inter, sans-serif', textShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
        {hookText}
      </div>
    </AbsoluteFill>
  );
};
