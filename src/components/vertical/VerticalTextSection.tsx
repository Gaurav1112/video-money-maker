import React from 'react';
import {
  useCurrentFrame,
  AbsoluteFill,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { FONTS } from '../../lib/theme';
import { VERTICAL, SAFE_ZONE, COMPONENT_DIMS } from '../../lib/vertical-layouts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerticalTextSectionProps {
  heading?: string;
  bullets?: string[];
  content?: string;
  narration?: string;
  startFrame?: number;
  endFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: any[];
  visualBeats?: any[];
  templateId?: string;
  templateVariant?: string;
  accentColor?: string;
  topic?: string;
  d2Svg?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BG = '#0C0A15';
const SAFFRON = '#E85D26';
const GOLD = '#FDB813';
const TEAL = '#1DD1A1';
const BULLET_COLORS = [SAFFRON, GOLD, TEAL] as const;

const CONTENT_WIDTH = 980;
const MARGIN_X = 50;
const MAX_BULLETS = 6;
const BULLET_STAGGER_FRAMES = 15;

// Layout y-positions
const HEADING_Y = 100;
const HEADING_ACCENT_HEIGHT = 50;
const HEADING_ACCENT_WIDTH = 6;
const BULLETS_START_Y = 280;
const BULLET_GAP = 60;   // was 24 — much more vertical spacing
const BULLET_LINE_HEIGHT = 1.6;
const DIAGRAM_Y = 750;
const DIAGRAM_WIDTH = 950;
const DIAGRAM_HEIGHT = 550;
const CAPTION_ZONE_Y = 1300;

// ---------------------------------------------------------------------------
// Helper: split content fallback
// ---------------------------------------------------------------------------

function getEffectiveBullets(bullets?: string[], content?: string): string[] {
  if (bullets && bullets.length > 0) {
    return bullets.slice(0, MAX_BULLETS);
  }
  if (content) {
    return content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, MAX_BULLETS);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Sub-component: single animated bullet
// ---------------------------------------------------------------------------

interface BulletProps {
  text: string;
  index: number;
  frame: number;
  fps: number;
  isFirst: boolean;
  color: string;
  sceneLocalFrame: number;
}

const AnimatedBullet: React.FC<BulletProps> = ({
  text,
  index,
  isFirst,
  color,
  sceneLocalFrame,
  fps,
}) => {
  const delayFrames = index * BULLET_STAGGER_FRAMES;
  const localFrame = Math.max(0, sceneLocalFrame - delayFrames);

  const tx = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
    from: 40,
    to: 0,
  });

  const opacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fontSize = isFirst ? 48 : 42;
  const fontWeight = isFirst ? 800 : 500;
  const textColor = isFirst ? '#FFFFFF' : 'rgba(255,255,255,0.92)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        transform: `translateX(${tx}px)`,
        opacity,
        marginBottom: BULLET_GAP,
        willChange: 'transform, opacity',
      }}
    >
      {/* Colored left border */}
      <div
        style={{
          width: 4,
          minHeight: fontSize * BULLET_LINE_HEIGHT,
          backgroundColor: color,
          borderRadius: 2,
          marginRight: 20,
          flexShrink: 0,
          alignSelf: 'stretch',
        }}
      />

      {/* Bullet text */}
      <span
        style={{
          fontFamily: FONTS.text,
          fontSize,
          fontWeight,
          color: textColor,
          lineHeight: BULLET_LINE_HEIGHT,
          flex: 1,
          letterSpacing: isFirst ? '-0.3px' : '0px',
        }}
      >
        {text}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-component: heading row with saffron accent bar
// ---------------------------------------------------------------------------

interface HeadingRowProps {
  heading: string;
  frame: number;
  fps: number;
  accentColor?: string;
}

const HeadingRow: React.FC<HeadingRowProps> = ({
  heading,
  frame,
  fps,
  accentColor,
}) => {
  const barScale = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 200, mass: 0.6 },
    from: 0,
    to: 1,
  });

  const headingOpacity = interpolate(frame, [4, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const headingTx = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 20, stiffness: 140, mass: 0.7 },
    from: -30,
    to: 0,
  });

  const accent = accentColor ?? SAFFRON;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        marginBottom: 40,
      }}
    >
      {/* Saffron accent bar */}
      <div
        style={{
          width: HEADING_ACCENT_WIDTH,
          height: HEADING_ACCENT_HEIGHT,
          backgroundColor: accent,
          borderRadius: 3,
          transform: `scaleY(${barScale})`,
          transformOrigin: 'top center',
          flexShrink: 0,
        }}
      />

      {/* Heading text */}
      <h1
        style={{
          fontFamily: FONTS.heading,
          fontSize: 56,
          fontWeight: 800,
          color: '#FFFFFF',
          margin: 0,
          lineHeight: 1.15,
          letterSpacing: '-0.5px',
          transform: `translateX(${headingTx}px)`,
          opacity: headingOpacity,
          flex: 1,
        }}
      >
        {heading}
      </h1>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-component: diagram area (SVG or nothing)
// ---------------------------------------------------------------------------

interface DiagramAreaProps {
  d2Svg?: string;
  frame: number;
  fps: number;
}

const DiagramArea: React.FC<DiagramAreaProps> = ({ d2Svg, frame, fps }) => {
  if (!d2Svg) return null;

  const opacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scale = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 20, stiffness: 100, mass: 1 },
    from: 0.92,
    to: 1,
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: DIAGRAM_Y,
        left: MARGIN_X,
        width: DIAGRAM_WIDTH,
        height: DIAGRAM_HEIGHT,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        overflow: 'hidden',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: d2Svg }}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const VerticalTextSection: React.FC<VerticalTextSectionProps> = ({
  heading,
  bullets,
  content,
  narration: _narration,
  startFrame = 0,
  endFrame: _endFrame,
  sceneIndex: _sceneIndex,
  sceneStartFrame,
  animationCues: _animationCues,
  visualBeats: _visualBeats,
  templateId: _templateId,
  templateVariant: _templateVariant,
  accentColor,
  topic: _topic,
  d2Svg,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene-local frame (relative to when this scene starts)
  const localStart = sceneStartFrame ?? startFrame;
  const sceneLocalFrame = Math.max(0, frame - localStart);

  // Resolve bullet list
  const effectiveBullets = getEffectiveBullets(bullets, content);
  const hasHeading = Boolean(heading);
  const hasDiagram = Boolean(d2Svg);

  // Adjust bullets start y when there's no heading
  const bulletsY = hasHeading
    ? BULLETS_START_Y
    : COMPONENT_DIMS.textSection.headingY + 20;

  // Background fade-in
  const bgOpacity = interpolate(sceneLocalFrame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Bullets container bottom clamp (stay above caption zone)
  const maxBulletsHeight = hasDiagram
    ? DIAGRAM_Y - bulletsY - 40
    : CAPTION_ZONE_Y - bulletsY - 40;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        opacity: bgOpacity,
        fontFamily: FONTS.text,
        overflow: 'hidden',
      }}
    >
      {/* Subtle top gradient glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 300,
          background:
            'linear-gradient(180deg, rgba(232,93,38,0.07) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── HEADING ── */}
      {hasHeading && (
        <div
          style={{
            position: 'absolute',
            top: HEADING_Y,
            left: MARGIN_X,
            width: CONTENT_WIDTH,
          }}
        >
          <HeadingRow
            heading={heading!}
            frame={sceneLocalFrame}
            fps={fps}
            accentColor={accentColor}
          />
        </div>
      )}

      {/* ── BULLETS — distributed evenly across vertical space ── */}
      {effectiveBullets.length > 0 && (() => {
        const availableHeight = (hasDiagram ? DIAGRAM_Y : CAPTION_ZONE_Y) - bulletsY - 40;
        const bulletCount = effectiveBullets.length;
        // Each bullet gets an equal slice of vertical space
        const sliceHeight = Math.min(280, Math.floor(availableHeight / Math.max(bulletCount, 1)));

        return (
          <div
            style={{
              position: 'absolute',
              top: bulletsY,
              left: MARGIN_X,
              right: MARGIN_X,
              height: availableHeight,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: bulletCount <= 4 ? 'space-around' : 'flex-start',
              gap: bulletCount <= 4 ? 0 : 20,
            }}
          >
            {effectiveBullets.map((text, i) => {
              const delayFrames = i * BULLET_STAGGER_FRAMES;
              const localFrame = Math.max(0, sceneLocalFrame - delayFrames);
              const bulletColor = BULLET_COLORS[i % BULLET_COLORS.length];

              const slideIn = spring({
                frame: localFrame,
                fps,
                config: { damping: 16, stiffness: 100, mass: 0.7 },
                from: 60,
                to: 0,
              });

              const fadeIn = interpolate(localFrame, [0, 15], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              const isFirst = i === 0;

              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    padding: '20px 24px',
                    backgroundColor: isFirst ? 'rgba(232,93,38,0.08)' : 'rgba(255,255,255,0.03)',
                    borderRadius: 16,
                    borderLeft: `5px solid ${bulletColor}`,
                    transform: `translateX(${slideIn}px)`,
                    opacity: fadeIn,
                    minHeight: bulletCount <= 3 ? 120 : 80,
                  }}
                >
                  {/* Number badge */}
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: `${bulletColor}22`,
                    border: `1.5px solid ${bulletColor}55`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontFamily: FONTS.heading,
                    fontSize: 22,
                    fontWeight: 800,
                    color: bulletColor,
                  }}>
                    {i + 1}
                  </div>

                  {/* Bullet text */}
                  <span style={{
                    fontFamily: FONTS.text,
                    fontSize: isFirst ? 44 : 38,
                    fontWeight: isFirst ? 700 : 500,
                    color: isFirst ? '#FFFFFF' : 'rgba(255,255,255,0.9)',
                    lineHeight: 1.4,
                    flex: 1,
                  }}>
                    {text}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── DIAGRAM AREA ── */}
      {hasDiagram && (
        <DiagramArea
          d2Svg={d2Svg}
          frame={sceneLocalFrame}
          fps={fps}
        />
      )}

      {/* ── BOTTOM FADE (into caption zone) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: VERTICAL.height - CAPTION_ZONE_Y,
          left: 0,
          right: 0,
          height: 80,
          background:
            'linear-gradient(180deg, transparent 0%, rgba(12,10,21,0.8) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

export default VerticalTextSection;
