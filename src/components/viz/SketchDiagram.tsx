import React, { useMemo } from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Caveat';
import type { VisualBeat } from '../../types';

// ---------------------------------------------------------------------------
// Load hand-drawn font
// ---------------------------------------------------------------------------
const { fontFamily: caveatFont } = loadFont();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SketchNode {
  id: string;
  label: string;
  x: number;       // percentage 0-100
  y: number;       // percentage 0-100
  width?: number;   // pixels, default 160
  height?: number;  // pixels, default 70
  color?: string;
  icon?: string;    // emoji or text icon
  beatIndex?: number;
}

export interface SketchEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
  beatIndex?: number;
}

export interface SketchDiagramProps {
  nodes: SketchNode[];
  edges: SketchEdge[];
  beats: VisualBeat[];
  fps: number;
  accentColor?: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// Canvas constants
// ---------------------------------------------------------------------------
const CANVAS_W = 1920;
const CANVAS_H = 1080;
const DEFAULT_NODE_W = 160;
const DEFAULT_NODE_H = 70;
const PADDING = 80; // safe area padding

// ---------------------------------------------------------------------------
// rough.js generator (lazy singleton)
// ---------------------------------------------------------------------------
let _generator: any = null;
function getGenerator() {
  if (!_generator) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rough = require('roughjs');
    _generator = rough.generator();
  }
  return _generator;
}

// ---------------------------------------------------------------------------
// Convert a rough.js Drawable into an array of React SVG <path> elements
// ---------------------------------------------------------------------------
function drawableToPathElements(
  drawable: any,
  key: string,
  extraProps?: React.SVGProps<SVGPathElement>,
): React.ReactElement[] {
  const gen = getGenerator();
  const paths: Array<{ d: string; stroke: string; strokeWidth: number; fill?: string }> =
    gen.toPaths(drawable);

  return paths.map((p, i) => (
    <path
      key={`${key}-${i}`}
      d={p.d}
      stroke={p.stroke}
      strokeWidth={p.strokeWidth}
      fill={p.fill || 'none'}
      {...extraProps}
    />
  ));
}

// ---------------------------------------------------------------------------
// Resolve node pixel position from percentage
// ---------------------------------------------------------------------------
function resolveNodePos(node: SketchNode) {
  const w = node.width ?? DEFAULT_NODE_W;
  const h = node.height ?? DEFAULT_NODE_H;
  const usableW = CANVAS_W - 2 * PADDING - w;
  const usableH = CANVAS_H - 2 * PADDING - h;
  const px = PADDING + (node.x / 100) * usableW;
  const py = PADDING + (node.y / 100) * usableH;
  return { px, py, w, h };
}

// ---------------------------------------------------------------------------
// Get center of a node
// ---------------------------------------------------------------------------
function getNodeCenter(node: SketchNode) {
  const { px, py, w, h } = resolveNodePos(node);
  return { cx: px + w / 2, cy: py + h / 2 };
}

// ---------------------------------------------------------------------------
// Compute active beat index from current frame
// ---------------------------------------------------------------------------
function getActiveBeatIndex(frame: number, fps: number, beats: VisualBeat[]): number {
  const timeSec = frame / fps;
  let active = -1;
  for (const b of beats) {
    if (timeSec >= b.startTime) {
      active = b.beatIndex;
    }
  }
  return active;
}

// ---------------------------------------------------------------------------
// Arrow head path (small triangle)
// ---------------------------------------------------------------------------
function arrowHeadPath(
  x1: number, y1: number, x2: number, y2: number, size: number = 12,
): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a1 = angle + Math.PI * 0.82;
  const a2 = angle - Math.PI * 0.82;
  return `M ${x2} ${y2} L ${x2 + size * Math.cos(a1)} ${y2 + size * Math.sin(a1)} L ${x2 + size * Math.cos(a2)} ${y2 + size * Math.sin(a2)} Z`;
}

// ---------------------------------------------------------------------------
// Compute edge endpoint (border of node rect, facing toward the other node)
// ---------------------------------------------------------------------------
function edgeEndpoint(
  fromNode: SketchNode,
  toNode: SketchNode,
): { x1: number; y1: number; x2: number; y2: number } {
  const from = getNodeCenter(fromNode);
  const to = getNodeCenter(toNode);
  const fromPos = resolveNodePos(fromNode);
  const toPos = resolveNodePos(toNode);

  const angle = Math.atan2(to.cy - from.cy, to.cx - from.cx);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Offset from center to border
  const fromHW = fromPos.w / 2;
  const fromHH = fromPos.h / 2;
  let tFx = Math.abs(cosA) > 0.001 ? Math.abs(fromHW / cosA) : Infinity;
  let tFy = Math.abs(sinA) > 0.001 ? Math.abs(fromHH / sinA) : Infinity;
  const tF = Math.min(tFx, tFy);
  const x1 = from.cx + cosA * tF;
  const y1 = from.cy + sinA * tF;

  const toHW = toPos.w / 2;
  const toHH = toPos.h / 2;
  const angleBack = angle + Math.PI;
  const cosB = Math.cos(angleBack);
  const sinB = Math.sin(angleBack);
  let tTx = Math.abs(cosB) > 0.001 ? Math.abs(toHW / cosB) : Infinity;
  let tTy = Math.abs(sinB) > 0.001 ? Math.abs(toHH / sinB) : Infinity;
  const tT = Math.min(tTx, tTy);
  const x2 = to.cx + cosB * tT;
  const y2 = to.cy + sinB * tT;

  return { x1, y1, x2, y2 };
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export const SketchDiagram: React.FC<SketchDiagramProps> = ({
  nodes,
  edges,
  beats,
  fps,
  accentColor = '#E85D26',
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps: vFps } = useVideoConfig();
  const activeBeatIndex = getActiveBeatIndex(frame, fps, beats);

  // Pre-compute all rough drawables (deterministic via fixed seeds)
  const drawables = useMemo(() => {
    const gen = getGenerator();
    const nodeDrawables: Record<string, any> = {};
    const highlightDrawables: Record<string, any> = {};
    const edgeDrawables: Array<{ key: string; drawable: any; arrowHead: string; label?: string; midX: number; midY: number; dashed: boolean }> = [];

    // Node rectangles
    nodes.forEach((node, idx) => {
      const { px, py, w, h } = resolveNodePos(node);
      const color = node.color || accentColor;
      nodeDrawables[node.id] = gen.rectangle(px, py, w, h, {
        roughness: 1.5,
        fill: color,
        fillStyle: 'hachure',
        fillWeight: 1.5,
        hachureGap: 6,
        stroke: color,
        strokeWidth: 2,
        seed: (idx + 1) * 42,
      });
      // Highlight circle (drawn around active node)
      const center = getNodeCenter(node);
      const radius = Math.max(w, h) * 0.75;
      highlightDrawables[node.id] = gen.ellipse(center.cx, center.cy, radius * 2, radius * 2, {
        roughness: 2.5,
        stroke: '#FDB813',
        strokeWidth: 3,
        fill: 'none',
        seed: (idx + 1) * 77,
      });
    });

    // Edge lines
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    edges.forEach((edge, idx) => {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      if (!fromNode || !toNode) return;

      const { x1, y1, x2, y2 } = edgeEndpoint(fromNode, toNode);
      const opts: any = {
        roughness: 1,
        stroke: '#AAAAAA',
        strokeWidth: 2,
        seed: (idx + 1) * 99,
      };
      if (edge.dashed) {
        opts.strokeLineDash = [8, 6];
      }
      const drawable = gen.line(x1, y1, x2, y2, opts);
      const headPath = arrowHeadPath(x1, y1, x2, y2, 10);
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      edgeDrawables.push({
        key: `edge-${idx}`,
        drawable,
        arrowHead: headPath,
        label: edge.label,
        midX,
        midY,
        dashed: !!edge.dashed,
      });
    });

    return { nodeDrawables, highlightDrawables, edgeDrawables };
  }, [nodes, edges, accentColor]);

  // ---------------------------------------------------------------------------
  // Determine which nodes/edges are visible based on beat-synced timing
  // ---------------------------------------------------------------------------
  // We use two modes: if nodes have beatIndex, use beat-based reveal.
  // Otherwise, reveal everything progressively via frame timing.
  const hasBeatIndexes = nodes.some(n => n.beatIndex !== undefined);

  function isNodeVisible(node: SketchNode): boolean {
    if (!hasBeatIndexes) {
      // Progressive reveal by node index
      const idx = nodes.indexOf(node);
      const enterFrame = idx * (fps * 0.3);
      return frame >= enterFrame;
    }
    return (node.beatIndex ?? 0) <= activeBeatIndex;
  }

  function isEdgeVisible(edge: SketchEdge): boolean {
    if (!hasBeatIndexes) {
      const idx = edges.indexOf(edge);
      const enterFrame = (nodes.length + idx) * (fps * 0.25);
      return frame >= enterFrame;
    }
    return (edge.beatIndex ?? 0) <= activeBeatIndex;
  }

  function isNodeActive(node: SketchNode): boolean {
    if (!hasBeatIndexes) return false;
    return node.beatIndex === activeBeatIndex;
  }

  // ---------------------------------------------------------------------------
  // Title entrance
  // ---------------------------------------------------------------------------
  const titleOpacity = title
    ? interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })
    : 0;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: CANVAS_W,
        height: CANVAS_H,
      }}
    >
      {/* Title */}
      {title && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: caveatFont,
            fontSize: 42,
            fontWeight: 700,
            color: accentColor,
            opacity: titleOpacity,
            zIndex: 10,
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          {title}
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        width={CANVAS_W}
        height={CANVAS_H}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Edges (rendered first, behind nodes) */}
        {drawables.edgeDrawables.map((edgeData, idx) => {
          const edge = edges[idx];
          if (!edge) return null;
          const visible = isEdgeVisible(edge);
          if (!visible) return null;

          const enterFrame = hasBeatIndexes
            ? (edge.beatIndex ?? 0) * (fps * 0.4)
            : (nodes.length + idx) * (fps * 0.25);
          const opacity = interpolate(
            frame,
            [enterFrame, enterFrame + fps * 0.3],
            [0, 0.7],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          return (
            <g key={edgeData.key} opacity={opacity}>
              {drawableToPathElements(edgeData.drawable, edgeData.key)}
              {/* Arrow head */}
              <path
                d={edgeData.arrowHead}
                fill="#AAAAAA"
                stroke="none"
              />
              {/* Edge label */}
              {edgeData.label && (
                <text
                  x={edgeData.midX}
                  y={edgeData.midY - 8}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.6)"
                  fontSize={16}
                  fontFamily={caveatFont}
                >
                  {edgeData.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node, idx) => {
          if (!isNodeVisible(node)) return null;

          const { px, py, w, h } = resolveNodePos(node);
          const enterFrame = hasBeatIndexes
            ? (node.beatIndex ?? 0) * (fps * 0.4)
            : idx * (fps * 0.3);
          const nodeSpring = spring({
            frame: Math.max(0, frame - enterFrame),
            fps: vFps,
            config: { damping: 15, stiffness: 100, mass: 0.8 },
          });
          const scale = interpolate(nodeSpring, [0, 1], [0.6, 1]);
          const opacity = interpolate(nodeSpring, [0, 1], [0, 1]);

          const center = getNodeCenter(node);
          const active = isNodeActive(node);

          return (
            <g
              key={node.id}
              opacity={opacity}
              transform={`translate(${center.cx}, ${center.cy}) scale(${scale}) translate(${-center.cx}, ${-center.cy})`}
            >
              {/* Node rectangle (rough.js) */}
              {drawableToPathElements(
                drawables.nodeDrawables[node.id],
                `node-${node.id}`,
              )}

              {/* Active highlight circle */}
              {active &&
                drawableToPathElements(
                  drawables.highlightDrawables[node.id],
                  `highlight-${node.id}`,
                  { opacity: 0.8 },
                )}

              {/* Icon (emoji / text) */}
              {node.icon && (
                <text
                  x={center.cx}
                  y={py + 18}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={22}
                  fill="white"
                >
                  {node.icon}
                </text>
              )}

              {/* Label */}
              <text
                x={center.cx}
                y={center.cy + (node.icon ? 6 : 0)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={20}
                fontWeight={700}
                fontFamily={caveatFont}
                fill="white"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default SketchDiagram;
