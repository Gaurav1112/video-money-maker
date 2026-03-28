import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, Audio, staticFile, spring, useVideoConfig } from 'remotion';
import { COLORS, LOADED_FONTS, SIZES } from '../lib/theme';

interface SceneTransitionFlashProps {
  /** Scene type for color theming and label */
  sceneType?: string;
}

// --- Scene metadata -----------------------------------------------------------

interface SceneMeta {
  color: string;
  icon: string;
  label: string;
}

const SCENE_META: Record<string, SceneMeta> = {
  title:     { color: COLORS.saffron,  icon: '🎬', label: 'INTRO'        },
  text:      { color: COLORS.indigo,   icon: '📝', label: 'CONCEPT'      },
  code:      { color: COLORS.teal,     icon: '</>', label: 'CODE'         },
  diagram:   { color: COLORS.indigo,   icon: '📐', label: 'DIAGRAM'      },
  table:     { color: COLORS.gold,     icon: '📊', label: 'COMPARISON'   },
  interview: { color: COLORS.saffron,  icon: '💼', label: 'INTERVIEW TIP'},
  review:    { color: COLORS.teal,     icon: '🎯', label: 'CHALLENGE'    },
  summary:   { color: COLORS.gold,     icon: '🏆', label: 'SUMMARY'      },
};

const DEFAULT_META: SceneMeta = { color: COLORS.saffron, icon: '▶', label: 'NEXT' };

// Total visible window — 15 frames (0.5 s at 30 fps)
const TRANSITION_FRAMES = 15;

// ---------------------------------------------------------------------------

const SceneTransitionFlash: React.FC<SceneTransitionFlashProps> = ({
  sceneType = 'text',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Nothing to render after the transition window
  if (frame > TRANSITION_FRAMES) return null;

  const meta = SCENE_META[sceneType] ?? DEFAULT_META;
  const { color, icon, label } = meta;

  // --- Flash overlay --------------------------------------------------------
  // Peaks hard at frame 3, fades by frame 15
  const flashOpacity = interpolate(
    frame,
    [0, 3, 7, 15],
    [0, 0.55, 0.25, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- Zoom pulse -----------------------------------------------------------
  // 1.0 → 1.03 → 1.0 — subtle but visible zoom on the overlay itself
  const scale = interpolate(
    frame,
    [0, 5, 15],
    [1.0, 1.03, 1.0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- Horizontal wipe line -------------------------------------------------
  const wipeX = interpolate(
    frame,
    [0, 12],
    [-5, 108],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const wipeOpacity = interpolate(
    frame,
    [0, 3, 10, 15],
    [0, 0.9, 0.5, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- Label badge ----------------------------------------------------------
  // Slides in from right, peaks mid-transition, then fades
  const labelX = interpolate(
    frame,
    [0, 5, 10, 15],
    [80, 0, 0, -80],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const labelOpacity = interpolate(
    frame,
    [0, 4, 10, 15],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // --- Spring scale for the badge -------------------------------------------
  const badgeScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
    from: 0.6,
    to: 1,
  });

  // Clamp badgeScale to 1 after frame 10 so it doesn't linger
  const clampedBadgeScale = frame > 10 ? 1 : badgeScale;

  // Is it the code scene? The "</>" icon is text, not emoji — needs a mono font
  const isCodeScene = sceneType === 'code';

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 50 }}>
      {/* Whoosh sound — plays once at frame 0 */}
      <Audio
        src={staticFile('audio/sfx/whoosh-in.wav')}
        startFrom={0}
        endAt={TRANSITION_FRAMES}
        volume={0.6}
      />

      {/* Full-screen color flash with zoom */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: color,
          opacity: flashOpacity,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      />

      {/* Top & bottom edge accent bars */}
      {[0, 'auto'].map((top, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: top === 0 ? 0 : undefined,
            bottom: top === 'auto' ? 0 : undefined,
            left: 0,
            right: 0,
            height: 4,
            background: `linear-gradient(90deg, transparent, ${color}CC, ${color}, ${color}CC, transparent)`,
            opacity: wipeOpacity * 0.9,
          }}
        />
      ))}

      {/* Vertical wipe flash line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${wipeX}%`,
          width: 6,
          background: `linear-gradient(180deg, transparent 0%, ${color} 20%, #fff 50%, ${color} 80%, transparent 100%)`,
          opacity: wipeOpacity,
          boxShadow: `0 0 40px 16px ${color}66`,
        }}
      />

      {/* Scene-type badge — centered horizontally, vertically centered */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) translateX(${labelX}px) scale(${clampedBadgeScale})`,
          opacity: labelOpacity,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          backgroundColor: `${COLORS.dark}EE`,
          border: `2px solid ${color}`,
          borderRadius: 12,
          paddingTop: 14,
          paddingBottom: 14,
          paddingLeft: 24,
          paddingRight: 32,
          boxShadow: `0 0 32px 8px ${color}44, 0 4px 24px rgba(0,0,0,0.6)`,
        }}
      >
        {/* Icon */}
        <span
          style={{
            fontSize: 36,
            lineHeight: 1,
            fontFamily: isCodeScene
              ? 'JetBrains Mono, monospace'
              : LOADED_FONTS.text,
            color: color,
            fontWeight: isCodeScene ? 700 : undefined,
            letterSpacing: isCodeScene ? -1 : undefined,
          }}
        >
          {icon}
        </span>

        {/* Divider */}
        <div
          style={{
            width: 2,
            height: 36,
            backgroundColor: `${color}66`,
            borderRadius: 2,
          }}
        />

        {/* Label text */}
        <span
          style={{
            fontSize: SIZES.heading3,
            fontFamily: LOADED_FONTS.heading,
            fontWeight: 800,
            color: COLORS.white,
            letterSpacing: 3,
            textTransform: 'uppercase' as const,
            textShadow: `0 0 20px ${color}88`,
          }}
        >
          {label}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export default SceneTransitionFlash;
