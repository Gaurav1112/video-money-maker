import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { AnimatedBox } from '../viz/AnimatedBox';
import { AnimatedArrow } from '../viz/AnimatedArrow';
import { DataFlowParticles } from '../viz/DataFlowParticles';
import { COLORS, FONTS, SIZES } from '../../lib/theme';
import type { VisualBeat } from '../../types';

// ── Interfaces ──────────────────────────────────────────────────────

export interface FlowStage {
  id: string;
  label: string;
  iconSlug?: string;
  color?: string;
  beatIndex: number;
  description?: string;
}

export interface FlowConfig {
  stages: FlowStage[];
  packetColor?: string;
  title?: string;
}

interface FlowRendererProps {
  config: FlowConfig;
  beats: VisualBeat[];
  accentColor: string;
  fps: number;
}

// ── Constants ───────────────────────────────────────────────────────

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const STAGE_W = 180;
const STAGE_H = 80;
const PADDING_X = 160;
const CENTER_Y = CANVAS_H * 0.5;
const TITLE_Y = 80;
const DESC_OFFSET_Y = STAGE_H / 2 + 22;

// ── Component ───────────────────────────────────────────────────────

export const FlowRenderer: React.FC<FlowRendererProps> = ({
  config,
  beats,
  accentColor,
  fps,
}) => {
  const frame = useCurrentFrame();
  const { stages, packetColor, title } = config;
  const stageCount = stages.length;

  // Distribute stages evenly across the horizontal axis
  const usableW = CANVAS_W - PADDING_X * 2;
  const gap = stageCount > 1 ? usableW / (stageCount - 1) : 0;

  const stagePositions = stages.map((_, i) => ({
    x: PADDING_X + gap * i,
    y: CENTER_Y,
  }));

  // Map beat index -> entry frame
  const beatEntryFrames: Record<number, number> = {};
  for (const b of beats) {
    beatEntryFrames[b.beatIndex] = Math.round(b.startTime * fps);
  }

  // Determine entry frame for each stage
  const stageEntryFrames = stages.map((s) => {
    const f = beatEntryFrames[s.beatIndex];
    return f !== undefined ? f : s.beatIndex * Math.round(fps * 2);
  });

  // All stages revealed when the last stage has been visible for ~1 second
  const lastStageEntry = stageEntryFrames[stageEntryFrames.length - 1] ?? 0;
  const particlesStartFrame = lastStageEntry + Math.round(fps * 1);

  const allRevealed = frame >= particlesStartFrame;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Title */}
      {title && (
        <div
          style={{
            position: 'absolute',
            top: TITLE_Y,
            left: 0,
            width: '100%',
            textAlign: 'center',
            fontSize: SIZES.heading2,
            fontFamily: FONTS.heading,
            fontWeight: 800,
            color: COLORS.white,
            letterSpacing: -0.5,
          }}
        >
          {title}
        </div>
      )}

      {/* Arrows between consecutive stages */}
      {stagePositions.slice(0, -1).map((pos, i) => {
        const next = stagePositions[i + 1];
        const arrowStart = stageEntryFrames[i + 1] - Math.round(fps * 0.3);
        return (
          <AnimatedArrow
            key={`arrow-${i}`}
            from={{ x: pos.x + STAGE_W / 2, y: pos.y }}
            to={{ x: next.x - STAGE_W / 2, y: next.y }}
            color={stages[i].color ?? accentColor}
            startFrame={Math.max(0, arrowStart)}
          />
        );
      })}

      {/* Stage boxes */}
      {stages.map((stage, i) => {
        const pos = stagePositions[i];
        const entryFrame = stageEntryFrames[i];
        const stageColor = stage.color ?? accentColor;
        const isActive =
          frame >= entryFrame &&
          (i === stageCount - 1 || frame < (stageEntryFrames[i + 1] ?? Infinity));

        return (
          <React.Fragment key={stage.id}>
            <AnimatedBox
              label={stage.label}
              iconSlug={stage.iconSlug}
              x={pos.x}
              y={pos.y}
              width={STAGE_W}
              height={STAGE_H}
              color={stageColor}
              isActive={isActive}
              entryFrame={entryFrame}
            />
            {/* Description text below the box */}
            {stage.description && frame >= entryFrame && (
              <div
                style={{
                  position: 'absolute',
                  left: pos.x - STAGE_W / 2,
                  top: pos.y + DESC_OFFSET_Y,
                  width: STAGE_W,
                  textAlign: 'center',
                  fontSize: 13,
                  fontFamily: FONTS.text,
                  fontWeight: 400,
                  color: `${COLORS.gray}CC`,
                  lineHeight: 1.3,
                }}
              >
                {stage.description}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Data flow particles after all stages revealed */}
      {allRevealed &&
        stagePositions.slice(0, -1).map((pos, i) => {
          const next = stagePositions[i + 1];
          return (
            <DataFlowParticles
              key={`particles-${i}`}
              fromX={pos.x + STAGE_W / 2}
              fromY={pos.y}
              toX={next.x - STAGE_W / 2}
              toY={next.y}
              color={packetColor ?? accentColor}
              particleCount={3}
              particleSize={5}
              speed={1.5}
              active
            />
          );
        })}
    </div>
  );
};
