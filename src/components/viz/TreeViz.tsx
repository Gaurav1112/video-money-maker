import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';

interface TreeVizProps {
  sync: SyncState;
  frame: number;
  keywords: string[];
  variant?: string;
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

export const TreeViz: React.FC<TreeVizProps> = ({ sync, frame, keywords, variant }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;

  // ─── VARIANT ROUTING ──────────────────────────────────────────────────────
  if (variant === 'search') return <TreeSearchVariant sync={sync} frame={frame} keywords={keywords} />;
  if (variant === 'delete') return <TreeDeleteVariant sync={sync} frame={frame} keywords={keywords} />;
  if (variant === 'balance') return <TreeBalanceVariant sync={sync} frame={frame} keywords={keywords} />;

  // ─── DEFAULT variant: 'insert' — original behavior ────────────────────────

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

// Helper: clamp
function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}
function progressRange(p: number, start: number, end: number) {
  return clamp((p - start) / (end - start), 0, 1);
}

// =====================================================================
// SEARCH VARIANT — Highlight path from root to target node
// =====================================================================
const TreeSearchVariant: React.FC<Omit<TreeVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;

  // Search for value 40: root(50) -> left(30) -> right(40)
  const searchPath = [0, 1, 4]; // indices into NODES
  const searchValue = 40;

  // Tree appears first
  const treeRevealP = progressRange(progress, 0, 0.3);

  // Search traversal: highlight each node in path sequentially
  const searchSteps = searchPath.length;
  const currentStep = Math.min(searchSteps - 1, Math.floor(progressRange(progress, 0.3, 0.85) * searchSteps));
  const foundP = progressRange(progress, 0.85, 1.0);

  const nodeSprings = NODES.map((node) => {
    const triggerFrame = Math.round(node.triggerProgress * fps * 5);
    return spring({ frame: frame - triggerFrame, fps, config: { damping: 13, stiffness: 120, mass: 0.9 } });
  });

  const SVG_W = 600;
  const SVG_H = 420;

  return (
    <div style={{ width: '100%', height: '100%', background: THEME.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ color: THEME.gold, fontSize: 18, fontWeight: 700, letterSpacing: 2, marginBottom: 8, opacity: treeRevealP }}>
        BST SEARCH: find({searchValue})
      </div>

      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ overflow: 'visible' }}>
        {/* Edges */}
        {NODES.map((node) => {
          if (node.parentId === null) return null;
          const parent = NODES[node.parentId];
          const ep = treeRevealP;
          return (
            <line key={`e-${node.id}`} x1={parent.x} y1={parent.y} x2={interpolate(ep, [0, 1], [parent.x, node.x])} y2={interpolate(ep, [0, 1], [parent.y, node.y])} stroke={THEME.nodeBorder} strokeWidth={2} opacity={0.7 * treeRevealP} />
          );
        })}

        {/* Highlight search path edges */}
        {searchPath.slice(0, currentStep + 1).map((nodeIdx, i) => {
          if (i === 0) return null;
          const prevNode = NODES[searchPath[i - 1]];
          const currNode = NODES[nodeIdx];
          return (
            <line key={`sp-${i}`} x1={prevNode.x} y1={prevNode.y} x2={currNode.x} y2={currNode.y} stroke={THEME.gold} strokeWidth={3} opacity={0.8} />
          );
        })}

        {/* Nodes */}
        {NODES.map((node, i) => {
          const s = nodeSprings[i] * treeRevealP;
          const isOnPath = searchPath.includes(i) && searchPath.indexOf(i) <= currentStep;
          const isTarget = i === searchPath[searchPath.length - 1] && foundP > 0;
          const nodeColor = isTarget ? THEME.gold : isOnPath ? THEME.saffron : THEME.nodeDefault;
          const r = 28;
          return (
            <g key={`n-${node.id}`} transform={`translate(${node.x}, ${node.y}) scale(${s})`} style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
              <circle cx={0} cy={0} r={r + (isTarget ? 8 : 0)} fill="none" stroke={nodeColor} strokeWidth={isOnPath ? 2.5 : 1.5} opacity={isOnPath ? 0.6 : 0.2} />
              <circle cx={0} cy={0} r={r} fill={`${nodeColor}22`} stroke={nodeColor} strokeWidth={2} />
              <text x={0} y={5} textAnchor="middle" fill={nodeColor} fontSize={16} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">{node.value}</text>

              {/* Comparison label */}
              {isOnPath && !isTarget && progress > 0.35 && (
                <text x={r + 8} y={-10} fill={THEME.saffron} fontSize={10} fontWeight={600} fontFamily="Inter, system-ui, sans-serif">
                  {searchValue} {searchValue < node.value ? '<' : '>'} {node.value} {'\u2192'} {searchValue < node.value ? 'left' : 'right'}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Found badge */}
      {foundP > 0 && (
        <div style={{ color: THEME.gold, fontSize: 16, fontWeight: 700, opacity: foundP, marginTop: 8, background: `${THEME.gold}22`, padding: '6px 20px', borderRadius: 8, border: `1px solid ${THEME.gold}` }}>
          FOUND {searchValue} in {searchPath.length} comparisons!
        </div>
      )}
    </div>
  );
};

// =====================================================================
// DELETE VARIANT — Remove a node, show restructuring
// =====================================================================
const TreeDeleteVariant: React.FC<Omit<TreeVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;

  const treeRevealP = progressRange(progress, 0, 0.25);
  const highlightP = progressRange(progress, 0.25, 0.45);  // highlight node to delete
  const deleteP = progressRange(progress, 0.45, 0.65);      // node fades out
  const restructureP = progressRange(progress, 0.65, 0.9);  // successor moves in

  // Delete node 30 (id=1) — in-order successor is 40 (id=4)
  const deleteNodeId = 1;
  const successorId = 4;
  const deleteValue = 30;
  const successorValue = 40;

  const nodeSprings = NODES.map((node) => {
    const triggerFrame = Math.round(node.triggerProgress * fps * 5);
    return spring({ frame: frame - triggerFrame, fps, config: { damping: 13, stiffness: 120, mass: 0.9 } });
  });

  const SVG_W = 600;
  const SVG_H = 420;

  // Successor slides to deleted node position
  const successorX = restructureP > 0 ? interpolate(restructureP, [0, 1], [NODES[successorId].x, NODES[deleteNodeId].x]) : NODES[successorId].x;
  const successorY = restructureP > 0 ? interpolate(restructureP, [0, 1], [NODES[successorId].y, NODES[deleteNodeId].y]) : NODES[successorId].y;

  return (
    <div style={{ width: '100%', height: '100%', background: THEME.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ color: '#EF4444', fontSize: 18, fontWeight: 700, letterSpacing: 2, marginBottom: 8, opacity: treeRevealP }}>
        BST DELETE: remove({deleteValue})
      </div>

      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ overflow: 'visible' }}>
        {/* Edges */}
        {NODES.map((node) => {
          if (node.parentId === null) return null;
          const parent = NODES[node.parentId];
          // Skip edges involving deleted/moved nodes after restructure
          if (restructureP > 0.5 && (node.id === deleteNodeId || node.id === successorId)) return null;
          return (
            <line key={`e-${node.id}`} x1={parent.x} y1={parent.y} x2={node.x} y2={node.y} stroke={THEME.nodeBorder} strokeWidth={2} opacity={0.7 * treeRevealP} />
          );
        })}

        {/* New edge: root -> successor at old position */}
        {restructureP > 0.3 && (
          <line x1={NODES[0].x} y1={NODES[0].y} x2={successorX} y2={successorY} stroke={THEME.gold} strokeWidth={2} opacity={restructureP} />
        )}

        {/* Nodes */}
        {NODES.map((node, i) => {
          const s = nodeSprings[i] * treeRevealP;
          const isDeleting = i === deleteNodeId;
          const isSuccessor = i === successorId;

          // Deleted node fades out
          if (isDeleting && deleteP > 0.5) return null;

          // Successor moves to deleted position
          const nx = isSuccessor ? successorX : node.x;
          const ny = isSuccessor ? successorY : node.y;

          const nodeColor = isDeleting && highlightP > 0 ? '#EF4444'
            : isSuccessor && restructureP > 0 ? THEME.gold
            : THEME.nodeDefault;
          const r = 28;

          return (
            <g key={`n-${node.id}`} transform={`translate(${nx}, ${ny}) scale(${s})`} style={{ transformOrigin: `${nx}px ${ny}px` }}
              opacity={isDeleting ? 1 - deleteP : 1}>
              <circle cx={0} cy={0} r={r} fill={`${nodeColor}22`} stroke={nodeColor} strokeWidth={2} />
              <text x={0} y={5} textAnchor="middle" fill={nodeColor} fontSize={16} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">
                {isSuccessor && restructureP > 0.5 ? successorValue : node.value}
              </text>
              {isDeleting && highlightP > 0 && deleteP < 0.5 && (
                <text x={r + 8} y={-10} fill="#EF4444" fontSize={10} fontWeight={600}>DELETE</text>
              )}
              {isSuccessor && restructureP > 0.2 && restructureP < 0.8 && (
                <text x={r + 8} y={-10} fill={THEME.gold} fontSize={10} fontWeight={600}>successor</text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Step indicator */}
      <div style={{ color: THEME.indigo, fontSize: 13, fontWeight: 600, opacity: 0.7, marginTop: 8 }}>
        {deleteP < 0.3 ? 'Step 1: Find node to delete'
          : deleteP < 0.8 ? 'Step 2: Find in-order successor'
          : restructureP < 0.8 ? 'Step 3: Replace with successor'
          : 'Done! Tree restructured'}
      </div>
    </div>
  );
};

// =====================================================================
// BALANCE VARIANT — Unbalanced tree rotates to balanced form
// =====================================================================
const TreeBalanceVariant: React.FC<Omit<TreeVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps } = useVideoConfig();
  const progress = sync.sceneProgress;

  // Phase 1: Show unbalanced (right-skewed) tree
  // Phase 2: Highlight imbalance
  // Phase 3: Rotation animation
  // Phase 4: Show balanced result

  const unbalancedRevealP = progressRange(progress, 0, 0.25);
  const imbalanceP = progressRange(progress, 0.25, 0.4);
  const rotateP = progressRange(progress, 0.4, 0.7);
  const balancedP = progressRange(progress, 0.7, 1.0);

  // Unbalanced: 10 -> 20 -> 30 -> 40 -> 50 (right skew)
  const unbalancedNodes = [
    { value: 10, x: 100, y: 80 },
    { value: 20, x: 200, y: 160 },
    { value: 30, x: 300, y: 240 },
    { value: 40, x: 400, y: 320 },
    { value: 50, x: 500, y: 400 },
  ];

  // Balanced: 30 at root
  const balancedNodes = [
    { value: 30, x: 300, y: 80 },
    { value: 10, x: 150, y: 180 },
    { value: 40, x: 450, y: 180 },
    { value: 20, x: 225, y: 280 },
    { value: 50, x: 525, y: 280 },
  ];

  // Interpolate positions
  const currentNodes = unbalancedNodes.map((un, i) => ({
    value: un.value,
    x: interpolate(rotateP, [0, 1], [un.x, balancedNodes[i].x]),
    y: interpolate(rotateP, [0, 1], [un.y, balancedNodes[i].y]),
  }));

  // Balanced edges (parent indices)
  const balancedEdges = [
    [0, 1], [0, 2], [1, 3], [2, 4], // root->left, root->right, left->child, right->child
  ];
  // Unbalanced edges
  const unbalancedEdges = [
    [0, 1], [1, 2], [2, 3], [3, 4],
  ];
  // Interpolate between edge sets
  const edges = rotateP < 0.5 ? unbalancedEdges : balancedEdges;

  const SVG_W = 600;
  const SVG_H = 440;

  return (
    <div style={{ width: '100%', height: '100%', background: THEME.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ color: THEME.teal, fontSize: 18, fontWeight: 700, letterSpacing: 2, marginBottom: 8, opacity: unbalancedRevealP }}>
        {rotateP < 0.5 ? 'UNBALANCED BST (O(n) lookup)' : 'BALANCED BST (O(log n) lookup)'}
      </div>

      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ overflow: 'visible' }}>
        {/* Edges */}
        {edges.map(([from, to], i) => (
          <line key={`e-${i}`} x1={currentNodes[from].x} y1={currentNodes[from].y} x2={currentNodes[to].x} y2={currentNodes[to].y} stroke={THEME.nodeBorder} strokeWidth={2} opacity={0.7 * unbalancedRevealP} />
        ))}

        {/* Nodes */}
        {currentNodes.map((node, i) => {
          const r = 28;
          const nodeColor = rotateP > 0.1 && rotateP < 0.9 ? THEME.gold : THEME.indigo;
          return (
            <g key={`n-${i}`} transform={`translate(${node.x}, ${node.y})`} opacity={unbalancedRevealP}>
              <circle cx={0} cy={0} r={r} fill={`${nodeColor}22`} stroke={nodeColor} strokeWidth={2} />
              <text x={0} y={5} textAnchor="middle" fill={nodeColor} fontSize={16} fontWeight={700} fontFamily="Inter, system-ui, sans-serif">{node.value}</text>
            </g>
          );
        })}
      </svg>

      {/* Imbalance warning */}
      {imbalanceP > 0 && rotateP < 0.3 && (
        <div style={{ color: '#EF4444', fontSize: 14, fontWeight: 700, opacity: imbalanceP, background: 'rgba(239,68,68,0.1)', padding: '6px 16px', borderRadius: 6, border: '1px solid #EF4444' }}>
          Height = {unbalancedNodes.length - 1} (should be {Math.ceil(Math.log2(unbalancedNodes.length + 1))}) {'\u2014'} ROTATION NEEDED
        </div>
      )}

      {/* Rotation indicator */}
      {rotateP > 0.1 && rotateP < 0.9 && (
        <div style={{ color: THEME.gold, fontSize: 14, fontWeight: 700, opacity: 0.5 + 0.5 * Math.sin(frame * 0.1), marginTop: 4 }}>
          {'\u21BB'} Performing AVL Rotation...
        </div>
      )}

      {/* Balanced confirmation */}
      {balancedP > 0.3 && (
        <div style={{ color: THEME.teal, fontSize: 14, fontWeight: 700, opacity: balancedP, background: `${THEME.teal}22`, padding: '6px 16px', borderRadius: 6, border: `1px solid ${THEME.teal}` }}>
          Balanced! Height = {Math.ceil(Math.log2(balancedNodes.length + 1))} {'\u2014'} O(log n) guaranteed
        </div>
      )}
    </div>
  );
};
