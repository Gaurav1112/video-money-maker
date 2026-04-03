import React from 'react';
import {
  useCurrentFrame,
  AbsoluteFill,
  interpolate,
  spring,
  useVideoConfig,
  staticFile,
  Img,
} from 'remotion';
import { COLORS, FONTS } from '../lib/theme';
import { TemplateFactory } from './templates/TemplateFactory';
import { getVisualTemplate } from '../lib/visual-templates';
import { computeVisualBeats } from '../lib/visual-beats';
import { getBackgroundImage } from '../lib/bg-images';
import type { AnimationCue, VisualBeat } from '../types';

// ---------------------------------------------------------------------------
// Props — EXTENDS original interface with new optional fields
// ---------------------------------------------------------------------------
interface TextSectionProps {
  heading?: string;
  bullets?: string[];
  content?: string;
  narration?: string;
  startFrame?: number;
  endFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  animationCues?: AnimationCue[];
  // New visual-template props (all optional for backward compat)
  visualBeats?: VisualBeat[];
  templateId?: string;
  templateVariant?: string;
  accentColor?: string;
  topic?: string;
}

// =============================
// MAIN COMPONENT
// =============================
const TextSection: React.FC<TextSectionProps> = ({
  heading = '',
  bullets = [],
  content = '',
  narration = '',
  startFrame = 0,
  endFrame = 300,
  sceneIndex,
  sceneStartFrame,
  animationCues,
  visualBeats: visualBeatsProp,
  templateId: templateIdProp,
  templateVariant: templateVariantProp,
  accentColor: accentColorProp,
  topic = '',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // -------------------------------------------------------------------
  // 1. Resolve template — either from props or auto-select
  // -------------------------------------------------------------------
  let templateId = templateIdProp || '';
  let templateVariant = templateVariantProp || 'overview';
  let accentColor = accentColorProp || COLORS.saffron;

  if (!templateId) {
    // Auto-select template from heading + topic keywords
    const auto = getVisualTemplate(
      topic,
      sceneIndex ?? 0,
      heading,
      'text',
    );
    templateId = auto.templateId;
    templateVariant = auto.variant;
    accentColor = auto.accentColor;
  }

  // -------------------------------------------------------------------
  // 2. Resolve visual beats — either from props or compute from narration
  // -------------------------------------------------------------------
  let beats: VisualBeat[] = visualBeatsProp || [];
  if (beats.length === 0 && narration) {
    // No word timestamps available at this level — build simple beats
    // by splitting narration into sentences with estimated timing
    const sentences = narration
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    const sceneDurationSec = (endFrame - startFrame) / fps;
    const timePerSentence = sceneDurationSec / Math.max(1, sentences.length);

    beats = sentences.map((text, i) => ({
      startTime: i * timePerSentence,
      endTime: (i + 1) * timePerSentence,
      text,
      beatIndex: i,
      totalBeats: sentences.length,
      keywords: [],
    }));
  }

  // -------------------------------------------------------------------
  // 3. Background image (subtle, 8% opacity)
  // -------------------------------------------------------------------
  const bgImagePath = getBackgroundImage('text');

  // -------------------------------------------------------------------
  // 4. Chapter marker animation (small heading, top-left)
  // -------------------------------------------------------------------
  const chapterOpacity = interpolate(frame, [0, 20], [0, 0.7], {
    extrapolateRight: 'clamp',
  });
  const chapterX = interpolate(frame, [0, 20], [-20, 0], {
    extrapolateRight: 'clamp',
  });

  // -------------------------------------------------------------------
  // 5. Template entrance animation
  // -------------------------------------------------------------------
  const templateEntrance = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 18, stiffness: 80, mass: 1 },
  });
  const templateScale = interpolate(templateEntrance, [0, 1], [0.95, 1]);
  const templateOpacity = interpolate(templateEntrance, [0, 1], [0, 1]);

  // -------------------------------------------------------------------
  // 6. Scene progress bar
  // -------------------------------------------------------------------
  const sceneDuration = endFrame - startFrame;
  const progressPercent = Math.min(100, (frame / sceneDuration) * 100);

  return (
    <AbsoluteFill
      style={{
        background: COLORS.dark,
        fontFamily: FONTS.text,
        overflow: 'hidden',
      }}
    >
      {/* ===== BACKGROUND IMAGE — 8% opacity ===== */}
      {bgImagePath && (
        <Img
          src={staticFile(bgImagePath)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.08,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ===== FULL-SCREEN TEMPLATE ===== */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${templateScale})`,
          opacity: templateOpacity,
        }}
      >
        <TemplateFactory
          templateId={templateId}
          variant={templateVariant}
          beats={beats}
          accentColor={accentColor}
          fps={fps}
          sceneHeading={heading}
          bullets={bullets.length > 0 ? bullets : undefined}
          content={content || undefined}
        />
      </div>

      {/* ===== CHAPTER MARKER — small heading, top-left ===== */}
      {heading && (
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 32,
            zIndex: 10,
            opacity: chapterOpacity,
            transform: `translateX(${chapterX}px)`,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: `${COLORS.gold}99`,
              fontFamily: FONTS.heading,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}
          >
            {heading}
          </div>
        </div>
      )}

      {/* ===== SCENE PROGRESS BAR — thin line at bottom ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: `${progressPercent}%`,
          height: 2,
          background: `linear-gradient(90deg, ${accentColor}80, ${accentColor})`,
          zIndex: 10,
        }}
      />
    </AbsoluteFill>
  );
};

export default TextSection;
