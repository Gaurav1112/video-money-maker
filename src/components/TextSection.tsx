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
import { SketchDiagram } from './viz/SketchDiagram';
import { getVisualTemplate } from '../lib/visual-templates';
import { computeVisualBeats } from '../lib/visual-beats';
import { getBackgroundImage } from '../lib/bg-images';
import type { AnimationCue, VisualBeat } from '../types';
import type { SketchNode, SketchEdge } from './viz/SketchDiagram';

// ---------------------------------------------------------------------------
// Sketch diagram data resolver — converts architecture/flow configs to sketch format
// ---------------------------------------------------------------------------
function getSketchDiagramData(
  templateId: string,
  variant: string,
): { nodes: SketchNode[]; edges: SketchEdge[]; title?: string } | null {
  try {
    // Check architecture configs
    const { ARCHITECTURE_CONFIGS } = require('./templates/architecture-configs');
    const archConfigMap = ARCHITECTURE_CONFIGS[templateId];
    if (archConfigMap) {
      const config = archConfigMap[variant] ?? archConfigMap.overview ?? Object.values(archConfigMap)[0];
      if (config) {
        const nodes: SketchNode[] = config.nodes.map((n: any) => ({
          id: n.id,
          label: n.label,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          color: n.color,
          beatIndex: n.beatIndex,
        }));
        const edges: SketchEdge[] = config.edges.map((e: any) => ({
          from: e.from,
          to: e.to,
          label: e.label,
          dashed: e.dashed,
          beatIndex: e.beatIndex,
        }));
        return { nodes, edges, title: config.title };
      }
    }

    // Check flow configs — convert linear stages to nodes + edges
    const { FLOW_CONFIGS } = require('./templates/flow-configs');
    const flowConfig = FLOW_CONFIGS[templateId];
    if (flowConfig) {
      const stages = flowConfig.stages || [];
      const count = stages.length;
      const nodes: SketchNode[] = stages.map((s: any, i: number) => ({
        id: s.id,
        label: s.label,
        x: 8 + (i / Math.max(1, count - 1)) * 84,
        y: 45,
        width: 160,
        height: 70,
        color: s.color,
        icon: s.description ? undefined : undefined,
        beatIndex: s.beatIndex,
      }));
      const edges: SketchEdge[] = [];
      for (let i = 0; i < count - 1; i++) {
        edges.push({
          from: stages[i].id,
          to: stages[i + 1].id,
          beatIndex: stages[i + 1].beatIndex,
        });
      }
      return { nodes, edges, title: flowConfig.title };
    }
  } catch {
    // Configs not available — fall through
  }
  return null;
}

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
      {/* Animated background — never plain black */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(29,209,161,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(29,209,161,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at 60% 50%, rgba(29,209,161,0.04) 0%, transparent 50%)`,
        }} />
      </div>

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
        {(() => {
          // Check if this template is architecture or flow — use SketchDiagram
          const sketchData = getSketchDiagramData(templateId, templateVariant);
          if (sketchData) {
            return (
              <SketchDiagram
                nodes={sketchData.nodes}
                edges={sketchData.edges}
                beats={beats}
                fps={fps}
                accentColor={accentColor}
                title={sketchData.title}
              />
            );
          }
          return (
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
          );
        })()}
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
