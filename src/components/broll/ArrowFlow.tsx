/**
 * ArrowFlow.tsx
 *
 * Animated data-flow arrows between labeled nodes.
 * Each arrow animates sequentially with a moving "packet" dot.
 * Uses SVG for crisp rendering at any scale.
 *
 * Information density: visualizes data moving through a system.
 * "Request → Load Balancer → Server A/B" drawn in real-time.
 *
 * Usage:
 *   <ArrowFlow
 *     seed={3}
 *     nodes={[
 *       { id: 'client', label: 'Client', x: 100, y: 300 },
 *       { id: 'lb', label: 'Load\nBalancer', x: 500, y: 300 },
 *       { id: 'srv1', label: 'Server A', x: 900, y: 150 },
 *       { id: 'srv2', label: 'Server B', x: 900, y: 450 },
 *     ]}
 *     edges={[
 *       { from: 'client', to: 'lb', label: '10k RPS' },
 *       { from: 'lb', to: 'srv1', label: '5k RPS' },
 *       { from: 'lb', to: 'srv2', label: '5k RPS' },
 *     ]}
 *     framesPerEdge={45}
 *   />
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { createNoise } from './seeded-noise';

interface FlowNode {
  id: string;
  label: string;
  x: number;
  y: number;
  icon?: string;
  color?: string;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  color?: string;
  /** Packets per second visual hint */
  thickness?: number;
}

interface ArrowFlowProps {
  seed: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Frames to draw each edge. Default: 45 */
  framesPerEdge?: number;
  /** Width of the SVG canvas */
  canvasWidth?: number;
  canvasHeight?: number;
  startFrame?: number;
  /** Show animated packet dots moving along edges */
  showPackets?: boolean;
}

const DEFAULT_COLOR = '#38BDF8';

export const ArrowFlow: React.FC<ArrowFlowProps> = ({
  seed,
  nodes,
  edges,
  framesPerEdge = 45,
  canvasWidth = 1000,
  canvasHeight = 600,
  startFrame = 0,
  showPackets = true,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const n = createNoise(seed);

  const nodeMap = new Map(nodes.map(nd => [nd.id, nd]));

  // How many edges are fully or partially drawn?
  const edgesRevealed = Math.min(
    Math.floor(elapsed / framesPerEdge) + 1,
    edges.length,
  );

  function getPos(id: string) {
    return nodeMap.get(id) ?? { x: 0, y: 0 };
  }

  // Quadratic bezier control point (slightly curved)
  function controlPoint(x1: number, y1: number, x2: number, y2: number, i: number) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    // Offset based on seed+index for visual variety
    const offset = n.smoothAt(i * 17.3, -80, 80);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    return {
      cx: mx - Math.sin(angle) * offset,
      cy: my + Math.cos(angle) * offset,
    };
  }

  // Bezier point at t
  function bezierPoint(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, t: number) {
    const mt = 1 - t;
    return {
      x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
      y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2,
    };
  }

  return (
    <div style={{ width: canvasWidth, height: canvasHeight, position: 'relative' }}>
      <svg
        width={canvasWidth}
        height={canvasHeight}
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
      >
        <defs>
          <marker id={`arrowhead-${seed}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={DEFAULT_COLOR} />
          </marker>
          {edges.map((e, i) => (
            <marker
              key={i}
              id={`arrowhead-${seed}-${i}`}
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill={e.color ?? DEFAULT_COLOR} />
            </marker>
          ))}
        </defs>

        {/* Edges */}
        {edges.slice(0, edgesRevealed).map((edge, i) => {
          const from = getPos(edge.from);
          const to = getPos(edge.to);
          const { cx, cy } = controlPoint(from.x, from.y, to.x, to.y, i);
          const color = edge.color ?? DEFAULT_COLOR;

          const edgeFrame = i * framesPerEdge;
          const edgeElapsed = Math.max(0, elapsed - edgeFrame);
          const drawProgress = Math.min(1, edgeElapsed / framesPerEdge);

          // Animated stroke-dashoffset for path drawing effect
          const pathLength = 300; // approximate — SVG handles via pathLength attr

          // Packet animation: loops every 60 frames, only after edge is drawn
          const packetT = ((elapsed - edgeFrame - framesPerEdge) % 60) / 60;
          const packetVisible = showPackets && edgeElapsed > framesPerEdge && packetT >= 0 && packetT <= 1;
          const packetPos = packetVisible
            ? bezierPoint(from.x, from.y, cx, cy, to.x, to.y, packetT)
            : null;

          return (
            <g key={i}>
              <path
                d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
                fill="none"
                stroke={color}
                strokeWidth={edge.thickness ?? 2.5}
                strokeDasharray={`${pathLength * drawProgress} ${pathLength}`}
                markerEnd={drawProgress > 0.9 ? `url(#arrowhead-${seed}-${i})` : undefined}
                opacity={0.85}
              />
              {/* Edge label */}
              {edge.label && drawProgress > 0.5 && (
                <text
                  x={cx}
                  y={cy - 14}
                  textAnchor="middle"
                  fill={color}
                  fontSize={16}
                  fontFamily='"Space Grotesk", sans-serif'
                  fontWeight="600"
                  opacity={interpolate(drawProgress, [0.5, 0.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
                >
                  {edge.label}
                </text>
              )}
              {/* Packet dot */}
              {packetPos && (
                <circle cx={packetPos.x} cy={packetPos.y} r={6} fill={color} opacity={0.9} />
              )}
            </g>
          );
        })}
      </svg>

      {/* Nodes (positioned absolutely over SVG) */}
      {nodes.map((node, i) => {
        const nodeFrame = Math.min(i * 12, framesPerEdge);
        const nodeElapsed = Math.max(0, elapsed - nodeFrame);
        const nodeOpacity = interpolate(nodeElapsed, [0, 15], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const nodeScale = interpolate(nodeElapsed, [0, 20], [0.7, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const color = node.color ?? DEFAULT_COLOR;

        return (
          <div
            key={node.id}
            style={{
              position: 'absolute',
              left: node.x - 60,
              top: node.y - 40,
              width: 120,
              height: 80,
              background: `linear-gradient(135deg, ${color}22, ${color}11)`,
              border: `2px solid ${color}`,
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: nodeOpacity,
              transform: `scale(${nodeScale})`,
              boxShadow: `0 0 16px ${color}44`,
            }}
          >
            {node.icon && <span style={{ fontSize: 22 }}>{node.icon}</span>}
            <span
              style={{
                color,
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: 15,
                textAlign: 'center',
                padding: '0 8px',
                whiteSpace: 'pre-line',
              }}
            >
              {node.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
