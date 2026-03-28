import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, spring, useVideoConfig } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, scaleIn } from '../lib/animations';
import { useSync } from '../hooks/useSync';
import type { AnimationCue } from '../types';

interface DiagramSlideProps {
  svgContent: string;
  title: string;
  startFrame?: number;
  endFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: AnimationCue[];
}

const DiagramSlide: React.FC<DiagramSlideProps> = ({
  svgContent,
  title,
  startFrame = 0,
  endFrame,
  sceneIndex,
  sceneStartFrame,
  animationCues,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const sync = useSync(sceneIndex ?? 0, sceneStartFrame ?? startFrame);

  const titleOpacity = fadeIn(frame, startFrame);
  const diagramOpacity = fadeIn(frame, startFrame + 15);

  const resolvedEndFrame = endFrame ?? durationInFrames;

  const hasSyncData = sync.isNarrating || sync.wordsSpoken > 0;
  const revealProgress = hasSyncData
    ? sync.sceneProgress
    : interpolate(frame - startFrame, [0, resolvedEndFrame - startFrame], [0, 1], {
        extrapolateRight: 'clamp',
      });

  const svgScale = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const clipPercent = Math.min(100, revealProgress * 120);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 80px',
        fontFamily: FONTS.text,
      }}
    >
      <div
        style={{
          opacity: titleOpacity,
          fontSize: SIZES.heading2,
          fontWeight: 700,
          color: COLORS.saffron,
          marginBottom: 40,
          textAlign: 'center',
          fontFamily: FONTS.heading,
        }}
      >
        {title}
      </div>

      <div
        style={{
          opacity: diagramOpacity,
          transform: `scale(${svgScale})`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          filter: `drop-shadow(0 0 30px ${COLORS.saffron}44)`,
          clipPath: `inset(0 ${100 - clipPercent}% 0 0)`,
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </AbsoluteFill>
  );
};

export default DiagramSlide;
