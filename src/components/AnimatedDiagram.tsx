import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, Easing, spring } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { fadeIn } from '../lib/animations';

interface DiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color?: string;
}

interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

interface AnimatedDiagramProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  title: string;
  startFrame: number;
  durationInFrames: number;
}

const NODE_RADIUS = 40;
const NODE_STAGGER = 12; // frames between each node appearing
const EDGE_DRAW_DURATION = 20; // frames to draw each edge

/**
 * AnimatedDiagram — code-driven diagram with spring-animated nodes
 * and self-drawing edges. Replaces Mermaid-to-SVG pipeline.
 */
const AnimatedDiagram: React.FC<AnimatedDiagramProps> = ({
  nodes,
  edges,
  title,
  startFrame,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const fps = 30;

  // Title animation
  const titleOpacity = fadeIn(frame, startFrame, 20);
  const titleY = interpolate(
    frame,
    [startFrame, startFrame + 30],
    [40, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
  );

  // Edges start after all nodes are in
  const edgesStartFrame = startFrame + 20 + nodes.length * NODE_STAGGER;

  // Node lookup for edge drawing
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, #0C0A15 0%, #0F0C1A 50%, #0C0A15 100%)`,
        fontFamily: FONTS.text,
        overflow: 'hidden',
      }}
    >
      {/* Subtle grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(${COLORS.white}03 1px, transparent 1px), linear-gradient(90deg, ${COLORS.white}03 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '40%',
          width: 700,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${COLORS.indigo}08, transparent 70%)`,
          filter: 'blur(80px)',
        }}
      />

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          fontSize: SIZES.heading2,
          fontWeight: 700,
          color: COLORS.saffron,
          fontFamily: FONTS.heading,
          zIndex: 5,
        }}
      >
        {title}
      </div>

      {/* Diagram area — shifted down to make room for title */}
      <div
        style={{
          position: 'absolute',
          top: 140,
          left: 100,
          right: 100,
          bottom: 80,
        }}
      >
        {/* SVG layer for edges */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill={COLORS.gray}
                opacity={0.7}
              />
            </marker>
          </defs>

          {edges.map((edge, i) => {
            const fromNode = nodeMap.get(edge.from);
            const toNode = nodeMap.get(edge.to);
            if (!fromNode || !toNode) return null;

            const edgeStart = edgesStartFrame + i * (EDGE_DRAW_DURATION + 5);

            // Edge drawing progress (0 to 1)
            const drawProgress = interpolate(
              frame,
              [edgeStart, edgeStart + EDGE_DRAW_DURATION],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) },
            );

            // Calculate edge positions as percentages
            const x1 = fromNode.x;
            const y1 = fromNode.y;
            const x2 = toNode.x;
            const y2 = toNode.y;

            // Shorten line to account for node radius
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / len;
            const ny = dy / len;
            // Adjust by radius offset as a percentage of the container
            const radiusPct = 3; // approximate radius in percentage
            const sx = x1 + nx * radiusPct;
            const sy = y1 + ny * radiusPct;
            const ex = x2 - nx * radiusPct;
            const ey = y2 - ny * radiusPct;

            // Visible endpoint based on draw progress
            const vx = sx + (ex - sx) * drawProgress;
            const vy = sy + (ey - sy) * drawProgress;

            const edgeOpacity = drawProgress > 0 ? 1 : 0;

            // Edge label midpoint
            const mx = (sx + ex) / 2;
            const my = (sy + ey) / 2;
            const labelOpacity = interpolate(
              frame,
              [edgeStart + EDGE_DRAW_DURATION, edgeStart + EDGE_DRAW_DURATION + 10],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );

            return (
              <g key={`edge-${i}`}>
                {/* Edge line */}
                <line
                  x1={`${sx}%`}
                  y1={`${sy}%`}
                  x2={`${vx}%`}
                  y2={`${vy}%`}
                  stroke={COLORS.gray}
                  strokeWidth={2}
                  opacity={edgeOpacity * 0.6}
                  markerEnd={drawProgress > 0.95 ? 'url(#arrowhead)' : undefined}
                />

                {/* Glow trail */}
                <line
                  x1={`${sx}%`}
                  y1={`${sy}%`}
                  x2={`${vx}%`}
                  y2={`${vy}%`}
                  stroke={COLORS.indigo}
                  strokeWidth={4}
                  opacity={edgeOpacity * 0.15}
                  filter="url(#blur)"
                />

                {/* Edge label */}
                {edge.label && (
                  <text
                    x={`${mx}%`}
                    y={`${my - 2}%`}
                    textAnchor="middle"
                    fill={COLORS.gray}
                    fontSize={SIZES.caption}
                    fontFamily={FONTS.text}
                    opacity={labelOpacity}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes rendered as positioned divs */}
        {nodes.map((node, i) => {
          const nodeStart = startFrame + 20 + i * NODE_STAGGER;
          const nodeSpring = spring({
            frame: Math.max(0, frame - nodeStart),
            fps,
            config: { damping: 12, stiffness: 120, mass: 0.7 },
          });

          const nodeColor = node.color || COLORS.indigo;

          // Subtle hover effect
          const breathe = interpolate(
            Math.sin(frame * 0.04 + i * 1.5),
            [-1, 1],
            [0.97, 1.03],
          );

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: `${node.x}%`,
                top: `${node.y}%`,
                transform: `translate(-50%, -50%) scale(${nodeSpring * breathe})`,
                opacity: nodeSpring,
              }}
            >
              {/* Node glow */}
              <div
                style={{
                  position: 'absolute',
                  top: -10,
                  left: -10,
                  right: -10,
                  bottom: -10,
                  borderRadius: 20,
                  background: `radial-gradient(circle, ${nodeColor}15, transparent 70%)`,
                  filter: 'blur(10px)',
                }}
              />

              {/* Node body */}
              <div
                style={{
                  width: NODE_RADIUS * 2,
                  height: NODE_RADIUS * 2,
                  borderRadius: 14,
                  backgroundColor: `${COLORS.darkAlt}`,
                  border: `2px solid ${nodeColor}66`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 8,
                  boxShadow: `0 4px 20px ${COLORS.dark}88, 0 0 0 1px ${nodeColor}15`,
                }}
              >
                <div
                  style={{
                    fontSize: SIZES.caption,
                    fontWeight: 600,
                    color: COLORS.white,
                    textAlign: 'center',
                    lineHeight: 1.3,
                    fontFamily: FONTS.text,
                  }}
                >
                  {node.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export default AnimatedDiagram;
