import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';

interface NarratorIndicatorProps {
  /** Whether narration is currently active */
  isActive?: boolean;
  /** Label to show (e.g. "Guru Sishya") */
  label?: string;
}

/**
 * NarratorIndicator - A small pulsing waveform/speaker icon in the bottom-left
 * that shows "someone is speaking". Gives the tutorial a human, personal feel.
 */
const NarratorIndicator: React.FC<NarratorIndicatorProps> = ({
  isActive = true,
  label = 'Guru Sishya',
}) => {
  const frame = useCurrentFrame();

  if (!isActive) return null;

  // Pulse opacity
  const pulse = interpolate(
    Math.sin(frame * 0.15),
    [-1, 1],
    [0.6, 1],
  );

  // Waveform bars
  const bars = [0, 1, 2, 3, 4];

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          bottom: 180,
          left: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: pulse,
          zIndex: 50,
        }}
      >
        {/* Speaker avatar circle */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${COLORS.saffron}, ${COLORS.gold})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 12px ${COLORS.saffron}44`,
          }}
        >
          {/* Speaker icon (simple triangle) */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '10px solid white',
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
              marginLeft: 3,
            }}
          />
        </div>

        {/* Waveform bars */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            height: 24,
          }}
        >
          {bars.map((i) => {
            const barHeight = interpolate(
              Math.sin(frame * 0.2 + i * 1.2),
              [-1, 1],
              [4, 18],
            );
            const barColors = [COLORS.saffron, COLORS.gold, COLORS.saffron, COLORS.gold, COLORS.saffron];
            return (
              <div
                key={i}
                style={{
                  width: 3,
                  height: barHeight,
                  backgroundColor: barColors[i],
                  borderRadius: 2,
                  opacity: 0.8,
                }}
              />
            );
          })}
        </div>

        {/* Label */}
        <div
          style={{
            fontSize: SIZES.caption - 2,
            fontFamily: FONTS.text,
            color: COLORS.gray,
            fontWeight: 500,
            letterSpacing: 0.5,
          }}
        >
          {label}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default NarratorIndicator;
