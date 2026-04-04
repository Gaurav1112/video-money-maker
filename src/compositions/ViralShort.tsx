import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  Audio,
  staticFile,
  interpolate,
  spring,
} from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { Storyboard, Scene } from '../types';
import { COLORS, FONTS } from '../lib/theme';
import { SyncTimeline } from '../lib/sync-engine';
import { setSyncTimeline } from '../hooks/useSync';
import { ConceptViz } from '../components/ConceptViz';
import { CaptionOverlay } from '../components';

// ── TitleSlide's TOPIC_VISUALS — imported inline to avoid circular deps ──────
interface TopicVisualConfig {
  problemLabel: string;
  problemIcon: string;
  problemColor: string;
  questionText: string;
  solutionLabels: string[];
  solutionColor: string;
}

const TOPIC_VISUALS: Record<string, TopicVisualConfig> = {
  'api gateway': { problemLabel: 'CLIENTS LOST', problemIcon: '\u{1F50C}', problemColor: '#E74C3C', questionText: 'Design an API Gateway', solutionLabels: ['Gateway', 'Auth', 'Rate Limit', 'Routing'], solutionColor: '#1DD1A1' },
  'caching': { problemLabel: 'DATABASE OVERLOADED', problemIcon: '\u{1F422}', problemColor: '#F39C12', questionText: 'How would you add caching?', solutionLabels: ['Cache Layer', 'TTL', 'Eviction', 'Invalidation'], solutionColor: '#FDB813' },
  'load balancing': { problemLabel: 'SERVER CRASHED', problemIcon: '\u{1F4A5}', problemColor: '#E74C3C', questionText: 'Design a load balancer', solutionLabels: ['Load Balancer', 'Health Check', 'Round Robin', 'Failover'], solutionColor: '#1DD1A1' },
  'database': { problemLabel: 'DATA CORRUPTED', problemIcon: '\u{1F5C3}', problemColor: '#8E44AD', questionText: 'Design the database layer', solutionLabels: ['Primary DB', 'Replica', 'Sharding', 'Backup'], solutionColor: '#A78BFA' },
  'microservices': { problemLabel: 'MONOLITH BREAKING', problemIcon: '\u{1F9F1}', problemColor: '#E74C3C', questionText: 'When to use microservices?', solutionLabels: ['Service A', 'Service B', 'API Gateway', 'Message Bus'], solutionColor: '#1DD1A1' },
  'message queue': { problemLabel: 'MESSAGES DROPPED', problemIcon: '\u{1F4E8}', problemColor: '#E74C3C', questionText: 'Design a message queue', solutionLabels: ['Producer', 'Queue', 'Consumer', 'DLQ'], solutionColor: '#F472B6' },
  'distributed': { problemLabel: 'NETWORK PARTITION', problemIcon: '\u{1F310}', problemColor: '#3498DB', questionText: 'Handle distributed failures', solutionLabels: ['Node A', 'Node B', 'Consensus', 'Replication'], solutionColor: '#1DD1A1' },
  'authentication': { problemLabel: 'SECURITY BREACH', problemIcon: '\u{1F513}', problemColor: '#E74C3C', questionText: 'Design auth system', solutionLabels: ['Auth Server', 'JWT', 'OAuth', 'Session'], solutionColor: '#27AE60' },
  'rate limiting': { problemLabel: 'API ABUSED', problemIcon: '\u{1F6AB}', problemColor: '#E74C3C', questionText: 'Implement rate limiting', solutionLabels: ['Token Bucket', 'Sliding Window', 'Counter', 'Throttle'], solutionColor: '#F39C12' },
  'consistent hashing': { problemLabel: 'REBALANCING CHAOS', problemIcon: '\u{1F504}', problemColor: '#F39C12', questionText: 'Explain consistent hashing', solutionLabels: ['Hash Ring', 'Virtual Nodes', 'Partition', 'Rebalance'], solutionColor: '#1DD1A1' },
  'circuit breaker': { problemLabel: 'CASCADE FAILURE', problemIcon: '\u{26A1}', problemColor: '#E74C3C', questionText: 'What is a circuit breaker?', solutionLabels: ['Closed', 'Open', 'Half-Open', 'Fallback'], solutionColor: '#1DD1A1' },
  'service discovery': { problemLabel: 'SERVICES UNREACHABLE', problemIcon: '\u{1F50D}', problemColor: '#E74C3C', questionText: 'Implement service discovery', solutionLabels: ['Registry', 'Health Check', 'DNS', 'Load Balancer'], solutionColor: '#3498DB' },
  'dns': { problemLabel: 'DOMAIN NOT FOUND', problemIcon: '\u{1F30D}', problemColor: '#E74C3C', questionText: 'How does DNS work?', solutionLabels: ['Resolver', 'Root NS', 'TLD NS', 'Auth NS'], solutionColor: '#3498DB' },
  'http': { problemLabel: 'REQUEST FAILED', problemIcon: '\u{1F4E1}', problemColor: '#E74C3C', questionText: 'Explain the HTTP lifecycle', solutionLabels: ['Client', 'TCP Handshake', 'Request', 'Response'], solutionColor: '#1DD1A1' },
  'tcp': { problemLabel: 'PACKETS LOST', problemIcon: '\u{1F4E6}', problemColor: '#E74C3C', questionText: 'How does TCP guarantee delivery?', solutionLabels: ['SYN', 'SYN-ACK', 'ACK', 'Data Transfer'], solutionColor: '#3498DB' },
  'websocket': { problemLabel: 'CONNECTION DROPPED', problemIcon: '\u{1F517}', problemColor: '#E74C3C', questionText: 'When to use WebSockets?', solutionLabels: ['Handshake', 'Upgrade', 'Full Duplex', 'Heartbeat'], solutionColor: '#1DD1A1' },
  'docker': { problemLabel: 'DEPENDENCY HELL', problemIcon: '\u{1F4E6}', problemColor: '#2496ED', questionText: 'Why use containers?', solutionLabels: ['Image', 'Container', 'Volume', 'Network'], solutionColor: '#2496ED' },
  'kubernetes': { problemLabel: 'ORCHESTRATION CHAOS', problemIcon: '\u{2388}', problemColor: '#326CE5', questionText: 'How does K8s orchestrate?', solutionLabels: ['Pod', 'Service', 'Deployment', 'Ingress'], solutionColor: '#326CE5' },
  'cdn': { problemLabel: 'HIGH LATENCY', problemIcon: '\u{1F30D}', problemColor: '#F39C12', questionText: 'How does a CDN work?', solutionLabels: ['Origin', 'Edge Node', 'Cache', 'PoP'], solutionColor: '#1DD1A1' },
  'reverse proxy': { problemLabel: 'EXPOSED SERVERS', problemIcon: '\u{1F6E1}', problemColor: '#E74C3C', questionText: 'What is a reverse proxy?', solutionLabels: ['Proxy', 'SSL Termination', 'Routing', 'Caching'], solutionColor: '#1DD1A1' },
  'sharding': { problemLabel: 'TABLE TOO LARGE', problemIcon: '\u{1FA93}', problemColor: '#8E44AD', questionText: 'When to shard a database?', solutionLabels: ['Shard Key', 'Shard 1', 'Shard 2', 'Router'], solutionColor: '#A78BFA' },
  'replication': { problemLabel: 'SINGLE POINT OF FAILURE', problemIcon: '\u{1F4CB}', problemColor: '#E74C3C', questionText: 'Explain database replication', solutionLabels: ['Primary', 'Replica 1', 'Replica 2', 'Sync'], solutionColor: '#1DD1A1' },
  'indexing': { problemLabel: 'FULL TABLE SCAN', problemIcon: '\u{1F50D}', problemColor: '#F39C12', questionText: 'How do indexes speed queries?', solutionLabels: ['B-Tree Index', 'Hash Index', 'Query', 'Result'], solutionColor: '#FDB813' },
  'sql': { problemLabel: 'QUERY TIMEOUT', problemIcon: '\u{1F4CA}', problemColor: '#3498DB', questionText: 'SQL vs NoSQL tradeoffs?', solutionLabels: ['Schema', 'ACID', 'Joins', 'Normalization'], solutionColor: '#3498DB' },
  'nosql': { problemLabel: 'RIGID SCHEMA', problemIcon: '\u{1F4C4}', problemColor: '#27AE60', questionText: 'When to choose NoSQL?', solutionLabels: ['Document', 'Key-Value', 'Column', 'Graph'], solutionColor: '#27AE60' },
  'concurrency': { problemLabel: 'RACE CONDITION', problemIcon: '\u{1F3C1}', problemColor: '#E74C3C', questionText: 'Handle concurrent access', solutionLabels: ['Lock', 'Semaphore', 'CAS', 'Thread Pool'], solutionColor: '#1DD1A1' },
  'deadlock': { problemLabel: 'SYSTEM FROZEN', problemIcon: '\u{1F9CA}', problemColor: '#E74C3C', questionText: 'How to prevent deadlocks?', solutionLabels: ['Detection', 'Prevention', 'Avoidance', 'Recovery'], solutionColor: '#1DD1A1' },
  'mutex': { problemLabel: 'DATA CORRUPTION', problemIcon: '\u{1F512}', problemColor: '#E74C3C', questionText: 'Mutex vs Semaphore', solutionLabels: ['Mutex', 'Lock', 'Unlock', 'Critical Section'], solutionColor: '#F39C12' },
  'event driven': { problemLabel: 'TIGHT COUPLING', problemIcon: '\u{1F4E2}', problemColor: '#8E44AD', questionText: 'Event-driven architecture?', solutionLabels: ['Publisher', 'Event Bus', 'Subscriber', 'Handler'], solutionColor: '#A78BFA' },
  'cqrs': { problemLabel: 'READ/WRITE BOTTLENECK', problemIcon: '\u{2194}', problemColor: '#3498DB', questionText: 'What is CQRS?', solutionLabels: ['Command', 'Query', 'Write DB', 'Read DB'], solutionColor: '#3498DB' },
  'saga': { problemLabel: 'DISTRIBUTED TXN FAILED', problemIcon: '\u{1F4DC}', problemColor: '#E74C3C', questionText: 'Saga pattern for transactions', solutionLabels: ['Step 1', 'Step 2', 'Compensate', 'Orchestrator'], solutionColor: '#1DD1A1' },
  'monitoring': { problemLabel: 'BLIND SPOT', problemIcon: '\u{1F441}', problemColor: '#F39C12', questionText: 'Design a monitoring system', solutionLabels: ['Metrics', 'Alerts', 'Dashboard', 'Log Agg'], solutionColor: '#FDB813' },
  'logging': { problemLabel: 'NO VISIBILITY', problemIcon: '\u{1F4DD}', problemColor: '#F39C12', questionText: 'Centralized logging design', solutionLabels: ['Agent', 'Collector', 'Storage', 'Search'], solutionColor: '#FDB813' },
  'tracing': { problemLabel: 'REQUEST LOST', problemIcon: '\u{1F50E}', problemColor: '#3498DB', questionText: 'Distributed tracing explained', solutionLabels: ['Trace ID', 'Span', 'Collector', 'Visualizer'], solutionColor: '#3498DB' },
  'elasticsearch': { problemLabel: 'SEARCH TOO SLOW', problemIcon: '\u{1F50D}', problemColor: '#F39C12', questionText: 'How does Elasticsearch work?', solutionLabels: ['Index', 'Shard', 'Inverted Index', 'Query DSL'], solutionColor: '#FDB813' },
  'blob storage': { problemLabel: 'FILES EVERYWHERE', problemIcon: '\u{1F4BE}', problemColor: '#3498DB', questionText: 'Design blob storage', solutionLabels: ['Upload', 'Chunk', 'Replicate', 'CDN Serve'], solutionColor: '#3498DB' },
  'mapreduce': { problemLabel: 'DATA TOO BIG', problemIcon: '\u{1F4CA}', problemColor: '#27AE60', questionText: 'How does MapReduce work?', solutionLabels: ['Split', 'Map', 'Shuffle', 'Reduce'], solutionColor: '#27AE60' },
  'kafka': { problemLabel: 'EVENT STREAM LOST', problemIcon: '\u{1F4E8}', problemColor: '#E74C3C', questionText: 'Why Kafka for streaming?', solutionLabels: ['Producer', 'Broker', 'Partition', 'Consumer'], solutionColor: '#1DD1A1' },
  'spark': { problemLabel: 'BATCH TOO SLOW', problemIcon: '\u{26A1}', problemColor: '#F39C12', questionText: 'Spark vs MapReduce', solutionLabels: ['Driver', 'Executor', 'RDD', 'DAG'], solutionColor: '#FDB813' },
  'leader election': { problemLabel: 'SPLIT BRAIN', problemIcon: '\u{1F451}', problemColor: '#E74C3C', questionText: 'How does leader election work?', solutionLabels: ['Candidate', 'Vote', 'Leader', 'Follower'], solutionColor: '#FDB813' },
  'gossip protocol': { problemLabel: 'NODES OUT OF SYNC', problemIcon: '\u{1F5E3}', problemColor: '#8E44AD', questionText: 'How gossip spreads state', solutionLabels: ['Node A', 'Gossip', 'Node B', 'Convergence'], solutionColor: '#A78BFA' },
  'vector clock': { problemLabel: 'CAUSAL ORDERING LOST', problemIcon: '\u{23F0}', problemColor: '#3498DB', questionText: 'Vector clocks for ordering', solutionLabels: ['Clock A', 'Clock B', 'Merge', 'Resolve'], solutionColor: '#3498DB' },
  'raft': { problemLabel: 'NO CONSENSUS', problemIcon: '\u{1F91D}', problemColor: '#E74C3C', questionText: 'Raft consensus algorithm', solutionLabels: ['Leader', 'Log', 'Commit', 'Follower'], solutionColor: '#1DD1A1' },
  'bloom filter': { problemLabel: 'WASTED LOOKUPS', problemIcon: '\u{1F338}', problemColor: '#8E44AD', questionText: 'How bloom filters save time', solutionLabels: ['Bit Array', 'Hash 1', 'Hash 2', 'Probabilistic'], solutionColor: '#A78BFA' },
  'lru cache': { problemLabel: 'CACHE MISS STORM', problemIcon: '\u{1F4A8}', problemColor: '#F39C12', questionText: 'Implement an LRU cache', solutionLabels: ['HashMap', 'Doubly Linked', 'Evict', 'O(1) Access'], solutionColor: '#FDB813' },
  'b-tree': { problemLabel: 'DISK SEEK SLOW', problemIcon: '\u{1F333}', problemColor: '#27AE60', questionText: 'Why databases use B-Trees', solutionLabels: ['Root', 'Internal', 'Leaf', 'Balanced'], solutionColor: '#27AE60' },
  'merkle tree': { problemLabel: 'DATA INTEGRITY LOST', problemIcon: '\u{1F332}', problemColor: '#27AE60', questionText: 'Merkle trees for verification', solutionLabels: ['Root Hash', 'Branch', 'Leaf Hash', 'Verify'], solutionColor: '#27AE60' },
  'skip list': { problemLabel: 'LINEAR SEARCH', problemIcon: '\u{23E9}', problemColor: '#3498DB', questionText: 'Skip list data structure', solutionLabels: ['Level 0', 'Level 1', 'Level 2', 'O(log n)'], solutionColor: '#3498DB' },
  'graphql': { problemLabel: 'OVER-FETCHING', problemIcon: '\u{1F4E5}', problemColor: '#E535AB', questionText: 'GraphQL vs REST', solutionLabels: ['Schema', 'Query', 'Resolver', 'Response'], solutionColor: '#E535AB' },
  'grpc': { problemLabel: 'SLOW SERIALIZATION', problemIcon: '\u{26A1}', problemColor: '#3498DB', questionText: 'Why use gRPC?', solutionLabels: ['Proto', 'Stub', 'Channel', 'Streaming'], solutionColor: '#3498DB' },
  'pagination': { problemLabel: 'TIMEOUT ON LARGE DATA', problemIcon: '\u{1F4C4}', problemColor: '#F39C12', questionText: 'Cursor vs Offset pagination', solutionLabels: ['Offset', 'Cursor', 'Keyset', 'Response'], solutionColor: '#FDB813' },
  'oauth': { problemLabel: 'UNAUTHORIZED ACCESS', problemIcon: '\u{1F511}', problemColor: '#E74C3C', questionText: 'OAuth 2.0 flow explained', solutionLabels: ['Client', 'Auth Server', 'Token', 'Resource'], solutionColor: '#27AE60' },
  'jwt': { problemLabel: 'TOKEN FORGERY', problemIcon: '\u{1F3AB}', problemColor: '#E74C3C', questionText: 'How JWT authentication works', solutionLabels: ['Header', 'Payload', 'Signature', 'Verify'], solutionColor: '#27AE60' },
  'scaling': { problemLabel: 'TRAFFIC SPIKE', problemIcon: '\u{1F4C8}', problemColor: '#E74C3C', questionText: 'Horizontal vs Vertical scaling', solutionLabels: ['Scale Out', 'Scale Up', 'Auto Scale', 'Metrics'], solutionColor: '#1DD1A1' },
  'cap theorem': { problemLabel: 'IMPOSSIBLE TRADEOFF', problemIcon: '\u{2696}', problemColor: '#8E44AD', questionText: 'Explain the CAP theorem', solutionLabels: ['Consistency', 'Availability', 'Partition', 'Tradeoff'], solutionColor: '#A78BFA' },
};

function getTopicVisuals(topic: string): TopicVisualConfig {
  const lower = topic.toLowerCase();
  const sortedKeys = Object.keys(TOPIC_VISUALS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) return TOPIC_VISUALS[key];
  }
  return {
    problemLabel: 'SYSTEM FAILURE',
    problemIcon: '\u{26A0}',
    problemColor: '#E74C3C',
    questionText: `Explain ${topic}`,
    solutionLabels: [topic, 'Architecture', 'Implementation', 'Optimization'],
    solutionColor: '#1DD1A1',
  };
}

// ── Layout Constants (1080x1920 portrait) ────────────────────────────────────
const WIDTH = 1080;
const HEIGHT = 1920;
const SAFE_TOP = 220;          // top safe zone (Instagram story bar + notch)
const SAFE_BOTTOM = 450;       // bottom safe zone (Instagram UI buttons)
const SAFE_RIGHT = 90;         // right safe zone (Instagram icons)
const CAPTION_Y_START = 1100;  // caption zone y start
const CAPTION_Y_END = 1400;    // caption zone y end
const CAPTION_HEIGHT = CAPTION_Y_END - CAPTION_Y_START;
const MARQUEE_HEIGHT = 52;
const CTA_BAR_HEIGHT = 64;
const HOOK_DURATION_FRAMES = 120;  // 4 seconds at 30fps (cinematic hook)
const OUTRO_DURATION_FRAMES = 90;  // 3 seconds at 30fps
const FADE_TRANSITION = 10;        // frames between scenes

// ── Props ─────────────────────────────────────────────────────────────────────
interface ViralShortProps {
  storyboard: Storyboard;
  clipStart?: number;   // scene index to start from (default 0)
  clipEnd?: number;     // scene index to end at (exclusive, default all)
}

// ── Helper: get active scene by audio time ────────────────────────────────────
function getActiveSceneByAudioTime(
  scenes: Scene[],
  audioTimeSeconds: number,
  sceneOffsets: number[],
): Scene | null {
  if (audioTimeSeconds < 0) return null;
  for (let i = scenes.length - 1; i >= 0; i--) {
    const offset = sceneOffsets[i] ?? scenes[i].audioOffsetSeconds ?? -1;
    if (offset === -1) continue;
    if (audioTimeSeconds >= offset) return scenes[i];
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED: Tech Grid Background (never plain black)
// ═══════════════════════════════════════════════════════════════════════════════
const TechGridBg: React.FC<{ frame: number; accentColor?: string }> = ({
  frame,
  accentColor = COLORS.saffron,
}) => {
  const keywords = ['async', 'await', 'class', 'function', 'return', 'import', 'const', 'deploy', 'scale', 'cache'];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(${accentColor}08 1px, transparent 1px),
            linear-gradient(90deg, ${accentColor}08 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 35%, ${accentColor}0C 0%, transparent 55%)`,
        }}
      />
      {keywords.map((kw, i) => {
        const x = (i * 10 + 2) % 100;
        const cycleFrame = (frame + i * 18) % 180;
        const y = (cycleFrame / 180) * 130 - 15;
        return (
          <div
            key={`kw-${i}`}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              fontSize: 14,
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
};

// ═══════════════════════════════════════════════════════════════════════════════
// CINEMATIC HOOK (first 4 seconds — topic-specific from TOPIC_VISUALS)
// ═══════════════════════════════════════════════════════════════════════════════
const CinematicHook: React.FC<{
  hookText: string;
  topic: string;
  fps: number;
}> = ({ hookText, topic, fps }) => {
  const frame = useCurrentFrame();
  const visuals = getTopicVisuals(topic);

  // Phase 1 (0-1.5s / 0-45f): Problem flash + icon + label
  const flashOp = interpolate(frame, [0, 4, 12], [0.8, 0.4, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const iconSpring = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });
  const iconScale = interpolate(iconSpring, [0, 1], [3, 1]);
  const iconOp = interpolate(frame, [5, 12, 50, 60], [0, 1, 1, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const labelOp = interpolate(frame, [8, 18, 50, 60], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelShake = frame < 30 ? Math.sin(frame * 2.5) * interpolate(frame, [8, 30], [5, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }) : 0;

  // Phase 2 (1.5-3s / 45-90f): Hook text slam
  const textSpring = spring({
    frame: Math.max(0, frame - 35),
    fps,
    config: { damping: 8, stiffness: 180, mass: 0.5 },
  });
  const textScale = interpolate(textSpring, [0, 1], [0.4, 1.0]);
  const textOp = interpolate(frame, [35, 42, 100, 115], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 3 (3-4s / 90-120f): Branding
  const brandSpring = spring({
    frame: Math.max(0, frame - 85),
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.8 },
  });
  const brandOp = interpolate(brandSpring, [0, 1], [0, 1]);
  const brandScale = interpolate(brandSpring, [0, 1], [0.8, 1.0]);

  // Energy particles burst from icon land
  const particleCount = 16;
  const particleElapsed = Math.max(0, frame - 5);

  // Alarm pulse (topic-specific color)
  const alarmPulse = frame < 50 ? interpolate(Math.sin(frame * 0.8), [-1, 1], [0, 0.08]) : 0;

  // Solution architecture boxes (Phase 2b)
  const boxCount = Math.min(4, Math.floor(interpolate(frame, [60, 95], [0, 4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));
  const boxOp = interpolate(frame, [60, 70, 100, 115], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Exit fade
  const exitOp = interpolate(frame, [108, 120], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        overflow: 'hidden',
        opacity: exitOp,
      }}
    >
      <TechGridBg frame={frame} accentColor={visuals.problemColor} />

      {/* Problem-color flash */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: visuals.problemColor, opacity: flashOp }} />

      {/* Alarm pulse */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: visuals.problemColor, opacity: alarmPulse }} />

      {/* Cinematic corner brackets */}
      {[
        { top: 30, left: 30, borderTop: `2px solid ${COLORS.saffron}`, borderLeft: `2px solid ${COLORS.saffron}` },
        { top: 30, right: 30, borderTop: `2px solid ${COLORS.saffron}`, borderRight: `2px solid ${COLORS.saffron}` },
        { bottom: 30, left: 30, borderBottom: `2px solid ${COLORS.saffron}`, borderLeft: `2px solid ${COLORS.saffron}` },
        { bottom: 30, right: 30, borderBottom: `2px solid ${COLORS.saffron}`, borderRight: `2px solid ${COLORS.saffron}` },
      ].map((style, i) => (
        <div
          key={`corner-${i}`}
          style={{
            position: 'absolute',
            width: 36,
            height: 36,
            opacity: interpolate(frame, [8, 20], [0, 0.5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            ...style,
          }}
        />
      ))}

      {/* Problem icon — large, springs in from center */}
      <div
        style={{
          position: 'absolute',
          top: '28%',
          left: '50%',
          transform: `translateX(-50%) scale(${iconScale})`,
          opacity: iconOp,
          fontSize: 80,
          textAlign: 'center',
        }}
      >
        {visuals.problemIcon}
      </div>

      {/* Problem label — shakes, topic-specific */}
      <div
        style={{
          position: 'absolute',
          top: '40%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: labelOp,
          transform: `translateX(${labelShake}px)`,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: visuals.problemColor,
            letterSpacing: 6,
            textShadow: `0 0 20px ${visuals.problemColor}66`,
          }}
        >
          {visuals.problemLabel}
        </span>
      </div>

      {/* Energy particle burst */}
      {particleElapsed < 40 && (
        <>
          {Array.from({ length: particleCount }, (_, i) => {
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 5 + (i % 4) * 2;
            const distance = particleElapsed * speed;
            const pOp = interpolate(particleElapsed, [0, 5, 25, 40], [0, 0.8, 0.3, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div
                key={`p-${i}`}
                style={{
                  position: 'absolute',
                  top: '35%',
                  left: '50%',
                  width: 3 + (i % 3),
                  height: 3 + (i % 3),
                  borderRadius: '50%',
                  backgroundColor: i % 3 === 0 ? COLORS.saffron : i % 3 === 1 ? COLORS.gold : COLORS.teal,
                  transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`,
                  opacity: pOp,
                  boxShadow: `0 0 6px ${i % 2 === 0 ? COLORS.saffron : COLORS.gold}`,
                }}
              />
            );
          })}
        </>
      )}

      {/* Hook text — big, centered, max 5 words per line */}
      <div
        style={{
          position: 'absolute',
          top: '46%',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          transform: `scale(${textScale})`,
          opacity: textOp,
          padding: '0 60px',
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontFamily: FONTS.heading,
            fontWeight: 900,
            color: COLORS.white,
            textAlign: 'center',
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
            textShadow: `0 0 40px ${visuals.problemColor}40, 0 4px 12px rgba(0,0,0,0.9)`,
            maxWidth: WIDTH - 120,
          }}
        >
          {hookText}
        </div>
      </div>

      {/* Solution architecture boxes (Phase 2b) */}
      <div
        style={{
          position: 'absolute',
          top: '68%',
          left: '8%',
          right: '8%',
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          flexWrap: 'wrap',
          opacity: boxOp,
        }}
      >
        {visuals.solutionLabels.slice(0, boxCount).map((label, i) => {
          const bSpring = spring({
            frame: Math.max(0, frame - 60 - i * 6),
            fps,
            config: { damping: 10, stiffness: 160 },
          });
          return (
            <div
              key={label}
              style={{
                width: 120,
                height: 48,
                border: `2px solid ${visuals.solutionColor}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `${visuals.solutionColor}15`,
                transform: `scale(${interpolate(bSpring, [0, 1], [0.3, 1])})`,
                opacity: interpolate(bSpring, [0, 1], [0, 1]),
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontFamily: FONTS.code,
                  color: visuals.solutionColor,
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* GURU SISHYA branding (Phase 3) */}
      <div
        style={{
          position: 'absolute',
          bottom: '18%',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          transform: `scale(${brandScale})`,
          opacity: brandOp,
        }}
      >
        <div
          style={{
            width: 160,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${COLORS.saffron}CC, ${COLORS.gold}FF, ${COLORS.saffron}CC, transparent)`,
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 28, fontFamily: FONTS.heading, fontWeight: 900, letterSpacing: -1 }}>
            <span style={{ color: COLORS.saffron }}>GURU</span>
            <span style={{ color: COLORS.gold }}> SISHYA</span>
          </span>
        </div>
        <span
          style={{
            fontSize: 14,
            fontFamily: FONTS.code,
            fontWeight: 600,
            color: `${COLORS.teal}CC`,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          Master Your Interview
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PORTRAIT TEXT SCENE
// ═══════════════════════════════════════════════════════════════════════════════
const PortraitText: React.FC<{ scene: Scene; fps: number; topic: string }> = ({ scene, fps, topic }) => {
  const frame = useCurrentFrame();

  // Extract key text — max 5 words visible (no bullets)
  const keyText = scene.heading || scene.narration?.split(/[.!?]/)[0]?.trim() || scene.content || topic;
  const words = keyText.split(' ').slice(0, 8).join(' ');

  const textSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180, mass: 0.8 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <TechGridBg frame={frame} />

      {/* Topic heading at top */}
      {scene.heading && (
        <div
          style={{
            position: 'absolute',
            top: SAFE_TOP + 20,
            left: 60,
            right: SAFE_RIGHT + 20,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: COLORS.gold,
              fontFamily: FONTS.heading,
              textTransform: 'uppercase',
              letterSpacing: 3,
              lineHeight: 1.3,
            }}
          >
            {scene.heading}
          </div>
          <div
            style={{
              width: 80,
              height: 3,
              background: `linear-gradient(90deg, ${COLORS.saffron}, transparent)`,
              marginTop: 10,
            }}
          />
        </div>
      )}

      {/* Main content — centered, large text */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          bottom: '35%',
          left: 60,
          right: SAFE_RIGHT + 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: interpolate(textSpring, [0, 1], [0, 1]),
          transform: `scale(${interpolate(textSpring, [0, 1], [0.9, 1])})`,
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: COLORS.white,
            fontFamily: FONTS.heading,
            textAlign: 'center',
            lineHeight: 1.4,
            textShadow: '0 4px 12px rgba(0,0,0,0.8)',
          }}
        >
          {words}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PORTRAIT CODE SCENE
// ═══════════════════════════════════════════════════════════════════════════════
const PortraitCode: React.FC<{ scene: Scene; fps: number }> = ({ scene, fps }) => {
  const frame = useCurrentFrame();
  const codeLines = (scene.content || '').split('\n').slice(0, 18);

  const revealSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 160, mass: 1.0 },
  });

  // Language detection for file tab
  const lang = scene.language || 'python';
  const langExt: Record<string, string> = {
    python: '.py',
    typescript: '.ts',
    javascript: '.js',
    java: '.java',
    go: '.go',
    rust: '.rs',
    cpp: '.cpp',
    c: '.c',
  };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <TechGridBg frame={frame} accentColor={COLORS.teal} />

      {/* Heading */}
      {scene.heading && (
        <div
          style={{
            position: 'absolute',
            top: SAFE_TOP + 20,
            left: 48,
            right: SAFE_RIGHT + 20,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: COLORS.white,
              fontFamily: FONTS.heading,
              lineHeight: 1.2,
            }}
          >
            {scene.heading}
          </div>
        </div>
      )}

      {/* IDE frame */}
      <div
        style={{
          position: 'absolute',
          top: SAFE_TOP + (scene.heading ? 100 : 20),
          left: 36,
          right: SAFE_RIGHT + 10,
          bottom: CAPTION_Y_START - 40,
          backgroundColor: '#1A1625',
          borderRadius: 16,
          border: `1px solid rgba(232, 93, 38, 0.2)`,
          overflow: 'hidden',
          opacity: interpolate(revealSpring, [0, 1], [0, 1]),
        }}
      >
        {/* Title bar with traffic lights */}
        <div
          style={{
            height: 36,
            background: '#151020',
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            gap: 8,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#FF5F57' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#FEBC2E' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#28C840' }} />
          <span
            style={{
              marginLeft: 12,
              fontSize: 13,
              fontFamily: FONTS.code,
              color: COLORS.gray,
              opacity: 0.7,
            }}
          >
            main{langExt[lang] || '.py'}
          </span>
        </div>

        {/* Code lines with typewriter + spotlight */}
        <div style={{ padding: '16px 20px', overflow: 'hidden' }}>
          {codeLines.map((line, i) => {
            const lineDelay = i * 3;
            const lineOpacity = interpolate(
              frame - lineDelay,
              [0, 8],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            );

            // Active line spotlight
            const activeLineIdx = Math.floor(frame / 12) % codeLines.length;
            const isActive = i === activeLineIdx;

            // Basic syntax highlighting
            const isComment = line.trimStart().startsWith('//') || line.trimStart().startsWith('#');
            const isKeyword = /^\s*(def |class |function |const |let |var |if |else |for |while |return |import |from |public |private |static |async )/.test(line);

            let lineColor: string = COLORS.white;
            if (isComment) lineColor = COLORS.gray;
            else if (isKeyword) lineColor = COLORS.teal;

            return (
              <div
                key={i}
                style={{
                  fontSize: 20,
                  fontFamily: FONTS.code,
                  color: lineColor,
                  lineHeight: 1.7,
                  whiteSpace: 'pre',
                  opacity: lineOpacity,
                  backgroundColor: isActive ? `${COLORS.saffron}10` : 'transparent',
                  borderLeft: isActive ? `3px solid ${COLORS.saffron}` : '3px solid transparent',
                  paddingLeft: 8,
                  marginLeft: -8,
                  transition: 'background-color 0.2s',
                }}
              >
                {line || ' '}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PORTRAIT DIAGRAM / VIZ SCENE
// ═══════════════════════════════════════════════════════════════════════════════
const PortraitViz: React.FC<{
  scene: Scene;
  topic: string;
  sceneIndex: number;
  sceneStartFrame: number;
}> = ({ scene, topic, sceneIndex, sceneStartFrame }) => {
  const frame = useCurrentFrame();
  const duration = scene.endFrame - scene.startFrame;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <TechGridBg frame={frame} />

      {/* Small heading for context */}
      {scene.heading && (
        <div
          style={{
            position: 'absolute',
            top: SAFE_TOP + 20,
            left: 48,
            right: SAFE_RIGHT + 20,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.saffron,
              fontFamily: FONTS.heading,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            {scene.heading}
          </div>
        </div>
      )}

      {/* ConceptViz fills middle 60% of screen */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: 24,
          right: 24,
          bottom: '25%',
          overflow: 'hidden',
        }}
      >
        <ConceptViz
          topic={topic}
          sceneIndex={sceneIndex}
          sceneStartFrame={sceneStartFrame}
          keywords={scene.bullets || []}
          sceneDuration={duration}
          vizVariant={scene.vizVariant}
        />
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MARQUEE TOP BAR
// ═══════════════════════════════════════════════════════════════════════════════
const MarqueeBar: React.FC = () => {
  const frame = useCurrentFrame();
  const text = '   guru-sishya.in   |   Master Your Interview   |   Subscribe for Daily Tips   |   FREE Questions   |   ';
  const repeats = text.repeat(4);
  const xOffset = -(frame * 2) % (text.length * 10);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: MARQUEE_HEIGHT,
        background: `linear-gradient(90deg, ${COLORS.saffron}DD, ${COLORS.gold}CC, ${COLORS.saffron}DD)`,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        zIndex: 80,
      }}
    >
      <div
        style={{
          whiteSpace: 'nowrap',
          fontSize: 16,
          fontFamily: FONTS.heading,
          fontWeight: 800,
          color: COLORS.dark,
          letterSpacing: 1,
          transform: `translateX(${xOffset}px)`,
        }}
      >
        {repeats}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CTA BOTTOM BAR
// ═══════════════════════════════════════════════════════════════════════════════
const CTABar: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.85, 1.0]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: SAFE_BOTTOM,
        left: 0,
        right: 0,
        height: CTA_BAR_HEIGHT,
        background: `linear-gradient(0deg, rgba(12,10,21,0.97), rgba(12,10,21,0.9))`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        zIndex: 70,
        opacity: pulse,
      }}
    >
      <span
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.white,
          fontFamily: FONTS.text,
        }}
      >
        Follow
      </span>
      <span
        style={{
          background: `linear-gradient(135deg, #833AB4, #FD1D1D, #F77737)`,
          borderRadius: 999,
          padding: '4px 16px',
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: COLORS.white,
            fontFamily: FONTS.text,
          }}
        >
          @guru_sishya.in
        </span>
      </span>
      <span style={{ width: 4, height: 4, borderRadius: 2, background: COLORS.gray }} />
      <span
        style={{
          fontSize: 16,
          color: COLORS.gray,
          fontWeight: 600,
          fontFamily: FONTS.text,
        }}
      >
        Comment &apos;guru-sishya&apos;
      </span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// OUTRO FRAME (3 seconds)
// ═══════════════════════════════════════════════════════════════════════════════
const OutroFrame: React.FC<{ topicSlug: string }> = ({ topicSlug }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Subscribe button
  const subSpring = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.6 },
  });
  const subScale = interpolate(subSpring, [0, 1], [0.5, 1]);
  const subPulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.92, 1.05]);

  // Brand spring
  const brandSpring = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.7 },
  });

  // Instagram CTA
  const instaSpring = spring({
    frame: Math.max(0, frame - 45),
    fps,
    config: { damping: 12, stiffness: 140, mass: 0.6 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <TechGridBg frame={frame} />

      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${COLORS.saffron}18, transparent 60%)`,
          filter: 'blur(40px)',
        }}
      />

      {/* LIKE & SUBSCRIBE button */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: `translateX(-50%) scale(${subScale * subPulse})`,
          opacity: interpolate(subSpring, [0, 1], [0, 1]),
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: `linear-gradient(135deg, ${COLORS.red}, #CC0000)`,
            borderRadius: 14,
            padding: '16px 40px',
            boxShadow: `0 4px 24px ${COLORS.red}66`,
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: '12px solid transparent',
              borderBottom: '12px solid transparent',
              borderLeft: `18px solid ${COLORS.white}`,
            }}
          />
          <span
            style={{
              fontSize: 28,
              fontFamily: FONTS.heading,
              fontWeight: 900,
              color: COLORS.white,
              letterSpacing: 2,
            }}
          >
            SUBSCRIBE
          </span>
        </div>
      </div>

      {/* guru-sishya.in — large */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(brandSpring, [0, 1], [0, 1]),
          transform: `scale(${interpolate(brandSpring, [0, 1], [0.8, 1])})`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <span style={{ fontSize: 36, fontFamily: FONTS.heading, fontWeight: 900, letterSpacing: -1 }}>
            <span style={{ color: COLORS.saffron }}>GURU</span>
            <span style={{ color: COLORS.gold }}> SISHYA</span>
          </span>
        </div>
        <div
          style={{
            width: 200,
            height: 2,
            margin: '12px auto',
            background: `linear-gradient(90deg, transparent, ${COLORS.saffron}CC, ${COLORS.gold}FF, ${COLORS.saffron}CC, transparent)`,
          }}
        />
        <div
          style={{
            backgroundColor: 'rgba(29, 209, 161, 0.15)',
            border: `2px solid ${COLORS.teal}`,
            borderRadius: 40,
            padding: '8px 24px',
            display: 'inline-block',
          }}
        >
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: COLORS.teal,
              fontFamily: FONTS.code,
            }}
          >
            guru-sishya.in/{topicSlug}
          </span>
        </div>
      </div>

      {/* Follow @guru_sishya.in */}
      <div
        style={{
          position: 'absolute',
          top: '70%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(instaSpring, [0, 1], [0, 1]),
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
            padding: '10px 28px',
            boxShadow: '0 2px 16px rgba(131, 58, 180, 0.4)',
          }}
        >
          <span
            style={{
              fontSize: 20,
              fontFamily: FONTS.text,
              fontWeight: 700,
              color: COLORS.white,
              letterSpacing: 1,
            }}
          >
            Follow @guru_sishya.in for daily tips
          </span>
        </div>
      </div>

      {/* Free questions count */}
      <div
        style={{
          position: 'absolute',
          top: '82%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(frame, [50, 60], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.gold,
            fontFamily: FONTS.heading,
          }}
        >
          5,800+ FREE Questions
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPOSITION — ViralShort
// ═══════════════════════════════════════════════════════════════════════════════

export const ViralShort: React.FC<ViralShortProps> = ({
  storyboard,
  clipStart = 0,
  clipEnd,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Slice scenes to the requested clip range ──
  const allContentScenes = storyboard.scenes.filter(
    (s) => s.type !== 'title' && s.type !== 'summary',
  );
  const endIdx = clipEnd ?? allContentScenes.length;
  const clipScenes = allContentScenes.slice(clipStart, endIdx);

  if (clipScenes.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
        <TechGridBg frame={0} />
        <div style={{ color: COLORS.white, fontSize: 40, textAlign: 'center', marginTop: 800 }}>
          No scenes in clip range
        </div>
      </AbsoluteFill>
    );
  }

  // ── Audio offset ──
  const audioStartOffset = (storyboard as any)._audioStartOffset ?? 0;
  const audioStartFrames = Math.round(audioStartOffset * fps);

  // ── Compute scene durations and total content frames ──
  const sceneDurations = clipScenes.map((s) => s.endFrame - s.startFrame);
  const totalContentFrames = sceneDurations.reduce((a, b) => a + b, 0);

  // ── Duration control: cap at 2700 frames (3 min) ──
  const maxContentFrames = 2700 - HOOK_DURATION_FRAMES - OUTRO_DURATION_FRAMES;
  let usedScenes = clipScenes;
  let usedDurations = sceneDurations;
  let usedContentFrames = totalContentFrames;

  if (totalContentFrames > maxContentFrames) {
    // Trim to fit within 3 minutes
    let cumulative = 0;
    let trimIdx = 0;
    for (let i = 0; i < sceneDurations.length; i++) {
      if (cumulative + sceneDurations[i] > maxContentFrames) break;
      cumulative += sceneDurations[i];
      trimIdx = i + 1;
    }
    usedScenes = clipScenes.slice(0, trimIdx);
    usedDurations = sceneDurations.slice(0, trimIdx);
    usedContentFrames = cumulative;
  }

  // ── Build SyncTimeline for caption sync ──
  const contentScenes = storyboard.scenes.slice(1, storyboard.scenes.length - 1);
  const syncTimeline = React.useMemo(() => {
    const offsets = storyboard.sceneOffsets || [];
    const timestamps = contentScenes.map((s) => s.wordTimestamps || []);
    return new SyncTimeline(offsets, timestamps, fps, HOOK_DURATION_FRAMES);
  }, [storyboard, fps]);

  setSyncTimeline(syncTimeline);

  // ── Active scene for captions (audio-time based) ──
  const audioTimeSeconds = (frame - HOOK_DURATION_FRAMES) / fps + audioStartOffset;
  const activeScene = getActiveSceneByAudioTime(
    contentScenes,
    audioTimeSeconds,
    storyboard.sceneOffsets || [],
  );
  const hasNarration =
    activeScene && activeScene.narration && activeScene.narration.trim() !== '';

  // ── Phase detection ──
  const isHook = frame < HOOK_DURATION_FRAMES;
  const isOutro = frame >= HOOK_DURATION_FRAMES + usedContentFrames;

  // ── Topic slug for outro link ──
  const topicSlug = storyboard.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // ── Hook text: first sentence of first scene's narration ──
  const hookText =
    usedScenes[0].narration?.split(/[.!?]/)[0]?.trim() ||
    usedScenes[0].heading ||
    storyboard.topic;

  // ── Compute cumulative scene start frames ──
  const cumulativeStarts: number[] = [];
  let cumulative = 0;
  for (const d of usedDurations) {
    cumulativeStarts.push(cumulative);
    cumulative += d;
  }

  // ── Transition pool for variety ──
  const transitions = [
    () => fade(),
    () => slide({ direction: 'from-bottom' }),
    () => fade(),
    () => slide({ direction: 'from-right' }),
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark, width: WIDTH, height: HEIGHT }}>
      {/* ── Cinematic Hook (4 seconds) ── */}
      <Sequence from={0} durationInFrames={HOOK_DURATION_FRAMES}>
        <CinematicHook
          hookText={hookText}
          topic={storyboard.topic}
          fps={fps}
        />
      </Sequence>

      {/* ── Content Scenes with transitions ── */}
      <Sequence from={HOOK_DURATION_FRAMES} durationInFrames={usedContentFrames}>
        <AbsoluteFill>
          <TransitionSeries>
            {usedScenes.map((scene, idx) => {
              const duration = usedDurations[idx];
              const sceneStartFrame = HOOK_DURATION_FRAMES + cumulativeStarts[idx];
              const isFirst = idx === 0;

              let sceneContent: React.ReactNode;
              if (scene.type === 'code') {
                sceneContent = <PortraitCode scene={scene} fps={fps} />;
              } else if (scene.type === 'diagram' || scene.type === 'table') {
                sceneContent = (
                  <PortraitViz
                    scene={scene}
                    topic={storyboard.topic}
                    sceneIndex={idx}
                    sceneStartFrame={sceneStartFrame}
                  />
                );
              } else {
                // text, interview, review — all use portrait text
                sceneContent = <PortraitText scene={scene} fps={fps} topic={storyboard.topic} />;
              }

              return (
                <React.Fragment key={idx}>
                  {!isFirst && (
                    <TransitionSeries.Transition
                      presentation={transitions[idx % transitions.length]()}
                      timing={linearTiming({ durationInFrames: FADE_TRANSITION })}
                    />
                  )}
                  <TransitionSeries.Sequence durationInFrames={duration}>
                    <AbsoluteFill>{sceneContent}</AbsoluteFill>
                  </TransitionSeries.Sequence>
                </React.Fragment>
              );
            })}
          </TransitionSeries>
        </AbsoluteFill>
      </Sequence>

      {/* ── Outro (3 seconds) ── */}
      <Sequence
        from={HOOK_DURATION_FRAMES + usedContentFrames}
        durationInFrames={OUTRO_DURATION_FRAMES}
      >
        <OutroFrame topicSlug={topicSlug} />
      </Sequence>

      {/* ── Marquee Top Bar (persistent during content) ── */}
      {!isHook && !isOutro && <MarqueeBar />}

      {/* ── Caption Overlay (center-lower, inside safe zone) ── */}
      {!isHook && !isOutro && hasNarration && activeScene && (
        <div
          style={{
            position: 'absolute',
            top: CAPTION_Y_START,
            left: 40,
            right: SAFE_RIGHT + 10,
            height: CAPTION_HEIGHT,
            zIndex: 60,
            clipPath: 'inset(0)',
          }}
        >
          <CaptionOverlay
            key={`caption-${activeScene.audioOffsetSeconds ?? activeScene.startFrame}`}
            text={activeScene.narration!}
            startFrame={
              activeScene.audioOffsetSeconds != null && activeScene.audioOffsetSeconds >= 0
                ? HOOK_DURATION_FRAMES + Math.round(activeScene.audioOffsetSeconds * fps)
                : HOOK_DURATION_FRAMES + activeScene.startFrame
            }
            durationInFrames={activeScene.endFrame - activeScene.startFrame}
            wordTimestamps={activeScene.wordTimestamps}
          />
        </div>
      )}

      {/* ── CTA Bottom Bar (persistent) ── */}
      {!isHook && !isOutro && <CTABar />}

      {/* ── Master Audio with startFrom for clip offset ── */}
      {storyboard.audioFile && (
        <Sequence from={HOOK_DURATION_FRAMES}>
          <Audio
            src={staticFile(`audio/${storyboard.audioFile.split('/').pop()}`)}
            startFrom={audioStartFrames}
            volume={(f) => {
              const baseVolume = 1.0;
              const fadeIn = interpolate(f, [0, 9], [0, 1], {
                extrapolateRight: 'clamp',
              });
              const fadeOut = interpolate(
                f,
                [usedContentFrames - 9, usedContentFrames],
                [1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              return baseVolume * fadeIn * fadeOut;
            }}
          />
        </Sequence>
      )}

      {/* ── SFX: Impact on hook entry ── */}
      <Sequence from={0} durationInFrames={30}>
        <Audio src={staticFile('audio/sfx/impact.wav')} volume={0.5} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default ViralShort;
