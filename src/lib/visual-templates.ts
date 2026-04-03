import type { SceneType } from '../types';

export interface VisualTemplateConfig {
  id: string;
  keywords: string[];
  variants: string[];
  layout: 'architecture' | 'flow' | 'comparison' | 'concept' | 'generic';
}

const TEMPLATES: VisualTemplateConfig[] = [
  // Architecture (7)
  { id: 'LoadBalancerArch', keywords: ['load balancing', 'load balancer', 'round robin', 'least connections'], variants: ['roundRobin', 'leastConnections', 'ipHash', 'weighted', 'overview'], layout: 'architecture' },
  { id: 'CacheArch', keywords: ['cache', 'caching', 'redis', 'cdn', 'memcached'], variants: ['overview', 'hitMiss', 'writeThrough', 'writeBehind', 'eviction', 'aside'], layout: 'architecture' },
  { id: 'DatabaseArch', keywords: ['database', 'sharding', 'replication', 'sql', 'nosql', 'indexing'], variants: ['masterReplica', 'sharding', 'indexing', 'readWrite', 'overview'], layout: 'architecture' },
  { id: 'MicroservicesArch', keywords: ['microservices', 'service mesh', 'service discovery', 'sidecar'], variants: ['basic', 'eventDriven', 'saga', 'sidecar', 'overview'], layout: 'architecture' },
  { id: 'MessageQueueArch', keywords: ['message queue', 'kafka', 'rabbitmq', 'pub sub', 'event driven'], variants: ['pubSub', 'pointToPoint', 'fanOut', 'deadLetter', 'overview'], layout: 'architecture' },
  { id: 'APIGatewayArch', keywords: ['api gateway', 'reverse proxy', 'gateway', 'routing'], variants: ['routing', 'rateLimiting', 'auth', 'aggregation', 'overview'], layout: 'architecture' },
  { id: 'DistributedArch', keywords: ['distributed', 'consensus', 'cap theorem', 'partition', 'paxos', 'raft'], variants: ['consensus', 'partition', 'replication', 'leaderElection', 'overview'], layout: 'architecture' },

  // Flow (5)
  { id: 'RequestFlow', keywords: ['http', 'request', 'response', 'rest', 'api call'], variants: ['httpLifecycle', 'dnsResolution', 'tlsHandshake', 'restApi', 'overview'], layout: 'flow' },
  { id: 'AuthFlow', keywords: ['authentication', 'oauth', 'jwt', 'session', 'login'], variants: ['oauth', 'jwt', 'session', 'apiKey', 'overview'], layout: 'flow' },
  { id: 'DataPipeline', keywords: ['pipeline', 'etl', 'streaming', 'batch', 'data flow'], variants: ['etl', 'streaming', 'batch', 'lambda', 'overview'], layout: 'flow' },
  { id: 'CIFlow', keywords: ['ci', 'cd', 'deployment', 'docker', 'kubernetes', 'devops'], variants: ['basic', 'blueGreen', 'canary', 'rollback', 'overview'], layout: 'flow' },
  { id: 'NetworkFlow', keywords: ['tcp', 'dns', 'websocket', 'networking', 'osi', 'udp'], variants: ['tcpHandshake', 'osi', 'websocket', 'http2', 'overview'], layout: 'flow' },

  // Comparison (3)
  { id: 'VSBattle', keywords: ['vs', 'comparison', 'trade-off', 'versus', 'compare'], variants: ['default'], layout: 'comparison' },
  { id: 'ScaleComparison', keywords: ['horizontal scaling', 'vertical scaling', 'scale up', 'scale out'], variants: ['horizontalVsVertical', 'autoScale'], layout: 'comparison' },
  { id: 'BeforeAfter', keywords: ['optimize', 'improve', 'refactor', 'before', 'after'], variants: ['default'], layout: 'comparison' },

  // Concept (3)
  { id: 'HashRing', keywords: ['consistent hashing', 'hash ring', 'hash function'], variants: ['basic', 'virtualNodes', 'rebalancing'], layout: 'concept' },
  { id: 'TreeVisualization', keywords: ['tree', 'binary tree', 'b-tree', 'trie', 'heap'], variants: ['binarySearch', 'bTree', 'trie', 'heap'], layout: 'concept' },
  { id: 'GraphVisualization', keywords: ['graph', 'bfs', 'dfs', 'dijkstra', 'topological sort'], variants: ['bfs', 'dfs', 'dijkstra', 'topological'], layout: 'concept' },

  // Generic (2)
  { id: 'ConceptDiagram', keywords: [], variants: ['auto'], layout: 'generic' },
  { id: 'IconGrid', keywords: [], variants: ['auto'], layout: 'generic' },
];

// Accent colors rotate by session number
const ACCENT_COLORS = ['#E85D26', '#1DD1A1', '#FDB813', '#818CF8'];

/**
 * Select the best visual template for a scene based on heading + topic keywords.
 * Heading keywords are weighted 2x for more precise matching.
 */
export function getVisualTemplate(
  topic: string,
  sessionNumber: number,
  sceneHeading: string,
  sceneType: SceneType,
  vizVariant?: string,
): { templateId: string; variant: string; accentColor: string } {
  const headingLower = (sceneHeading || '').toLowerCase();
  const topicLower = topic.toLowerCase();
  const combined = `${headingLower} ${topicLower}`;

  let bestTemplate: VisualTemplateConfig | null = null;
  let bestScore = 0;

  for (const tmpl of TEMPLATES) {
    if (tmpl.keywords.length === 0) continue; // skip generic
    let score = 0;
    for (const kw of tmpl.keywords) {
      if (headingLower.includes(kw)) score += 2; // heading match weighted 2x
      else if (topicLower.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = tmpl;
    }
  }

  // Fallback to generic
  if (!bestTemplate) {
    bestTemplate = sceneType === 'table'
      ? TEMPLATES.find(t => t.id === 'VSBattle')!
      : TEMPLATES.find(t => t.id === 'ConceptDiagram')!;
  }

  // Select variant from content keywords or vizVariant
  let variant = bestTemplate.variants[0];
  if (vizVariant && bestTemplate.variants.includes(vizVariant)) {
    variant = vizVariant;
  } else {
    // Try to match variant from heading keywords
    for (const v of bestTemplate.variants) {
      if (headingLower.includes(v.toLowerCase())) {
        variant = v;
        break;
      }
    }
  }

  const accentColor = ACCENT_COLORS[sessionNumber % ACCENT_COLORS.length];

  return {
    templateId: bestTemplate.id,
    variant,
    accentColor,
  };
}
