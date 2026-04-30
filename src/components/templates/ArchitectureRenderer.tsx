import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { AnimatedBox } from '../viz/AnimatedBox';
import { AnimatedArrow } from '../viz/AnimatedArrow';
import { DataFlowParticles } from '../viz/DataFlowParticles';
import { COLORS } from '../../lib/theme';
import type { VisualBeat } from '../../types';

export interface ArchNode {
  id: string;
  label: string;
  x: number;        // percentage 0-100
  y: number;        // percentage 0-100
  iconSlug?: string | null; // Simple Icons slug
  color?: string;
  width?: number;
  height?: number;
  beatIndex: number; // which beat reveals this node
}

export interface ArchEdge {
  from: string;      // node id
  to: string;        // node id
  label?: string;
  color?: string;
  curved?: boolean;
  dashed?: boolean;
  beatIndex: number; // which beat reveals this edge
}

export interface ArchFlow {
  path: string[];    // node ids defining the flow path
  color: string;
  beatIndex: number; // when particles start flowing
}

export interface ArchitectureConfig {
  nodes: ArchNode[];
  edges: ArchEdge[];
  flows?: ArchFlow[];
  title?: string;
}

interface ArchitectureRendererProps {
  config: ArchitectureConfig;
  beats: VisualBeat[];
  accentColor: string;
  fps: number;
}

export const ArchitectureRenderer: React.FC<ArchitectureRendererProps> = ({
  config,
  beats,
  accentColor,
  fps,
}) => {
  const frame = useCurrentFrame();
  const { width: videoWidth, height: videoHeight } = useVideoConfig();

  // Find active beat index
  const elapsedSec = frame / fps;
  let activeBeatIdx = -1;
  for (let i = beats.length - 1; i >= 0; i--) {
    if (elapsedSec >= beats[i].startTime) {
      activeBeatIdx = i;
      break;
    }
  }

  // Convert percentage positions to pixels
  const toX = (pct: number) => (pct / 100) * videoWidth;
  const toY = (pct: number) => (pct / 100) * videoHeight;

  // Node lookup for edges
  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));

  // Calculate entry frames from beats
  const beatToFrame = (beatIdx: number) => {
    if (beatIdx < 0 || beatIdx >= beats.length) return 0;
    return Math.round(beats[beatIdx].startTime * fps);
  };

  return (
    <AbsoluteFill style={{ padding: '60px 40px' }}>
      {/* Edges (arrows) -- rendered first so they appear behind nodes */}
      {config.edges.map((edge, i) => {
        if (edge.beatIndex > activeBeatIdx) return null;
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode) return null;

        return (
          <AnimatedArrow
            key={`edge-${i}`}
            from={{ x: toX(fromNode.x), y: toY(fromNode.y) }}
            to={{ x: toX(toNode.x), y: toY(toNode.y) }}
            color={edge.color || COLORS.gray}
            startFrame={beatToFrame(edge.beatIndex)}
            label={edge.label}
            curved={edge.curved}
            dashed={edge.dashed}
          />
        );
      })}

      {/* Data flow particles -- only after their beat */}
      {config.flows?.map((flow, i) => {
        if (flow.beatIndex > activeBeatIdx) return null;
        const segments: React.ReactNode[] = [];
        for (let j = 0; j < flow.path.length - 1; j++) {
          const fromNode = nodeMap.get(flow.path[j]);
          const toNode = nodeMap.get(flow.path[j + 1]);
          if (!fromNode || !toNode) continue;
          segments.push(
            <DataFlowParticles
              key={`flow-${i}-seg-${j}`}
              fromX={toX(fromNode.x)}
              fromY={toY(fromNode.y)}
              toX={toX(toNode.x)}
              toY={toY(toNode.y)}
              color={flow.color}
              particleCount={3}
              speed={2}
              active={true}
            />,
          );
        }
        return <React.Fragment key={`flow-${i}`}>{segments}</React.Fragment>;
      })}

      {/* Nodes (boxes) -- rendered last so they sit on top */}
      {config.nodes.map((node) => (
        <AnimatedBox
          key={`node-${node.id}`}
          label={node.label}
          iconSlug={node.iconSlug}
          x={toX(node.x)}
          y={toY(node.y)}
          width={node.width || 160}
          height={node.height || 70}
          color={node.color || accentColor}
          isActive={node.beatIndex === activeBeatIdx}
          entryFrame={beatToFrame(node.beatIndex)}
        />
      ))}
    </AbsoluteFill>
  );
};
