import React from 'react';
import { useCurrentFrame } from 'remotion';
import { useSync } from '../hooks/useSync';
import { KeywordCloud } from './viz/KeywordCloud';
import { HashTableViz } from './viz/HashTableViz';
import { TrafficFlow } from './viz/TrafficFlow';
import { SystemArchViz } from './viz/SystemArchViz';
import { MetricDashboard } from './viz/MetricDashboard';
import { TreeViz } from './viz/TreeViz';
import { SortingViz } from './viz/SortingViz';
import type { SyncState } from '../types';

const TOPIC_VIZ_MAP: Record<string, React.FC<{ sync: SyncState; frame: number; keywords: string[] }>> = {
  'hash-map': HashTableViz,
  'hash-table': HashTableViz,
  'caching': HashTableViz,
  'load-balanc': TrafficFlow,
  'cdn': TrafficFlow,
  'api-gateway': TrafficFlow,
  'system-design': SystemArchViz,
  'microservice': SystemArchViz,
  'binary-tree': TreeViz,
  'bst': TreeViz,
  'heap': TreeViz,
  'sort': SortingViz,
  'merge-sort': SortingViz,
  'quick-sort': SortingViz,
};

function getVisualization(topic: string) {
  const normalizedTopic = topic.toLowerCase().replace(/[^a-z0-9]/g, '-');

  for (const [key, component] of Object.entries(TOPIC_VIZ_MAP)) {
    if (normalizedTopic.includes(key)) return component;
  }

  return KeywordCloud;
}

interface ConceptVizProps {
  topic: string;
  sceneIndex: number;
  sceneStartFrame: number;
  keywords?: string[];
}

export const ConceptViz: React.FC<ConceptVizProps> = ({
  topic,
  sceneIndex,
  sceneStartFrame,
  keywords = [],
}) => {
  const frame = useCurrentFrame();
  const sync = useSync(sceneIndex, sceneStartFrame);
  const Viz = getVisualization(topic);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Viz sync={sync} frame={frame} keywords={keywords} />
    </div>
  );
};
