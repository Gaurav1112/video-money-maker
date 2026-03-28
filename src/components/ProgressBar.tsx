import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, spring, useVideoConfig } from 'remotion';
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
  /** Total word count for tick marks */
  totalWords?: number;
  /** Current word index for segment pulsing */
  currentWordIndex?: number;
  /** Scene name for transition label */
  sceneName?: string;
  /** Frame when current scene started (for slide-in animation) */
  sceneStartFrame?: number;
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
  totalWords = 0,
  currentWordIndex = 0,
  sceneName,
  sceneStartFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const clampedProgress = Math.min(1, Math.max(0, progress));

  // Shimmer effect on the progress fill
  const shimmerX = interpolate(
    frame % 120,
    [0, 120],
    [-100, 200],
  );

  // Current word segment glow pulse
  const wordPulse = interpolate(
    Math.sin(frame * 0.15),
    [-1, 1],
    [0.5, 1.0],
  );

  // Scene name slide-in animation
  const sceneTransitionFrame = sceneStartFrame ?? 0;
  const nameSlideSpr = spring({
    frame: Math.max(0, frame - sceneTransitionFrame),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });
  const nameSlideX = interpolate(nameSlideSpr, [0, 1], [60, 0]);
  const nameOpacity = interpolate(nameSlideSpr, [0, 1], [0, 1]);

  // Generate word boundary tick marks (show up to 30 ticks for readability)
  const tickCount = totalWords > 0 ? Math.min(totalWords, 30) : 0;
  const tickStep = totalWords > 30 ? Math.floor(totalWords / 30) : 1;

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

        {/* Word boundary tick marks */}
        {totalWords > 0 && Array.from({ length: tickCount }).map((_, i) => {
          const wordIdx = i * tickStep;
          const tickPos = wordIdx / totalWords;
          const isPast = tickPos <= clampedProgress;
          const isCurrent = Math.abs(wordIdx - currentWordIndex) <= tickStep;

          return (
            <div
              key={`tick-${i}`}
              style={{
                position: 'absolute',
                bottom: 0,
                left: `${tickPos * 100}%`,
                width: 1,
                height: isCurrent ? 10 : 6,
                backgroundColor: isCurrent
                  ? COLORS.saffron
                  : isPast
                    ? `${COLORS.gold}44`
                    : `${COLORS.gray}20`,
                opacity: isCurrent ? wordPulse : 1,
                borderRadius: 1,
                boxShadow: isCurrent ? `0 0 6px ${COLORS.saffron}66` : 'none',
                transform: 'translateX(-50%)',
              }}
            />
          );
        })}

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

        {/* Progress dot with glow */}
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
              boxShadow: `0 0 ${10 + wordPulse * 6}px ${COLORS.gold}66`,
              border: `2px solid ${COLORS.dark}`,
            }}
          />
        )}
      </div>

      {/* Scene name label — slides in at scene transitions */}
      {sceneName && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 32,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: `${COLORS.dark}CC`,
            padding: '4px 12px',
            borderRadius: 6,
            border: `1px solid ${COLORS.saffron}20`,
            transform: `translateX(${nameSlideX}px)`,
            opacity: nameOpacity,
          }}
        >
          <div
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: COLORS.saffron,
              boxShadow: `0 0 6px ${COLORS.saffron}`,
            }}
          />
          <span
            style={{
              fontSize: SIZES.caption - 3,
              fontFamily: FONTS.text,
              color: `${COLORS.white}BB`,
              fontWeight: 600,
              letterSpacing: '0.03em',
            }}
          >
            {sceneName}
          </span>
        </div>
      )}

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
