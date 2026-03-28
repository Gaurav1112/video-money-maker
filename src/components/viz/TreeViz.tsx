import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';

interface TreeVizProps {
  sync: SyncState;
  frame: number;
  keywords: string[];
}

const THEME = {
  saffron: '#E85D26',
  gold: '#FFD700',
  teal: '#20C997',
  indigo: '#818CF8',
  dark: '#0C0A15',
  nodeDefault: '#818CF8',
  nodeBorder: 'rgba(255,255,255,0.15)',
};

interface TreeNode {
  id: number;
  value: number;
  x: number;
  y: number;
  parentId: number | null;
  triggerProgress: number;
}

// BST structure: insert 50, 30, 70, 20, 40
const NODES: TreeNode[] = [
  { id: 0, value: 50, x: 300, y: 80,  parentId: null, triggerProgress: 0.0 },  // root
  { id: 1, value: 30, x: 180, y: 180, parentId: 0,    triggerProgress: 0.2 },
  { id: 2, value: 70, x: 420, y: 180, parentId: 0,    triggerProgress: 0.35 },
  { id: 3, value: 20, x: 100, y: 280, parentId: 1,    triggerProgress: 0.5 },
  { id: 4, value: 40, x: 260, y: 280, parentId: 1,    triggerProgress: 0.65 },
];

// The "inserted" node travels from root down to its final position
const INSERT_VALUE = 35;
const INSERT_PATH = [NODES[0], NODES[1], { ...NODES[4], value: INSERT_VALUE, x: 200, y: 380 }];
const INSERT_TRIGGER = 0.78;
const INSERT_DURATION = 0.18;

export const TreeViz: React.FC<TreeVizProps> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;

  // Per-node spring scale
  const nodeSprings = NODES.map((node) => {
    const triggerFrame = Math.round(node.triggerProgress * fps * 8);
    return spring({
      frame: frame - triggerFrame,
      fps,
      config: { damping: 13, stiffness: 120, mass: 0.9 },
    });
  });

  // Edge draw progress for each node (toward its parent)
  const edgeProgress = NODES.map((node) => {
    if (node.parentId === null) return 1;
    const start = node.triggerProgress - 0.05;
    return interpolate(progress, [start, start + 0.18], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  });

  // Insert animation progress (0 → 1 across INSERT_DURATION)
  const insertT = interpolate(
    progress,
    [INSERT_TRIGGER, INSERT_TRIGGER + INSERT_DURATION],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Which path segment the insert dot is on
  // 0→1: root → node1, 1→2: node1 → final position
  const insertSegment = insertT < 0.5 ? 0 : 1;
  const segT = insertT < 0.5 ? insertT * 2 : (insertT - 0.5) * 2;

  const insertFrom = INSERT_PATH[insertSegment];
  const insertTo = INSERT_PATH[insertSegment + 1];
  const insertX = interpolate(segT, [0, 1], [insertFrom.x, insertTo.x]);
  const insertY = interpolate(segT, [0, 1], [insertFrom.y, insertTo.y]);
  const insertVisible = progress >= INSERT_TRIGGER;
  const insertSettled = progress >= INSERT_TRIGGER + INSERT_DURATION + 0.02;

  // Insert node scale
  const insertNodeSpring = spring({
    frame: frame - Math.round((INSERT_TRIGGER + INSERT_DURATION) * fps * 8),
    fps,
    config: { damping: 11, stiffness: 180 },
  });

  const SVG_W = 600;
  const SVG_H = 420;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: THEME.dark,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Title */}
      <div
        style={{
          color: THEME.gold,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2,
          marginBottom: 8,
          opacity: interpolate(nodeSprings[0], [0, 1], [0, 1]),
        }}
      >
        BINARY SEARCH TREE
      </div>

      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ overflow: 'visible' }}
      >
        {/* Edges */}
        {NODES.map((node) => {
          if (node.parentId === null) return null;
          const parent = NODES[node.parentId];
          const ep = edgeProgress[node.id];
          const endX = interpolate(ep, [0, 1], [parent.x, node.x]);
          const endY = interpolate(ep, [0, 1], [parent.y, node.y]);

          return (
            <line
              key={`edge-${node.id}`}
              x1={parent.x}
              y1={parent.y}
              x2={endX}
              y2={endY}
              stroke={THEME.nodeBorder}
              strokeWidth={2}
              opacity={0.7}
            />
          );
        })}

        {/* Insert path edge (root → node1) highlight */}
        {insertVisible && insertT < 0.5 && (
          <line
            x1={INSERT_PATH[0].x}
            y1={INSERT_PATH[0].y}
            x2={INSERT_PATH[1].x}
            y2={INSERT_PATH[1].y}
            stroke={THEME.gold}
            strokeWidth={2}
            strokeDasharray="6 3"
            opacity={0.5}
          />
        )}

        {/* Nodes */}
        {NODES.map((node, i) => {
          const s = nodeSprings[i];
          const r = 28;
          return (
            <g
              key={`node-${node.id}`}
              transform={`translate(${node.x}, ${node.y}) scale(${s})`}
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            >
              {/* Glow ring */}
              <circle
                cx={0}
                cy={0}
                r={r + 6}
                fill="none"
                stroke={THEME.indigo}
                strokeWidth={1.5}
                opacity={0.2 * s}
              />
              {/* Main circle */}
              <circle
                cx={0}
                cy={0}
                r={r}
                fill={`${THEME.nodeDefault}22`}
                stroke={THEME.nodeDefault}
                strokeWidth={2}
              />
              {/* Value text */}
              <text
                x={0}
                y={5}
                textAnchor="middle"
                fill={THEME.indigo}
                fontSize={16}
                fontWeight={700}
                fontFamily="Inter, system-ui, sans-serif"
              >
                {node.value}
              </text>
            </g>
          );
        })}

        {/* Insert travelling dot */}
        {insertVisible && !insertSettled && (
          <g>
            {/* Trail glow */}
            <circle
              cx={insertX}
              cy={insertY}
              r={18}
              fill={THEME.gold}
              opacity={0.15}
            />
            <circle
              cx={insertX}
              cy={insertY}
              r={28}
              fill={`${THEME.gold}22`}
              stroke={THEME.gold}
              strokeWidth={2}
              opacity={0.9}
            />
            <text
              x={insertX}
              y={insertY + 5}
              textAnchor="middle"
              fill={THEME.gold}
              fontSize={16}
              fontWeight={700}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {INSERT_VALUE}
            </text>
          </g>
        )}

        {/* Settled insert node */}
        {insertSettled && (
          <g transform={`translate(${INSERT_PATH[2].x}, ${INSERT_PATH[2].y}) scale(${insertNodeSpring})`}>
            {/* Edge to parent */}
            <line
              x1={0}
              y1={0}
              x2={NODES[1].x - INSERT_PATH[2].x}
              y2={NODES[1].y - INSERT_PATH[2].y}
              stroke={THEME.gold}
              strokeWidth={2}
              opacity={0.6}
            />
            <circle
              cx={0}
              cy={0}
              r={34}
              fill="none"
              stroke={THEME.gold}
              strokeWidth={2}
              opacity={0.3}
            />
            <circle
              cx={0}
              cy={0}
              r={28}
              fill={`${THEME.gold}33`}
              stroke={THEME.gold}
              strokeWidth={2.5}
            />
            <text
              x={0}
              y={5}
              textAnchor="middle"
              fill={THEME.gold}
              fontSize={16}
              fontWeight={700}
              fontFamily="Inter, system-ui, sans-serif"
            >
              {INSERT_VALUE}
            </text>
            {/* "inserted!" label */}
            <text
              x={36}
              y={-18}
              fill={THEME.gold}
              fontSize={11}
              fontWeight={600}
              fontFamily="Inter, system-ui, sans-serif"
              opacity={0.8}
            >
              inserted!
            </text>
          </g>
        )}

        {/* Legend */}
        <g transform="translate(20, 390)">
          <circle cx={8} cy={0} r={6} fill={`${THEME.indigo}44`} stroke={THEME.indigo} strokeWidth={1.5} />
          <text x={20} y={4} fill="rgba(255,255,255,0.4)" fontSize={11} fontFamily="Inter, system-ui, sans-serif">
            existing node
          </text>
          <circle cx={120} cy={0} r={6} fill={`${THEME.gold}44`} stroke={THEME.gold} strokeWidth={1.5} />
          <text x={132} y={4} fill="rgba(255,255,255,0.4)" fontSize={11} fontFamily="Inter, system-ui, sans-serif">
            inserted node
          </text>
        </g>
      </svg>
    </div>
  );
};
