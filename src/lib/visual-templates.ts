import type { SceneType } from '../types';

export interface VisualTemplateConfig {
  id: string;
  keywords: string[];
  variants: string[];
  layout: 'architecture' | 'flow' | 'comparison' | 'concept' | 'data-structure' | 'monitoring' | 'security' | 'generic';
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

  // Concurrency & Threading (4)
  { id: 'ThreadPoolViz', keywords: ['thread pool', 'thread', 'executor', 'worker pool', 'task queue'], variants: ['fixedPool', 'cachedPool', 'scheduledPool', 'forkJoin', 'overview'], layout: 'concept' },
  { id: 'MutexSemaphoreViz', keywords: ['mutex', 'semaphore', 'lock', 'critical section', 'mutual exclusion'], variants: ['mutex', 'countingSemaphore', 'readerWriter', 'spinLock', 'overview'], layout: 'concept' },
  { id: 'DeadlockViz', keywords: ['deadlock', 'circular wait', 'resource allocation', 'starvation', 'livelock'], variants: ['circularWait', 'resourceAllocation', 'detection', 'prevention', 'overview'], layout: 'concept' },
  { id: 'ConcurrencyControlViz', keywords: ['concurrency control', 'optimistic locking', 'pessimistic locking', 'mvcc', 'two phase locking', 'isolation level'], variants: ['pessimistic', 'optimistic', 'mvcc', 'twoPhase', 'overview'], layout: 'flow' },

  // Architectural Patterns (5)
  { id: 'CQRSViz', keywords: ['cqrs', 'command query', 'read model', 'write model', 'event sourcing'], variants: ['basic', 'withEventSourcing', 'materializedView', 'asyncSync', 'overview'], layout: 'architecture' },
  { id: 'SagaPatternViz', keywords: ['saga', 'saga pattern', 'compensating transaction', 'choreography', 'orchestration'], variants: ['choreography', 'orchestration', 'compensation', 'rollback', 'overview'], layout: 'flow' },
  { id: 'EventDrivenViz', keywords: ['event driven', 'event sourcing', 'event store', 'event bus', 'domain event', 'cdc'], variants: ['pubSub', 'eventSourcing', 'eventStore', 'cdc', 'overview'], layout: 'architecture' },
  { id: 'ServiceDiscoveryViz', keywords: ['service discovery', 'service registry', 'consul', 'eureka', 'zookeeper'], variants: ['clientSide', 'serverSide', 'dnsBased', 'healthCheck', 'overview'], layout: 'architecture' },
  { id: 'ContainerOrchestrationViz', keywords: ['container', 'orchestration', 'kubernetes', 'k8s', 'pod', 'replica set'], variants: ['podScheduling', 'scaling', 'selfHealing', 'rollingUpdate', 'overview'], layout: 'architecture' },

  // Resilience & Deployment (4)
  { id: 'CircuitBreakerViz', keywords: ['circuit breaker', 'fallback', 'half-open', 'bulkhead', 'retry'], variants: ['closed', 'open', 'halfOpen', 'stateTransition', 'overview'], layout: 'flow' },
  { id: 'BlueGreenCanaryViz', keywords: ['blue green', 'canary', 'canary release', 'rolling update', 'deployment strategy', 'zero downtime'], variants: ['blueGreen', 'canary', 'rolling', 'abTesting', 'overview'], layout: 'flow' },
  { id: 'FeatureFlagViz', keywords: ['feature flag', 'feature toggle', 'a/b test', 'dark launch', 'kill switch'], variants: ['toggle', 'percentage', 'userSegment', 'killSwitch', 'overview'], layout: 'flow' },
  { id: 'ChaosEngineeringViz', keywords: ['chaos engineering', 'chaos monkey', 'fault injection', 'resilience testing', 'game day'], variants: ['faultInjection', 'blastRadius', 'steadyState', 'gameDay', 'overview'], layout: 'monitoring' },

  // Security & Auth (2)
  { id: 'OAuthJWTViz', keywords: ['oauth', 'oauth 2.0', 'jwt', 'json web token', 'access token', 'refresh token', 'authorization code'], variants: ['authCodeFlow', 'implicitFlow', 'clientCredentials', 'jwtStructure', 'overview'], layout: 'security' },
  { id: 'RateLimiterViz', keywords: ['rate limiting', 'rate limiter', 'token bucket', 'sliding window', 'fixed window', 'leaky bucket', 'throttle'], variants: ['tokenBucket', 'slidingWindow', 'fixedWindow', 'leakyBucket', 'overview'], layout: 'concept' },

  // API & Protocol Patterns (4)
  { id: 'GraphQLViz', keywords: ['graphql', 'query', 'mutation', 'subscription', 'resolver', 'schema'], variants: ['queryResolve', 'mutation', 'subscription', 'schemaStitch', 'overview'], layout: 'flow' },
  { id: 'GRPCViz', keywords: ['grpc', 'protocol buffers', 'protobuf', 'rpc', 'streaming', 'bidirectional'], variants: ['unary', 'serverStreaming', 'clientStreaming', 'bidirectional', 'overview'], layout: 'flow' },
  { id: 'PaginationViz', keywords: ['pagination', 'cursor', 'offset', 'infinite scroll', 'keyset', 'page token'], variants: ['offsetLimit', 'cursorBased', 'keysetPagination', 'infiniteScroll', 'overview'], layout: 'concept' },
  { id: 'APIVersioningViz', keywords: ['api versioning', 'versioning', 'backward compatible', 'breaking change', 'deprecation'], variants: ['urlPath', 'headerBased', 'queryParam', 'contentNegotiation', 'overview'], layout: 'comparison' },

  // Data Structures (5)
  { id: 'BloomFilterViz', keywords: ['bloom filter', 'probabilistic', 'false positive', 'bit array'], variants: ['insert', 'lookup', 'falsePositive', 'countingBloom', 'overview'], layout: 'data-structure' },
  { id: 'LRUCacheViz', keywords: ['lru', 'lru cache', 'least recently used', 'cache eviction', 'doubly linked list'], variants: ['get', 'put', 'eviction', 'implementation', 'overview'], layout: 'data-structure' },
  { id: 'SkipListViz', keywords: ['skip list', 'probabilistic', 'express lane', 'sorted'], variants: ['search', 'insert', 'delete', 'levelBuilding', 'overview'], layout: 'data-structure' },
  { id: 'MerkleTreeViz', keywords: ['merkle tree', 'hash tree', 'verification', 'tamper proof', 'blockchain', 'data integrity'], variants: ['construction', 'verification', 'tamperDetection', 'proofOfInclusion', 'overview'], layout: 'data-structure' },
  { id: 'BTreeViz', keywords: ['b-tree', 'b+ tree', 'btree', 'database index', 'page split'], variants: ['search', 'insert', 'split', 'rangeQuery', 'overview'], layout: 'data-structure' },

  // Search & Storage (3)
  { id: 'SearchEngineViz', keywords: ['elasticsearch', 'search', 'inverted index', 'full text', 'lucene', 'tokenizer'], variants: ['invertedIndex', 'tokenization', 'relevanceScoring', 'shardedSearch', 'overview'], layout: 'architecture' },
  { id: 'BlobStorageViz', keywords: ['blob storage', 'object storage', 's3', 'block storage', 'distributed file', 'hdfs', 'minio'], variants: ['objectStore', 'blockStorage', 'distributedFS', 'tieredStorage', 'overview'], layout: 'architecture' },
  { id: 'FileSystemViz', keywords: ['file system', 'inode', 'directory', 'ext4', 'block allocation', 'journaling'], variants: ['inodeStructure', 'directoryTree', 'blockAllocation', 'journaling', 'overview'], layout: 'concept' },

  // Big Data & Streaming (4)
  { id: 'MapReduceViz', keywords: ['mapreduce', 'map reduce', 'mapper', 'reducer', 'shuffle', 'hadoop'], variants: ['wordCount', 'sortMerge', 'combiner', 'partitioner', 'overview'], layout: 'flow' },
  { id: 'SparkStreamViz', keywords: ['spark', 'spark streaming', 'rdd', 'dataframe', 'micro-batch', 'dag'], variants: ['dag', 'microBatch', 'rddTransform', 'sparkSQL', 'overview'], layout: 'flow' },
  { id: 'KafkaStreamsViz', keywords: ['kafka streams', 'stream processing', 'ktable', 'kstream', 'topology', 'windowed'], variants: ['topology', 'joinStreams', 'windowing', 'stateStore', 'overview'], layout: 'flow' },
  { id: 'DataSerializationViz', keywords: ['serialization', 'protobuf', 'avro', 'thrift', 'binary format', 'schema evolution'], variants: ['jsonVsBinary', 'schemaEvolution', 'encoding', 'sizeComparison', 'overview'], layout: 'comparison' },

  // Distributed Algorithms (4)
  { id: 'LeaderElectionViz', keywords: ['leader election', 'bully algorithm', 'ring election', 'leader', 'follower'], variants: ['bully', 'ring', 'raft', 'heartbeat', 'overview'], layout: 'concept' },
  { id: 'GossipProtocolViz', keywords: ['gossip protocol', 'gossip', 'epidemic', 'rumor spreading', 'crdt', 'anti-entropy'], variants: ['rumorSpreading', 'antiEntropy', 'membershipDetection', 'crdt', 'overview'], layout: 'concept' },
  { id: 'VectorClockViz', keywords: ['vector clock', 'lamport', 'logical clock', 'happened before', 'causal ordering'], variants: ['lamport', 'vectorClock', 'causalOrdering', 'conflictDetection', 'overview'], layout: 'concept' },
  { id: 'RaftConsensusViz', keywords: ['raft', 'consensus', 'log replication', 'term', 'vote', 'append entries'], variants: ['leaderElection', 'logReplication', 'commitment', 'splitBrain', 'overview'], layout: 'concept' },

  // Monitoring & Observability (2)
  { id: 'LoggingTracingViz', keywords: ['logging', 'tracing', 'distributed tracing', 'span', 'trace id', 'jaeger', 'zipkin', 'opentelemetry'], variants: ['structuredLogs', 'distributedTrace', 'spanTree', 'correlation', 'overview'], layout: 'monitoring' },
  { id: 'MonitoringAlertViz', keywords: ['monitoring', 'alerting', 'prometheus', 'grafana', 'metric', 'slo', 'sli', 'error budget'], variants: ['metricsCollection', 'alertThreshold', 'sloTracking', 'dashboardView', 'overview'], layout: 'monitoring' },

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
