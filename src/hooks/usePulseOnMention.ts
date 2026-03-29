import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import type { CSSProperties } from 'react';

/**
 * Maps common narration keywords to component identifiers.
 * When the narrator says one of these words, the matching viz element pulses.
 */
const KEYWORD_TO_COMPONENT: Record<string, string> = {
  client: 'client',
  clients: 'client',
  user: 'client',
  users: 'client',
  'load balancer': 'loadbalancer',
  balancer: 'loadbalancer',
  server: 'server',
  servers: 'server',
  database: 'database',
  db: 'database',
  cache: 'cache',
  redis: 'cache',
  memcached: 'cache',
  queue: 'queue',
  'message queue': 'queue',
  kafka: 'queue',
  rabbitmq: 'queue',
  shard: 'shard',
  shards: 'shard',
  replica: 'replica',
  replicas: 'replica',
  primary: 'primary',
  master: 'primary',
  secondary: 'secondary',
  slave: 'secondary',
  node: 'node',
  nodes: 'node',
  bucket: 'bucket',
  buckets: 'bucket',
  hash: 'hash',
  'hash table': 'hashtable',
  'hash map': 'hashtable',
  tree: 'tree',
  root: 'root',
  leaf: 'leaf',
  graph: 'graph',
  edge: 'edge',
  vertex: 'node',
  stack: 'stack',
  heap: 'heap',
  'cdn': 'cdn',
  'api gateway': 'gateway',
  gateway: 'gateway',
  producer: 'producer',
  consumer: 'consumer',
  subscriber: 'subscriber',
  publisher: 'publisher',
};

export interface PulseState {
  activeComponent: string | null;
  pulseIntensity: number; // 0-1
}

export function usePulseOnMention(
  wordTimestamps: Array<{ word: string; start: number; end: number }> | undefined,
  sceneStartFrame: number,
): PulseState {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!wordTimestamps || wordTimestamps.length === 0) {
    return { activeComponent: null, pulseIntensity: 0 };
  }

  const relativeFrame = frame - sceneStartFrame;
  const currentTime = relativeFrame / fps;

  // Find the current word being spoken
  let currentWord = '';
  let matchTime = -1;
  for (const wt of wordTimestamps) {
    if (currentTime >= wt.start && currentTime <= wt.end + 0.3) {
      currentWord = wt.word.toLowerCase().replace(/[^a-z\s]/g, '');
      matchTime = wt.start;
    }
  }

  // Check if current word matches a component
  let activeComponent: string | null = null;

  // Try single word match
  if (KEYWORD_TO_COMPONENT[currentWord]) {
    activeComponent = KEYWORD_TO_COMPONENT[currentWord];
  }

  // Calculate pulse intensity (spring decay)
  if (activeComponent && matchTime >= 0) {
    const pulseElapsed = Math.max(0, (currentTime - matchTime) * fps);
    const decay = spring({
      frame: pulseElapsed,
      fps,
      config: { damping: 8, stiffness: 60, mass: 0.5 },
      durationInFrames: 20,
    });
    const intensity = Math.max(0, 1 - decay * 0.7);
    return { activeComponent, pulseIntensity: intensity };
  }

  return { activeComponent: null, pulseIntensity: 0 };
}

/**
 * Returns CSS style for a component that should pulse when mentioned.
 * Apply this to the component's container div/element.
 */
export function getPulseStyle(
  componentId: string,
  pulseState: PulseState,
  baseColor: string,
): CSSProperties {
  if (
    pulseState.activeComponent !== componentId ||
    pulseState.pulseIntensity <= 0
  ) {
    return {};
  }
  const i = pulseState.pulseIntensity;
  return {
    boxShadow: `0 0 ${20 * i}px ${8 * i}px ${baseColor}88`,
    transform: `scale(${1 + 0.05 * i})`,
  };
}
