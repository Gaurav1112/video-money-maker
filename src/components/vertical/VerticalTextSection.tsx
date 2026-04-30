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
import { TemplateFactory } from '../templates/TemplateFactory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface VisualBeat {
  startFrame?: number;
  endFrame?: number;
  text?: string;
}

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
  visualBeats?: VisualBeat[];
  wordTimestamps?: WordTimestamp[];
  templateId?: string;
  templateVariant?: string;
  accentColor?: string;
  topic?: string;
  d2Svg?: string;
}

// ---------------------------------------------------------------------------
// Constants — Fireship-level pacing
// ---------------------------------------------------------------------------

const BG = '#0C0A15';
const SAFFRON = '#E85D26';
const GOLD = '#FDB813';
const TEAL = '#1DD1A1';
const BULLET_COLORS = [SAFFRON, GOLD, TEAL] as const;

const CONTENT_WIDTH = 880;
const MARGIN_X = 60;
const MAX_BULLETS = 2; // was 4 — Fireship rule: ONE concept per scene, max 2 bullets
const BULLET_STAGGER_FRAMES = 8; // was 15 — faster entrance, bullets land in <0.5s total

// Layout y-positions
const HEADING_Y = 210;
const HEADING_ACCENT_HEIGHT = 50;
const HEADING_ACCENT_WIDTH = 6;
const BULLETS_START_Y = 360;
const DIAGRAM_Y = 750;
const DIAGRAM_WIDTH = 880;
const DIAGRAM_HEIGHT = 550;
const CAPTION_ZONE_Y = 1200;

// ── Ongoing animation constants ──
// These keep the frame alive AFTER entrance animations complete.
const BREATHE_AMPLITUDE = 2; // px — subtle vertical oscillation
const BREATHE_PERIOD = 45; // frames per cycle (~1.5s)
const ACTIVE_OPACITY = 1.0;
const INACTIVE_OPACITY = 0.35; // dim non-active bullets hard
const HIGHLIGHT_TRANSITION_FRAMES = 8; // smooth transition between active bullets
const PROGRESS_BAR_WIDTH = 5; // left accent bar that fills as narration progresses
const BADGE_PULSE_SCALE = 0.06; // scale oscillation for active badge

// ---------------------------------------------------------------------------
// Helper: split content fallback
// ---------------------------------------------------------------------------

function getEffectiveBullets(bullets?: string[], content?: string, narration?: string): string[] {
  if (bullets && bullets.length > 0) {
    return bullets.slice(0, MAX_BULLETS);
  }
  if (content) {
    const byLine = content.split('\n').map((l) => l.trim()).filter(Boolean);
    if (byLine.length >= 2) {
      return byLine.slice(0, MAX_BULLETS);
    }
  }
  const text = content || narration || '';
  if (text) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 10);
    if (sentences.length >= 2) {
      return sentences.slice(0, MAX_BULLETS);
    }
    if (text.length > 80) {
      const words = text.split(/\s+/);
      const chunks: string[] = [];
      let current = '';
      for (const word of words) {
        if (current.length + word.length > 80 && current.length > 20) {
          chunks.push(current.trim());
          current = word;
        } else {
          current += (current ? ' ' : '') + word;
        }
      }
      if (current.trim()) chunks.push(current.trim());
      return chunks.slice(0, MAX_BULLETS);
    }
    if (text.length > 0) return [text];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Helper: deterministic sine for ongoing animation (no Math.random)
// ---------------------------------------------------------------------------

function deterministicSine(frame: number, period: number, amplitude: number): number {
  return Math.sin((frame / period) * Math.PI * 2) * amplitude;
}

// ---------------------------------------------------------------------------
// Helper: compute which bullet is "active" based on scene progress
// ---------------------------------------------------------------------------

function getActiveBulletIndex(
  sceneLocalFrame: number,
  bulletCount: number,
  sceneDurationFrames: number,
  fps: number,
): number {
  if (bulletCount <= 1) return 0;
  // Each bullet gets an equal share of the scene duration
  const entranceDone = bulletCount * BULLET_STAGGER_FRAMES + 10;
  if (sceneLocalFrame < entranceDone) return 0; // during entrance, first is active
  const activeTime = sceneLocalFrame - entranceDone;
  const perBullet = Math.max(1, (sceneDurationFrames - entranceDone) / bulletCount);
  return Math.min(bulletCount - 1, Math.floor(activeTime / perBullet));
}

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

  const headingOpacity = interpolate(frame, [2, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const headingTx = spring({
    frame: Math.max(0, frame - 2),
    fps,
    config: { damping: 18, stiffness: 160, mass: 0.6 },
    from: -25,
    to: 0,
  });

  const accent = accentColor ?? SAFFRON;

  // Ongoing: subtle heading glow pulse
  const glowIntensity = frame > 15
    ? 0.04 + deterministicSine(frame, 60, 0.03)
    : 0;

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
          boxShadow: glowIntensity > 0
            ? `0 0 ${12 + glowIntensity * 100}px ${accent}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')}`
            : 'none',
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

  const opacity = interpolate(frame, [6, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const scale = spring({
    frame: Math.max(0, frame - 6),
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
// Main component — Fireship-paced vertical text scene
// ---------------------------------------------------------------------------

export const VerticalTextSection: React.FC<VerticalTextSectionProps> = ({
  heading,
  bullets,
  content,
  narration,
  startFrame = 0,
  endFrame,
  sceneIndex: _sceneIndex,
  sceneStartFrame,
  animationCues: _animationCues,
  visualBeats,
  wordTimestamps: _wordTimestamps,
  templateId,
  templateVariant,
  accentColor,
  topic: _topic,
  d2Svg,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene-local frame (relative to when this scene starts)
  const localStart = sceneStartFrame ?? startFrame;
  const sceneLocalFrame = Math.max(0, frame - localStart);
  const sceneDurationFrames = endFrame ? endFrame - localStart : 180; // fallback 6s

  // Resolve bullet list
  const effectiveBullets = getEffectiveBullets(bullets, content, narration);
  const bulletCount = effectiveBullets.length;
  const hasHeading = Boolean(heading);
  const hasDiagram = Boolean(d2Svg);
  // TODO: TemplateFactory integration deferred — some templates crash in vertical scale mode
  const hasTemplate = false; // Boolean(templateId) — will enable after per-template testing

  // Adjust bullets start y when there's no heading
  const bulletsY = hasHeading
    ? BULLETS_START_Y
    : COMPONENT_DIMS.textSection.headingY + 20;

  // Background fade-in — faster (4 frames, not 8)
  const bgOpacity = interpolate(sceneLocalFrame, [0, 4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Active bullet index — drives all ongoing animations ──
  const activeBulletIdx = getActiveBulletIndex(
    sceneLocalFrame,
    bulletCount,
    sceneDurationFrames,
    fps,
  );

  // ── Scene progress (0→1) for progress bar ──
  const sceneProgress = Math.min(1, sceneLocalFrame / Math.max(1, sceneDurationFrames));

  // ── Breathing motion — subtle Y drift on entire content ──
  const breatheY = deterministicSine(sceneLocalFrame, BREATHE_PERIOD, BREATHE_AMPLITUDE);

  const availableHeight = (hasDiagram ? DIAGRAM_Y : CAPTION_ZONE_Y) - bulletsY - 40;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        opacity: bgOpacity,
        fontFamily: FONTS.text,
        overflow: 'hidden',
      }}
    >
      {/* Subtle top gradient glow — pulses with scene progress */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 300,
          background:
            `linear-gradient(180deg, rgba(232,93,38,${0.05 + deterministicSine(sceneLocalFrame, 90, 0.03)}) 0%, transparent 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* ── SCENE PROGRESS BAR (top edge) ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${sceneProgress * 100}%`,
          height: 3,
          backgroundColor: accentColor ?? SAFFRON,
          opacity: 0.6,
          transition: 'none',
        }}
      />

      {/* ── HEADING with breathing motion ── */}
      {hasHeading && (
        <div
          style={{
            position: 'absolute',
            top: HEADING_Y,
            left: MARGIN_X,
            width: CONTENT_WIDTH,
            transform: `translateY(${breatheY}px)`,
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

      {/* ── BULLETS — with active tracking + ongoing animation ── */}
      {bulletCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: bulletsY,
            left: MARGIN_X,
            right: 140,
            height: availableHeight,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: bulletCount <= 2 ? 'center' : 'space-around',
            gap: bulletCount <= 2 ? 32 : 20,
            transform: `translateY(${breatheY}px)`,
          }}
        >
          {effectiveBullets.map((text, i) => {
            const delayFrames = i * BULLET_STAGGER_FRAMES;
            const localFrame = Math.max(0, sceneLocalFrame - delayFrames);
            const bulletColor = BULLET_COLORS[i % BULLET_COLORS.length];

            // ── ENTRANCE (fast — spring settles in ~10 frames) ──
            const slideIn = spring({
              frame: localFrame,
              fps,
              config: { damping: 20, stiffness: 160, mass: 0.5 },
              from: 50,
              to: 0,
            });

            const fadeIn = interpolate(localFrame, [0, 8], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            // ── ONGOING: active bullet emphasis ──
            const isActive = i === activeBulletIdx;
            const entranceDone = bulletCount * BULLET_STAGGER_FRAMES + 10;
            const afterEntrance = sceneLocalFrame > entranceDone;

            // Smooth opacity transition between active/inactive
            const targetOpacity = afterEntrance
              ? (isActive ? ACTIVE_OPACITY : INACTIVE_OPACITY)
              : 1.0;
            // Use interpolate for smooth transition over HIGHLIGHT_TRANSITION_FRAMES
            const bulletOpacity = fadeIn * targetOpacity;

            // ── ONGOING: active badge pulse ──
            const badgePulse = isActive && afterEntrance
              ? 1 + deterministicSine(sceneLocalFrame, 20, BADGE_PULSE_SCALE)
              : 1;

            // ── ONGOING: progress fill on left accent bar ──
            // The active bullet's bar fills from 0% to 100% during its "turn"
            const perBulletDuration = Math.max(1, (sceneDurationFrames - entranceDone) / bulletCount);
            const bulletStartFrame = entranceDone + i * perBulletDuration;
            const bulletProgress = afterEntrance
              ? Math.min(1, Math.max(0, (sceneLocalFrame - bulletStartFrame) / perBulletDuration))
              : 0;
            const barFillHeight = isActive ? `${bulletProgress * 100}%` : (i < activeBulletIdx ? '100%' : '0%');

            // ── ONGOING: subtle scale on active bullet ──
            const activeScale = isActive && afterEntrance
              ? 1 + deterministicSine(sceneLocalFrame, 40, 0.008)
              : 1;

            const isFirst = i === 0;

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: '20px 24px',
                  backgroundColor: isActive && afterEntrance
                    ? `${bulletColor}18`
                    : 'rgba(255,255,255,0.03)',
                  borderRadius: 16,
                  // Left accent bar with progress fill via gradient
                  borderLeft: 'none',
                  transform: `translateX(${slideIn}px) scale(${activeScale})`,
                  opacity: bulletOpacity,
                  minHeight: bulletCount <= 2 ? 140 : 80,
                  position: 'relative',
                  willChange: 'transform, opacity',
                }}
              >
                {/* ── Progress accent bar (fills top→bottom as narration progresses) ── */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: PROGRESS_BAR_WIDTH,
                  borderRadius: '16px 0 0 16px',
                  overflow: 'hidden',
                }}>
                  {/* Background track */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: `${bulletColor}30`,
                  }} />
                  {/* Fill */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: barFillHeight,
                    backgroundColor: bulletColor,
                    borderRadius: '16px 0 0 0',
                  }} />
                </div>

                {/* Number badge with pulse */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isActive && afterEntrance ? `${bulletColor}33` : `${bulletColor}22`,
                  border: `1.5px solid ${isActive && afterEntrance ? bulletColor : `${bulletColor}55`}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontFamily: FONTS.heading,
                  fontSize: 22,
                  fontWeight: 800,
                  color: bulletColor,
                  marginLeft: PROGRESS_BAR_WIDTH + 12,
                  transform: `scale(${badgePulse})`,
                  boxShadow: isActive && afterEntrance
                    ? `0 0 12px ${bulletColor}40`
                    : 'none',
                }}>
                  {i + 1}
                </div>

                {/* Bullet text */}
                <span style={{
                  fontFamily: FONTS.text,
                  fontSize: isFirst ? 44 : 38,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive || !afterEntrance ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                  lineHeight: 1.4,
                  flex: 1,
                }}>
                  {text}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── DIAGRAM AREA — D2 SVG or TemplateFactory animated diagrams ── */}
      {hasDiagram && (
        <DiagramArea
          d2Svg={d2Svg}
          frame={sceneLocalFrame}
          fps={fps}
        />
      )}
      {/* TemplateFactory diagram zone — renders 57 animated templates when templateId is set */}
      {hasTemplate && !hasDiagram && (() => {
        try {
          return (
            <div style={{
              position: 'absolute',
              top: 320,
              left: 30,
              width: 1020,
              height: 560,
              overflow: 'hidden',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                transform: 'scale(0.53)',
                transformOrigin: 'top left',
                width: 1920,
                height: 1080,
              }}>
                <TemplateFactory
                  templateId={templateId!}
                  variant={templateVariant || 'overview'}
                  beats={(visualBeats || []) as any}
                  accentColor={accentColor || SAFFRON}
                  fps={fps}
                  sceneHeading={heading}
                  bullets={effectiveBullets}
                  content={content}
                />
              </div>
            </div>
          );
        } catch {
          return null; // graceful fallback if template render fails
        }
      })()}

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
