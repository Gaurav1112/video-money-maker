import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = {
  red: '#EF4444',
  green: '#22C55E',
  dark: '#0C0A15',
  darkAlt: '#1A1625',
  white: '#FFFFFF',
  gray: '#A9ACB3',
  saffron: '#E85D26',
};

interface BeforeAfterSplitProps {
  beforeTitle: string;
  afterTitle: string;
  beforeBullets: string[];
  afterBullets: string[];
  sceneProgress?: number;
}

export const BeforeAfterSplit: React.FC<BeforeAfterSplitProps> = ({
  beforeTitle,
  afterTitle,
  beforeBullets,
  afterBullets,
  sceneProgress = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1 (0-0.3): Before panel slides in
  const beforeEntrance = spring({
    frame: Math.max(0, sceneProgress * 300),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  // Phase 2 (0.3-0.5): Divider draws
  const dividerProgress = interpolate(sceneProgress, [0.3, 0.5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 3 (0.5-0.8): After panel slides in
  const afterEntrance = spring({
    frame: Math.max(0, (sceneProgress - 0.5) * 300),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.9 },
  });

  // Phase 4 (0.8-1.0): Metrics appear
  const metricsOpacity = interpolate(sceneProgress, [0.8, 0.95], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const panelStyle = (color: string, entrance: number, fromLeft: boolean): React.CSSProperties => ({
    flex: '0 0 48%',
    padding: '32px 28px',
    borderRadius: 16,
    background: `${COLORS.darkAlt}`,
    border: `2px solid ${color}44`,
    boxShadow: `0 0 ${20 * entrance}px ${color}22`,
    transform: `translateX(${fromLeft ? -1 : 1}${interpolate(entrance, [0, 1], [80, 0])}px)`,
    opacity: entrance,
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        padding: '60px 40px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* BEFORE panel */}
      <div style={panelStyle(COLORS.red, beforeEntrance, true)}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.red,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>{'\u274C'}</span> {beforeTitle}
        </div>
        {beforeBullets.map((bullet, i) => {
          const bulletDelay = 0.05 + i * 0.06;
          const bulletOpacity = interpolate(sceneProgress, [bulletDelay, bulletDelay + 0.1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                fontSize: 16,
                color: COLORS.gray,
                marginBottom: 12,
                opacity: bulletOpacity,
                paddingLeft: 16,
                borderLeft: `3px solid ${COLORS.red}44`,
                lineHeight: 1.5,
              }}
            >
              {bullet}
            </div>
          );
        })}
      </div>

      {/* DIVIDER */}
      <div
        style={{
          width: 4,
          height: `${dividerProgress * 70}%`,
          background: `linear-gradient(180deg, ${COLORS.saffron}, ${COLORS.saffron}00)`,
          borderRadius: 2,
          margin: '0 16px',
          position: 'relative',
        }}
      >
        {dividerProgress > 0.5 && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: COLORS.dark,
              border: `2px solid ${COLORS.saffron}`,
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.saffron,
              opacity: dividerProgress,
            }}
          >
            VS
          </div>
        )}
      </div>

      {/* AFTER panel */}
      <div style={panelStyle(COLORS.green, afterEntrance, false)}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.green,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 18 }}>{'\u2705'}</span> {afterTitle}
        </div>
        {afterBullets.map((bullet, i) => {
          const bulletDelay = 0.55 + i * 0.06;
          const bulletOpacity = interpolate(sceneProgress, [bulletDelay, bulletDelay + 0.1], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={i}
              style={{
                fontSize: 16,
                color: COLORS.gray,
                marginBottom: 12,
                opacity: bulletOpacity,
                paddingLeft: 16,
                borderLeft: `3px solid ${COLORS.green}44`,
                lineHeight: 1.5,
              }}
            >
              {bullet}
            </div>
          );
        })}
      </div>
    </div>
  );
};
