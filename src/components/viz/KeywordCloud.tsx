import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';

interface KeywordCloudProps {
  sync: SyncState;
  keywords: string[];
  frame: number;
  variant?: string;
}

export const KeywordCloud: React.FC<KeywordCloudProps> = ({ sync, keywords, frame }) => {
  const { fps } = useVideoConfig();
  const displayKeywords = keywords.length > 0 ? keywords : ['concept', 'learn', 'build', 'code'];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
      }}
    >
      {displayKeywords.map((keyword, i) => {
        const isCurrentWord =
          sync.currentWord.toLowerCase().includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(sync.currentWord.toLowerCase());

        const baseScale = spring({
          frame: frame - i * 8,
          fps,
          config: { damping: 15, stiffness: 100 },
        });

        const pulseScale = isCurrentWord ? 1.3 : 1.0;
        const color = isCurrentWord ? '#E85D26' : '#A9ACB3';
        const opacity = interpolate(baseScale, [0, 1], [0, isCurrentWord ? 1 : 0.5]);

        return (
          <span
            key={keyword}
            style={{
              fontSize: isCurrentWord ? 32 : 20,
              fontWeight: isCurrentWord ? 700 : 400,
              color,
              opacity,
              transform: `scale(${baseScale * pulseScale})`,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            {keyword}
          </span>
        );
      })}
    </div>
  );
};
