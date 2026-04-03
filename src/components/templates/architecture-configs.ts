import type { ArchitectureConfig } from './ArchitectureRenderer';

// ---------------------------------------------------------------------------
// Color palette (shared across configs)
// ---------------------------------------------------------------------------
const C = {
  client: '#60A5FA',   // blue
  gateway: '#E85D26',  // saffron
  server: '#1DD1A1',   // teal
  db: '#A78BFA',       // purple
  cache: '#FDB813',    // gold
  queue: '#F472B6',    // pink
} as const;

// ---------------------------------------------------------------------------
// 1. Load Balancer Architecture
// ---------------------------------------------------------------------------
export const LOAD_BALANCER_OVERVIEW: ArchitectureConfig = {
  title: 'Load Balancer Architecture',
  nodes: [
    { id: 'client', label: 'Client', x: 15, y: 50, color: C.client, beatIndex: 0 },
    { id: 'lb', label: 'Load Balancer', x: 40, y: 50, color: C.gateway, beatIndex: 1, width: 180, height: 80 },
    { id: 'srv1', label: 'Server 1', x: 70, y: 25, color: C.server, beatIndex: 2 },
    { id: 'srv2', label: 'Server 2', x: 70, y: 50, color: C.server, beatIndex: 2 },
    { id: 'srv3', label: 'Server 3', x: 70, y: 75, color: C.server, beatIndex: 2 },
    { id: 'db', label: 'Database', x: 92, y: 50, color: C.db, beatIndex: 3 },
  ],
  edges: [
    { from: 'client', to: 'lb', label: 'Request', beatIndex: 1 },
    { from: 'lb', to: 'srv1', beatIndex: 2 },
    { from: 'lb', to: 'srv2', beatIndex: 2 },
    { from: 'lb', to: 'srv3', beatIndex: 2 },
    { from: 'srv1', to: 'db', dashed: true, beatIndex: 3 },
    { from: 'srv2', to: 'db', dashed: true, beatIndex: 3 },
    { from: 'srv3', to: 'db', dashed: true, beatIndex: 3 },
  ],
  flows: [
    { path: ['client', 'lb', 'srv1'], color: C.server, beatIndex: 4 },
    { path: ['client', 'lb', 'srv2'], color: C.cache, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// 2. Cache Architecture
// ---------------------------------------------------------------------------
export const CACHE_OVERVIEW: ArchitectureConfig = {
  title: 'Cache Architecture',
  nodes: [
    { id: 'client', label: 'Client', x: 10, y: 50, color: C.client, beatIndex: 0 },
    { id: 'app', label: 'App Server', x: 35, y: 50, color: C.server, beatIndex: 1 },
    { id: 'cache', label: 'Cache (Redis)', x: 60, y: 25, color: C.cache, beatIndex: 2, width: 180, height: 80 },
    { id: 'db', label: 'Database', x: 60, y: 75, color: C.db, beatIndex: 2 },
    { id: 'cdn', label: 'CDN', x: 85, y: 25, color: C.gateway, beatIndex: 3 },
  ],
  edges: [
    { from: 'client', to: 'app', label: 'Request', beatIndex: 1 },
    { from: 'app', to: 'cache', label: 'Check cache', beatIndex: 2 },
    { from: 'app', to: 'db', label: 'Miss -> DB', dashed: true, beatIndex: 2 },
    { from: 'cache', to: 'cdn', label: 'Static', beatIndex: 3 },
    { from: 'db', to: 'cache', label: 'Populate', curved: true, beatIndex: 3 },
  ],
  flows: [
    { path: ['client', 'app', 'cache'], color: C.cache, beatIndex: 4 },
    { path: ['app', 'db', 'cache'], color: C.db, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// 3. Database Architecture
// ---------------------------------------------------------------------------
export const DATABASE_OVERVIEW: ArchitectureConfig = {
  title: 'Database Architecture',
  nodes: [
    { id: 'app', label: 'Application', x: 15, y: 50, color: C.server, beatIndex: 0 },
    { id: 'primary', label: 'Primary DB', x: 45, y: 35, color: C.db, beatIndex: 1, width: 180, height: 80 },
    { id: 'replica1', label: 'Read Replica 1', x: 75, y: 20, color: C.db, beatIndex: 2 },
    { id: 'replica2', label: 'Read Replica 2', x: 75, y: 50, color: C.db, beatIndex: 2 },
    { id: 'shard', label: 'Shard DB', x: 45, y: 75, color: C.cache, beatIndex: 3, width: 180, height: 70 },
    { id: 'backup', label: 'Backup', x: 75, y: 80, color: C.queue, beatIndex: 3 },
  ],
  edges: [
    { from: 'app', to: 'primary', label: 'Write', beatIndex: 1 },
    { from: 'primary', to: 'replica1', label: 'Replicate', beatIndex: 2 },
    { from: 'primary', to: 'replica2', label: 'Replicate', beatIndex: 2 },
    { from: 'app', to: 'shard', label: 'Sharded R/W', dashed: true, beatIndex: 3 },
    { from: 'primary', to: 'backup', dashed: true, beatIndex: 3 },
  ],
  flows: [
    { path: ['app', 'primary', 'replica1'], color: C.db, beatIndex: 4 },
    { path: ['app', 'primary', 'replica2'], color: C.server, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// 4. Microservices Architecture
// ---------------------------------------------------------------------------
export const MICROSERVICES_OVERVIEW: ArchitectureConfig = {
  title: 'Microservices Architecture',
  nodes: [
    { id: 'client', label: 'Client', x: 10, y: 50, color: C.client, beatIndex: 0 },
    { id: 'gateway', label: 'API Gateway', x: 30, y: 50, color: C.gateway, beatIndex: 1, width: 180, height: 80 },
    { id: 'auth', label: 'Auth Service', x: 55, y: 20, color: C.server, beatIndex: 2 },
    { id: 'user', label: 'User Service', x: 55, y: 50, color: C.server, beatIndex: 2 },
    { id: 'order', label: 'Order Service', x: 55, y: 80, color: C.server, beatIndex: 2 },
    { id: 'db1', label: 'Auth DB', x: 80, y: 20, color: C.db, beatIndex: 3 },
    { id: 'db2', label: 'User DB', x: 80, y: 50, color: C.db, beatIndex: 3 },
    { id: 'db3', label: 'Order DB', x: 80, y: 80, color: C.db, beatIndex: 3 },
  ],
  edges: [
    { from: 'client', to: 'gateway', label: 'Request', beatIndex: 1 },
    { from: 'gateway', to: 'auth', beatIndex: 2 },
    { from: 'gateway', to: 'user', beatIndex: 2 },
    { from: 'gateway', to: 'order', beatIndex: 2 },
    { from: 'auth', to: 'db1', dashed: true, beatIndex: 3 },
    { from: 'user', to: 'db2', dashed: true, beatIndex: 3 },
    { from: 'order', to: 'db3', dashed: true, beatIndex: 3 },
  ],
  flows: [
    { path: ['client', 'gateway', 'user', 'db2'], color: C.server, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// 5. Message Queue Architecture
// ---------------------------------------------------------------------------
export const MESSAGE_QUEUE_OVERVIEW: ArchitectureConfig = {
  title: 'Message Queue Architecture',
  nodes: [
    { id: 'producer', label: 'Producer', x: 12, y: 40, color: C.client, beatIndex: 0 },
    { id: 'queue', label: 'Message Queue', x: 40, y: 40, color: C.queue, beatIndex: 1, width: 200, height: 80 },
    { id: 'consumer1', label: 'Consumer 1', x: 70, y: 20, color: C.server, beatIndex: 2 },
    { id: 'consumer2', label: 'Consumer 2', x: 70, y: 60, color: C.server, beatIndex: 2 },
    { id: 'dlq', label: 'Dead Letter Q', x: 40, y: 80, color: C.gateway, beatIndex: 3 },
    { id: 'db', label: 'Database', x: 92, y: 40, color: C.db, beatIndex: 3 },
  ],
  edges: [
    { from: 'producer', to: 'queue', label: 'Publish', beatIndex: 1 },
    { from: 'queue', to: 'consumer1', label: 'Subscribe', beatIndex: 2 },
    { from: 'queue', to: 'consumer2', label: 'Subscribe', beatIndex: 2 },
    { from: 'queue', to: 'dlq', label: 'Failed', dashed: true, beatIndex: 3 },
    { from: 'consumer1', to: 'db', dashed: true, beatIndex: 3 },
    { from: 'consumer2', to: 'db', dashed: true, beatIndex: 3 },
  ],
  flows: [
    { path: ['producer', 'queue', 'consumer1', 'db'], color: C.queue, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// 6. API Gateway Architecture
// ---------------------------------------------------------------------------
export const API_GATEWAY_OVERVIEW: ArchitectureConfig = {
  title: 'API Gateway Architecture',
  nodes: [
    { id: 'web', label: 'Web Client', x: 10, y: 30, color: C.client, beatIndex: 0 },
    { id: 'mobile', label: 'Mobile App', x: 10, y: 70, color: C.client, beatIndex: 0 },
    { id: 'gateway', label: 'API Gateway', x: 38, y: 50, color: C.gateway, beatIndex: 1, width: 190, height: 90 },
    { id: 'ratelimit', label: 'Rate Limiter', x: 38, y: 15, color: C.cache, beatIndex: 2 },
    { id: 'svc1', label: 'Service A', x: 68, y: 30, color: C.server, beatIndex: 3 },
    { id: 'svc2', label: 'Service B', x: 68, y: 70, color: C.server, beatIndex: 3 },
    { id: 'db', label: 'Database', x: 92, y: 50, color: C.db, beatIndex: 4 },
  ],
  edges: [
    { from: 'web', to: 'gateway', label: 'HTTPS', beatIndex: 1 },
    { from: 'mobile', to: 'gateway', label: 'HTTPS', beatIndex: 1 },
    { from: 'gateway', to: 'ratelimit', label: 'Check', curved: true, beatIndex: 2 },
    { from: 'gateway', to: 'svc1', label: 'Route', beatIndex: 3 },
    { from: 'gateway', to: 'svc2', label: 'Route', beatIndex: 3 },
    { from: 'svc1', to: 'db', dashed: true, beatIndex: 4 },
    { from: 'svc2', to: 'db', dashed: true, beatIndex: 4 },
  ],
  flows: [
    { path: ['web', 'gateway', 'svc1', 'db'], color: C.server, beatIndex: 5 },
  ],
};

// ---------------------------------------------------------------------------
// 7. Distributed System Architecture
// ---------------------------------------------------------------------------
export const DISTRIBUTED_OVERVIEW: ArchitectureConfig = {
  title: 'Distributed System Architecture',
  nodes: [
    { id: 'client', label: 'Client', x: 10, y: 50, color: C.client, beatIndex: 0 },
    { id: 'lb', label: 'Load Balancer', x: 30, y: 50, color: C.gateway, beatIndex: 1 },
    { id: 'node1', label: 'Node 1', x: 55, y: 20, color: C.server, beatIndex: 2 },
    { id: 'node2', label: 'Node 2', x: 55, y: 50, color: C.server, beatIndex: 2 },
    { id: 'node3', label: 'Node 3', x: 55, y: 80, color: C.server, beatIndex: 2 },
    { id: 'consensus', label: 'Consensus', x: 80, y: 50, color: C.cache, beatIndex: 3, width: 170, height: 70 },
  ],
  edges: [
    { from: 'client', to: 'lb', beatIndex: 1 },
    { from: 'lb', to: 'node1', beatIndex: 2 },
    { from: 'lb', to: 'node2', beatIndex: 2 },
    { from: 'lb', to: 'node3', beatIndex: 2 },
    { from: 'node1', to: 'consensus', label: 'Raft/Paxos', dashed: true, beatIndex: 3 },
    { from: 'node2', to: 'consensus', dashed: true, beatIndex: 3 },
    { from: 'node3', to: 'consensus', dashed: true, beatIndex: 3 },
  ],
  flows: [
    { path: ['client', 'lb', 'node1', 'consensus'], color: C.cache, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// 8. CQRS Architecture
// ---------------------------------------------------------------------------
export const CQRS_OVERVIEW: ArchitectureConfig = {
  title: 'CQRS Architecture',
  nodes: [
    { id: 'client', label: 'Client', x: 10, y: 50, color: C.client, beatIndex: 0 },
    { id: 'cmdapi', label: 'Command API', x: 35, y: 25, color: C.gateway, beatIndex: 1, width: 180, height: 70 },
    { id: 'queryapi', label: 'Query API', x: 35, y: 75, color: C.server, beatIndex: 1, width: 180, height: 70 },
    { id: 'writedb', label: 'Write DB', x: 65, y: 25, color: C.db, beatIndex: 2 },
    { id: 'eventbus', label: 'Event Bus', x: 65, y: 50, color: C.queue, beatIndex: 3, width: 170, height: 60 },
    { id: 'readdb', label: 'Read DB', x: 65, y: 75, color: C.cache, beatIndex: 3 },
  ],
  edges: [
    { from: 'client', to: 'cmdapi', label: 'Command', beatIndex: 1 },
    { from: 'client', to: 'queryapi', label: 'Query', beatIndex: 1 },
    { from: 'cmdapi', to: 'writedb', label: 'Write', beatIndex: 2 },
    { from: 'writedb', to: 'eventbus', label: 'Event', beatIndex: 3 },
    { from: 'eventbus', to: 'readdb', label: 'Project', beatIndex: 3 },
    { from: 'queryapi', to: 'readdb', label: 'Read', dashed: true, beatIndex: 3 },
  ],
  flows: [
    { path: ['client', 'cmdapi', 'writedb', 'eventbus', 'readdb'], color: C.queue, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// 9. Event-Driven Architecture
// ---------------------------------------------------------------------------
export const EVENT_DRIVEN_OVERVIEW: ArchitectureConfig = {
  title: 'Event-Driven Architecture',
  nodes: [
    { id: 'source', label: 'Event Source', x: 10, y: 50, color: C.client, beatIndex: 0 },
    { id: 'broker', label: 'Event Broker', x: 38, y: 50, color: C.queue, beatIndex: 1, width: 190, height: 80 },
    { id: 'handler1', label: 'Handler A', x: 65, y: 20, color: C.server, beatIndex: 2 },
    { id: 'handler2', label: 'Handler B', x: 65, y: 50, color: C.server, beatIndex: 2 },
    { id: 'handler3', label: 'Handler C', x: 65, y: 80, color: C.server, beatIndex: 2 },
    { id: 'store', label: 'Event Store', x: 90, y: 50, color: C.db, beatIndex: 3 },
  ],
  edges: [
    { from: 'source', to: 'broker', label: 'Emit', beatIndex: 1 },
    { from: 'broker', to: 'handler1', label: 'Subscribe', beatIndex: 2 },
    { from: 'broker', to: 'handler2', beatIndex: 2 },
    { from: 'broker', to: 'handler3', beatIndex: 2 },
    { from: 'broker', to: 'store', label: 'Persist', dashed: true, beatIndex: 3 },
  ],
  flows: [
    { path: ['source', 'broker', 'handler1'], color: C.queue, beatIndex: 4 },
    { path: ['source', 'broker', 'handler3'], color: C.cache, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// 10. Service Discovery Architecture
// ---------------------------------------------------------------------------
export const SERVICE_DISCOVERY_OVERVIEW: ArchitectureConfig = {
  title: 'Service Discovery Architecture',
  nodes: [
    { id: 'client', label: 'Client Service', x: 12, y: 50, color: C.client, beatIndex: 0 },
    { id: 'registry', label: 'Service Registry', x: 50, y: 20, color: C.cache, beatIndex: 1, width: 200, height: 80 },
    { id: 'svc1', label: 'Service A (x3)', x: 50, y: 55, color: C.server, beatIndex: 2 },
    { id: 'svc2', label: 'Service B (x2)', x: 50, y: 80, color: C.server, beatIndex: 2 },
    { id: 'health', label: 'Health Check', x: 85, y: 20, color: C.gateway, beatIndex: 3 },
  ],
  edges: [
    { from: 'client', to: 'registry', label: 'Lookup', curved: true, beatIndex: 1 },
    { from: 'svc1', to: 'registry', label: 'Register', beatIndex: 2 },
    { from: 'svc2', to: 'registry', label: 'Register', beatIndex: 2 },
    { from: 'client', to: 'svc1', label: 'Call', dashed: true, beatIndex: 3 },
    { from: 'registry', to: 'health', label: 'Heartbeat', beatIndex: 3 },
  ],
  flows: [
    { path: ['client', 'registry'], color: C.cache, beatIndex: 4 },
    { path: ['client', 'svc1'], color: C.server, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// 11. Container Orchestration Architecture
// ---------------------------------------------------------------------------
export const CONTAINER_ORCHESTRATION_OVERVIEW: ArchitectureConfig = {
  title: 'Container Orchestration Architecture',
  nodes: [
    { id: 'master', label: 'Control Plane', x: 20, y: 25, color: C.gateway, beatIndex: 0, width: 190, height: 80 },
    { id: 'scheduler', label: 'Scheduler', x: 20, y: 65, color: C.cache, beatIndex: 1 },
    { id: 'worker1', label: 'Worker Node 1', x: 60, y: 20, color: C.server, beatIndex: 2 },
    { id: 'worker2', label: 'Worker Node 2', x: 60, y: 50, color: C.server, beatIndex: 2 },
    { id: 'worker3', label: 'Worker Node 3', x: 60, y: 80, color: C.server, beatIndex: 2 },
    { id: 'etcd', label: 'etcd Store', x: 90, y: 25, color: C.db, beatIndex: 3 },
    { id: 'registry', label: 'Image Registry', x: 90, y: 65, color: C.queue, beatIndex: 3 },
  ],
  edges: [
    { from: 'master', to: 'scheduler', label: 'Schedule', beatIndex: 1 },
    { from: 'scheduler', to: 'worker1', beatIndex: 2 },
    { from: 'scheduler', to: 'worker2', beatIndex: 2 },
    { from: 'scheduler', to: 'worker3', beatIndex: 2 },
    { from: 'master', to: 'etcd', label: 'State', dashed: true, beatIndex: 3 },
    { from: 'worker1', to: 'registry', label: 'Pull', dashed: true, beatIndex: 3 },
  ],
  flows: [
    { path: ['master', 'scheduler', 'worker1'], color: C.server, beatIndex: 4 },
    { path: ['master', 'scheduler', 'worker2'], color: C.cache, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// 12. Search Engine Architecture
// ---------------------------------------------------------------------------
export const SEARCH_ENGINE_OVERVIEW: ArchitectureConfig = {
  title: 'Search Engine Architecture',
  nodes: [
    { id: 'client', label: 'Client', x: 10, y: 50, color: C.client, beatIndex: 0 },
    { id: 'api', label: 'Search API', x: 32, y: 50, color: C.gateway, beatIndex: 1, width: 170, height: 70 },
    { id: 'index', label: 'Index Shard 1', x: 58, y: 25, color: C.cache, beatIndex: 2 },
    { id: 'index2', label: 'Index Shard 2', x: 58, y: 55, color: C.cache, beatIndex: 2 },
    { id: 'ranker', label: 'Ranker', x: 58, y: 82, color: C.server, beatIndex: 3, width: 160, height: 60 },
    { id: 'store', label: 'Doc Store', x: 88, y: 40, color: C.db, beatIndex: 3 },
  ],
  edges: [
    { from: 'client', to: 'api', label: 'Query', beatIndex: 1 },
    { from: 'api', to: 'index', label: 'Scatter', beatIndex: 2 },
    { from: 'api', to: 'index2', label: 'Scatter', beatIndex: 2 },
    { from: 'index', to: 'ranker', label: 'Gather', curved: true, beatIndex: 3 },
    { from: 'index2', to: 'ranker', beatIndex: 3 },
    { from: 'ranker', to: 'store', label: 'Fetch docs', dashed: true, beatIndex: 3 },
  ],
  flows: [
    { path: ['client', 'api', 'index', 'ranker', 'store'], color: C.cache, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// Master lookup: templateId -> variant -> config
// ---------------------------------------------------------------------------
export const ARCHITECTURE_CONFIGS: Record<string, Record<string, ArchitectureConfig>> = {
  LoadBalancerArch: { overview: LOAD_BALANCER_OVERVIEW },
  CacheArch: { overview: CACHE_OVERVIEW },
  DatabaseArch: { overview: DATABASE_OVERVIEW },
  MicroservicesArch: { overview: MICROSERVICES_OVERVIEW },
  MessageQueueArch: { overview: MESSAGE_QUEUE_OVERVIEW },
  APIGatewayArch: { overview: API_GATEWAY_OVERVIEW },
  DistributedArch: { overview: DISTRIBUTED_OVERVIEW },
  CQRSViz: { overview: CQRS_OVERVIEW },
  EventDrivenViz: { overview: EVENT_DRIVEN_OVERVIEW },
  ServiceDiscoveryViz: { overview: SERVICE_DISCOVERY_OVERVIEW },
  ContainerOrchestrationViz: { overview: CONTAINER_ORCHESTRATION_OVERVIEW },
  SearchEngineViz: { overview: SEARCH_ENGINE_OVERVIEW },
};
