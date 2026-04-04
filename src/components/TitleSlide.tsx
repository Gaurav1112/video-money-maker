import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring, Easing } from 'remotion';
import { COLORS, FONTS, SIZES } from '../lib/theme';
import { AnimatedBox } from './viz/AnimatedBox';
import { AnimatedArrow } from './viz/AnimatedArrow';

interface TitleSlideProps {
  topic?: string;
  sessionNumber?: number;
  totalSessions?: number;
  title?: string;
  objectives?: string[];
  language?: string;
  hookText?: string;
  /** Topic stats line, e.g. "12 Sessions * 45 Questions * Python & Java" */
  stats?: string;
  /** Duration label, e.g. "8 min deep dive" */
  durationLabel?: string;
}

// ════════════════════════════════════════════════════════════════════════════════
// TOPIC-SPECIFIC VISUALS — unique labels, colors, questions per topic
// ════════════════════════════════════════════════════════════════════════════════
interface TopicVisualConfig {
  problemLabel: string;       // Phase 1: What problem text to show
  problemIcon: string;        // Phase 1: What icon/emoji
  problemColor: string;       // Phase 1: Flash color
  questionText: string;       // Phase 2: What the interviewer asks
  solutionLabels: string[];   // Phase 3: What architecture boxes to show
  solutionColor: string;      // Phase 3: Success color
}

const TOPIC_VISUALS: Record<string, TopicVisualConfig> = {
  'api gateway': {
    problemLabel: 'CLIENTS LOST',
    problemIcon: '\u{1F50C}',
    problemColor: '#E74C3C',
    questionText: 'Design an API Gateway',
    solutionLabels: ['Gateway', 'Auth', 'Rate Limit', 'Routing'],
    solutionColor: '#1DD1A1',
  },
  'caching': {
    problemLabel: 'DATABASE OVERLOADED',
    problemIcon: '\u{1F422}',
    problemColor: '#F39C12',
    questionText: 'How would you add caching?',
    solutionLabels: ['Cache Layer', 'TTL', 'Eviction', 'Invalidation'],
    solutionColor: '#FDB813',
  },
  'load balancing': {
    problemLabel: 'SERVER CRASHED',
    problemIcon: '\u{1F4A5}',
    problemColor: '#E74C3C',
    questionText: 'Design a load balancer',
    solutionLabels: ['Load Balancer', 'Health Check', 'Round Robin', 'Failover'],
    solutionColor: '#1DD1A1',
  },
  'database': {
    problemLabel: 'DATA CORRUPTED',
    problemIcon: '\u{1F5C3}',
    problemColor: '#8E44AD',
    questionText: 'Design the database layer',
    solutionLabels: ['Primary DB', 'Replica', 'Sharding', 'Backup'],
    solutionColor: '#A78BFA',
  },
  'microservices': {
    problemLabel: 'MONOLITH BREAKING',
    problemIcon: '\u{1F9F1}',
    problemColor: '#E74C3C',
    questionText: 'When to use microservices?',
    solutionLabels: ['Service A', 'Service B', 'API Gateway', 'Message Bus'],
    solutionColor: '#1DD1A1',
  },
  'message queue': {
    problemLabel: 'MESSAGES DROPPED',
    problemIcon: '\u{1F4E8}',
    problemColor: '#E74C3C',
    questionText: 'Design a message queue',
    solutionLabels: ['Producer', 'Queue', 'Consumer', 'DLQ'],
    solutionColor: '#F472B6',
  },
  'distributed': {
    problemLabel: 'NETWORK PARTITION',
    problemIcon: '\u{1F310}',
    problemColor: '#3498DB',
    questionText: 'Handle distributed failures',
    solutionLabels: ['Node A', 'Node B', 'Consensus', 'Replication'],
    solutionColor: '#1DD1A1',
  },
  'authentication': {
    problemLabel: 'SECURITY BREACH',
    problemIcon: '\u{1F513}',
    problemColor: '#E74C3C',
    questionText: 'Design auth system',
    solutionLabels: ['Auth Server', 'JWT', 'OAuth', 'Session'],
    solutionColor: '#27AE60',
  },
  'rate limiting': {
    problemLabel: 'API ABUSED',
    problemIcon: '\u{1F6AB}',
    problemColor: '#E74C3C',
    questionText: 'Implement rate limiting',
    solutionLabels: ['Token Bucket', 'Sliding Window', 'Counter', 'Throttle'],
    solutionColor: '#F39C12',
  },
  'consistent hashing': {
    problemLabel: 'REBALANCING CHAOS',
    problemIcon: '\u{1F504}',
    problemColor: '#F39C12',
    questionText: 'Explain consistent hashing',
    solutionLabels: ['Hash Ring', 'Virtual Nodes', 'Partition', 'Rebalance'],
    solutionColor: '#1DD1A1',
  },
  'circuit breaker': {
    problemLabel: 'CASCADE FAILURE',
    problemIcon: '\u{26A1}',
    problemColor: '#E74C3C',
    questionText: 'What is a circuit breaker?',
    solutionLabels: ['Closed', 'Open', 'Half-Open', 'Fallback'],
    solutionColor: '#1DD1A1',
  },
  'service discovery': {
    problemLabel: 'SERVICES UNREACHABLE',
    problemIcon: '\u{1F50D}',
    problemColor: '#E74C3C',
    questionText: 'Implement service discovery',
    solutionLabels: ['Registry', 'Health Check', 'DNS', 'Load Balancer'],
    solutionColor: '#3498DB',
  },
  'dns': {
    problemLabel: 'DOMAIN NOT FOUND',
    problemIcon: '\u{1F30D}',
    problemColor: '#E74C3C',
    questionText: 'How does DNS work?',
    solutionLabels: ['Resolver', 'Root NS', 'TLD NS', 'Auth NS'],
    solutionColor: '#3498DB',
  },
  'http': {
    problemLabel: 'REQUEST FAILED',
    problemIcon: '\u{1F4E1}',
    problemColor: '#E74C3C',
    questionText: 'Explain the HTTP lifecycle',
    solutionLabels: ['Client', 'TCP Handshake', 'Request', 'Response'],
    solutionColor: '#1DD1A1',
  },
  'tcp': {
    problemLabel: 'PACKETS LOST',
    problemIcon: '\u{1F4E6}',
    problemColor: '#E74C3C',
    questionText: 'How does TCP guarantee delivery?',
    solutionLabels: ['SYN', 'SYN-ACK', 'ACK', 'Data Transfer'],
    solutionColor: '#3498DB',
  },
  'websocket': {
    problemLabel: 'CONNECTION DROPPED',
    problemIcon: '\u{1F517}',
    problemColor: '#E74C3C',
    questionText: 'When to use WebSockets?',
    solutionLabels: ['Handshake', 'Upgrade', 'Full Duplex', 'Heartbeat'],
    solutionColor: '#1DD1A1',
  },
  'docker': {
    problemLabel: 'DEPENDENCY HELL',
    problemIcon: '\u{1F4E6}',
    problemColor: '#2496ED',
    questionText: 'Why use containers?',
    solutionLabels: ['Image', 'Container', 'Volume', 'Network'],
    solutionColor: '#2496ED',
  },
  'kubernetes': {
    problemLabel: 'ORCHESTRATION CHAOS',
    problemIcon: '\u{2388}',
    problemColor: '#326CE5',
    questionText: 'How does K8s orchestrate?',
    solutionLabels: ['Pod', 'Service', 'Deployment', 'Ingress'],
    solutionColor: '#326CE5',
  },
  'cdn': {
    problemLabel: 'HIGH LATENCY',
    problemIcon: '\u{1F30D}',
    problemColor: '#F39C12',
    questionText: 'How does a CDN work?',
    solutionLabels: ['Origin', 'Edge Node', 'Cache', 'PoP'],
    solutionColor: '#1DD1A1',
  },
  'reverse proxy': {
    problemLabel: 'EXPOSED SERVERS',
    problemIcon: '\u{1F6E1}',
    problemColor: '#E74C3C',
    questionText: 'What is a reverse proxy?',
    solutionLabels: ['Proxy', 'SSL Termination', 'Routing', 'Caching'],
    solutionColor: '#1DD1A1',
  },
  'sharding': {
    problemLabel: 'TABLE TOO LARGE',
    problemIcon: '\u{1FA93}',
    problemColor: '#8E44AD',
    questionText: 'When to shard a database?',
    solutionLabels: ['Shard Key', 'Shard 1', 'Shard 2', 'Router'],
    solutionColor: '#A78BFA',
  },
  'replication': {
    problemLabel: 'SINGLE POINT OF FAILURE',
    problemIcon: '\u{1F4CB}',
    problemColor: '#E74C3C',
    questionText: 'Explain database replication',
    solutionLabels: ['Primary', 'Replica 1', 'Replica 2', 'Sync'],
    solutionColor: '#1DD1A1',
  },
  'indexing': {
    problemLabel: 'FULL TABLE SCAN',
    problemIcon: '\u{1F50D}',
    problemColor: '#F39C12',
    questionText: 'How do indexes speed queries?',
    solutionLabels: ['B-Tree Index', 'Hash Index', 'Query', 'Result'],
    solutionColor: '#FDB813',
  },
  'sql': {
    problemLabel: 'QUERY TIMEOUT',
    problemIcon: '\u{1F4CA}',
    problemColor: '#3498DB',
    questionText: 'SQL vs NoSQL tradeoffs?',
    solutionLabels: ['Schema', 'ACID', 'Joins', 'Normalization'],
    solutionColor: '#3498DB',
  },
  'nosql': {
    problemLabel: 'RIGID SCHEMA',
    problemIcon: '\u{1F4C4}',
    problemColor: '#27AE60',
    questionText: 'When to choose NoSQL?',
    solutionLabels: ['Document', 'Key-Value', 'Column', 'Graph'],
    solutionColor: '#27AE60',
  },
  'concurrency': {
    problemLabel: 'RACE CONDITION',
    problemIcon: '\u{1F3C1}',
    problemColor: '#E74C3C',
    questionText: 'Handle concurrent access',
    solutionLabels: ['Lock', 'Semaphore', 'CAS', 'Thread Pool'],
    solutionColor: '#1DD1A1',
  },
  'deadlock': {
    problemLabel: 'SYSTEM FROZEN',
    problemIcon: '\u{1F9CA}',
    problemColor: '#E74C3C',
    questionText: 'How to prevent deadlocks?',
    solutionLabels: ['Detection', 'Prevention', 'Avoidance', 'Recovery'],
    solutionColor: '#1DD1A1',
  },
  'mutex': {
    problemLabel: 'DATA CORRUPTION',
    problemIcon: '\u{1F512}',
    problemColor: '#E74C3C',
    questionText: 'Mutex vs Semaphore',
    solutionLabels: ['Mutex', 'Lock', 'Unlock', 'Critical Section'],
    solutionColor: '#F39C12',
  },
  'event driven': {
    problemLabel: 'TIGHT COUPLING',
    problemIcon: '\u{1F4E2}',
    problemColor: '#8E44AD',
    questionText: 'Event-driven architecture?',
    solutionLabels: ['Publisher', 'Event Bus', 'Subscriber', 'Handler'],
    solutionColor: '#A78BFA',
  },
  'cqrs': {
    problemLabel: 'READ/WRITE BOTTLENECK',
    problemIcon: '\u{2194}',
    problemColor: '#3498DB',
    questionText: 'What is CQRS?',
    solutionLabels: ['Command', 'Query', 'Write DB', 'Read DB'],
    solutionColor: '#3498DB',
  },
  'saga': {
    problemLabel: 'DISTRIBUTED TXN FAILED',
    problemIcon: '\u{1F4DC}',
    problemColor: '#E74C3C',
    questionText: 'Saga pattern for transactions',
    solutionLabels: ['Step 1', 'Step 2', 'Compensate', 'Orchestrator'],
    solutionColor: '#1DD1A1',
  },
  'monitoring': {
    problemLabel: 'BLIND SPOT',
    problemIcon: '\u{1F441}',
    problemColor: '#F39C12',
    questionText: 'Design a monitoring system',
    solutionLabels: ['Metrics', 'Alerts', 'Dashboard', 'Log Agg'],
    solutionColor: '#FDB813',
  },
  'logging': {
    problemLabel: 'NO VISIBILITY',
    problemIcon: '\u{1F4DD}',
    problemColor: '#F39C12',
    questionText: 'Centralized logging design',
    solutionLabels: ['Agent', 'Collector', 'Storage', 'Search'],
    solutionColor: '#FDB813',
  },
  'tracing': {
    problemLabel: 'REQUEST LOST',
    problemIcon: '\u{1F50E}',
    problemColor: '#3498DB',
    questionText: 'Distributed tracing explained',
    solutionLabels: ['Trace ID', 'Span', 'Collector', 'Visualizer'],
    solutionColor: '#3498DB',
  },
  'elasticsearch': {
    problemLabel: 'SEARCH TOO SLOW',
    problemIcon: '\u{1F50D}',
    problemColor: '#F39C12',
    questionText: 'How does Elasticsearch work?',
    solutionLabels: ['Index', 'Shard', 'Inverted Index', 'Query DSL'],
    solutionColor: '#FDB813',
  },
  'blob storage': {
    problemLabel: 'FILES EVERYWHERE',
    problemIcon: '\u{1F4BE}',
    problemColor: '#3498DB',
    questionText: 'Design blob storage',
    solutionLabels: ['Upload', 'Chunk', 'Replicate', 'CDN Serve'],
    solutionColor: '#3498DB',
  },
  'mapreduce': {
    problemLabel: 'DATA TOO BIG',
    problemIcon: '\u{1F4CA}',
    problemColor: '#27AE60',
    questionText: 'How does MapReduce work?',
    solutionLabels: ['Split', 'Map', 'Shuffle', 'Reduce'],
    solutionColor: '#27AE60',
  },
  'kafka': {
    problemLabel: 'EVENT STREAM LOST',
    problemIcon: '\u{1F4E8}',
    problemColor: '#E74C3C',
    questionText: 'Why Kafka for streaming?',
    solutionLabels: ['Producer', 'Broker', 'Partition', 'Consumer'],
    solutionColor: '#1DD1A1',
  },
  'spark': {
    problemLabel: 'BATCH TOO SLOW',
    problemIcon: '\u{26A1}',
    problemColor: '#F39C12',
    questionText: 'Spark vs MapReduce',
    solutionLabels: ['Driver', 'Executor', 'RDD', 'DAG'],
    solutionColor: '#FDB813',
  },
  'leader election': {
    problemLabel: 'SPLIT BRAIN',
    problemIcon: '\u{1F451}',
    problemColor: '#E74C3C',
    questionText: 'How does leader election work?',
    solutionLabels: ['Candidate', 'Vote', 'Leader', 'Follower'],
    solutionColor: '#FDB813',
  },
  'gossip protocol': {
    problemLabel: 'NODES OUT OF SYNC',
    problemIcon: '\u{1F5E3}',
    problemColor: '#8E44AD',
    questionText: 'How gossip spreads state',
    solutionLabels: ['Node A', 'Gossip', 'Node B', 'Convergence'],
    solutionColor: '#A78BFA',
  },
  'vector clock': {
    problemLabel: 'CAUSAL ORDERING LOST',
    problemIcon: '\u{23F0}',
    problemColor: '#3498DB',
    questionText: 'Vector clocks for ordering',
    solutionLabels: ['Clock A', 'Clock B', 'Merge', 'Resolve'],
    solutionColor: '#3498DB',
  },
  'raft': {
    problemLabel: 'NO CONSENSUS',
    problemIcon: '\u{1F91D}',
    problemColor: '#E74C3C',
    questionText: 'Raft consensus algorithm',
    solutionLabels: ['Leader', 'Log', 'Commit', 'Follower'],
    solutionColor: '#1DD1A1',
  },
  'bloom filter': {
    problemLabel: 'WASTED LOOKUPS',
    problemIcon: '\u{1F338}',
    problemColor: '#8E44AD',
    questionText: 'How bloom filters save time',
    solutionLabels: ['Bit Array', 'Hash 1', 'Hash 2', 'Probabilistic'],
    solutionColor: '#A78BFA',
  },
  'lru cache': {
    problemLabel: 'CACHE MISS STORM',
    problemIcon: '\u{1F4A8}',
    problemColor: '#F39C12',
    questionText: 'Implement an LRU cache',
    solutionLabels: ['HashMap', 'Doubly Linked', 'Evict', 'O(1) Access'],
    solutionColor: '#FDB813',
  },
  'b-tree': {
    problemLabel: 'DISK SEEK SLOW',
    problemIcon: '\u{1F333}',
    problemColor: '#27AE60',
    questionText: 'Why databases use B-Trees',
    solutionLabels: ['Root', 'Internal', 'Leaf', 'Balanced'],
    solutionColor: '#27AE60',
  },
  'merkle tree': {
    problemLabel: 'DATA INTEGRITY LOST',
    problemIcon: '\u{1F332}',
    problemColor: '#27AE60',
    questionText: 'Merkle trees for verification',
    solutionLabels: ['Root Hash', 'Branch', 'Leaf Hash', 'Verify'],
    solutionColor: '#27AE60',
  },
  'skip list': {
    problemLabel: 'LINEAR SEARCH',
    problemIcon: '\u{23E9}',
    problemColor: '#3498DB',
    questionText: 'Skip list data structure',
    solutionLabels: ['Level 0', 'Level 1', 'Level 2', 'O(log n)'],
    solutionColor: '#3498DB',
  },
  'graphql': {
    problemLabel: 'OVER-FETCHING',
    problemIcon: '\u{1F4E5}',
    problemColor: '#E535AB',
    questionText: 'GraphQL vs REST',
    solutionLabels: ['Schema', 'Query', 'Resolver', 'Response'],
    solutionColor: '#E535AB',
  },
  'grpc': {
    problemLabel: 'SLOW SERIALIZATION',
    problemIcon: '\u{26A1}',
    problemColor: '#3498DB',
    questionText: 'Why use gRPC?',
    solutionLabels: ['Proto', 'Stub', 'Channel', 'Streaming'],
    solutionColor: '#3498DB',
  },
  'pagination': {
    problemLabel: 'TIMEOUT ON LARGE DATA',
    problemIcon: '\u{1F4C4}',
    problemColor: '#F39C12',
    questionText: 'Cursor vs Offset pagination',
    solutionLabels: ['Offset', 'Cursor', 'Keyset', 'Response'],
    solutionColor: '#FDB813',
  },
  'oauth': {
    problemLabel: 'UNAUTHORIZED ACCESS',
    problemIcon: '\u{1F511}',
    problemColor: '#E74C3C',
    questionText: 'OAuth 2.0 flow explained',
    solutionLabels: ['Client', 'Auth Server', 'Token', 'Resource'],
    solutionColor: '#27AE60',
  },
  'jwt': {
    problemLabel: 'TOKEN FORGERY',
    problemIcon: '\u{1F3AB}',
    problemColor: '#E74C3C',
    questionText: 'How JWT authentication works',
    solutionLabels: ['Header', 'Payload', 'Signature', 'Verify'],
    solutionColor: '#27AE60',
  },
  'scaling': {
    problemLabel: 'TRAFFIC SPIKE',
    problemIcon: '\u{1F4C8}',
    problemColor: '#E74C3C',
    questionText: 'Horizontal vs Vertical scaling',
    solutionLabels: ['Scale Out', 'Scale Up', 'Auto Scale', 'Metrics'],
    solutionColor: '#1DD1A1',
  },
  'cap theorem': {
    problemLabel: 'IMPOSSIBLE TRADEOFF',
    problemIcon: '\u{2696}',
    problemColor: '#8E44AD',
    questionText: 'Explain the CAP theorem',
    solutionLabels: ['Consistency', 'Availability', 'Partition', 'Tradeoff'],
    solutionColor: '#A78BFA',
  },
};

function getTopicVisuals(topic: string): TopicVisualConfig {
  const lower = topic.toLowerCase();
  // Check longer keys first for specificity
  const sortedKeys = Object.keys(TOPIC_VISUALS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) return TOPIC_VISUALS[key];
  }
  // Fallback -- generic but still uses topic name
  return {
    problemLabel: 'SYSTEM FAILURE',
    problemIcon: '\u{26A0}',
    problemColor: '#E74C3C',
    questionText: `Explain ${topic}`,
    solutionLabels: [topic, 'Architecture', 'Implementation', 'Optimization'],
    solutionColor: '#1DD1A1',
  };
}

// ── FPS = 30. Phase mapping (title scene runs ~25-30s = 750-900 frames): ──
// Phase 1:  0-150f   (0-5s)    "THE PROBLEM" — servers overwhelmed, errors climb
// Phase 2:  150-450f (5-15s)   "THE QUESTION" — interview scenario, pressure
// Phase 3:  450-660f (15-22s)  "THE SOLUTION PREVIEW" — system heals, stats soar
// Phase 4:  660-900f (22-30s)  "CTA + TRANSITION" — subscribe, brand, fade out

// ── Shared: Tech grid background ──
const TechGridBg: React.FC<{ frame: number; accentColor?: string }> = ({
  frame,
  accentColor = COLORS.saffron,
}) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
    {/* Grid lines */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(${accentColor}08 1px, transparent 1px),
          linear-gradient(90deg, ${accentColor}08 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }}
    />
    {/* Radial glow */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 50% 40%, ${accentColor}0A 0%, transparent 50%)`,
      }}
    />
    {/* Floating code keywords */}
    {['async', 'await', 'class', 'return', 'import', 'deploy', 'scale', 'cache'].map((kw, i) => {
      const x = (i * 12.5 + 3) % 100;
      const cycleFrame = (frame + i * 20) % 200;
      const y = (cycleFrame / 200) * 120 - 10;
      return (
        <div
          key={`kw-${i}`}
          style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            fontSize: 13,
            fontFamily: FONTS.code,
            color: COLORS.teal,
            opacity: 0.05 + (i % 3) * 0.015,
            whiteSpace: 'nowrap',
          }}
        >
          {kw}
        </div>
      );
    })}
  </div>
);

// ── Cinematic corner brackets ──
const CinematicFrame: React.FC<{ opacity: number }> = ({ opacity }) => (
  <>
    {[
      { top: 40, left: 40, borderTop: `2px solid ${COLORS.saffron}`, borderLeft: `2px solid ${COLORS.saffron}` },
      { top: 40, right: 40, borderTop: `2px solid ${COLORS.saffron}`, borderRight: `2px solid ${COLORS.saffron}` },
      { bottom: 40, left: 40, borderBottom: `2px solid ${COLORS.saffron}`, borderLeft: `2px solid ${COLORS.saffron}` },
      { bottom: 40, right: 40, borderBottom: `2px solid ${COLORS.saffron}`, borderRight: `2px solid ${COLORS.saffron}` },
    ].map((style, i) => (
      <div
        key={`corner-${i}`}
        style={{
          position: 'absolute',
          width: 40,
          height: 40,
          opacity,
          ...style,
        }}
      />
    ))}
  </>
);

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 1: "THE PROBLEM" — servers overwhelmed, errors climb (0-150f / 0-5s)
// ════════════════════════════════════════════════════════════════════════════════
const PhaseProblem: React.FC<{ frame: number; topic: string }> = ({ frame, topic }) => {
  const config = getTopicVisuals(topic);

  // Phase label: "THE PROBLEM" — springs in at frame 5
  const labelSpring = spring({
    frame: Math.max(0, frame - 5),
    fps: 30,
    config: { damping: 10, stiffness: 180, mass: 0.5 },
  });
  const labelOp = interpolate(frame, [5, 15, 120, 140], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Server boxes appear staggered — turn problem-color one by one
  const serverData = [
    { x: 660, y: 340, label: config.solutionLabels[0] || 'SRV-1' },
    { x: 900, y: 340, label: config.solutionLabels[1] || 'SRV-2' },
    { x: 1140, y: 340, label: config.solutionLabels[2] || 'SRV-3' },
  ];

  // Request arrows rain down from top
  const arrowCount = Math.min(6, Math.floor(interpolate(frame, [20, 80], [0, 6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })));

  // Each server turns problem-color at different times
  const serverRedFrame = [45, 65, 85];

  // Error counter: 0 -> 127 -> 5842
  const errorVal = Math.round(
    interpolate(frame, [40, 70, 120], [0, 127, 5842], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const errorOp = interpolate(frame, [35, 45, 135, 150], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Problem-color background pulse intensity
  const redPulse = frame > 50
    ? interpolate(Math.sin(frame * 0.12), [-1, 1], [0.02, 0.08])
    : 0;

  // Phase fade-out
  const phaseOp = interpolate(frame, [130, 150], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Problem icon spring
  const iconSpring = spring({
    frame: Math.max(0, frame - 10),
    fps: 30,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });
  const iconOp = interpolate(frame, [10, 20, 80, 100], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: phaseOp }}>
      {/* Problem-color alarm pulse overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: config.problemColor,
          opacity: redPulse,
        }}
      />

      {/* "THE PROBLEM" label */}
      <div
        style={{
          position: 'absolute',
          top: '12%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: labelOp,
          transform: `scale(${interpolate(labelSpring, [0, 1], [0.5, 1])})`,
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontFamily: FONTS.code,
            fontWeight: 800,
            color: config.problemColor,
            letterSpacing: 8,
            textTransform: 'uppercase',
            textShadow: `0 0 20px ${config.problemColor}66`,
          }}
        >
          THE PROBLEM
        </span>
      </div>

      {/* Topic-specific problem icon */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: `translateX(-50%) scale(${interpolate(iconSpring, [0, 1], [3, 1])})`,
          opacity: iconOp,
          fontSize: 72,
          textAlign: 'center',
        }}
      >
        {config.problemIcon}
      </div>

      {/* Server boxes using AnimatedBox — labels from topic config */}
      {serverData.map((srv, i) => {
        const isRed = frame > serverRedFrame[i];
        return (
          <AnimatedBox
            key={`srv-${i}`}
            label={srv.label}
            x={srv.x}
            y={srv.y}
            width={160}
            height={70}
            color={isRed ? config.problemColor : COLORS.teal}
            isActive={isRed}
            entryFrame={15 + i * 10}
          />
        );
      })}

      {/* Request arrows raining down */}
      {Array.from({ length: arrowCount }, (_, i) => (
        <AnimatedArrow
          key={`req-${i}`}
          from={{ x: 700 + i * 80, y: 180 }}
          to={{ x: 700 + i * 80, y: 320 }}
          color={COLORS.saffron}
          startFrame={20 + i * 8}
          duration={12}
          label={i === 0 ? 'req' : undefined}
        />
      ))}

      {/* Error counter */}
      <div
        style={{
          position: 'absolute',
          top: '62%',
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: errorOp,
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontFamily: FONTS.code,
            fontWeight: 700,
            color: COLORS.gray,
            letterSpacing: 3,
          }}
        >
          ERRORS:
        </span>
        <span
          style={{
            fontSize: 56,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: errorVal > 1000 ? config.problemColor : errorVal > 50 ? COLORS.saffron : COLORS.gold,
            textShadow: errorVal > 1000
              ? `0 0 30px ${config.problemColor}88`
              : 'none',
          }}
        >
          {errorVal.toLocaleString()}
        </span>
      </div>

      {/* Shaking problem label text at end — topic-specific */}
      {frame > 90 && (
        <div
          style={{
            position: 'absolute',
            top: '80%',
            left: 0,
            right: 0,
            textAlign: 'center',
            opacity: interpolate(frame, [90, 100, 130, 145], [0, 1, 1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `translateX(${Math.sin(frame * 2.5) * interpolate(frame, [90, 120], [6, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' })}px)`,
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontFamily: FONTS.heading,
              fontWeight: 800,
              color: config.problemColor,
              letterSpacing: 6,
              textShadow: `0 0 20px ${config.problemColor}66`,
            }}
          >
            {config.problemLabel}
          </span>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 2: "THE QUESTION" — interview scenario (150-450f / 5-15s)
// ════════════════════════════════════════════════════════════════════════════════
const PhaseQuestion: React.FC<{ frame: number; topic: string; title?: string }> = ({
  frame,
  topic,
  title,
}) => {
  // Relative frame within this phase
  const f = Math.max(0, frame - 150);
  const dur = 300; // 10 seconds

  // Phase fade in/out
  const phaseOp = interpolate(frame, [150, 165, 435, 450], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "THE QUESTION" label
  const labelSpring = spring({
    frame: Math.max(0, f - 5),
    fps: 30,
    config: { damping: 10, stiffness: 160, mass: 0.5 },
  });
  const labelOp = interpolate(f, [5, 18, dur - 30, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Interviewer box — slides in from left
  const interviewerSlide = interpolate(f, [30, 55], [-300, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const interviewerOp = interpolate(f, [30, 50, dur - 30, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "YOU" box — slides in from right
  const youSlide = interpolate(f, [40, 65], [300, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const youOp = interpolate(f, [40, 60, dur - 30, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Speech bubble from interviewer — appears at f=70
  const bubbleSpring = spring({
    frame: Math.max(0, f - 70),
    fps: 30,
    config: { damping: 12, stiffness: 140, mass: 0.6 },
  });
  const bubbleOp = interpolate(f, [70, 85, dur - 30, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Interview timer counting down (45:00 -> 44:XX)
  const timerSeconds = Math.max(
    0,
    Math.round(
      interpolate(f, [60, dur], [2700, 2640], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
    ),
  );
  const timerMin = Math.floor(timerSeconds / 60);
  const timerSec = timerSeconds % 60;
  const timerOp = interpolate(f, [55, 68, dur - 30, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Timer pulse — red urgency
  const timerPulse = interpolate(Math.sin(f * 0.08), [-1, 1], [0.7, 1.0]);

  // Your answer "..." blinking
  const blinkOp = f > 120 ? interpolate(Math.sin(f * 0.15), [-1, 1], [0.3, 1.0]) : 0;
  const answerOp = interpolate(f, [110, 125, dur - 30, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Desk line connecting the two
  const deskOp = interpolate(f, [50, 70, dur - 30, dur], [0, 0.6, 0.6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // The question to display — topic-aware from config
  const config = getTopicVisuals(topic);
  const questionText = title || config.questionText;
  // Truncate to ~5 words for on-screen display
  const shortQuestion = questionText.split(' ').slice(0, 5).join(' ') + (questionText.split(' ').length > 5 ? '...' : '');

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: phaseOp }}>
      {/* "THE QUESTION" label */}
      <div
        style={{
          position: 'absolute',
          top: '10%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: labelOp,
          transform: `scale(${interpolate(labelSpring, [0, 1], [0.5, 1])})`,
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontFamily: FONTS.code,
            fontWeight: 800,
            color: COLORS.gold,
            letterSpacing: 8,
            textTransform: 'uppercase',
            textShadow: `0 0 20px ${COLORS.gold}44`,
          }}
        >
          THE QUESTION
        </span>
      </div>

      {/* Timer — top right */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          right: 80,
          opacity: timerOp,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: COLORS.red,
            opacity: timerPulse,
            boxShadow: `0 0 8px ${COLORS.red}88`,
          }}
        />
        <span
          style={{
            fontSize: 28,
            fontFamily: FONTS.code,
            fontWeight: 700,
            color: COLORS.red,
            letterSpacing: 2,
            textShadow: `0 0 12px ${COLORS.red}44`,
          }}
        >
          {timerMin}:{timerSec.toString().padStart(2, '0')}
        </span>
      </div>

      {/* INTERVIEWER box */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '10%',
          transform: `translateX(${interviewerSlide}px)`,
          opacity: interviewerOp,
        }}
      >
        <div
          style={{
            width: 200,
            height: 100,
            border: `2px solid ${COLORS.teal}`,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${COLORS.teal}11`,
            boxShadow: `0 0 20px ${COLORS.teal}22`,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontFamily: FONTS.text,
              fontWeight: 700,
              color: COLORS.teal,
              letterSpacing: 3,
            }}
          >
            INTERVIEWER
          </span>
        </div>
      </div>

      {/* Desk line */}
      <div
        style={{
          position: 'absolute',
          top: '42%',
          left: '24%',
          right: '24%',
          height: 2,
          background: `linear-gradient(90deg, ${COLORS.teal}55, ${COLORS.gray}33, ${COLORS.saffron}55)`,
          opacity: deskOp,
        }}
      />

      {/* YOU box */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          right: '10%',
          transform: `translateX(${youSlide}px)`,
          opacity: youOp,
        }}
      >
        <div
          style={{
            width: 200,
            height: 100,
            border: `2px solid ${COLORS.saffron}`,
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: `${COLORS.saffron}11`,
            boxShadow: `0 0 20px ${COLORS.saffron}22`,
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontFamily: FONTS.text,
              fontWeight: 800,
              color: COLORS.saffron,
              letterSpacing: 3,
            }}
          >
            YOU
          </span>
        </div>
      </div>

      {/* Speech bubble from interviewer */}
      <div
        style={{
          position: 'absolute',
          top: '55%',
          left: '15%',
          right: '25%',
          opacity: bubbleOp,
          transform: `scale(${interpolate(bubbleSpring, [0, 1], [0.7, 1])})`,
        }}
      >
        <div
          style={{
            background: `${COLORS.darkAlt}`,
            border: `1.5px solid ${COLORS.teal}44`,
            borderRadius: 16,
            padding: '20px 28px',
            position: 'relative',
            boxShadow: `0 4px 30px ${COLORS.dark}CC`,
          }}
        >
          {/* Triangle pointer */}
          <div
            style={{
              position: 'absolute',
              top: -10,
              left: 40,
              width: 0,
              height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderBottom: `10px solid ${COLORS.darkAlt}`,
            }}
          />
          <span
            style={{
              fontSize: 30,
              fontFamily: FONTS.heading,
              fontWeight: 700,
              color: COLORS.white,
              lineHeight: 1.3,
            }}
          >
            &ldquo;{shortQuestion}&rdquo;
          </span>
        </div>
      </div>

      {/* Your answer — blinking "..." */}
      <div
        style={{
          position: 'absolute',
          top: '75%',
          right: '12%',
          opacity: answerOp,
        }}
      >
        <div
          style={{
            background: `${COLORS.saffron}15`,
            border: `1.5px solid ${COLORS.saffron}33`,
            borderRadius: 12,
            padding: '14px 30px',
          }}
        >
          <span
            style={{
              fontSize: 36,
              fontFamily: FONTS.code,
              fontWeight: 700,
              color: COLORS.saffron,
              opacity: blinkOp,
              letterSpacing: 8,
            }}
          >
            ...
          </span>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 3: "THE SOLUTION PREVIEW" — system heals, stats soar (450-660f / 15-22s)
// ════════════════════════════════════════════════════════════════════════════════
const PhaseSolution: React.FC<{ frame: number; topic: string; objectives?: string[] }> = ({
  frame,
  topic,
  objectives = [],
}) => {
  const config = getTopicVisuals(topic);

  // Relative frame within this phase
  const f = Math.max(0, frame - 450);
  const dur = 210; // 7 seconds

  // Phase fade in/out
  const phaseOp = interpolate(frame, [450, 465, 645, 660], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "THE SOLUTION" label
  const labelSpring = spring({
    frame: Math.max(0, f - 5),
    fps: 30,
    config: { damping: 10, stiffness: 160, mass: 0.5 },
  });
  const labelOp = interpolate(f, [5, 18, dur - 20, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Architecture boxes — building up, topic-specific labels and color
  const sLabels = config.solutionLabels;
  const sColor = config.solutionColor;
  const boxPositions = [
    { x: 400, y: 280 },
    { x: 700, y: 420 },
    { x: 1000, y: 420 },
    { x: 1300, y: 280 },
  ];
  const boxData = sLabels.map((label, i) => ({
    x: boxPositions[i]?.x ?? 400 + i * 300,
    y: boxPositions[i]?.y ?? 350,
    label,
    entryF: 30 + i * 20,
    color: i % 2 === 0 ? sColor : (i === 1 ? COLORS.teal : COLORS.gold),
  }));

  // Animated stats counters
  const uptimeVal = Math.round(
    interpolate(f, [80, 140], [90, 99.99], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }) * 100,
  ) / 100;
  const latencyVal = Math.round(
    interpolate(f, [90, 140], [500, 12], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const statsOp = interpolate(f, [75, 90, dur - 20, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "After this video..." text
  const afterOp = interpolate(f, [130, 150, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const afterSpring = spring({
    frame: Math.max(0, f - 130),
    fps: 30,
    config: { damping: 12, stiffness: 120, mass: 0.7 },
  });

  // Green success pulse
  const greenPulse = f > 40
    ? interpolate(Math.sin(f * 0.06), [-1, 1], [0.01, 0.04])
    : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: phaseOp }}>
      {/* Success glow — topic-specific color */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: sColor,
          opacity: greenPulse,
        }}
      />

      {/* "THE SOLUTION" label */}
      <div
        style={{
          position: 'absolute',
          top: '8%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: labelOp,
          transform: `scale(${interpolate(labelSpring, [0, 1], [0.5, 1])})`,
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontFamily: FONTS.code,
            fontWeight: 800,
            color: sColor,
            letterSpacing: 8,
            textTransform: 'uppercase',
            textShadow: `0 0 20px ${sColor}44`,
          }}
        >
          THE SOLUTION
        </span>
      </div>

      {/* Architecture boxes */}
      {boxData.map((box, i) => (
        <AnimatedBox
          key={`sol-${i}`}
          label={box.label}
          x={box.x}
          y={box.y}
          width={200}
          height={80}
          color={box.color}
          isActive={f > box.entryF + 40}
          entryFrame={box.entryF}
        />
      ))}

      {/* Arrows connecting boxes */}
      <AnimatedArrow
        from={{ x: 500, y: 320 }}
        to={{ x: 700, y: 420 }}
        color={COLORS.teal}
        startFrame={60}
        duration={15}
        curved
      />
      <AnimatedArrow
        from={{ x: 800, y: 420 }}
        to={{ x: 1000, y: 420 }}
        color={COLORS.indigo}
        startFrame={80}
        duration={15}
      />
      <AnimatedArrow
        from={{ x: 1100, y: 420 }}
        to={{ x: 1300, y: 320 }}
        color={COLORS.gold}
        startFrame={100}
        duration={15}
        curved
      />

      {/* Stats counters */}
      <div
        style={{
          position: 'absolute',
          top: '68%',
          left: '20%',
          right: '20%',
          display: 'flex',
          justifyContent: 'space-around',
          opacity: statsOp,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 42,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              color: COLORS.teal,
              textShadow: `0 0 20px ${COLORS.teal}44`,
            }}
          >
            {uptimeVal}%
          </div>
          <div
            style={{
              fontSize: 14,
              fontFamily: FONTS.code,
              color: COLORS.gray,
              letterSpacing: 3,
              marginTop: 4,
            }}
          >
            UPTIME
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 42,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              color: COLORS.gold,
              textShadow: `0 0 20px ${COLORS.gold}44`,
            }}
          >
            {latencyVal}ms
          </div>
          <div
            style={{
              fontSize: 14,
              fontFamily: FONTS.code,
              color: COLORS.gray,
              letterSpacing: 3,
              marginTop: 4,
            }}
          >
            LATENCY
          </div>
        </div>
      </div>

      {/* "After this video, YOU will know." */}
      <div
        style={{
          position: 'absolute',
          top: '85%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: afterOp,
          transform: `scale(${interpolate(afterSpring, [0, 1], [0.8, 1])})`,
        }}
      >
        <span
          style={{
            fontSize: 28,
            fontFamily: FONTS.heading,
            fontWeight: 700,
            color: COLORS.white,
          }}
        >
          You will{' '}
          <span style={{ color: COLORS.gold }}>master</span> this.
        </span>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// PHASE 4: "CTA + TRANSITION" — subscribe, brand, fade (660-900f / 22-30s)
// ════════════════════════════════════════════════════════════════════════════════
const PhaseCta: React.FC<{
  frame: number;
  topic: string;
  sessionNumber: number;
  totalSessions: number;
  totalFrames: number;
}> = ({
  frame,
  topic,
  sessionNumber,
  totalSessions,
  totalFrames,
}) => {
  // Relative frame within this phase
  const f = Math.max(0, frame - 660);
  const dur = totalFrames - 660;

  // Phase fade in/out
  const phaseOp = interpolate(frame, [660, 678, totalFrames - 20, totalFrames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Topic name — huge reveal
  const topicSpring = spring({
    frame: Math.max(0, f - 5),
    fps: 30,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });
  const topicOp = interpolate(f, [5, 18, dur - 30, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Session badge
  const badgeSpring = spring({
    frame: Math.max(0, f - 25),
    fps: 30,
    config: { damping: 12, stiffness: 130, mass: 0.7 },
  });
  const badgeOp = interpolate(f, [25, 38, dur - 25, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Subscribe CTA — springs in at f=50
  const ctaSpring = spring({
    frame: Math.max(0, f - 50),
    fps: 30,
    config: { damping: 10, stiffness: 150, mass: 0.6 },
  });
  const ctaOp = interpolate(f, [50, 65, dur - 20, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Subscribe button pulse
  const subPulse = interpolate(Math.sin(f * 0.08), [-1, 1], [0.9, 1.05]);

  // Branding line — guru-sishya.in
  const brandSpring = spring({
    frame: Math.max(0, f - 70),
    fps: 30,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });
  const brandOp = interpolate(f, [70, 85, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Instagram CTA
  const instaOp = interpolate(f, [90, 105, dur - 15, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const instaSpring = spring({
    frame: Math.max(0, f - 90),
    fps: 30,
    config: { damping: 12, stiffness: 140, mass: 0.6 },
  });

  // Divider line width animation
  const dividerWidth = interpolate(f, [15, 45], [0, 320], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Glow pulse behind topic
  const glowPulse = interpolate(Math.sin(f * 0.06), [-1, 1], [0.6, 1.0]);

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: phaseOp }}>
      {/* Radial glow behind topic */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 300,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.saffron}18, transparent 60%)`,
          opacity: glowPulse * topicOp,
          filter: 'blur(40px)',
        }}
      />

      {/* TOPIC NAME — huge, cinematic */}
      <div
        style={{
          position: 'absolute',
          top: '18%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: topicOp,
          transform: `scale(${interpolate(topicSpring, [0, 1], [0.3, 1])})`,
        }}
      >
        <span
          style={{
            fontSize: SIZES.heading1,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.saffron,
            letterSpacing: 3,
            textTransform: 'uppercase',
            textShadow: `0 0 40px ${COLORS.saffron}66, 0 0 80px ${COLORS.saffron}22`,
          }}
        >
          {topic}
        </span>
      </div>

      {/* Saffron divider */}
      <div
        style={{
          position: 'absolute',
          top: '32%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: dividerWidth,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${COLORS.saffron}, ${COLORS.gold}, transparent)`,
          borderRadius: 2,
          boxShadow: `0 0 12px ${COLORS.saffron}44`,
        }}
      />

      {/* Session badge */}
      <div
        style={{
          position: 'absolute',
          top: '37%',
          left: '50%',
          transform: `translateX(-50%) scale(${interpolate(badgeSpring, [0, 1], [0.7, 1])})`,
          opacity: badgeOp,
        }}
      >
        <div
          style={{
            background: `${COLORS.saffron}`,
            borderRadius: 8,
            padding: '8px 24px',
            boxShadow: `0 0 16px ${COLORS.saffron}55`,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontFamily: FONTS.text,
              fontWeight: 800,
              color: COLORS.white,
              letterSpacing: 2,
            }}
          >
            SESSION {sessionNumber} OF {totalSessions}
          </span>
        </div>
      </div>

      {/* SUBSCRIBE CTA */}
      <div
        style={{
          position: 'absolute',
          top: '52%',
          left: '50%',
          transform: `translateX(-50%) scale(${interpolate(ctaSpring, [0, 1], [0.5, 1]) * subPulse})`,
          opacity: ctaOp,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: `linear-gradient(135deg, ${COLORS.red}, #CC0000)`,
            borderRadius: 12,
            padding: '14px 36px',
            boxShadow: `0 4px 24px ${COLORS.red}66`,
          }}
        >
          {/* Play triangle icon */}
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: '10px solid transparent',
              borderBottom: '10px solid transparent',
              borderLeft: `16px solid ${COLORS.white}`,
            }}
          />
          <span
            style={{
              fontSize: 22,
              fontFamily: FONTS.heading,
              fontWeight: 800,
              color: COLORS.white,
              letterSpacing: 2,
            }}
          >
            SUBSCRIBE
          </span>
        </div>
      </div>

      {/* guru-sishya.in branding — top area */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: brandOp,
          transform: `scale(${interpolate(brandSpring, [0, 1], [0.8, 1])})`,
        }}
      >
        {/* Decorative line */}
        <div
          style={{
            width: 200,
            height: 2,
            margin: '0 auto 12px',
            background: `linear-gradient(90deg, transparent, ${COLORS.saffron}CC, ${COLORS.gold}FF, ${COLORS.saffron}CC, transparent)`,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <span style={{ fontSize: 28, fontFamily: FONTS.heading, fontWeight: 900, letterSpacing: -1 }}>
            <span style={{ color: COLORS.saffron }}>GURU</span>
            <span style={{ color: COLORS.gold }}> SISHYA</span>
          </span>
        </div>
        <span
          style={{
            fontSize: 15,
            fontFamily: FONTS.code,
            fontWeight: 600,
            color: COLORS.gray,
            letterSpacing: 2,
            display: 'block',
            marginTop: 6,
          }}
        >
          guru-sishya.in
        </span>
      </div>

      {/* Instagram CTA — for Reels cross-promotion */}
      <div
        style={{
          position: 'absolute',
          top: '82%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: instaOp,
          transform: `scale(${interpolate(instaSpring, [0, 1], [0.8, 1])})`,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: `linear-gradient(135deg, #833AB4, #FD1D1D, #F77737)`,
            borderRadius: 999,
            padding: '8px 24px',
            boxShadow: '0 2px 16px rgba(131, 58, 180, 0.4)',
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontFamily: FONTS.text,
              fontWeight: 700,
              color: COLORS.white,
              letterSpacing: 1,
            }}
          >
            @guru_sishya.in
          </span>
        </div>
      </div>

      {/* "Comment 'guru-sishya' for link" — Instagram Reels CTA */}
      <div
        style={{
          position: 'absolute',
          top: '90%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(f, [110, 125, dur - 10, dur], [0, 0.8, 0.8, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontFamily: FONTS.code,
            fontWeight: 600,
            color: COLORS.gray,
            letterSpacing: 1.5,
          }}
        >
          Comment &apos;guru-sishya&apos; for link
        </span>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT — TitleSlide (4-phase movie-trailer opening)
// ════════════════════════════════════════════════════════════════════════════════
const TitleSlide: React.FC<TitleSlideProps> = ({
  topic = 'TOPIC',
  sessionNumber = 1,
  totalSessions = 12,
  title = '',
  objectives = [],
  language,
  hookText,
  stats,
  durationLabel,
}) => {
  const frame = useCurrentFrame();

  // Corner brackets fade in over first 30 frames
  const cornerOp = interpolate(frame, [0, 30], [0, 0.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Star particles — ambient movement throughout
  const starCount = 20;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        overflow: 'hidden',
      }}
    >
      {/* LAYER 0: Tech grid background — always visible */}
      <TechGridBg frame={frame} accentColor={COLORS.saffron} />

      {/* LAYER 0b: Gradient mesh */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 50% 40% at 15% 25%, ${COLORS.saffron}0A 0%, transparent 70%),
            radial-gradient(ellipse 40% 35% at 85% 75%, ${COLORS.teal}08 0%, transparent 65%),
            radial-gradient(ellipse 45% 30% at 50% 90%, ${COLORS.indigo}06 0%, transparent 60%)
          `,
        }}
      />

      {/* LAYER 1: Star field particles — ambient */}
      {Array.from({ length: starCount }).map((_, i) => {
        const seed = i * 137.508;
        const baseX = (seed * 7.31) % 100;
        const baseY = (seed * 3.97) % 100;
        const driftX = Math.sin(frame * 0.005 + i * 0.7) * 2;
        const driftY = Math.cos(frame * 0.004 + i * 1.1) * 1.5;
        const twinkle = interpolate(
          Math.sin(frame * 0.04 + i * 1.3),
          [-1, 1],
          [0.03, i < 4 ? 0.4 : 0.2],
        );
        const size = i < 3 ? 3 : i < 8 ? 2 : 1;
        const starColor = [COLORS.saffron, COLORS.gold, COLORS.teal, COLORS.indigo, COLORS.white][i % 5];
        return (
          <div
            key={`star-${i}`}
            style={{
              position: 'absolute',
              left: `${baseX + driftX}%`,
              top: `${baseY + driftY}%`,
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: starColor,
              opacity: twinkle,
              boxShadow: i < 4 ? `0 0 ${size * 3}px ${starColor}44` : 'none',
              zIndex: 1,
            }}
          />
        );
      })}

      {/* LAYER 2: Cinematic corner brackets */}
      <CinematicFrame opacity={cornerOp} />

      {/* LAYER 3: Phase content — all 4 phases render simultaneously,
          each self-manages its own opacity/visibility based on frame */}
      <PhaseProblem frame={frame} topic={topic} />
      <PhaseQuestion frame={frame} topic={topic} title={hookText || title} />
      <PhaseSolution frame={frame} topic={topic} objectives={objectives} />
      <PhaseCta
        frame={frame}
        topic={topic}
        sessionNumber={sessionNumber}
        totalSessions={totalSessions}
        totalFrames={900} // ~30 seconds at 30fps
      />
    </AbsoluteFill>
  );
};

export default TitleSlide;
