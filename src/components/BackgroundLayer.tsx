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
    <AbsoluteFill style={{ backgroundColor: bg }} />
  );
};

export default BackgroundLayer;
