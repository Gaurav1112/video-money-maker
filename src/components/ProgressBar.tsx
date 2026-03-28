import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';

interface SceneMarker {
  position: number; // 0-1 fraction
  type: string;
  label: string;
}

interface ProgressBarProps {
  progress: number;
  sceneMarkers?: SceneMarker[];
  currentSceneType?: string;
}

const SCENE_ICONS: Record<string, string> = {
  title: '\u{1F3AC}',      // clapper board
  text: '\u{1F4DD}',       // memo
  code: '\u{1F4BB}',       // laptop
  diagram: '\u{1F4CA}',    // chart
  table: '\u{1F5C2}',      // file dividers
  interview: '\u{1F3AF}',  // target
  review: '\u{2753}',      // question mark
  summary: '\u{1F3C6}',    // trophy
};

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress = 0,
  sceneMarkers = [],
  currentSceneType,
}) => {
  const frame = useCurrentFrame();
  const clampedProgress = Math.min(1, Math.max(0, progress));

  // Shimmer effect
  const shimmerX = interpolate(
    frame % 120,
    [0, 120],
    [-100, 200],
  );

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: `${COLORS.darkAlt}`,
        }}
      >
        {/* Progress fill */}
        <div
          style={{
            height: '100%',
            width: `${clampedProgress * 100}%`,
            background: `linear-gradient(90deg, ${COLORS.saffron}, ${COLORS.gold})`,
            borderRadius: '0 2px 2px 0',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Shimmer */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: `${shimmerX}%`,
              width: 60,
              height: '100%',
              background: `linear-gradient(90deg, transparent, ${COLORS.white}33, transparent)`,
            }}
          />
        </div>

        {/* Scene markers */}
        {sceneMarkers.map((marker, i) => {
          const isPast = marker.position <= clampedProgress;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                bottom: 0,
                left: `${marker.position * 100}%`,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* Tick mark */}
              <div
                style={{
                  width: 2,
                  height: 10,
                  backgroundColor: isPast ? COLORS.gold + '66' : COLORS.gray + '33',
                  borderRadius: 1,
                }}
              />
            </div>
          );
        })}

        {/* Progress dot */}
        {clampedProgress > 0.01 && (
          <div
            style={{
              position: 'absolute',
              top: -4,
              left: `${clampedProgress * 100}%`,
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: COLORS.gold,
              transform: 'translateX(-50%)',
              boxShadow: `0 0 10px ${COLORS.gold}66`,
              border: `2px solid ${COLORS.dark}`,
            }}
          />
        )}
      </div>

      {/* Current scene type indicator (bottom-right) */}
      {currentSceneType && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            right: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: `${COLORS.dark}CC`,
            padding: '4px 10px',
            borderRadius: 6,
            border: `1px solid ${COLORS.gray}15`,
          }}
        >
          <span style={{ fontSize: 12 }}>
            {SCENE_ICONS[currentSceneType] || '\u{1F4DD}'}
          </span>
          <span
            style={{
              fontSize: SIZES.caption - 3,
              fontFamily: FONTS.code,
              color: COLORS.gray,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {currentSceneType}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default ProgressBar;
