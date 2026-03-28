import React from 'react';
import { useCurrentFrame } from 'remotion';
import { useSync } from '../hooks/useSync';
import { KeywordCloud } from './viz/KeywordCloud';
import { PromoPanel } from './viz/PromoPanel';
import { HashTableViz } from './viz/HashTableViz';
import { TrafficFlow } from './viz/TrafficFlow';
import { SystemArchViz } from './viz/SystemArchViz';
import { MetricDashboard } from './viz/MetricDashboard';
import { TreeViz } from './viz/TreeViz';
import { SortingViz } from './viz/SortingViz';
import { DatabaseViz } from './viz/DatabaseViz';
import { CacheViz } from './viz/CacheViz';
import { QueueViz } from './viz/QueueViz';
import { GraphViz } from './viz/GraphViz';
import type { SyncState } from '../types';

export type VizProps = { sync: SyncState; frame: number; keywords: string[]; variant?: string };

const TOPIC_VIZ_MAP: Record<string, React.FC<VizProps>> = {
  'hash-map': HashTableViz,
  'hash-table': HashTableViz,
  'hashmap': HashTableViz,
  'hashtable': HashTableViz,
  'caching': CacheViz,
  'cache': CacheViz,
  'redis': CacheViz,
  'memcached': CacheViz,
  'database': DatabaseViz,
  'replication': DatabaseViz,
  'sharding': DatabaseViz,
  'postgres': DatabaseViz,
  'mysql': DatabaseViz,
  'mongodb': DatabaseViz,
  'queue': QueueViz,
  'kafka': QueueViz,
  'rabbitmq': QueueViz,
  'message': QueueViz,
  'pub-sub': QueueViz,
  'pubsub': QueueViz,
  'event-driven': QueueViz,
  'eventdriven': QueueViz,
  'graph': GraphViz,
  'bfs': GraphViz,
  'dfs': GraphViz,
  'dijkstra': GraphViz,
  'shortest-path': GraphViz,
  'shortestpath': GraphViz,
  'breadth-first': GraphViz,
  'breadthfirst': GraphViz,
  'depth-first': GraphViz,
  'depthfirst': GraphViz,
  'load-balanc': TrafficFlow,
  'loadbalanc': TrafficFlow,
  'traffic': TrafficFlow,
  'cdn': CacheViz,
  'api-gateway': TrafficFlow,
  'apigateway': TrafficFlow,
  'reverse-proxy': TrafficFlow,
  'reverseproxy': TrafficFlow,
  'system-design': SystemArchViz,
  'systemdesign': SystemArchViz,
  'microservice': SystemArchViz,
  'distributed': SystemArchViz,
  'architecture': SystemArchViz,
  'binary-tree': TreeViz,
  'binarytree': TreeViz,
  'bst': TreeViz,
  'heap': TreeViz,
  'trie': TreeViz,
  'sort': SortingViz,
  'merge-sort': SortingViz,
  'mergesort': SortingViz,
  'quick-sort': SortingViz,
  'quicksort': SortingViz,
  'bubble-sort': SortingViz,
  'bubblesort': SortingViz,
};

function getVisualization(topic: string) {
  // Normalize: lowercase, strip all non-alphanumeric to handle any separator
  const normalizedTopic = topic.toLowerCase().replace(/[^a-z0-9]/g, '-');
  // Also create a version without dashes for compound-word matching
  const compactTopic = topic.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const [key, component] of Object.entries(TOPIC_VIZ_MAP)) {
    if (normalizedTopic.includes(key) || compactTopic.includes(key)) return component;
  }

  // Fallback: KeywordCloud for topics with keywords, PromoPanel otherwise.
  // KeywordCloud is more visually interesting than an empty panel.
  return KeywordCloud;
}

interface ConceptVizProps {
  topic: string;
  sceneIndex: number;
  sceneStartFrame: number;
  keywords?: string[];
  sceneDuration?: number;
  vizVariant?: string;
}

export const ConceptViz: React.FC<ConceptVizProps> = ({
  topic,
  sceneIndex,
  sceneStartFrame,
  keywords = [],
  sceneDuration = 300, // fallback 10s at 30fps
  vizVariant,
}) => {
  const frame = useCurrentFrame();
  const rawSync = useSync(sceneIndex, sceneStartFrame);
  const TopicViz = getVisualization(topic);

  // Always use the matched topic viz. PromoPanel is only a fallback (via getVisualization)
  // when no topic-specific visualization exists — never alternate with promo on known topics.
  const Viz = TopicViz;

  // BUG FIX: Inside TransitionSeries.Sequence, useCurrentFrame() returns SCENE-RELATIVE
  // frames (0 to sceneDuration), but sceneStartFrame is ABSOLUTE. This means useSync
  // computes relativeFrame = (small scene frame) - (large absolute frame) = negative,
  // clamped to 0. So getSyncState always receives frame 0 → sceneProgress stuck at 0.
  //
  // SOLUTION: Always use time-based progress derived from the scene-relative frame.
  // This gives smooth 0→1 progress that drives all viz animations correctly.
  const effectiveDuration = Math.max(1, sceneDuration);
  const timeBasedProgress = Math.min(1, frame / effectiveDuration);

  // Use sync data if it's producing meaningful progress, otherwise use time-based fallback.
  const hasSyncData = rawSync.sceneProgress > 0.001 || rawSync.wordsSpoken > 0;
  const sync: SyncState = hasSyncData
    ? rawSync
    : {
        ...rawSync,
        sceneProgress: timeBasedProgress,
        isNarrating: frame > 0,
      };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      // Ensure the viz container is always visible — prevent zero-height collapse
      minHeight: '100%',
    }}>
      <Viz sync={sync} frame={frame} keywords={keywords} variant={vizVariant} />
    </div>
  );
};
