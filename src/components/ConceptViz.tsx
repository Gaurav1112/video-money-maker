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

// ---------------------------------------------------------------------------
// SLUG-BASED ROUTING: exact topic slug → visualization component
// This is the PRIMARY routing mechanism. The slug comes from the storyboard
// topic field (e.g., "load-balancing", "hash-tables", "design-url-shortener").
// ---------------------------------------------------------------------------
const SLUG_VIZ_MAP: Record<string, React.FC<VizProps>> = {
  // ── Traffic/Network (TrafficFlow) ──
  'load-balancing': TrafficFlow,
  'api-gateway': TrafficFlow,
  'cdn': TrafficFlow,
  'networking': TrafficFlow,
  'rate-limiting': TrafficFlow,
  'proxy': TrafficFlow,
  'reverse-proxy': TrafficFlow,
  'nginx': TrafficFlow,
  'haproxy': TrafficFlow,
  'dns': TrafficFlow,
  'http': TrafficFlow,
  'rest-api': TrafficFlow,
  'grpc': TrafficFlow,
  'websockets': TrafficFlow,
  'tcp-udp': TrafficFlow,

  // ── Database (DatabaseViz) ──
  'database-design': DatabaseViz,
  'database-scaling': DatabaseViz,
  'rdbms-sql': DatabaseViz,
  'nosql': DatabaseViz,
  'distributed-key-value': DatabaseViz,
  'sql': DatabaseViz,
  'postgres': DatabaseViz,
  'mysql': DatabaseViz,
  'mongodb': DatabaseViz,
  'cassandra': DatabaseViz,
  'dynamodb': DatabaseViz,
  'database-replication': DatabaseViz,
  'database-sharding': DatabaseViz,
  'database-indexing': DatabaseViz,
  'acid-transactions': DatabaseViz,
  'cap-theorem': DatabaseViz,

  // ── Cache (CacheViz) ──
  'caching': CacheViz,
  'redis': CacheViz,
  'memcached': CacheViz,
  'content-delivery': CacheViz,
  'cache-strategies': CacheViz,

  // ── Queue/Messaging (QueueViz) ──
  'message-queues': QueueViz,
  'kafka': QueueViz,
  'rabbitmq': QueueViz,
  'notification-system': QueueViz,
  'task-scheduler': QueueViz,
  'pub-sub': QueueViz,
  'event-driven': QueueViz,
  'sqs': QueueViz,
  'sns': QueueViz,
  'async-processing': QueueViz,

  // ── Graph (GraphViz) ──
  'graphs': GraphViz,
  'distributed-systems': GraphViz,
  'consensus': GraphViz,
  'raft': GraphViz,
  'paxos': GraphViz,
  'network-flow': GraphViz,

  // ── Tree (TreeViz) ──
  'trees-bst': TreeViz,
  'trie': TreeViz,
  'binary-tree': TreeViz,
  'avl-tree': TreeViz,
  'red-black-tree': TreeViz,
  'segment-tree': TreeViz,
  'heap': TreeViz,
  'priority-queue': TreeViz,

  // ── Hash Table (HashTableViz) ──
  'hash-tables': HashTableViz,
  'hash-map': HashTableViz,
  'hashing': HashTableViz,
  'consistent-hashing': HashTableViz,

  // ── Sorting/Arrays (SortingViz) ──
  'sorting-searching': SortingViz,
  'arrays-strings': SortingViz,
  'two-pointer': SortingViz,
  'sliding-window': SortingViz,
  'binary-search': SortingViz,
  'merge-sort': SortingViz,
  'quick-sort': SortingViz,

  // ── System Architecture (SystemArchViz) ──
  'microservices': SystemArchViz,
  'scalability': SystemArchViz,
  'scalability-patterns': SystemArchViz,
  'monitoring': SystemArchViz,
  'observability': SystemArchViz,
  'authentication': SystemArchViz,
  'authorization': SystemArchViz,
  'oauth': SystemArchViz,
  'security': SystemArchViz,
  'ci-cd': SystemArchViz,
  'devops': SystemArchViz,
  // System design case studies
  'design-url-shortener': SystemArchViz,
  'design-twitter': SystemArchViz,
  'design-instagram': SystemArchViz,
  'design-whatsapp': SystemArchViz,
  'design-youtube': SystemArchViz,
  'design-uber': SystemArchViz,
  'design-netflix': SystemArchViz,
  'design-dropbox': SystemArchViz,
  'design-google-drive': SystemArchViz,
  'design-web-crawler': SystemArchViz,
  'design-news-feed': SystemArchViz,
  'design-search-autocomplete': SystemArchViz,
  'design-chat-system': SystemArchViz,
  'design-e-commerce': SystemArchViz,
  'design-payment-system': SystemArchViz,
  'design-notification-system': SystemArchViz,
  'design-rate-limiter': SystemArchViz,
  'design-file-storage': SystemArchViz,
  'design-social-media': SystemArchViz,
  'design-video-streaming': SystemArchViz,
  'design-ride-sharing': SystemArchViz,
  'system-design-basics': SystemArchViz,
  'system-design-interview': SystemArchViz,

  // ── Metric Dashboard (MetricDashboard) ──
  // (monitoring/observability also in SystemArchViz above — MetricDashboard
  //  is selected via keyword fallback if needed; slug takes priority)

  // ── Keyword Cloud (KeywordCloud) — code-heavy / conceptual topics ──
  'design-patterns': KeywordCloud,
  'dsa-patterns': KeywordCloud,
  'interview-framework': KeywordCloud,
  'estimation': KeywordCloud,
  'java-core': KeywordCloud,
  'javascript': KeywordCloud,
  'typescript': KeywordCloud,
  'spring-boot': KeywordCloud,
  'react-nextjs': KeywordCloud,
  'react': KeywordCloud,
  'nextjs': KeywordCloud,
  'nodejs': KeywordCloud,
  'node-js': KeywordCloud,
  'html-css': KeywordCloud,
  'k8s-docker': KeywordCloud,
  'kubernetes': KeywordCloud,
  'docker': KeywordCloud,
  'aws': KeywordCloud,
  'gcp': KeywordCloud,
  'azure': KeywordCloud,
  'linked-list': KeywordCloud,
  'stack': KeywordCloud,
  'stacks-queues': KeywordCloud,
  'recursion': KeywordCloud,
  'backtracking': KeywordCloud,
  'dynamic-programming': KeywordCloud,
  'bit-manipulation': KeywordCloud,
  'union-find': KeywordCloud,
  'greedy': KeywordCloud,
  'math': KeywordCloud,
  'oop': KeywordCloud,
  'solid-principles': KeywordCloud,
  'multithreading': KeywordCloud,
  'concurrency': KeywordCloud,
  'testing': KeywordCloud,
  'git': KeywordCloud,
  'behavioral-interview': KeywordCloud,
};

// ---------------------------------------------------------------------------
// KEYWORD FALLBACK: partial matches for topics not in the slug map.
// Ordered from most specific to least specific to avoid false positives.
// These use `includes()` on the normalized slug.
// ---------------------------------------------------------------------------
const KEYWORD_VIZ_RULES: Array<{ keywords: string[]; component: React.FC<VizProps> }> = [
  // Hash table (before 'cache' to catch 'hash' first)
  { keywords: ['hash-table', 'hash-map', 'hashmap', 'hashing', 'collision'], component: HashTableViz },

  // Tree (before generic terms)
  { keywords: ['tree', 'bst', 'heap', 'trie', 'prefix-tree', 'avl', 'red-black', 'segment-tree'], component: TreeViz },

  // Sorting / Arrays
  { keywords: ['sort', 'merge-sort', 'quick-sort', 'binary-search', 'two-pointer', 'sliding-window', 'array', 'string'], component: SortingViz },

  // Traffic / Network
  { keywords: ['load-balanc', 'api-gateway', 'gateway', 'rate-limit', 'throttl', 'network', 'proxy', 'nginx', 'haproxy', 'dns', 'http', 'grpc', 'websocket', 'tcp', 'udp'], component: TrafficFlow },

  // Database
  { keywords: ['database', 'rdbms', 'sql', 'nosql', 'mongo', 'postgres', 'mysql', 'dynamo', 'cassandra', 'replicat', 'sharding', 'storage', 'acid', 'cap-theorem'], component: DatabaseViz },

  // Cache
  { keywords: ['cache', 'caching', 'redis', 'memcache', 'cdn', 'content-delivery'], component: CacheViz },

  // Queue / Messaging
  { keywords: ['queue', 'kafka', 'rabbitmq', 'message', 'pub-sub', 'event-driven', 'notification', 'scheduler', 'task-scheduler', 'sqs', 'sns'], component: QueueViz },

  // Graph
  { keywords: ['graph', 'bfs', 'dfs', 'dijkstra', 'shortest-path', 'distributed-system', 'consensus', 'raft', 'paxos'], component: GraphViz },

  // Metric Dashboard
  { keywords: ['monitoring', 'observ', 'metric', 'dashboard', 'alerting', 'logging', 'tracing'], component: MetricDashboard },

  // System Architecture (broadest — catch-all for design topics)
  { keywords: ['microservice', 'architecture', 'design-', 'system-design', 'scalab', 'auth', 'payment', 'e-commerce', 'social-media', 'chat', 'video-stream', 'ride-shar', 'file-storage', 'web-crawler', 'news-feed', 'url-shortener', 'search-auto', 'ci-cd', 'devops', 'security'], component: SystemArchViz },

  // Keyword Cloud (programming languages/frameworks — broadest fallback)
  { keywords: ['java', 'javascript', 'typescript', 'react', 'next', 'spring', 'node', 'html', 'css', 'aws', 'kubernetes', 'docker', 'k8s', 'design-pattern', 'dsa-pattern', 'interview', 'estimation', 'linked-list', 'stack', 'recursion', 'backtrack', 'dynamic-programming', 'bit-manipul', 'union-find', 'greedy', 'oop', 'solid', 'concurren', 'multithread', 'testing', 'behavioral'], component: KeywordCloud },
];

function getVisualization(topic: string): React.FC<VizProps> {
  // Step 1: Normalize the topic slug
  const slug = topic.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  // Step 2: Exact slug match (primary — fastest and most accurate)
  if (SLUG_VIZ_MAP[slug]) return SLUG_VIZ_MAP[slug];

  // Step 3: Keyword fallback — check if any keyword appears in the slug
  for (const rule of KEYWORD_VIZ_RULES) {
    for (const kw of rule.keywords) {
      if (slug.includes(kw)) return rule.component;
    }
  }

  // Step 4: Ultimate fallback — KeywordCloud is visually interesting for any topic
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
