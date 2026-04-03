import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { AnimatedBox } from '../viz/AnimatedBox';
import { AnimatedArrow } from '../viz/AnimatedArrow';
import { COLORS, FONTS, SIZES } from '../../lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConceptElement {
  id: string;
  label: string;
  /** x position as percentage (0-100) */
  x: number;
  /** y position as percentage (0-100) */
  y: number;
  shape?: 'box' | 'circle' | 'diamond';
  color?: string;
  size?: number;
  beatIndex: number;
}

export interface ConceptConnection {
  from: string;
  to: string;
  label?: string;
  color?: string;
  beatIndex: number;
  /** pulse/glow animation on the connection line */
  animated?: boolean;
}

export interface ConceptConfig {
  layoutMode:
    | 'ring'
    | 'grid'
    | 'timeline'
    | 'tree'
    | 'stateMachine'
    | 'freeform';
  elements: ConceptElement[];
  connections: ConceptConnection[];
  title?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTAINER_W = 1920;
const CONTAINER_H = 1080;
const BEAT_GAP = 8; // frames between beats

// ---------------------------------------------------------------------------
// Helper: percentage to pixel
// ---------------------------------------------------------------------------

function pctToPx(
  pctX: number,
  pctY: number,
): { x: number; y: number } {
  return {
    x: (pctX / 100) * CONTAINER_W,
    y: (pctY / 100) * CONTAINER_H,
  };
}

// ---------------------------------------------------------------------------
// Element renderer (circle / diamond / default box)
// ---------------------------------------------------------------------------

const ConceptElementView: React.FC<{
  el: ConceptElement;
  fps: number;
  frame: number;
}> = ({ el, fps, frame }) => {
  const { x, y } = pctToPx(el.x, el.y);
  const entryFrame = el.beatIndex * BEAT_GAP;
  const sz = el.size ?? 90;
  const color = el.color ?? COLORS.teal;

  if (el.shape === 'circle' || el.shape === 'diamond') {
    const age = frame - entryFrame;
    if (age < 0) return null;

    const entrance = spring({
      frame: age,
      fps,
      config: { damping: 14, stiffness: 120, mass: 0.8 },
    });

    const scale = interpolate(entrance, [0, 1], [0.7, 1.0]);
    const opacity = interpolate(entrance, [0, 1], [0, 1]);

    const isCircle = el.shape === 'circle';
    const dimension = isCircle ? sz : sz * 0.85;

    return (
      <div
        style={{
          position: 'absolute',
          left: x - dimension / 2,
          top: y - dimension / 2,
          width: dimension,
          height: dimension,
          transform: isCircle
            ? `scale(${scale})`
            : `scale(${scale}) rotate(45deg)`,
          opacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${COLORS.dark}EE`,
          border: `2px solid ${color}`,
          borderRadius: isCircle ? '50%' : 8,
          boxShadow: `0 0 16px ${color}33`,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontFamily: FONTS.text,
            fontWeight: 700,
            color: COLORS.white,
            textAlign: 'center',
            transform: isCircle ? undefined : 'rotate(-45deg)',
            maxWidth: dimension - 16,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {el.label}
        </span>
      </div>
    );
  }

  // Default: rectangular box via AnimatedBox
  return (
    <AnimatedBox
      label={el.label}
      x={x}
      y={y}
      width={sz * 2}
      height={sz * 0.9}
      color={color}
      entryFrame={entryFrame}
    />
  );
};

// ---------------------------------------------------------------------------
// Connection renderer with optional pulse animation
// ---------------------------------------------------------------------------

const ConceptConnectionView: React.FC<{
  conn: ConceptConnection;
  elements: ConceptElement[];
  frame: number;
  fps: number;
}> = ({ conn, elements, frame, fps }) => {
  const fromEl = elements.find((e) => e.id === conn.from);
  const toEl = elements.find((e) => e.id === conn.to);
  if (!fromEl || !toEl) return null;

  const fromPx = pctToPx(fromEl.x, fromEl.y);
  const toPx = pctToPx(toEl.x, toEl.y);
  const startFrame = conn.beatIndex * BEAT_GAP;
  const color = conn.color ?? COLORS.gray;

  // Pulse glow overlay for animated connections
  const pulseOpacity = conn.animated
    ? interpolate(
        Math.sin(((frame - startFrame) / fps) * Math.PI * 2),
        [-1, 1],
        [0.4, 1],
      )
    : 1;

  return (
    <div style={{ opacity: pulseOpacity }}>
      <AnimatedArrow
        from={fromPx}
        to={toPx}
        color={color}
        startFrame={startFrame}
        label={conn.label}
        curved
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Title overlay
// ---------------------------------------------------------------------------

const ConceptTitle: React.FC<{ title: string; fps: number }> = ({
  title,
  fps,
}) => {
  const frame = useCurrentFrame();
  const entrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80, mass: 1 },
  });
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const translateY = interpolate(entrance, [0, 1], [-20, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 30,
        left: 0,
        width: '100%',
        textAlign: 'center',
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <span
        style={{
          fontSize: SIZES.heading3,
          fontFamily: FONTS.heading,
          fontWeight: 800,
          color: COLORS.saffron,
          textShadow: `0 2px 12px ${COLORS.dark}`,
        }}
      >
        {title}
      </span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ConceptRenderer: the main factory renderer
// ---------------------------------------------------------------------------

export interface ConceptRendererProps {
  config: ConceptConfig;
}

export const ConceptRenderer: React.FC<ConceptRendererProps> = ({
  config,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: 'relative',
        width: CONTAINER_W,
        height: CONTAINER_H,
        overflow: 'hidden',
        background: COLORS.dark,
      }}
    >
      {/* Title */}
      {config.title && <ConceptTitle title={config.title} fps={fps} />}

      {/* Connections (render below elements) */}
      {config.connections.map((conn, i) => (
        <ConceptConnectionView
          key={`conn-${i}`}
          conn={conn}
          elements={config.elements}
          frame={frame}
          fps={fps}
        />
      ))}

      {/* Elements */}
      {config.elements.map((el) => (
        <ConceptElementView
          key={el.id}
          el={el}
          fps={fps}
          frame={frame}
        />
      ))}
    </div>
  );
};

export default ConceptRenderer;
