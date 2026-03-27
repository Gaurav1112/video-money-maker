import React from 'react';
import { useCurrentFrame, AbsoluteFill } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn, scaleIn } from '../lib/animations';

interface DiagramSlideProps {
  svgContent: string;
  title: string;
  startFrame?: number;
}

const DiagramSlide: React.FC<DiagramSlideProps> = ({
  svgContent,
  title,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();

  const titleOpacity = fadeIn(frame, startFrame);
  const diagramOpacity = fadeIn(frame, startFrame + 15);
  const diagramScale = scaleIn(frame, startFrame + 15);

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
          transform: `scale(${diagramScale})`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          filter: `drop-shadow(0 0 30px ${COLORS.saffron}44)`,
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </AbsoluteFill>
  );
};

export default DiagramSlide;
