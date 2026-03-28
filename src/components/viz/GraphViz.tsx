import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import type { SyncState } from '../../types';

const C = {
  saffron: '#E85D26',
  gold: '#FDB813',
  teal: '#1DD1A1',
  indigo: '#818CF8',
  gray: '#A9ACB3',
  dark: '#0C0A15',
  darkAlt: '#1A1625',
  white: '#FFFFFF',
  red: '#EF4444',
  green: '#22C55E',
  purple: '#A855F7',
  cyan: '#06B6D4',
};

interface GraphVizProps {
  sync: SyncState;
  frame: number;
  keywords: string[];
  variant?: string;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function progressWindow(p: number, start: number, end: number) {
  return clamp((p - start) / (end - start), 0, 1);
}

function useReliableProgress(frame: number, fps: number, sync: SyncState): number {
  if (sync.sceneProgress > 0.01 && sync.sceneProgress < 0.99) {
    return sync.sceneProgress;
  }
  const assumedDuration = 8 * fps;
  return Math.min(1, frame / assumedDuration);
}

// Graph definition: 8 nodes with adjacency
interface GraphNode {
  id: number;
  label: string;
  fx: number;
  fy: number;
}

interface GraphEdge {
  from: number;
  to: number;
  weight: number;
}

const NODES: GraphNode[] = [
  { id: 0, label: 'A', fx: 0.18, fy: 0.20 },
  { id: 1, label: 'B', fx: 0.42, fy: 0.12 },
  { id: 2, label: 'C', fx: 0.68, fy: 0.18 },
  { id: 3, label: 'D', fx: 0.12, fy: 0.52 },
  { id: 4, label: 'E', fx: 0.40, fy: 0.48 },
  { id: 5, label: 'F', fx: 0.65, fy: 0.50 },
  { id: 6, label: 'G', fx: 0.30, fy: 0.78 },
  { id: 7, label: 'H', fx: 0.60, fy: 0.80 },
];

const EDGES: GraphEdge[] = [
  { from: 0, to: 1, weight: 4 },
  { from: 0, to: 3, weight: 2 },
  { from: 1, to: 2, weight: 5 },
  { from: 1, to: 4, weight: 3 },
  { from: 2, to: 5, weight: 6 },
  { from: 3, to: 4, weight: 1 },
  { from: 3, to: 6, weight: 7 },
  { from: 4, to: 5, weight: 2 },
  { from: 4, to: 6, weight: 4 },
  { from: 4, to: 7, weight: 5 },
  { from: 5, to: 7, weight: 3 },
  { from: 6, to: 7, weight: 6 },
];

// BFS order from node 0
const BFS_ORDER = [0, 1, 3, 2, 4, 6, 5, 7];
// BFS levels
const BFS_LEVELS: number[][] = [[0], [1, 3], [2, 4, 6], [5, 7]];

// DFS order from node 0
const DFS_ORDER = [0, 1, 2, 5, 7, 4, 6, 3];

// Dijkstra shortest path from 0 to 7
const DIJKSTRA_ORDER = [0, 3, 4, 5, 7]; // Shortest path nodes
const DIJKSTRA_DISTANCES: Record<number, number> = { 0: 0, 3: 2, 4: 3, 1: 4, 6: 7, 5: 5, 2: 9, 7: 8 };

// Colors for visited states
const NODE_STATES = {
  unvisited: C.gray,
  current: C.saffron,
  visited: C.teal,
  path: C.gold,
};

// ---- Sub-components ----

interface GraphNodeCircleProps {
  node: GraphNode;
  state: 'unvisited' | 'current' | 'visited' | 'path';
  springVal: number;
  frame: number;
  svgW: number;
  svgH: number;
  distLabel?: string;
}

const GraphNodeCircle: React.FC<GraphNodeCircleProps> = ({
  node, state, springVal, frame, svgW, svgH, distLabel,
}) => {
  const cx = node.fx * svgW;
  const cy = node.fy * svgH;
  const color = NODE_STATES[state];
  const isCurrent = state === 'current';
  const isPath = state === 'path';

  const pulse = isCurrent ? 1 + 0.15 * Math.sin(frame * 0.2) : 1;
  const glowSize = isCurrent ? 8 + 4 * Math.sin(frame * 0.15) : isPath ? 5 : 0;
  const radius = 22;

  return (
    <g opacity={springVal}>
      {/* Glow ring */}
      {(isCurrent || isPath) && (
        <circle cx={cx} cy={cy} r={radius + glowSize} fill="none"
          stroke={color} strokeWidth={2} opacity={0.3 + 0.2 * Math.sin(frame * 0.1)}
        />
      )}
      {/* Node circle */}
      <circle cx={cx} cy={cy} r={radius * pulse}
        fill={`${color}22`} stroke={color} strokeWidth={isCurrent ? 3 : 2}
      />
      {/* Label */}
      <text x={cx} y={cy + 1} fill={color} fontSize={16} fontWeight={700}
        fontFamily="Inter, sans-serif" textAnchor="middle" dominantBaseline="middle">
        {node.label}
      </text>
      {/* Distance label for Dijkstra */}
      {distLabel && (
        <g>
          <rect x={cx + radius - 2} y={cy - radius - 4} width={28} height={16} rx={4}
            fill={C.dark} stroke={color} strokeWidth={1}
          />
          <text x={cx + radius + 12} y={cy - radius + 6} fill={color} fontSize={10}
            fontWeight={700} fontFamily="Inter, sans-serif" textAnchor="middle">
            {distLabel}
          </text>
        </g>
      )}
    </g>
  );
};

interface GraphEdgeLineProps {
  edge: GraphEdge;
  nodes: GraphNode[];
  svgW: number;
  svgH: number;
  opacity: number;
  isHighlighted: boolean;
  highlightColor?: string;
  showWeight: boolean;
  frame: number;
}

const GraphEdgeLine: React.FC<GraphEdgeLineProps> = ({
  edge, nodes, svgW, svgH, opacity, isHighlighted, highlightColor, showWeight, frame,
}) => {
  const from = nodes[edge.from];
  const to = nodes[edge.to];
  const x1 = from.fx * svgW;
  const y1 = from.fy * svgH;
  const x2 = to.fx * svgW;
  const y2 = to.fy * svgH;
  const color = isHighlighted ? (highlightColor || C.gold) : C.gray;
  const strokeW = isHighlighted ? 3 : 1.5;
  const pulse = isHighlighted ? 0.7 + 0.3 * Math.sin(frame * 0.08) : 0.3;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  // Offset weight label perpendicular to edge
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len * 14;
  const ny = dx / len * 14;

  return (
    <g opacity={opacity}>
      {/* Edge line */}
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={strokeW} strokeLinecap="round"
        opacity={pulse}
      />
      {/* Highlighted glow */}
      {isHighlighted && (
        <line x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color} strokeWidth={8} strokeLinecap="round"
          opacity={0.1 + 0.05 * Math.sin(frame * 0.08)}
        />
      )}
      {/* Weight label */}
      {showWeight && (
        <g>
          <rect x={midX + nx - 10} y={midY + ny - 8} width={20} height={16} rx={3}
            fill={C.dark} stroke={`${C.gray}44`} strokeWidth={1}
          />
          <text x={midX + nx} y={midY + ny + 1} fill={isHighlighted ? color : C.gray}
            fontSize={10} fontWeight={600} fontFamily="Inter, sans-serif"
            textAnchor="middle" dominantBaseline="middle">
            {edge.weight}
          </text>
        </g>
      )}
    </g>
  );
};

// =====================================================================
// BFS VARIANT
// =====================================================================
const BfsVariant: React.FC<Omit<GraphVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  // Reveal graph
  const graphRevealP = progressWindow(p, 0, 0.15);
  const nodeSprings = NODES.map((_, i) =>
    spring({
      frame: Math.max(0, frame - i * 3), fps,
      config: { damping: 14, stiffness: 120, mass: 0.7 },
      from: 0, to: graphRevealP > 0 ? 1 : 0,
    })
  );

  const edgeRevealP = progressWindow(p, 0.05, 0.15);

  // BFS animation: visit nodes in level order
  const bfsP = progressWindow(p, 0.18, 0.90);
  const visitedCount = Math.floor(bfsP * BFS_ORDER.length);
  const visitedSet = new Set(BFS_ORDER.slice(0, visitedCount));
  const currentNodeId = visitedCount > 0 && visitedCount <= BFS_ORDER.length
    ? BFS_ORDER[Math.min(visitedCount - 1, BFS_ORDER.length - 1)] : -1;

  // Current BFS level
  let currentLevel = -1;
  let cumCount = 0;
  for (let lv = 0; lv < BFS_LEVELS.length; lv++) {
    cumCount += BFS_LEVELS[lv].length;
    if (visitedCount <= cumCount) { currentLevel = lv; break; }
  }
  if (currentLevel === -1) currentLevel = BFS_LEVELS.length - 1;

  // Edges that connect visited nodes
  const highlightedEdges = new Set<number>();
  EDGES.forEach((e, i) => {
    if (visitedSet.has(e.from) && visitedSet.has(e.to)) highlightedEdges.add(i);
  });

  // Level indicator colors
  const levelColors = [C.teal, C.gold, C.saffron, C.indigo];

  function getNodeState(id: number): 'unvisited' | 'current' | 'visited' {
    if (id === currentNodeId) return 'current';
    if (visitedSet.has(id)) return 'visited';
    return 'unvisited';
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">

        {/* Edges */}
        {EDGES.map((edge, i) => (
          <GraphEdgeLine key={`edge-${i}`} edge={edge} nodes={NODES}
            svgW={svgW} svgH={svgH}
            opacity={edgeRevealP}
            isHighlighted={highlightedEdges.has(i)}
            highlightColor={C.teal}
            showWeight={false}
            frame={frame}
          />
        ))}

        {/* BFS wave rings - show current level expanding */}
        {bfsP > 0 && BFS_LEVELS.slice(0, currentLevel + 1).map((level, lv) => {
          // Draw a faint ring around nodes in this level
          const levelActive = lv <= currentLevel;
          return level.map((nodeId) => {
            const n = NODES[nodeId];
            const cx = n.fx * svgW;
            const cy = n.fy * svgH;
            const ringSize = lv === currentLevel
              ? 30 + 5 * Math.sin(frame * 0.12)
              : 28;
            return (
              <circle key={`wave-${lv}-${nodeId}`}
                cx={cx} cy={cy} r={ringSize}
                fill="none" stroke={levelColors[lv % levelColors.length]}
                strokeWidth={1.5} opacity={levelActive ? 0.2 : 0}
                strokeDasharray="4 3"
              />
            );
          });
        })}

        {/* Nodes */}
        {NODES.map((node) => (
          <GraphNodeCircle key={`node-${node.id}`}
            node={node} state={getNodeState(node.id)}
            springVal={nodeSprings[node.id]} frame={frame}
            svgW={svgW} svgH={svgH}
          />
        ))}
      </svg>

      {/* BFS Queue visualization */}
      {bfsP > 0 && (
        <div style={{
          position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)',
          background: `${C.dark}DD`, border: `1.5px solid ${C.indigo}44`, borderRadius: 10,
          padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, color: C.gray, letterSpacing: 1 }}>BFS QUEUE</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {BFS_ORDER.slice(visitedCount).slice(0, 5).map((nodeId, i) => (
              <div key={`bq-${i}`} style={{
                width: 28, height: 28, borderRadius: 6,
                background: `${C.indigo}22`, border: `1.5px solid ${C.indigo}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: C.indigo,
              }}>
                {NODES[nodeId].label}
              </div>
            ))}
            {BFS_ORDER.length - visitedCount > 5 && (
              <span style={{ fontSize: 12, color: C.gray, alignSelf: 'center' }}>...</span>
            )}
          </div>
          <span style={{ fontSize: 10, color: C.teal }}>
            Level {currentLevel} | Visited: {visitedCount}/{NODES.length}
          </span>
        </div>
      )}

      {/* Title */}
      <div style={{
        position: 'absolute', top: '3%', left: '50%', transform: 'translateX(-50%)',
        opacity: graphRevealP,
      }}>
        <span style={{ fontSize: 13, color: C.teal, letterSpacing: 2, fontWeight: 700 }}>
          BREADTH-FIRST SEARCH
        </span>
      </div>
    </div>
  );
};

// =====================================================================
// DFS VARIANT
// =====================================================================
const DfsVariant: React.FC<Omit<GraphVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  const graphRevealP = progressWindow(p, 0, 0.15);
  const nodeSprings = NODES.map((_, i) =>
    spring({
      frame: Math.max(0, frame - i * 3), fps,
      config: { damping: 14, stiffness: 120, mass: 0.7 },
      from: 0, to: graphRevealP > 0 ? 1 : 0,
    })
  );

  const edgeRevealP = progressWindow(p, 0.05, 0.15);

  // DFS animation
  const dfsP = progressWindow(p, 0.18, 0.90);
  const visitedCount = Math.floor(dfsP * DFS_ORDER.length);
  const visitedSet = new Set(DFS_ORDER.slice(0, visitedCount));
  const currentNodeId = visitedCount > 0 && visitedCount <= DFS_ORDER.length
    ? DFS_ORDER[Math.min(visitedCount - 1, DFS_ORDER.length - 1)] : -1;

  // Path edges: consecutive DFS nodes that share an edge
  const pathEdges = new Set<number>();
  for (let i = 0; i < visitedCount - 1; i++) {
    const from = DFS_ORDER[i];
    const to = DFS_ORDER[i + 1];
    EDGES.forEach((e, idx) => {
      if ((e.from === from && e.to === to) || (e.from === to && e.to === from)) {
        pathEdges.add(idx);
      }
    });
  }

  function getNodeState(id: number): 'unvisited' | 'current' | 'visited' {
    if (id === currentNodeId) return 'current';
    if (visitedSet.has(id)) return 'visited';
    return 'unvisited';
  }

  // Stack visualization
  const stack: number[] = [];
  // Simulate DFS stack based on current progress
  if (visitedCount > 0) {
    // The stack holds the path from root to current
    let pathFromRoot: number[] = [];
    for (let i = 0; i < visitedCount; i++) {
      const node = DFS_ORDER[i];
      // Simple: just show last few visited as "stack"
      pathFromRoot.push(node);
    }
    // Keep last 4 for display
    stack.push(...pathFromRoot.slice(-4));
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">

        {/* Edges */}
        {EDGES.map((edge, i) => (
          <GraphEdgeLine key={`edge-${i}`} edge={edge} nodes={NODES}
            svgW={svgW} svgH={svgH}
            opacity={edgeRevealP}
            isHighlighted={pathEdges.has(i)}
            highlightColor={C.saffron}
            showWeight={false}
            frame={frame}
          />
        ))}

        {/* DFS path trail - animated dashes along path edges */}
        {Array.from(pathEdges).map((edgeIdx) => {
          const e = EDGES[edgeIdx];
          const from = NODES[e.from];
          const to = NODES[e.to];
          const x1 = from.fx * svgW;
          const y1 = from.fy * svgH;
          const x2 = to.fx * svgW;
          const y2 = to.fy * svgH;
          return (
            <line key={`trail-${edgeIdx}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={C.saffron} strokeWidth={5}
              opacity={0.15} strokeLinecap="round"
            />
          );
        })}

        {/* Nodes */}
        {NODES.map((node) => (
          <GraphNodeCircle key={`node-${node.id}`}
            node={node} state={getNodeState(node.id)}
            springVal={nodeSprings[node.id]} frame={frame}
            svgW={svgW} svgH={svgH}
          />
        ))}
      </svg>

      {/* DFS Stack visualization */}
      {dfsP > 0 && (
        <div style={{
          position: 'absolute', right: '5%', top: '50%', transform: 'translateY(-50%)',
          background: `${C.dark}DD`, border: `1.5px solid ${C.saffron}44`, borderRadius: 10,
          padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, color: C.gray, letterSpacing: 1 }}>CALL STACK</span>
          {stack.map((nodeId, i) => (
            <div key={`st-${i}`} style={{
              width: 36, height: 30, borderRadius: 6,
              background: i === stack.length - 1 ? `${C.saffron}33` : `${C.saffron}15`,
              border: `1.5px solid ${i === stack.length - 1 ? C.saffron : `${C.saffron}66`}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              color: i === stack.length - 1 ? C.saffron : `${C.saffron}AA`,
            }}>
              {NODES[nodeId].label}
            </div>
          )).reverse()}
          <span style={{ fontSize: 9, color: C.gray }}>Depth: {stack.length}</span>
        </div>
      )}

      {/* Title */}
      <div style={{
        position: 'absolute', top: '3%', left: '50%', transform: 'translateX(-50%)',
        opacity: graphRevealP,
      }}>
        <span style={{ fontSize: 13, color: C.saffron, letterSpacing: 2, fontWeight: 700 }}>
          DEPTH-FIRST SEARCH
        </span>
      </div>

      {/* Visit order */}
      {dfsP > 0 && (
        <div style={{
          position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)',
          background: `${C.dark}CC`, border: `1.5px solid ${C.gray}33`, borderRadius: 8,
          padding: '6px 16px', display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, color: C.gray }}>Order:</span>
          {DFS_ORDER.slice(0, visitedCount).map((nodeId, i) => (
            <span key={`ord-${i}`} style={{
              fontSize: 12, fontWeight: 700,
              color: i === visitedCount - 1 ? C.saffron : C.teal,
            }}>
              {NODES[nodeId].label}{i < visitedCount - 1 ? ' ->' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// DIJKSTRA VARIANT
// =====================================================================
const DijkstraVariant: React.FC<Omit<GraphVizProps, 'variant'>> = ({ sync, frame }) => {
  const { fps, width, height } = useVideoConfig();
  const p = useReliableProgress(frame, fps, sync);
  const svgW = width;
  const svgH = height;

  const graphRevealP = progressWindow(p, 0, 0.15);
  const nodeSprings = NODES.map((_, i) =>
    spring({
      frame: Math.max(0, frame - i * 3), fps,
      config: { damping: 14, stiffness: 120, mass: 0.7 },
      from: 0, to: graphRevealP > 0 ? 1 : 0,
    })
  );

  const edgeRevealP = progressWindow(p, 0.05, 0.15);

  // Dijkstra exploration phase
  const exploreP = progressWindow(p, 0.18, 0.65);
  // Then highlight shortest path
  const pathP = progressWindow(p, 0.70, 0.90);

  // Nodes explored in distance order
  const distOrder = Object.entries(DIJKSTRA_DISTANCES)
    .sort(([, a], [, b]) => a - b)
    .map(([id]) => parseInt(id));

  const exploredCount = Math.floor(exploreP * distOrder.length);
  const exploredSet = new Set(distOrder.slice(0, exploredCount));
  const currentExploreId = exploredCount > 0 ? distOrder[Math.min(exploredCount - 1, distOrder.length - 1)] : -1;

  // Shortest path highlight
  const pathSet = new Set(pathP > 0 ? DIJKSTRA_ORDER : []);
  const pathEdgeSet = new Set<number>();
  if (pathP > 0) {
    for (let i = 0; i < DIJKSTRA_ORDER.length - 1; i++) {
      const from = DIJKSTRA_ORDER[i];
      const to = DIJKSTRA_ORDER[i + 1];
      EDGES.forEach((e, idx) => {
        if ((e.from === from && e.to === to) || (e.from === to && e.to === from)) {
          pathEdgeSet.add(idx);
        }
      });
    }
  }

  // All explored edges
  const exploredEdges = new Set<number>();
  EDGES.forEach((e, i) => {
    if (exploredSet.has(e.from) && exploredSet.has(e.to)) exploredEdges.add(i);
  });

  function getNodeState(id: number): 'unvisited' | 'current' | 'visited' | 'path' {
    if (pathSet.has(id) && pathP > 0.3) return 'path';
    if (id === currentExploreId && exploreP < 1) return 'current';
    if (exploredSet.has(id)) return 'visited';
    return 'unvisited';
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent', fontFamily: 'Inter, sans-serif' }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">

        {/* Edges */}
        {EDGES.map((edge, i) => (
          <GraphEdgeLine key={`edge-${i}`} edge={edge} nodes={NODES}
            svgW={svgW} svgH={svgH}
            opacity={edgeRevealP}
            isHighlighted={pathEdgeSet.has(i) ? true : exploredEdges.has(i)}
            highlightColor={pathEdgeSet.has(i) ? C.gold : C.teal}
            showWeight={true}
            frame={frame}
          />
        ))}

        {/* Shortest path glow */}
        {pathP > 0 && DIJKSTRA_ORDER.slice(0, -1).map((nodeId, i) => {
          const from = NODES[nodeId];
          const to = NODES[DIJKSTRA_ORDER[i + 1]];
          return (
            <line key={`sp-${i}`}
              x1={from.fx * svgW} y1={from.fy * svgH}
              x2={to.fx * svgW} y2={to.fy * svgH}
              stroke={C.gold} strokeWidth={6}
              opacity={0.2 + 0.1 * Math.sin(frame * 0.08 + i)}
              strokeLinecap="round"
            />
          );
        })}

        {/* Nodes */}
        {NODES.map((node) => (
          <GraphNodeCircle key={`node-${node.id}`}
            node={node} state={getNodeState(node.id)}
            springVal={nodeSprings[node.id]} frame={frame}
            svgW={svgW} svgH={svgH}
            distLabel={exploredSet.has(node.id) ? `${DIJKSTRA_DISTANCES[node.id]}` : undefined}
          />
        ))}

        {/* Animated dot along shortest path */}
        {pathP > 0.3 && (() => {
          const dotCycle = fps * 3;
          const dotT = (frame % dotCycle) / dotCycle;
          // Traverse path segments
          const segCount = DIJKSTRA_ORDER.length - 1;
          const segIdx = Math.min(Math.floor(dotT * segCount), segCount - 1);
          const segT = (dotT * segCount) - segIdx;
          const from = NODES[DIJKSTRA_ORDER[segIdx]];
          const to = NODES[DIJKSTRA_ORDER[segIdx + 1]];
          const cx = from.fx * svgW + (to.fx * svgW - from.fx * svgW) * segT;
          const cy = from.fy * svgH + (to.fy * svgH - from.fy * svgH) * segT;
          return (
            <circle cx={cx} cy={cy} r={7} fill={C.gold}
              opacity={0.9} style={{ filter: `drop-shadow(0 0 8px ${C.gold})` }}
            />
          );
        })()}
      </svg>

      {/* Title */}
      <div style={{
        position: 'absolute', top: '3%', left: '50%', transform: 'translateX(-50%)',
        opacity: graphRevealP,
      }}>
        <span style={{ fontSize: 13, color: C.gold, letterSpacing: 2, fontWeight: 700 }}>
          DIJKSTRA'S SHORTEST PATH
        </span>
      </div>

      {/* Distance table */}
      {exploreP > 0 && (
        <div style={{
          position: 'absolute', bottom: '5%', left: '50%', transform: 'translateX(-50%)',
          background: `${C.dark}DD`, border: `1.5px solid ${C.gold}44`, borderRadius: 10,
          padding: '8px 16px', display: 'flex', gap: 12, alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, color: C.gray }}>Distance from A:</span>
          {distOrder.slice(0, exploredCount).map((nodeId) => (
            <div key={`dist-${nodeId}`} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: pathSet.has(nodeId) ? C.gold : C.teal,
              }}>
                {NODES[nodeId].label}
              </span>
              <span style={{ fontSize: 10, color: C.gray }}>
                {DIJKSTRA_DISTANCES[nodeId]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Shortest path result */}
      {pathP > 0.5 && (
        <div style={{
          position: 'absolute', top: '8%', right: '5%',
          background: `${C.gold}18`, border: `2px solid ${C.gold}`, borderRadius: 10,
          padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 4,
          opacity: interpolate(pathP, [0.5, 0.8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <span style={{ fontSize: 10, color: C.gray }}>SHORTEST PATH</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>
            {DIJKSTRA_ORDER.map((id) => NODES[id].label).join(' -> ')}
          </span>
          <span style={{ fontSize: 12, color: C.teal }}>
            Total Cost: {DIJKSTRA_DISTANCES[7]}
          </span>
        </div>
      )}
    </div>
  );
};

// =====================================================================
// MAIN EXPORT
// =====================================================================
export const GraphViz: React.FC<GraphVizProps> = (props) => {
  if (props.variant === 'dfs') return <DfsVariant {...props} />;
  if (props.variant === 'dijkstra') return <DijkstraVariant {...props} />;
  return <BfsVariant {...props} />;
};
