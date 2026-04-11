import type { D2Node, D2Edge } from './d2-renderer';

export interface D2DiagramDef {
  nodes: D2Node[];
  edges: D2Edge[];
  direction?: 'right' | 'down';
}

export const D2_DIAGRAMS: Record<string, D2DiagramDef> = {
  'api-gateway': {
    direction: 'right',
    nodes: [
      { id: 'client', label: 'Client', color: '#1e3a5f', stroke: '#60a5fa' },
      { id: 'gateway', label: 'API Gateway', color: '#7c2d12', stroke: '#fb923c', shape: 'hexagon' },
      { id: 'auth', label: 'Auth Service', color: '#064e3b', stroke: '#34d399' },
      { id: 'users', label: 'User Service', color: '#1e1b4b', stroke: '#818cf8' },
      { id: 'orders', label: 'Order Service', color: '#1e1b4b', stroke: '#818cf8' },
      { id: 'db', label: 'Database', color: '#312e81', stroke: '#a78bfa', shape: 'cylinder' },
      { id: 'cache', label: 'Redis Cache', color: '#713f12', stroke: '#fbbf24' },
    ],
    edges: [
      { from: 'client', to: 'gateway', label: 'HTTPS', color: '#60a5fa' },
      { from: 'gateway', to: 'auth', label: 'Validate', color: '#34d399' },
      { from: 'gateway', to: 'users', label: 'Route', color: '#818cf8' },
      { from: 'gateway', to: 'orders', label: 'Route', color: '#818cf8' },
      { from: 'users', to: 'db', label: 'Query', color: '#a78bfa' },
      { from: 'orders', to: 'cache', label: 'Read', color: '#fbbf24' },
      { from: 'cache', to: 'db', label: 'Miss', color: '#a78bfa', dashed: true },
    ],
  },

  'load-balancing': {
    direction: 'right',
    nodes: [
      { id: 'clients', label: 'Clients', color: '#1e3a5f', stroke: '#60a5fa' },
      { id: 'lb', label: 'Load Balancer', color: '#7c2d12', stroke: '#fb923c', shape: 'hexagon' },
      { id: 'srv1', label: 'Server 1', color: '#064e3b', stroke: '#34d399' },
      { id: 'srv2', label: 'Server 2', color: '#064e3b', stroke: '#34d399' },
      { id: 'srv3', label: 'Server 3', color: '#064e3b', stroke: '#34d399' },
      { id: 'health', label: 'Health Check', color: '#4a1d6e', stroke: '#c084fc', shape: 'diamond' },
    ],
    edges: [
      { from: 'clients', to: 'lb', label: 'Requests', color: '#60a5fa' },
      { from: 'lb', to: 'srv1', label: 'Round Robin', color: '#34d399' },
      { from: 'lb', to: 'srv2', label: 'Weighted', color: '#34d399' },
      { from: 'lb', to: 'srv3', label: 'Least Conn', color: '#34d399' },
      { from: 'health', to: 'srv1', label: 'Ping', color: '#c084fc', dashed: true },
      { from: 'health', to: 'srv2', label: 'Ping', color: '#c084fc', dashed: true },
      { from: 'health', to: 'srv3', label: 'Ping', color: '#c084fc', dashed: true },
    ],
  },

  'caching': {
    direction: 'right',
    nodes: [
      { id: 'app', label: 'Application', color: '#1e3a5f', stroke: '#60a5fa' },
      { id: 'l1', label: 'L1 Cache', color: '#713f12', stroke: '#fbbf24' },
      { id: 'l2', label: 'L2 Redis', color: '#7c2d12', stroke: '#fb923c' },
      { id: 'db', label: 'Database', color: '#312e81', stroke: '#a78bfa', shape: 'cylinder' },
      { id: 'cdn', label: 'CDN', color: '#064e3b', stroke: '#34d399', shape: 'hexagon' },
      { id: 'inv', label: 'Invalidation', color: '#4a1d6e', stroke: '#c084fc', shape: 'diamond' },
    ],
    edges: [
      { from: 'app', to: 'l1', label: 'Check', color: '#fbbf24' },
      { from: 'l1', to: 'l2', label: 'Miss', color: '#fb923c', dashed: true },
      { from: 'l2', to: 'db', label: 'Miss', color: '#a78bfa', dashed: true },
      { from: 'app', to: 'cdn', label: 'Static', color: '#34d399' },
      { from: 'inv', to: 'l1', label: 'Purge', color: '#c084fc' },
      { from: 'inv', to: 'l2', label: 'Purge', color: '#c084fc' },
    ],
  },

  'database': {
    direction: 'down',
    nodes: [
      { id: 'app', label: 'Application', color: '#1e3a5f', stroke: '#60a5fa' },
      { id: 'primary', label: 'Primary DB', color: '#064e3b', stroke: '#34d399', shape: 'cylinder' },
      { id: 'replica1', label: 'Read Replica 1', color: '#312e81', stroke: '#a78bfa', shape: 'cylinder' },
      { id: 'replica2', label: 'Read Replica 2', color: '#312e81', stroke: '#a78bfa', shape: 'cylinder' },
      { id: 'shard1', label: 'Shard A-M', color: '#713f12', stroke: '#fbbf24', shape: 'cylinder' },
      { id: 'shard2', label: 'Shard N-Z', color: '#713f12', stroke: '#fbbf24', shape: 'cylinder' },
    ],
    edges: [
      { from: 'app', to: 'primary', label: 'Writes', color: '#34d399' },
      { from: 'app', to: 'replica1', label: 'Reads', color: '#a78bfa' },
      { from: 'app', to: 'replica2', label: 'Reads', color: '#a78bfa' },
      { from: 'primary', to: 'replica1', label: 'Replication', color: '#818cf8', dashed: true },
      { from: 'primary', to: 'replica2', label: 'Replication', color: '#818cf8', dashed: true },
      { from: 'app', to: 'shard1', label: 'Hash A-M', color: '#fbbf24' },
      { from: 'app', to: 'shard2', label: 'Hash N-Z', color: '#fbbf24' },
    ],
  },

  'microservices': {
    direction: 'right',
    nodes: [
      { id: 'gateway', label: 'API Gateway', color: '#7c2d12', stroke: '#fb923c', shape: 'hexagon' },
      { id: 'user_svc', label: 'User Service', color: '#1e1b4b', stroke: '#818cf8' },
      { id: 'order_svc', label: 'Order Service', color: '#1e1b4b', stroke: '#818cf8' },
      { id: 'payment_svc', label: 'Payment Service', color: '#064e3b', stroke: '#34d399' },
      { id: 'mq', label: 'Message Queue', color: '#4a1d6e', stroke: '#c084fc', shape: 'hexagon' },
      { id: 'registry', label: 'Service Registry', color: '#713f12', stroke: '#fbbf24', shape: 'diamond' },
    ],
    edges: [
      { from: 'gateway', to: 'user_svc', label: 'REST', color: '#818cf8' },
      { from: 'gateway', to: 'order_svc', label: 'REST', color: '#818cf8' },
      { from: 'order_svc', to: 'mq', label: 'Publish', color: '#c084fc' },
      { from: 'mq', to: 'payment_svc', label: 'Subscribe', color: '#34d399' },
      { from: 'registry', to: 'user_svc', label: 'Register', color: '#fbbf24', dashed: true },
      { from: 'registry', to: 'order_svc', label: 'Register', color: '#fbbf24', dashed: true },
      { from: 'registry', to: 'payment_svc', label: 'Register', color: '#fbbf24', dashed: true },
    ],
  },

  'message-queue': {
    direction: 'right',
    nodes: [
      { id: 'producer1', label: 'Producer A', color: '#1e3a5f', stroke: '#60a5fa' },
      { id: 'producer2', label: 'Producer B', color: '#1e3a5f', stroke: '#60a5fa' },
      { id: 'broker', label: 'Message Broker', color: '#7c2d12', stroke: '#fb923c', shape: 'hexagon' },
      { id: 'queue1', label: 'Queue: Orders', color: '#4a1d6e', stroke: '#c084fc' },
      { id: 'queue2', label: 'Queue: Emails', color: '#4a1d6e', stroke: '#c084fc' },
      { id: 'consumer1', label: 'Consumer 1', color: '#064e3b', stroke: '#34d399' },
      { id: 'consumer2', label: 'Consumer 2', color: '#064e3b', stroke: '#34d399' },
    ],
    edges: [
      { from: 'producer1', to: 'broker', label: 'Publish', color: '#60a5fa' },
      { from: 'producer2', to: 'broker', label: 'Publish', color: '#60a5fa' },
      { from: 'broker', to: 'queue1', label: 'Route', color: '#c084fc' },
      { from: 'broker', to: 'queue2', label: 'Route', color: '#c084fc' },
      { from: 'queue1', to: 'consumer1', label: 'Consume', color: '#34d399' },
      { from: 'queue2', to: 'consumer2', label: 'Consume', color: '#34d399' },
    ],
  },

  'distributed': {
    direction: 'right',
    nodes: [
      { id: 'client', label: 'Client', color: '#1e3a5f', stroke: '#60a5fa' },
      { id: 'node1', label: 'Node 1 (Leader)', color: '#7c2d12', stroke: '#fb923c' },
      { id: 'node2', label: 'Node 2', color: '#1e1b4b', stroke: '#818cf8' },
      { id: 'node3', label: 'Node 3', color: '#1e1b4b', stroke: '#818cf8' },
      { id: 'consensus', label: 'Consensus', color: '#064e3b', stroke: '#34d399', shape: 'diamond' },
      { id: 'log', label: 'WAL Log', color: '#312e81', stroke: '#a78bfa', shape: 'cylinder' },
    ],
    edges: [
      { from: 'client', to: 'node1', label: 'Write', color: '#60a5fa' },
      { from: 'node1', to: 'consensus', label: 'Propose', color: '#34d399' },
      { from: 'consensus', to: 'node2', label: 'Replicate', color: '#818cf8' },
      { from: 'consensus', to: 'node3', label: 'Replicate', color: '#818cf8' },
      { from: 'node1', to: 'log', label: 'Append', color: '#a78bfa' },
      { from: 'node2', to: 'log', label: 'Append', color: '#a78bfa', dashed: true },
    ],
  },

  'authentication': {
    direction: 'right',
    nodes: [
      { id: 'user', label: 'User', color: '#1e3a5f', stroke: '#60a5fa' },
      { id: 'auth_server', label: 'Auth Server', color: '#7c2d12', stroke: '#fb923c', shape: 'hexagon' },
      { id: 'idp', label: 'Identity Provider', color: '#4a1d6e', stroke: '#c084fc' },
      { id: 'token_store', label: 'Token Store', color: '#713f12', stroke: '#fbbf24', shape: 'cylinder' },
      { id: 'api', label: 'Protected API', color: '#064e3b', stroke: '#34d399' },
      { id: 'rbac', label: 'RBAC Engine', color: '#312e81', stroke: '#a78bfa', shape: 'diamond' },
    ],
    edges: [
      { from: 'user', to: 'auth_server', label: 'Login', color: '#60a5fa' },
      { from: 'auth_server', to: 'idp', label: 'Verify', color: '#c084fc' },
      { from: 'auth_server', to: 'token_store', label: 'Issue JWT', color: '#fbbf24' },
      { from: 'user', to: 'api', label: 'Bearer Token', color: '#34d399' },
      { from: 'api', to: 'rbac', label: 'Check Perms', color: '#a78bfa' },
      { from: 'rbac', to: 'token_store', label: 'Validate', color: '#fbbf24', dashed: true },
    ],
  },

  'rate-limiting': {
    direction: 'right',
    nodes: [
      { id: 'client', label: 'Client', color: '#1e3a5f', stroke: '#60a5fa' },
      { id: 'limiter', label: 'Rate Limiter', color: '#7c2d12', stroke: '#fb923c', shape: 'hexagon' },
      { id: 'counter', label: 'Token Bucket', color: '#713f12', stroke: '#fbbf24', shape: 'diamond' },
      { id: 'redis', label: 'Redis Counter', color: '#4a1d6e', stroke: '#c084fc', shape: 'cylinder' },
      { id: 'api', label: 'API Server', color: '#064e3b', stroke: '#34d399' },
      { id: 'reject', label: '429 Too Many', color: '#991b1b', stroke: '#f87171', shape: 'oval' },
    ],
    edges: [
      { from: 'client', to: 'limiter', label: 'Request', color: '#60a5fa' },
      { from: 'limiter', to: 'counter', label: 'Check', color: '#fbbf24' },
      { from: 'counter', to: 'redis', label: 'Incr/Decr', color: '#c084fc' },
      { from: 'limiter', to: 'api', label: 'Allow', color: '#34d399' },
      { from: 'limiter', to: 'reject', label: 'Deny', color: '#f87171', dashed: true },
    ],
  },

  'monitoring': {
    direction: 'down',
    nodes: [
      { id: 'services', label: 'Microservices', color: '#1e1b4b', stroke: '#818cf8' },
      { id: 'collector', label: 'Metrics Collector', color: '#7c2d12', stroke: '#fb923c', shape: 'hexagon' },
      { id: 'tsdb', label: 'Time-Series DB', color: '#312e81', stroke: '#a78bfa', shape: 'cylinder' },
      { id: 'dashboard', label: 'Grafana Dashboard', color: '#064e3b', stroke: '#34d399' },
      { id: 'alerter', label: 'Alert Manager', color: '#991b1b', stroke: '#f87171', shape: 'diamond' },
      { id: 'oncall', label: 'On-Call Engineer', color: '#713f12', stroke: '#fbbf24' },
    ],
    edges: [
      { from: 'services', to: 'collector', label: 'Push Metrics', color: '#818cf8' },
      { from: 'collector', to: 'tsdb', label: 'Store', color: '#a78bfa' },
      { from: 'tsdb', to: 'dashboard', label: 'Query', color: '#34d399' },
      { from: 'tsdb', to: 'alerter', label: 'Threshold', color: '#f87171' },
      { from: 'alerter', to: 'oncall', label: 'Page', color: '#fbbf24' },
    ],
  },

  'cdn': {
    direction: 'right',
    nodes: [
      { id: 'user', label: 'User', color: '#1e3a5f', stroke: '#60a5fa' },
      { id: 'dns', label: 'DNS Resolver', color: '#4a1d6e', stroke: '#c084fc', shape: 'diamond' },
      { id: 'edge', label: 'Edge Server', color: '#7c2d12', stroke: '#fb923c', shape: 'hexagon' },
      { id: 'pop', label: 'PoP Cache', color: '#713f12', stroke: '#fbbf24' },
      { id: 'origin', label: 'Origin Server', color: '#064e3b', stroke: '#34d399' },
      { id: 'storage', label: 'Object Store', color: '#312e81', stroke: '#a78bfa', shape: 'cylinder' },
    ],
    edges: [
      { from: 'user', to: 'dns', label: 'Resolve', color: '#c084fc' },
      { from: 'dns', to: 'edge', label: 'Nearest PoP', color: '#fb923c' },
      { from: 'edge', to: 'pop', label: 'Check', color: '#fbbf24' },
      { from: 'pop', to: 'origin', label: 'Cache Miss', color: '#34d399', dashed: true },
      { from: 'origin', to: 'storage', label: 'Fetch', color: '#a78bfa' },
    ],
  },

  'circuit-breaker': {
    direction: 'right',
    nodes: [
      { id: 'caller', label: 'Caller Service', color: '#1e3a5f', stroke: '#60a5fa' },
      { id: 'breaker', label: 'Circuit Breaker', color: '#7c2d12', stroke: '#fb923c', shape: 'diamond' },
      { id: 'target', label: 'Target Service', color: '#064e3b', stroke: '#34d399' },
      { id: 'fallback', label: 'Fallback', color: '#713f12', stroke: '#fbbf24', shape: 'oval' },
      { id: 'monitor', label: 'Failure Counter', color: '#4a1d6e', stroke: '#c084fc' },
      { id: 'timer', label: 'Half-Open Timer', color: '#991b1b', stroke: '#f87171' },
    ],
    edges: [
      { from: 'caller', to: 'breaker', label: 'Request', color: '#60a5fa' },
      { from: 'breaker', to: 'target', label: 'Closed', color: '#34d399' },
      { from: 'breaker', to: 'fallback', label: 'Open', color: '#fbbf24', dashed: true },
      { from: 'target', to: 'monitor', label: 'Fail/OK', color: '#c084fc' },
      { from: 'monitor', to: 'breaker', label: 'Trip', color: '#f87171' },
      { from: 'timer', to: 'breaker', label: 'Half-Open', color: '#f87171', dashed: true },
    ],
  },
};

/**
 * Look up a D2 diagram definition for a given topic string.
 * Matches by checking if the topic slug contains or is contained by any key.
 */
export function getD2Diagram(topic: string): D2DiagramDef | null {
  const lower = topic.toLowerCase().replace(/[^a-z0-9]/g, '-');
  for (const [key, def] of Object.entries(D2_DIAGRAMS)) {
    if (lower.includes(key) || key.includes(lower)) return def;
  }
  return null;
}
