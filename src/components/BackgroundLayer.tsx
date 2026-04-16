import React from 'react';
import { AbsoluteFill } from 'remotion';

interface BackgroundLayerProps {
  sceneType?: string;
}

// Scene-specific subtle background tints on the light base
const SCENE_TINTS: Record<string, string> = {
  title: '#F5F3EF',
  text: '#F5F3EF',
  code: '#F8FAFC',    // slightly cooler for code
  diagram: '#F5F3EF',
  table: '#FEF9F0',   // slightly warmer for comparisons
  interview: '#F0FDF4', // slight green tint for interview
  review: '#FFF7ED',   // slight warm for quiz
  summary: '#F5F3EF',
};

const BackgroundLayer: React.FC<BackgroundLayerProps> = ({ sceneType = 'text' }) => {
  const bg = SCENE_TINTS[sceneType] || '#F5F3EF';

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      {/* Out-of-focus bokeh shapes for depth */}
      {[0.15, 0.7, 0.4, 0.85].map((x, i) => (
        <div key={`bokeh-${i}`} style={{
          position: 'absolute',
          left: `${x * 100}%`, top: `${(i * 25 + 10)}%`,
          width: 120 + i * 40, height: 120 + i * 40,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(37,99,235,0.05) 0%, transparent 70%)`,
          filter: 'blur(30px)',
        }} />
      ))}
    </AbsoluteFill>
  );
};

export default BackgroundLayer;
