import type { ConceptConfig } from './ConceptRenderer';
import { COLORS } from '../../lib/theme';

// ---------------------------------------------------------------------------
// Helper: generate ring positions (elements equally spaced on a circle)
// ---------------------------------------------------------------------------
function ringPositions(
  count: number,
  cx = 50,
  cy = 50,
  rx = 30,
  ry = 30,
  startAngle = -90,
): Array<{ x: number; y: number }> {
  return Array.from({ length: count }, (_, i) => {
    const angle = startAngle + (360 / count) * i;
    const rad = (angle * Math.PI) / 180;
    return { x: cx + rx * Math.cos(rad), y: cy + ry * Math.sin(rad) };
  });
}

// ---------------------------------------------------------------------------
// 1. HashRing — ring layout, nodes on a consistent-hash circle
// ---------------------------------------------------------------------------
export const HashRingConfig: ConceptConfig = {
  layoutMode: 'ring',
  title: 'Consistent Hash Ring',
  elements: (() => {
    const pos = ringPositions(6);
    const labels = ['Node A', 'Node B', 'Node C', 'Key 1', 'Key 2', 'Key 3'];
    return labels.map((label, i) => ({
      id: `hr-${i}`,
      label,
      x: pos[i].x,
      y: pos[i].y,
      shape: i < 3 ? ('circle' as const) : ('diamond' as const),
      color: i < 3 ? COLORS.teal : COLORS.gold,
      size: i < 3 ? 90 : 60,
      beatIndex: i,
    }));
  })(),
  connections: [
    { from: 'hr-3', to: 'hr-0', label: 'maps to', color: COLORS.gold, beatIndex: 6, animated: true },
    { from: 'hr-4', to: 'hr-1', label: 'maps to', color: COLORS.gold, beatIndex: 7 },
    { from: 'hr-5', to: 'hr-2', label: 'maps to', color: COLORS.gold, beatIndex: 8 },
    { from: 'hr-0', to: 'hr-1', color: COLORS.gray, beatIndex: 3 },
    { from: 'hr-1', to: 'hr-2', color: COLORS.gray, beatIndex: 4 },
    { from: 'hr-2', to: 'hr-0', color: COLORS.gray, beatIndex: 5 },
  ],
};

// ---------------------------------------------------------------------------
// 2. TreeVisualization — tree layout, generic binary tree
// ---------------------------------------------------------------------------
export const TreeVisualizationConfig: ConceptConfig = {
  layoutMode: 'tree',
  title: 'Binary Tree',
  elements: [
    { id: 'root', label: '50', x: 50, y: 15, shape: 'circle', color: COLORS.saffron, size: 80, beatIndex: 0 },
    { id: 'l1', label: '30', x: 30, y: 35, shape: 'circle', color: COLORS.teal, size: 70, beatIndex: 1 },
    { id: 'r1', label: '70', x: 70, y: 35, shape: 'circle', color: COLORS.teal, size: 70, beatIndex: 1 },
    { id: 'l2', label: '20', x: 18, y: 55, shape: 'circle', color: COLORS.indigo, size: 65, beatIndex: 2 },
    { id: 'l3', label: '40', x: 42, y: 55, shape: 'circle', color: COLORS.indigo, size: 65, beatIndex: 2 },
    { id: 'r2', label: '60', x: 58, y: 55, shape: 'circle', color: COLORS.indigo, size: 65, beatIndex: 3 },
    { id: 'r3', label: '80', x: 82, y: 55, shape: 'circle', color: COLORS.indigo, size: 65, beatIndex: 3 },
  ],
  connections: [
    { from: 'root', to: 'l1', color: COLORS.saffron, beatIndex: 1 },
    { from: 'root', to: 'r1', color: COLORS.saffron, beatIndex: 1 },
    { from: 'l1', to: 'l2', color: COLORS.teal, beatIndex: 2 },
    { from: 'l1', to: 'l3', color: COLORS.teal, beatIndex: 2 },
    { from: 'r1', to: 'r2', color: COLORS.teal, beatIndex: 3 },
    { from: 'r1', to: 'r3', color: COLORS.teal, beatIndex: 3 },
  ],
};

// ---------------------------------------------------------------------------
// 3. GraphVisualization — freeform with edges
// ---------------------------------------------------------------------------
export const GraphVisualizationConfig: ConceptConfig = {
  layoutMode: 'freeform',
  title: 'Directed Graph',
  elements: [
    { id: 'g-a', label: 'A', x: 20, y: 30, shape: 'circle', color: COLORS.teal, size: 70, beatIndex: 0 },
    { id: 'g-b', label: 'B', x: 50, y: 15, shape: 'circle', color: COLORS.indigo, size: 70, beatIndex: 0 },
    { id: 'g-c', label: 'C', x: 80, y: 30, shape: 'circle', color: COLORS.saffron, size: 70, beatIndex: 1 },
    { id: 'g-d', label: 'D', x: 35, y: 60, shape: 'circle', color: COLORS.gold, size: 70, beatIndex: 1 },
    { id: 'g-e', label: 'E', x: 65, y: 60, shape: 'circle', color: COLORS.teal, size: 70, beatIndex: 2 },
    { id: 'g-f', label: 'F', x: 50, y: 82, shape: 'circle', color: COLORS.indigo, size: 70, beatIndex: 2 },
  ],
  connections: [
    { from: 'g-a', to: 'g-b', label: '4', color: COLORS.teal, beatIndex: 3 },
    { from: 'g-b', to: 'g-c', label: '2', color: COLORS.indigo, beatIndex: 3 },
    { from: 'g-a', to: 'g-d', label: '7', color: COLORS.teal, beatIndex: 4 },
    { from: 'g-d', to: 'g-e', label: '3', color: COLORS.gold, beatIndex: 4 },
    { from: 'g-c', to: 'g-e', label: '1', color: COLORS.saffron, beatIndex: 5 },
    { from: 'g-e', to: 'g-f', label: '5', color: COLORS.teal, beatIndex: 5 },
  ],
};

// ---------------------------------------------------------------------------
// 4. ThreadPoolViz — grid of workers + task queue
// ---------------------------------------------------------------------------
export const ThreadPoolVizConfig: ConceptConfig = {
  layoutMode: 'grid',
  title: 'Thread Pool',
  elements: [
    { id: 'tq', label: 'Task Queue', x: 50, y: 15, shape: 'box', color: COLORS.saffron, size: 100, beatIndex: 0 },
    { id: 'w1', label: 'Worker 1', x: 20, y: 40, shape: 'box', color: COLORS.teal, size: 80, beatIndex: 1 },
    { id: 'w2', label: 'Worker 2', x: 40, y: 40, shape: 'box', color: COLORS.teal, size: 80, beatIndex: 1 },
    { id: 'w3', label: 'Worker 3', x: 60, y: 40, shape: 'box', color: COLORS.teal, size: 80, beatIndex: 2 },
    { id: 'w4', label: 'Worker 4', x: 80, y: 40, shape: 'box', color: COLORS.teal, size: 80, beatIndex: 2 },
    { id: 't1', label: 'Task A', x: 25, y: 65, shape: 'diamond', color: COLORS.gold, size: 55, beatIndex: 3 },
    { id: 't2', label: 'Task B', x: 50, y: 65, shape: 'diamond', color: COLORS.gold, size: 55, beatIndex: 3 },
    { id: 't3', label: 'Task C', x: 75, y: 65, shape: 'diamond', color: COLORS.gold, size: 55, beatIndex: 4 },
  ],
  connections: [
    { from: 'tq', to: 'w1', label: 'dispatch', color: COLORS.saffron, beatIndex: 3, animated: true },
    { from: 'tq', to: 'w2', color: COLORS.saffron, beatIndex: 3 },
    { from: 'tq', to: 'w3', color: COLORS.saffron, beatIndex: 4 },
    { from: 'tq', to: 'w4', color: COLORS.saffron, beatIndex: 4 },
    { from: 'w1', to: 't1', label: 'exec', color: COLORS.teal, beatIndex: 5 },
    { from: 'w2', to: 't2', color: COLORS.teal, beatIndex: 5 },
  ],
};

// ---------------------------------------------------------------------------
// 5. MutexSemaphoreViz — state machine: locked/unlocked
// ---------------------------------------------------------------------------
export const MutexSemaphoreVizConfig: ConceptConfig = {
  layoutMode: 'stateMachine',
  title: 'Mutex State Machine',
  elements: [
    { id: 'unlocked', label: 'UNLOCKED', x: 25, y: 45, shape: 'box', color: COLORS.teal, size: 90, beatIndex: 0 },
    { id: 'locked', label: 'LOCKED', x: 75, y: 45, shape: 'box', color: COLORS.red, size: 90, beatIndex: 1 },
    { id: 'thread-a', label: 'Thread A', x: 50, y: 15, shape: 'circle', color: COLORS.indigo, size: 70, beatIndex: 2 },
    { id: 'thread-b', label: 'Thread B', x: 50, y: 75, shape: 'circle', color: COLORS.gold, size: 70, beatIndex: 2 },
    { id: 'cs', label: 'Critical Section', x: 75, y: 75, shape: 'diamond', color: COLORS.saffron, size: 70, beatIndex: 3 },
  ],
  connections: [
    { from: 'unlocked', to: 'locked', label: 'acquire()', color: COLORS.teal, beatIndex: 3, animated: true },
    { from: 'locked', to: 'unlocked', label: 'release()', color: COLORS.red, beatIndex: 4 },
    { from: 'thread-a', to: 'unlocked', label: 'request', color: COLORS.indigo, beatIndex: 5 },
    { from: 'thread-b', to: 'locked', label: 'blocked', color: COLORS.gold, beatIndex: 6 },
    { from: 'locked', to: 'cs', label: 'access', color: COLORS.saffron, beatIndex: 7 },
  ],
};

// ---------------------------------------------------------------------------
// 6. DeadlockViz — ring: 4 processes in circular wait
// ---------------------------------------------------------------------------
export const DeadlockVizConfig: ConceptConfig = {
  layoutMode: 'ring',
  title: 'Deadlock — Circular Wait',
  elements: (() => {
    const pos = ringPositions(4, 50, 50, 28, 28);
    const labels = ['Process A', 'Process B', 'Process C', 'Process D'];
    return labels.map((label, i) => ({
      id: `dl-${i}`,
      label,
      x: pos[i].x,
      y: pos[i].y,
      shape: 'box' as const,
      color: COLORS.red,
      size: 85,
      beatIndex: i,
    }));
  })(),
  connections: [
    { from: 'dl-0', to: 'dl-1', label: 'waits for R1', color: COLORS.red, beatIndex: 4, animated: true },
    { from: 'dl-1', to: 'dl-2', label: 'waits for R2', color: COLORS.red, beatIndex: 5, animated: true },
    { from: 'dl-2', to: 'dl-3', label: 'waits for R3', color: COLORS.red, beatIndex: 6, animated: true },
    { from: 'dl-3', to: 'dl-0', label: 'waits for R4', color: COLORS.red, beatIndex: 7, animated: true },
  ],
};

// ---------------------------------------------------------------------------
// 7. RateLimiterViz — grid: token bucket visualization
// ---------------------------------------------------------------------------
export const RateLimiterVizConfig: ConceptConfig = {
  layoutMode: 'grid',
  title: 'Token Bucket Rate Limiter',
  elements: [
    { id: 'bucket', label: 'Token Bucket', x: 50, y: 20, shape: 'box', color: COLORS.saffron, size: 100, beatIndex: 0 },
    { id: 'tk1', label: 'Token', x: 30, y: 40, shape: 'circle', color: COLORS.teal, size: 50, beatIndex: 1 },
    { id: 'tk2', label: 'Token', x: 50, y: 40, shape: 'circle', color: COLORS.teal, size: 50, beatIndex: 1 },
    { id: 'tk3', label: 'Token', x: 70, y: 40, shape: 'circle', color: COLORS.teal, size: 50, beatIndex: 2 },
    { id: 'req1', label: 'Request 1', x: 25, y: 65, shape: 'diamond', color: COLORS.gold, size: 55, beatIndex: 3 },
    { id: 'req2', label: 'Request 2', x: 50, y: 65, shape: 'diamond', color: COLORS.gold, size: 55, beatIndex: 3 },
    { id: 'req3', label: 'Request 3', x: 75, y: 65, shape: 'diamond', color: COLORS.red, size: 55, beatIndex: 4 },
    { id: 'refill', label: 'Refill Timer', x: 50, y: 88, shape: 'box', color: COLORS.indigo, size: 80, beatIndex: 5 },
  ],
  connections: [
    { from: 'bucket', to: 'tk1', color: COLORS.teal, beatIndex: 1 },
    { from: 'bucket', to: 'tk2', color: COLORS.teal, beatIndex: 1 },
    { from: 'tk1', to: 'req1', label: 'consume', color: COLORS.gold, beatIndex: 4, animated: true },
    { from: 'tk2', to: 'req2', label: 'consume', color: COLORS.gold, beatIndex: 5 },
    { from: 'refill', to: 'bucket', label: 'add tokens', color: COLORS.indigo, beatIndex: 6 },
  ],
};

// ---------------------------------------------------------------------------
// 8. PaginationViz — grid: data rows with sliding window
// ---------------------------------------------------------------------------
export const PaginationVizConfig: ConceptConfig = {
  layoutMode: 'grid',
  title: 'Cursor-Based Pagination',
  elements: [
    { id: 'pg-db', label: 'Database', x: 50, y: 12, shape: 'box', color: COLORS.indigo, size: 100, beatIndex: 0 },
    { id: 'pg-r1', label: 'Row 1-10', x: 20, y: 35, shape: 'box', color: COLORS.gray, size: 75, beatIndex: 1 },
    { id: 'pg-r2', label: 'Row 11-20', x: 40, y: 35, shape: 'box', color: COLORS.teal, size: 75, beatIndex: 1 },
    { id: 'pg-r3', label: 'Row 21-30', x: 60, y: 35, shape: 'box', color: COLORS.gray, size: 75, beatIndex: 2 },
    { id: 'pg-r4', label: 'Row 31-40', x: 80, y: 35, shape: 'box', color: COLORS.gray, size: 75, beatIndex: 2 },
    { id: 'pg-cursor', label: 'Cursor: id=20', x: 40, y: 58, shape: 'diamond', color: COLORS.saffron, size: 65, beatIndex: 3 },
    { id: 'pg-client', label: 'Client', x: 50, y: 80, shape: 'box', color: COLORS.gold, size: 85, beatIndex: 0 },
  ],
  connections: [
    { from: 'pg-client', to: 'pg-db', label: 'GET /items?cursor=20', color: COLORS.gold, beatIndex: 3, animated: true },
    { from: 'pg-db', to: 'pg-r2', label: 'fetch page', color: COLORS.teal, beatIndex: 4 },
    { from: 'pg-r2', to: 'pg-cursor', label: 'next cursor', color: COLORS.saffron, beatIndex: 5 },
    { from: 'pg-cursor', to: 'pg-r3', label: 'next page', color: COLORS.saffron, beatIndex: 6 },
  ],
};

// ---------------------------------------------------------------------------
// 9. BloomFilterViz — grid: bit array
// ---------------------------------------------------------------------------
export const BloomFilterVizConfig: ConceptConfig = {
  layoutMode: 'grid',
  title: 'Bloom Filter',
  elements: [
    { id: 'bf-input', label: 'Input "hello"', x: 50, y: 12, shape: 'box', color: COLORS.gold, size: 85, beatIndex: 0 },
    { id: 'bf-h1', label: 'Hash 1', x: 25, y: 32, shape: 'circle', color: COLORS.saffron, size: 60, beatIndex: 1 },
    { id: 'bf-h2', label: 'Hash 2', x: 50, y: 32, shape: 'circle', color: COLORS.teal, size: 60, beatIndex: 1 },
    { id: 'bf-h3', label: 'Hash 3', x: 75, y: 32, shape: 'circle', color: COLORS.indigo, size: 60, beatIndex: 2 },
    { id: 'bf-b0', label: '0', x: 15, y: 58, shape: 'box', color: COLORS.gray, size: 40, beatIndex: 3 },
    { id: 'bf-b1', label: '1', x: 30, y: 58, shape: 'box', color: COLORS.teal, size: 40, beatIndex: 3 },
    { id: 'bf-b2', label: '0', x: 45, y: 58, shape: 'box', color: COLORS.gray, size: 40, beatIndex: 3 },
    { id: 'bf-b3', label: '1', x: 60, y: 58, shape: 'box', color: COLORS.saffron, size: 40, beatIndex: 4 },
    { id: 'bf-b4', label: '0', x: 75, y: 58, shape: 'box', color: COLORS.gray, size: 40, beatIndex: 4 },
    { id: 'bf-b5', label: '1', x: 90, y: 58, shape: 'box', color: COLORS.indigo, size: 40, beatIndex: 4 },
  ],
  connections: [
    { from: 'bf-input', to: 'bf-h1', color: COLORS.gold, beatIndex: 1 },
    { from: 'bf-input', to: 'bf-h2', color: COLORS.gold, beatIndex: 1 },
    { from: 'bf-input', to: 'bf-h3', color: COLORS.gold, beatIndex: 2 },
    { from: 'bf-h1', to: 'bf-b1', label: 'set bit', color: COLORS.teal, beatIndex: 4, animated: true },
    { from: 'bf-h2', to: 'bf-b3', label: 'set bit', color: COLORS.saffron, beatIndex: 5 },
    { from: 'bf-h3', to: 'bf-b5', label: 'set bit', color: COLORS.indigo, beatIndex: 6 },
  ],
};

// ---------------------------------------------------------------------------
// 10. LRUCacheViz — timeline: doubly linked list nodes
// ---------------------------------------------------------------------------
export const LRUCacheVizConfig: ConceptConfig = {
  layoutMode: 'timeline',
  title: 'LRU Cache (Doubly Linked List)',
  elements: [
    { id: 'lru-head', label: 'HEAD', x: 10, y: 45, shape: 'box', color: COLORS.gray, size: 65, beatIndex: 0 },
    { id: 'lru-a', label: 'Key: A', x: 28, y: 45, shape: 'box', color: COLORS.teal, size: 70, beatIndex: 1 },
    { id: 'lru-b', label: 'Key: B', x: 46, y: 45, shape: 'box', color: COLORS.indigo, size: 70, beatIndex: 1 },
    { id: 'lru-c', label: 'Key: C', x: 64, y: 45, shape: 'box', color: COLORS.saffron, size: 70, beatIndex: 2 },
    { id: 'lru-tail', label: 'TAIL', x: 82, y: 45, shape: 'box', color: COLORS.gray, size: 65, beatIndex: 2 },
    { id: 'lru-map', label: 'HashMap', x: 50, y: 15, shape: 'box', color: COLORS.gold, size: 90, beatIndex: 0 },
    { id: 'lru-evict', label: 'Evict LRU', x: 82, y: 75, shape: 'diamond', color: COLORS.red, size: 60, beatIndex: 4 },
  ],
  connections: [
    { from: 'lru-head', to: 'lru-a', color: COLORS.gray, beatIndex: 1 },
    { from: 'lru-a', to: 'lru-b', color: COLORS.teal, beatIndex: 2 },
    { from: 'lru-b', to: 'lru-c', color: COLORS.indigo, beatIndex: 3 },
    { from: 'lru-c', to: 'lru-tail', color: COLORS.saffron, beatIndex: 3 },
    { from: 'lru-map', to: 'lru-b', label: 'O(1) lookup', color: COLORS.gold, beatIndex: 4, animated: true },
    { from: 'lru-tail', to: 'lru-evict', label: 'remove', color: COLORS.red, beatIndex: 5 },
  ],
};

// ---------------------------------------------------------------------------
// 11. SkipListViz — grid: multi-level linked list
// ---------------------------------------------------------------------------
export const SkipListVizConfig: ConceptConfig = {
  layoutMode: 'grid',
  title: 'Skip List',
  elements: [
    // Level 3 (express lane)
    { id: 'sl-3h', label: 'HEAD', x: 10, y: 20, shape: 'box', color: COLORS.saffron, size: 55, beatIndex: 0 },
    { id: 'sl-3a', label: '20', x: 50, y: 20, shape: 'circle', color: COLORS.saffron, size: 50, beatIndex: 1 },
    { id: 'sl-3t', label: 'NIL', x: 90, y: 20, shape: 'box', color: COLORS.gray, size: 50, beatIndex: 1 },
    // Level 2
    { id: 'sl-2h', label: 'HEAD', x: 10, y: 42, shape: 'box', color: COLORS.teal, size: 55, beatIndex: 0 },
    { id: 'sl-2a', label: '10', x: 30, y: 42, shape: 'circle', color: COLORS.teal, size: 50, beatIndex: 2 },
    { id: 'sl-2b', label: '20', x: 50, y: 42, shape: 'circle', color: COLORS.teal, size: 50, beatIndex: 2 },
    { id: 'sl-2t', label: 'NIL', x: 90, y: 42, shape: 'box', color: COLORS.gray, size: 50, beatIndex: 2 },
    // Level 1
    { id: 'sl-1h', label: 'HEAD', x: 10, y: 64, shape: 'box', color: COLORS.indigo, size: 55, beatIndex: 0 },
    { id: 'sl-1a', label: '5', x: 20, y: 64, shape: 'circle', color: COLORS.indigo, size: 50, beatIndex: 3 },
    { id: 'sl-1b', label: '10', x: 30, y: 64, shape: 'circle', color: COLORS.indigo, size: 50, beatIndex: 3 },
    { id: 'sl-1c', label: '15', x: 40, y: 64, shape: 'circle', color: COLORS.indigo, size: 50, beatIndex: 3 },
    { id: 'sl-1d', label: '20', x: 50, y: 64, shape: 'circle', color: COLORS.indigo, size: 50, beatIndex: 4 },
    { id: 'sl-1e', label: '25', x: 60, y: 64, shape: 'circle', color: COLORS.indigo, size: 50, beatIndex: 4 },
  ],
  connections: [
    { from: 'sl-3h', to: 'sl-3a', color: COLORS.saffron, beatIndex: 2 },
    { from: 'sl-3a', to: 'sl-3t', color: COLORS.saffron, beatIndex: 2 },
    { from: 'sl-2h', to: 'sl-2a', color: COLORS.teal, beatIndex: 3 },
    { from: 'sl-2a', to: 'sl-2b', color: COLORS.teal, beatIndex: 3 },
    { from: 'sl-2b', to: 'sl-2t', color: COLORS.teal, beatIndex: 4 },
    { from: 'sl-1h', to: 'sl-1a', color: COLORS.indigo, beatIndex: 5, animated: true },
  ],
};

// ---------------------------------------------------------------------------
// 12. MerkleTreeViz — tree: hash tree
// ---------------------------------------------------------------------------
export const MerkleTreeVizConfig: ConceptConfig = {
  layoutMode: 'tree',
  title: 'Merkle Tree',
  elements: [
    { id: 'mk-root', label: 'Root Hash', x: 50, y: 12, shape: 'box', color: COLORS.saffron, size: 90, beatIndex: 0 },
    { id: 'mk-h01', label: 'H(0-1)', x: 30, y: 35, shape: 'box', color: COLORS.teal, size: 75, beatIndex: 1 },
    { id: 'mk-h23', label: 'H(2-3)', x: 70, y: 35, shape: 'box', color: COLORS.teal, size: 75, beatIndex: 1 },
    { id: 'mk-d0', label: 'Data 0', x: 18, y: 58, shape: 'circle', color: COLORS.indigo, size: 60, beatIndex: 2 },
    { id: 'mk-d1', label: 'Data 1', x: 42, y: 58, shape: 'circle', color: COLORS.indigo, size: 60, beatIndex: 2 },
    { id: 'mk-d2', label: 'Data 2', x: 58, y: 58, shape: 'circle', color: COLORS.gold, size: 60, beatIndex: 3 },
    { id: 'mk-d3', label: 'Data 3', x: 82, y: 58, shape: 'circle', color: COLORS.gold, size: 60, beatIndex: 3 },
  ],
  connections: [
    { from: 'mk-root', to: 'mk-h01', color: COLORS.saffron, beatIndex: 1 },
    { from: 'mk-root', to: 'mk-h23', color: COLORS.saffron, beatIndex: 1 },
    { from: 'mk-h01', to: 'mk-d0', label: 'hash', color: COLORS.teal, beatIndex: 3, animated: true },
    { from: 'mk-h01', to: 'mk-d1', color: COLORS.teal, beatIndex: 3 },
    { from: 'mk-h23', to: 'mk-d2', color: COLORS.teal, beatIndex: 4 },
    { from: 'mk-h23', to: 'mk-d3', color: COLORS.teal, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// 13. BTreeViz — tree: multi-key B-tree nodes
// ---------------------------------------------------------------------------
export const BTreeVizConfig: ConceptConfig = {
  layoutMode: 'tree',
  title: 'B-Tree (Order 3)',
  elements: [
    { id: 'bt-root', label: '[15 | 30]', x: 50, y: 15, shape: 'box', color: COLORS.saffron, size: 95, beatIndex: 0 },
    { id: 'bt-l', label: '[5 | 10]', x: 20, y: 40, shape: 'box', color: COLORS.teal, size: 85, beatIndex: 1 },
    { id: 'bt-m', label: '[20 | 25]', x: 50, y: 40, shape: 'box', color: COLORS.indigo, size: 85, beatIndex: 1 },
    { id: 'bt-r', label: '[35 | 40]', x: 80, y: 40, shape: 'box', color: COLORS.gold, size: 85, beatIndex: 2 },
    { id: 'bt-ll', label: '[1 | 3]', x: 12, y: 65, shape: 'box', color: COLORS.gray, size: 70, beatIndex: 3 },
    { id: 'bt-lr', label: '[7 | 12]', x: 30, y: 65, shape: 'box', color: COLORS.gray, size: 70, beatIndex: 3 },
    { id: 'bt-ml', label: '[17 | 18]', x: 45, y: 65, shape: 'box', color: COLORS.gray, size: 70, beatIndex: 4 },
    { id: 'bt-mr', label: '[27 | 28]', x: 58, y: 65, shape: 'box', color: COLORS.gray, size: 70, beatIndex: 4 },
  ],
  connections: [
    { from: 'bt-root', to: 'bt-l', color: COLORS.saffron, beatIndex: 1 },
    { from: 'bt-root', to: 'bt-m', color: COLORS.saffron, beatIndex: 1 },
    { from: 'bt-root', to: 'bt-r', color: COLORS.saffron, beatIndex: 2 },
    { from: 'bt-l', to: 'bt-ll', color: COLORS.teal, beatIndex: 3 },
    { from: 'bt-l', to: 'bt-lr', color: COLORS.teal, beatIndex: 3 },
    { from: 'bt-m', to: 'bt-ml', color: COLORS.indigo, beatIndex: 4, animated: true },
  ],
};

// ---------------------------------------------------------------------------
// 14. FileSystemViz — tree: directory structure
// ---------------------------------------------------------------------------
export const FileSystemVizConfig: ConceptConfig = {
  layoutMode: 'tree',
  title: 'File System Tree',
  elements: [
    { id: 'fs-root', label: '/', x: 50, y: 10, shape: 'box', color: COLORS.saffron, size: 70, beatIndex: 0 },
    { id: 'fs-home', label: '/home', x: 25, y: 30, shape: 'box', color: COLORS.teal, size: 70, beatIndex: 1 },
    { id: 'fs-etc', label: '/etc', x: 50, y: 30, shape: 'box', color: COLORS.indigo, size: 70, beatIndex: 1 },
    { id: 'fs-var', label: '/var', x: 75, y: 30, shape: 'box', color: COLORS.gold, size: 70, beatIndex: 2 },
    { id: 'fs-user', label: 'user/', x: 18, y: 52, shape: 'box', color: COLORS.teal, size: 65, beatIndex: 3 },
    { id: 'fs-docs', label: 'docs/', x: 35, y: 52, shape: 'box', color: COLORS.teal, size: 65, beatIndex: 3 },
    { id: 'fs-nginx', label: 'nginx.conf', x: 50, y: 52, shape: 'diamond', color: COLORS.indigo, size: 55, beatIndex: 4 },
    { id: 'fs-log', label: 'log/', x: 75, y: 52, shape: 'box', color: COLORS.gold, size: 65, beatIndex: 4 },
  ],
  connections: [
    { from: 'fs-root', to: 'fs-home', color: COLORS.saffron, beatIndex: 1 },
    { from: 'fs-root', to: 'fs-etc', color: COLORS.saffron, beatIndex: 1 },
    { from: 'fs-root', to: 'fs-var', color: COLORS.saffron, beatIndex: 2 },
    { from: 'fs-home', to: 'fs-user', color: COLORS.teal, beatIndex: 3 },
    { from: 'fs-home', to: 'fs-docs', color: COLORS.teal, beatIndex: 3 },
    { from: 'fs-etc', to: 'fs-nginx', color: COLORS.indigo, beatIndex: 4 },
  ],
};

// ---------------------------------------------------------------------------
// 15. LeaderElectionViz — ring: election process
// ---------------------------------------------------------------------------
export const LeaderElectionVizConfig: ConceptConfig = {
  layoutMode: 'ring',
  title: 'Leader Election (Bully Algorithm)',
  elements: (() => {
    const pos = ringPositions(5);
    const labels = ['Node 1', 'Node 2', 'Node 3\n(Leader)', 'Node 4', 'Node 5'];
    const colors = [COLORS.teal, COLORS.teal, COLORS.saffron, COLORS.teal, COLORS.gray];
    return labels.map((label, i) => ({
      id: `le-${i}`,
      label,
      x: pos[i].x,
      y: pos[i].y,
      shape: 'circle' as const,
      color: colors[i],
      size: i === 2 ? 95 : 75,
      beatIndex: i,
    }));
  })(),
  connections: [
    { from: 'le-0', to: 'le-2', label: 'election msg', color: COLORS.teal, beatIndex: 5, animated: true },
    { from: 'le-1', to: 'le-2', label: 'election msg', color: COLORS.teal, beatIndex: 5 },
    { from: 'le-2', to: 'le-0', label: 'coordinator', color: COLORS.saffron, beatIndex: 6 },
    { from: 'le-2', to: 'le-1', label: 'coordinator', color: COLORS.saffron, beatIndex: 7 },
    { from: 'le-2', to: 'le-3', label: 'coordinator', color: COLORS.saffron, beatIndex: 7 },
  ],
};

// ---------------------------------------------------------------------------
// 16. GossipProtocolViz — grid: epidemic spread
// ---------------------------------------------------------------------------
export const GossipProtocolVizConfig: ConceptConfig = {
  layoutMode: 'grid',
  title: 'Gossip Protocol (Epidemic Spread)',
  elements: [
    { id: 'gp-0', label: 'Node A\n(infected)', x: 20, y: 25, shape: 'circle', color: COLORS.saffron, size: 75, beatIndex: 0 },
    { id: 'gp-1', label: 'Node B', x: 50, y: 25, shape: 'circle', color: COLORS.gray, size: 75, beatIndex: 0 },
    { id: 'gp-2', label: 'Node C', x: 80, y: 25, shape: 'circle', color: COLORS.gray, size: 75, beatIndex: 0 },
    { id: 'gp-3', label: 'Node D', x: 20, y: 60, shape: 'circle', color: COLORS.gray, size: 75, beatIndex: 1 },
    { id: 'gp-4', label: 'Node E', x: 50, y: 60, shape: 'circle', color: COLORS.gray, size: 75, beatIndex: 1 },
    { id: 'gp-5', label: 'Node F', x: 80, y: 60, shape: 'circle', color: COLORS.gray, size: 75, beatIndex: 1 },
  ],
  connections: [
    { from: 'gp-0', to: 'gp-1', label: 'gossip', color: COLORS.saffron, beatIndex: 2, animated: true },
    { from: 'gp-0', to: 'gp-3', label: 'gossip', color: COLORS.saffron, beatIndex: 3, animated: true },
    { from: 'gp-1', to: 'gp-2', label: 'spread', color: COLORS.teal, beatIndex: 4, animated: true },
    { from: 'gp-1', to: 'gp-4', label: 'spread', color: COLORS.teal, beatIndex: 5, animated: true },
    { from: 'gp-3', to: 'gp-5', label: 'spread', color: COLORS.teal, beatIndex: 6, animated: true },
  ],
};

// ---------------------------------------------------------------------------
// 17. VectorClockViz — timeline: parallel processes
// ---------------------------------------------------------------------------
export const VectorClockVizConfig: ConceptConfig = {
  layoutMode: 'timeline',
  title: 'Vector Clocks',
  elements: [
    { id: 'vc-p1-label', label: 'Process 1', x: 8, y: 25, shape: 'box', color: COLORS.teal, size: 70, beatIndex: 0 },
    { id: 'vc-p2-label', label: 'Process 2', x: 8, y: 50, shape: 'box', color: COLORS.indigo, size: 70, beatIndex: 0 },
    { id: 'vc-p3-label', label: 'Process 3', x: 8, y: 75, shape: 'box', color: COLORS.saffron, size: 70, beatIndex: 0 },
    { id: 'vc-e1', label: '[1,0,0]', x: 30, y: 25, shape: 'circle', color: COLORS.teal, size: 60, beatIndex: 1 },
    { id: 'vc-e2', label: '[2,0,0]', x: 55, y: 25, shape: 'circle', color: COLORS.teal, size: 60, beatIndex: 2 },
    { id: 'vc-e3', label: '[0,1,0]', x: 35, y: 50, shape: 'circle', color: COLORS.indigo, size: 60, beatIndex: 1 },
    { id: 'vc-e4', label: '[2,2,0]', x: 65, y: 50, shape: 'circle', color: COLORS.indigo, size: 60, beatIndex: 3 },
    { id: 'vc-e5', label: '[0,0,1]', x: 45, y: 75, shape: 'circle', color: COLORS.saffron, size: 60, beatIndex: 2 },
  ],
  connections: [
    { from: 'vc-e1', to: 'vc-e2', color: COLORS.teal, beatIndex: 2 },
    { from: 'vc-e3', to: 'vc-e4', color: COLORS.indigo, beatIndex: 3 },
    { from: 'vc-e2', to: 'vc-e4', label: 'send msg', color: COLORS.gold, beatIndex: 4, animated: true },
    { from: 'vc-e5', to: 'vc-e4', label: 'send msg', color: COLORS.gold, beatIndex: 5, animated: true },
  ],
};

// ---------------------------------------------------------------------------
// 18. RaftConsensusViz — ring: leader + followers
// ---------------------------------------------------------------------------
export const RaftConsensusVizConfig: ConceptConfig = {
  layoutMode: 'ring',
  title: 'Raft Consensus',
  elements: (() => {
    const pos = ringPositions(5);
    const labels = ['Leader', 'Follower 1', 'Follower 2', 'Follower 3', 'Follower 4'];
    const colors = [COLORS.saffron, COLORS.teal, COLORS.teal, COLORS.teal, COLORS.gray];
    return labels.map((label, i) => ({
      id: `raft-${i}`,
      label,
      x: pos[i].x,
      y: pos[i].y,
      shape: 'circle' as const,
      color: colors[i],
      size: i === 0 ? 100 : 75,
      beatIndex: i,
    }));
  })(),
  connections: [
    { from: 'raft-0', to: 'raft-1', label: 'AppendEntries', color: COLORS.saffron, beatIndex: 5, animated: true },
    { from: 'raft-0', to: 'raft-2', label: 'AppendEntries', color: COLORS.saffron, beatIndex: 5 },
    { from: 'raft-0', to: 'raft-3', label: 'AppendEntries', color: COLORS.saffron, beatIndex: 6 },
    { from: 'raft-1', to: 'raft-0', label: 'ACK', color: COLORS.teal, beatIndex: 7 },
    { from: 'raft-2', to: 'raft-0', label: 'ACK', color: COLORS.teal, beatIndex: 7 },
    { from: 'raft-3', to: 'raft-0', label: 'ACK (majority)', color: COLORS.teal, beatIndex: 8 },
  ],
};

// ---------------------------------------------------------------------------
// Master lookup: slug -> config
// ---------------------------------------------------------------------------
export const CONCEPT_CONFIGS: Record<string, ConceptConfig> = {
  'hash-ring': HashRingConfig,
  'consistent-hashing': HashRingConfig,
  'tree-visualization': TreeVisualizationConfig,
  'binary-tree': TreeVisualizationConfig,
  'graph-visualization': GraphVisualizationConfig,
  'graph': GraphVisualizationConfig,
  'thread-pool': ThreadPoolVizConfig,
  'mutex-semaphore': MutexSemaphoreVizConfig,
  'mutex': MutexSemaphoreVizConfig,
  'deadlock': DeadlockVizConfig,
  'rate-limiter': RateLimiterVizConfig,
  'token-bucket': RateLimiterVizConfig,
  'pagination': PaginationVizConfig,
  'cursor-pagination': PaginationVizConfig,
  'bloom-filter': BloomFilterVizConfig,
  'lru-cache': LRUCacheVizConfig,
  'skip-list': SkipListVizConfig,
  'merkle-tree': MerkleTreeVizConfig,
  'b-tree': BTreeVizConfig,
  'btree': BTreeVizConfig,
  'file-system': FileSystemVizConfig,
  'leader-election': LeaderElectionVizConfig,
  'bully-algorithm': LeaderElectionVizConfig,
  'gossip-protocol': GossipProtocolVizConfig,
  'vector-clock': VectorClockVizConfig,
  'vector-clocks': VectorClockVizConfig,
  'raft-consensus': RaftConsensusVizConfig,
  'raft': RaftConsensusVizConfig,
};
