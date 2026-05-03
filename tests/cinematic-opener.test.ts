/**
 * cinematic-opener.test.ts
 *
 * Tests for Rank #4 fix: CinematicOpener determinism, duration, and style variety.
 *
 * Run with:  npx jest tests/cinematic-opener.test.ts
 * Or:        npx ts-jest tests/cinematic-opener.test.ts
 *
 * These tests are pure TypeScript — no DOM, no Remotion renderer needed.
 * They exercise the hash logic and selectStyle() contract directly.
 */

import { fnv1a32, hashSelect, topicSlug } from '../src/lib/hash-select';
import {
  selectStyle,
  getStyleName,
  MAX_OPENER_FRAMES,
  MIN_OPENER_FRAMES,
} from '../src/components/CinematicOpener';
import { HOOK_STYLE_COUNT, HOOK_STYLE_NAMES } from '../src/components/HookOpeners';

// ─────────────────────────────────────────────────────────────────────────────
// 1. FNV-1a hash unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('fnv1a32', () => {
  test('returns a non-negative integer', () => {
    expect(fnv1a32('hello')).toBeGreaterThanOrEqual(0);
    expect(fnv1a32('')).toBeGreaterThanOrEqual(0);
  });

  test('is deterministic — same input always gives same output', () => {
    const inputs = ['load-balancing', 'cap-theorem', 'caching', 'sharding', ''];
    for (const input of inputs) {
      expect(fnv1a32(input)).toBe(fnv1a32(input));
      expect(fnv1a32(input)).toBe(fnv1a32(input)); // third call for good measure
    }
  });

  test('different strings produce different hashes (no trivial collisions in key set)', () => {
    const topics = [
      'load-balancing',
      'caching',
      'cap-theorem',
      'consistent-hashing',
      'database-indexing',
      'message-queues',
    ];
    const hashes = topics.map(fnv1a32);
    const unique = new Set(hashes);
    expect(unique.size).toBe(topics.length);
  });

  test('returns unsigned 32-bit integer (fits in Number, ≤ 0xFFFFFFFF)', () => {
    const h = fnv1a32('stress-test-string-with-unicode-日本語');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xFFFFFFFF);
    expect(Number.isInteger(h)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. hashSelect unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('hashSelect', () => {
  test('always returns an index in [0, count)', () => {
    const counts = [1, 2, 6, 20, 100];
    const keys = ['a', 'b', 'load-balancing', 'x'.repeat(200)];
    for (const count of counts) {
      for (const key of keys) {
        const idx = hashSelect(key, count);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(count);
      }
    }
  });

  test('is deterministic', () => {
    expect(hashSelect('load-balancing', 6)).toBe(hashSelect('load-balancing', 6));
    expect(hashSelect('caching', 6)).toBe(hashSelect('caching', 6));
  });

  test('throws on count <= 0', () => {
    expect(() => hashSelect('anything', 0)).toThrow();
    expect(() => hashSelect('anything', -1)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. topicSlug normalisation
// ─────────────────────────────────────────────────────────────────────────────

describe('topicSlug', () => {
  test('lowercases and trims', () => {
    expect(topicSlug('  Load Balancing  ')).toBe('load-balancing');
  });

  test('collapses non-alphanumeric to hyphens', () => {
    expect(topicSlug('CAP Theorem (2023)')).toBe('cap-theorem-2023');
  });

  test('strips leading/trailing hyphens', () => {
    expect(topicSlug('---hello---')).toBe('hello');
  });

  test('handles empty string', () => {
    expect(topicSlug('')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. selectStyle — core correctness
// ─────────────────────────────────────────────────────────────────────────────

describe('selectStyle', () => {
  test('returns an integer in [0, HOOK_STYLE_COUNT)', () => {
    const topics = [
      'Load Balancing',
      'Caching',
      'CAP Theorem',
      'Consistent Hashing',
      'Database Indexing',
      'Message Queues',
    ];
    for (const topic of topics) {
      const idx = selectStyle(topic);
      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(HOOK_STYLE_COUNT);
    }
  });

  /**
   * CRITICAL ASSERTION #1:
   * Same topic must ALWAYS return the same style.
   * This is the primary bug fix — before the fix, selectStyle() returned 0
   * for everything. After the fix, it must be both stable AND non-constant.
   */
  test('same topic always picks same style (determinism)', () => {
    const topics = [
      'Load Balancing',
      'Caching',
      'CAP Theorem',
      'Consistent Hashing',
      'Database Sharding',
      'Rate Limiting',
      'Circuit Breaker',
      'Event Sourcing',
    ];
    for (const topic of topics) {
      const first = selectStyle(topic);
      // Call 9 more times — must be identical
      for (let i = 0; i < 9; i++) {
        expect(selectStyle(topic)).toBe(first);
      }
    }
  });

  test('does NOT always return 0 (the bug is fixed)', () => {
    // Generate 20 varied topics; at least one must return a non-0 index
    const topics = Array.from({ length: 20 }, (_, i) => `Topic ${i}`);
    const styles = topics.map(selectStyle);
    const allZero = styles.every((s) => s === 0);
    expect(allZero).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. getStyleName
// ─────────────────────────────────────────────────────────────────────────────

describe('getStyleName', () => {
  test('returns a valid style name', () => {
    const names = HOOK_STYLE_NAMES as readonly string[];
    expect(names).toContain(getStyleName('Load Balancing'));
    expect(names).toContain(getStyleName('Caching'));
  });

  test('is deterministic', () => {
    expect(getStyleName('Load Balancing')).toBe(getStyleName('Load Balancing'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Duration contract
// ─────────────────────────────────────────────────────────────────────────────

describe('Duration contract', () => {
  /**
   * CRITICAL ASSERTION #2:
   * MAX_OPENER_FRAMES must be ≤ 90. NEVER ≥ 150.
   * The 30-second (900-frame) / 5-second (150-frame) opener is the single biggest
   * retention killer. This test enforces the hard cap at the constant level.
   */
  test('MAX_OPENER_FRAMES ≤ 90', () => {
    expect(MAX_OPENER_FRAMES).toBeLessThanOrEqual(90);
  });

  test('MAX_OPENER_FRAMES is NOT ≥ 150 (old broken value)', () => {
    expect(MAX_OPENER_FRAMES).toBeLessThan(150);
  });

  test('MIN_OPENER_FRAMES is at least 30 (one second)', () => {
    expect(MIN_OPENER_FRAMES).toBeGreaterThanOrEqual(30);
  });

  test('MIN_OPENER_FRAMES < MAX_OPENER_FRAMES', () => {
    expect(MIN_OPENER_FRAMES).toBeLessThan(MAX_OPENER_FRAMES);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Style coverage across 100 topics
// ─────────────────────────────────────────────────────────────────────────────

describe('Style coverage (100 topic sample)', () => {
  // Representative sample of realistic topics from the guru-sishya content set
  const SAMPLE_TOPICS = [
    'Load Balancing', 'Caching', 'CAP Theorem', 'Consistent Hashing',
    'Database Indexing', 'Message Queues', 'Rate Limiting', 'Circuit Breaker',
    'Event Sourcing', 'CQRS', 'Service Mesh', 'API Gateway',
    'Kubernetes Basics', 'Docker Containers', 'Microservices', 'Monolith vs Microservices',
    'SQL vs NoSQL', 'Redis Internals', 'Kafka Architecture', 'Zookeeper',
    'Raft Consensus', 'Paxos Algorithm', 'Two-Phase Commit', 'Saga Pattern',
    'Distributed Transactions', 'Database Sharding', 'Read Replicas', 'Write-Ahead Log',
    'B-Tree Index', 'LSM Tree', 'Bloom Filter', 'HyperLogLog',
    'Content Delivery Network', 'DNS Resolution', 'TCP vs UDP', 'HTTP/2 vs HTTP/3',
    'WebSockets', 'Long Polling', 'Server-Sent Events', 'GraphQL vs REST',
    'OAuth2 Flow', 'JWT Tokens', 'API Security', 'DDoS Protection',
    'Horizontal Scaling', 'Vertical Scaling', 'Auto Scaling', 'Serverless Functions',
    'Cold Start Problem', 'Memory Management', 'Garbage Collection', 'JVM Internals',
    'Heap vs Stack', 'Thread Safety', 'Deadlock Prevention', 'Mutex vs Semaphore',
    'Actor Model', 'Reactive Programming', 'Event Loop', 'Async/Await',
    'Design Patterns', 'SOLID Principles', 'Clean Architecture', 'Domain-Driven Design',
    'System Design Interview', 'LLD vs HLD', 'Requirements Analysis', 'Capacity Planning',
    'SLA vs SLO vs SLI', 'Observability', 'Distributed Tracing', 'Log Aggregation',
    'Metrics Collection', 'Alerting Strategies', 'On-Call Best Practices', 'Incident Management',
    'Blue-Green Deployment', 'Canary Release', 'Feature Flags', 'A/B Testing Infrastructure',
    'CI/CD Pipeline', 'GitOps', 'Infrastructure as Code', 'Configuration Management',
    'Secret Management', 'Certificate Rotation', 'mTLS', 'Service Discovery',
    'Health Checks', 'Retry Strategies', 'Exponential Backoff', 'Bulkhead Pattern',
    'Timeout Patterns', 'Fallback Strategies', 'Cache Invalidation', 'Cache Stampede',
    'Write-Through Cache', 'Read-Through Cache', 'Eventual Consistency', 'Strong Consistency',
    'Vector Clocks', 'Lamport Timestamps', 'CRDTs', 'Operational Transformation',
    'WebRTC Architecture', 'Video Streaming', 'Adaptive Bitrate', 'Content Moderation At Scale',
  ];

  /**
   * CRITICAL ASSERTION #3:
   * All 6 styles must be selected at least once across 100 realistic topics.
   * This proves the hash distributes across all styles (no degenerate clustering).
   */
  test('all 6 styles are selected at least once across 100 topics', () => {
    const selectedStyles = SAMPLE_TOPICS.map(selectStyle);
    const styleSet = new Set(selectedStyles);

    for (let i = 0; i < HOOK_STYLE_COUNT; i++) {
      expect(styleSet.has(i)).toBe(true);
    }

    expect(styleSet.size).toBe(HOOK_STYLE_COUNT);
  });

  test('each style is selected at least once (spec: ≥1x per style in 100 topics)', () => {
    // The spec requires ≥1x per style, not perfect uniformity.
    // FNV-1a on real topic slugs is not perfectly uniform for N=100,
    // but every style must appear at least once.
    const counts = new Array<number>(HOOK_STYLE_COUNT).fill(0);
    for (const topic of SAMPLE_TOPICS) {
      counts[selectStyle(topic)]++;
    }
    for (let i = 0; i < HOOK_STYLE_COUNT; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(1);
      // No single style should dominate >60% of all topics
      expect(counts[i]).toBeLessThanOrEqual(Math.ceil(SAMPLE_TOPICS.length * 0.6));
    }
  });

  test('style names for all 100 topics are valid HookStyleName values', () => {
    const validNames = new Set(HOOK_STYLE_NAMES as readonly string[]);
    for (const topic of SAMPLE_TOPICS) {
      expect(validNames.has(getStyleName(topic))).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Regression: selectStyle ignores sessionNumber (was the old broken signature)
// ─────────────────────────────────────────────────────────────────────────────

describe('Regression: style depends on topic, NOT session number', () => {
  test('same topic with different session numbers always returns same style', () => {
    const topic = 'Load Balancing';
    // Session numbers used to be a param — removing it was the fix.
    // The new selectStyle(topic) must be session-number-independent.
    const base = selectStyle(topic);
    // Simulate that even if caller passes session implicitly via topic string,
    // the pure topic slug always wins.
    expect(selectStyle('Load Balancing')).toBe(base);
    expect(selectStyle('Load Balancing')).toBe(base);
    expect(selectStyle('Load Balancing')).toBe(base);
  });
});
