/**
 * Procedural concept-diagram renderer for body scenes.
 *
 * Panel-21 Retention P0 (user-reported): "the video misses the graphic
 * representation of how kafka is being taught". Body scenes were
 * showing stock B-roll + caption text + mid-promise — but never the
 * actual concept. Viewers heard "consumer group reads partitions" and
 * stared at a generic developer typing on a laptop. Zero teaching.
 *
 * This module emits a deterministic ffmpeg filter chain (drawbox +
 * drawtext primitives only — no external assets, no PNG composites,
 * no random seeds) that draws a topic-specific architecture diagram
 * progressively across the scene's local timeline.
 *
 * Design constraints (in priority order):
 *   1. Byte-deterministic — same inputs ⇒ same SHA. No Date.now(),
 *      no Math.random(), all coords integer-clamped.
 *   2. Zero-cost — no licensed clipart, no svg-to-png conversion
 *      pipeline (Mermaid/D2 require headless chromium = nondeterministic
 *      timing artifacts in the per-frame raster).
 *   3. Progressive reveal — boxes/arrows fade in stage-by-stage so
 *      the diagram BUILDS as the narration explains it, instead of
 *      slamming the full graph onscreen at t=0 (which destroys the
 *      "teaching" cadence — viewers either skip ahead visually or
 *      bounce because the graph looks busy).
 *   4. Fits the 1080×1920 portrait safe zone, between the y=200
 *      hook tail and y=1080 caption band, with a 200-px notch
 *      (y=480..680) reserved for the mid-promise drawer.
 *   5. Topic-keyed registry with fuzzy slug match + a generic
 *      fallback so unknown topics still get a 3-step visual.
 */

/** Single rectangle node in the diagram. */
export interface DiagramNode {
  /** Stable id used to attach edges. */
  id: string;
  /** Top-left x in the 1080×1920 canvas (integer). */
  x: number;
  /** Top-left y (integer). */
  y: number;
  /** Width in pixels (integer). */
  w: number;
  /** Height in pixels (integer). */
  h: number;
  /** Hex fill color (no leading `#`, ffmpeg-style "RRGGBB"). */
  fill: string;
  /** Hex border color. */
  border: string;
  /** Primary label (single line, ≤ 14 chars renders cleanly at FS=36). */
  label: string;
  /** Optional second line below the label (≤ 18 chars at FS=24). */
  sublabel?: string;
  /** Reveal stage index (0 = first to appear, monotonically increasing). */
  stage: number;
  /** Highlight ring on a special stage (e.g. "the idle consumer"). */
  highlightStage?: number;
}

/**
 * Directed edge between two nodes. Always rendered as an axis-aligned
 * line with an arrowhead at `to`. We only support vertical-down and
 * down-then-horizontal kinks because diagonals on a 1080-wide canvas
 * read as "messy circuit diagram" at YT-Shorts thumbnail resolution.
 */
export interface DiagramEdge {
  from: string;
  to: string;
  stage: number;
}

export interface ConceptDiagram {
  /** Title bar text (drawn at top of diagram region). */
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

const TITLE_FILL = '0E1B2C';
const TITLE_BORDER = 'FFEB3B';

/** Diagram region: y=200..1060, with a y=480..680 notch for mid-promise. */
const DIAGRAM_TOP = 200;
const DIAGRAM_BOTTOM = 1060;

/** Apache Kafka producer→topic→consumer-group canonical visualization. */
function kafkaConsumerGroupsDiagram(): ConceptDiagram {
  return {
    title: 'KAFKA CONSUMER GROUPS',
    nodes: [
      { id: 'prod', x: 400, y: 300, w: 280, h: 80, fill: '2196F3', border: 'FFFFFF', label: 'Producer', stage: 1 },
      { id: 'p0', x: 220, y: 720, w: 200, h: 80, fill: '00897B', border: 'FFFFFF', label: 'P0', sublabel: 'partition', stage: 2 },
      { id: 'p1', x: 440, y: 720, w: 200, h: 80, fill: '00897B', border: 'FFFFFF', label: 'P1', sublabel: 'partition', stage: 2 },
      { id: 'p2', x: 660, y: 720, w: 200, h: 80, fill: '00897B', border: 'FFFFFF', label: 'P2', sublabel: 'partition', stage: 2 },
      { id: 'c1', x: 140, y: 880, w: 180, h: 80, fill: 'F57C00', border: 'FFFFFF', label: 'C1', sublabel: 'reads P0', stage: 3 },
      { id: 'c2', x: 340, y: 880, w: 180, h: 80, fill: 'F57C00', border: 'FFFFFF', label: 'C2', sublabel: 'reads P1', stage: 3 },
      { id: 'c3', x: 540, y: 880, w: 180, h: 80, fill: 'F57C00', border: 'FFFFFF', label: 'C3', sublabel: 'reads P2', stage: 3 },
      { id: 'c4', x: 740, y: 880, w: 180, h: 80, fill: '4A4A4A', border: 'F44336', label: 'C4', sublabel: 'IDLE', stage: 4, highlightStage: 4 },
    ],
    edges: [
      { from: 'prod', to: 'p1', stage: 1 },
      { from: 'p0', to: 'c1', stage: 3 },
      { from: 'p1', to: 'c2', stage: 3 },
      { from: 'p2', to: 'c3', stage: 3 },
    ],
  };
}

function kafkaPartitioningDiagram(): ConceptDiagram {
  return {
    title: 'KAFKA PARTITIONING',
    nodes: [
      { id: 'msg', x: 400, y: 300, w: 280, h: 80, fill: '2196F3', border: 'FFFFFF', label: 'Producer', sublabel: 'key=user_id', stage: 1 },
      { id: 'hash', x: 380, y: 410, w: 320, h: 60, fill: '7B1FA2', border: 'FFFFFF', label: 'hash(key) % N', stage: 2 },
      { id: 'p0', x: 220, y: 720, w: 200, h: 80, fill: '00897B', border: 'FFFFFF', label: 'P0', sublabel: 'ordered', stage: 3 },
      { id: 'p1', x: 440, y: 720, w: 200, h: 80, fill: '00897B', border: 'FFFFFF', label: 'P1', sublabel: 'ordered', stage: 3 },
      { id: 'p2', x: 660, y: 720, w: 200, h: 80, fill: '00897B', border: 'FFFFFF', label: 'P2', sublabel: 'ordered', stage: 3 },
      { id: 'rule', x: 90, y: 880, w: 900, h: 70, fill: '0E1B2C', border: 'FFEB3B', label: 'same key → same partition', stage: 4, highlightStage: 4 },
    ],
    edges: [
      { from: 'msg', to: 'hash', stage: 2 },
      { from: 'hash', to: 'p1', stage: 3 },
    ],
  };
}

function loadBalancerDiagram(): ConceptDiagram {
  return {
    title: 'LOAD BALANCING',
    nodes: [
      { id: 'client', x: 400, y: 300, w: 280, h: 80, fill: '2196F3', border: 'FFFFFF', label: 'Clients', sublabel: '10K req/s', stage: 1 },
      { id: 'lb', x: 350, y: 410, w: 380, h: 70, fill: 'D32F2F', border: 'FFFFFF', label: 'Load Balancer', stage: 2 },
      { id: 's1', x: 180, y: 730, w: 200, h: 80, fill: '00897B', border: 'FFFFFF', label: 'Server 1', sublabel: 'healthy', stage: 3 },
      { id: 's2', x: 440, y: 730, w: 200, h: 80, fill: '00897B', border: 'FFFFFF', label: 'Server 2', sublabel: 'healthy', stage: 3 },
      { id: 's3', x: 700, y: 730, w: 200, h: 80, fill: '4A4A4A', border: 'F44336', label: 'Server 3', sublabel: 'DOWN', stage: 4, highlightStage: 4 },
      { id: 'rule', x: 90, y: 880, w: 900, h: 70, fill: '0E1B2C', border: 'FFEB3B', label: 'health-check skips dead nodes', stage: 4 },
    ],
    edges: [
      { from: 'client', to: 'lb', stage: 2 },
      { from: 'lb', to: 's1', stage: 3 },
      { from: 'lb', to: 's2', stage: 3 },
      { from: 'lb', to: 's3', stage: 3 },
    ],
  };
}

function redisCachingDiagram(): ConceptDiagram {
  return {
    title: 'CACHE-ASIDE PATTERN',
    nodes: [
      { id: 'app', x: 400, y: 300, w: 280, h: 80, fill: '2196F3', border: 'FFFFFF', label: 'App', stage: 1 },
      { id: 'cache', x: 140, y: 720, w: 380, h: 90, fill: 'D32F2F', border: 'FFFFFF', label: 'Redis Cache', sublabel: '1ms · TTL=60s', stage: 2 },
      { id: 'db', x: 560, y: 720, w: 380, h: 90, fill: '7B1FA2', border: 'FFFFFF', label: 'Database', sublabel: '50ms · source of truth', stage: 3 },
      { id: 'rule', x: 90, y: 880, w: 900, h: 70, fill: '0E1B2C', border: 'FFEB3B', label: 'miss → DB → set cache', stage: 4, highlightStage: 4 },
    ],
    edges: [
      { from: 'app', to: 'cache', stage: 2 },
      { from: 'cache', to: 'db', stage: 3 },
    ],
  };
}

function pubSubDiagram(): ConceptDiagram {
  return {
    title: 'PUB / SUB',
    nodes: [
      { id: 'pub', x: 400, y: 300, w: 280, h: 80, fill: '2196F3', border: 'FFFFFF', label: 'Publisher', stage: 1 },
      { id: 'topic', x: 280, y: 420, w: 520, h: 70, fill: '7B1FA2', border: 'FFFFFF', label: 'Topic / Channel', stage: 2 },
      { id: 's1', x: 100, y: 730, w: 280, h: 80, fill: '00897B', border: 'FFFFFF', label: 'Subscriber A', sublabel: 'email', stage: 3 },
      { id: 's2', x: 400, y: 730, w: 280, h: 80, fill: '00897B', border: 'FFFFFF', label: 'Subscriber B', sublabel: 'sms', stage: 3 },
      { id: 's3', x: 700, y: 730, w: 280, h: 80, fill: '00897B', border: 'FFFFFF', label: 'Subscriber C', sublabel: 'analytics', stage: 3 },
      { id: 'rule', x: 90, y: 880, w: 900, h: 70, fill: '0E1B2C', border: 'FFEB3B', label: 'one publish → fan-out', stage: 4, highlightStage: 4 },
    ],
    edges: [
      { from: 'pub', to: 'topic', stage: 2 },
      { from: 'topic', to: 's1', stage: 3 },
      { from: 'topic', to: 's2', stage: 3 },
      { from: 'topic', to: 's3', stage: 3 },
    ],
  };
}

function microservicesDiagram(): ConceptDiagram {
  return {
    title: 'MICROSERVICES',
    nodes: [
      { id: 'gw', x: 350, y: 300, w: 380, h: 80, fill: 'D32F2F', border: 'FFFFFF', label: 'API Gateway', stage: 1 },
      { id: 'auth', x: 100, y: 720, w: 240, h: 90, fill: '00897B', border: 'FFFFFF', label: 'Auth', sublabel: 'JWT · OAuth', stage: 2 },
      { id: 'order', x: 380, y: 720, w: 240, h: 90, fill: '2196F3', border: 'FFFFFF', label: 'Orders', sublabel: 'gRPC', stage: 2 },
      { id: 'pay', x: 660, y: 720, w: 320, h: 90, fill: '7B1FA2', border: 'FFFFFF', label: 'Payments', sublabel: 'idempotent', stage: 2 },
      { id: 'rule', x: 90, y: 880, w: 900, h: 70, fill: '0E1B2C', border: 'FFEB3B', label: 'each service = own DB', stage: 3, highlightStage: 3 },
    ],
    edges: [
      { from: 'gw', to: 'auth', stage: 2 },
      { from: 'gw', to: 'order', stage: 2 },
      { from: 'gw', to: 'pay', stage: 2 },
    ],
  };
}

function dbIndexingDiagram(): ConceptDiagram {
  return {
    title: 'DATABASE INDEX',
    nodes: [
      { id: 'q', x: 400, y: 300, w: 280, h: 80, fill: '2196F3', border: 'FFFFFF', label: 'WHERE id=42', stage: 1 },
      { id: 'noidx', x: 90, y: 460, w: 440, h: 90, fill: 'F57C00', border: 'FFFFFF', label: 'No index', sublabel: 'O(N) full scan', stage: 2 },
      { id: 'idx', x: 550, y: 460, w: 440, h: 90, fill: '00897B', border: 'FFFFFF', label: 'B-tree index', sublabel: 'O(log N)', stage: 3 },
      { id: 'rule', x: 90, y: 880, w: 900, h: 70, fill: '0E1B2C', border: 'FFEB3B', label: '1M rows: 800ms → 2ms', stage: 4, highlightStage: 4 },
    ],
    edges: [
      { from: 'q', to: 'idx', stage: 3 },
    ],
  };
}

function oauthDiagram(): ConceptDiagram {
  return {
    title: 'OAUTH 2.0 FLOW',
    nodes: [
      { id: 'user', x: 60, y: 300, w: 280, h: 80, fill: '2196F3', border: 'FFFFFF', label: 'User', stage: 1 },
      { id: 'app', x: 400, y: 300, w: 280, h: 80, fill: '7B1FA2', border: 'FFFFFF', label: 'Your App', stage: 1 },
      { id: 'auth', x: 740, y: 300, w: 280, h: 80, fill: 'D32F2F', border: 'FFFFFF', label: 'Auth Server', stage: 1 },
      { id: 'code', x: 90, y: 540, w: 900, h: 60, fill: '00897B', border: 'FFFFFF', label: '1) get authorization code', stage: 2 },
      { id: 'token', x: 90, y: 720, w: 900, h: 60, fill: '00897B', border: 'FFFFFF', label: '2) exchange code → access_token', stage: 3 },
      { id: 'rule', x: 90, y: 880, w: 900, h: 70, fill: '0E1B2C', border: 'FFEB3B', label: 'never store passwords', stage: 4, highlightStage: 4 },
    ],
    edges: [],
  };
}

function websocketDiagram(): ConceptDiagram {
  return {
    title: 'HTTP vs WEBSOCKET',
    nodes: [
      { id: 'http', x: 90, y: 320, w: 440, h: 90, fill: 'F57C00', border: 'FFFFFF', label: 'HTTP', sublabel: 'request/response', stage: 1 },
      { id: 'ws', x: 550, y: 320, w: 440, h: 90, fill: '00897B', border: 'FFFFFF', label: 'WebSocket', sublabel: 'full duplex', stage: 2 },
      { id: 'http2', x: 90, y: 720, w: 440, h: 80, fill: '4A4A4A', border: 'FFFFFF', label: 'new TCP each time', stage: 1 },
      { id: 'ws2', x: 550, y: 720, w: 440, h: 80, fill: '2196F3', border: 'FFFFFF', label: 'one persistent conn', stage: 2 },
      { id: 'rule', x: 90, y: 880, w: 900, h: 70, fill: '0E1B2C', border: 'FFEB3B', label: 'realtime → WebSocket', stage: 3, highlightStage: 3 },
    ],
    edges: [],
  };
}

function genericThreePointDiagram(topicLabel: string): ConceptDiagram {
  const upper = topicLabel.toUpperCase();
  return {
    title: upper.length > 22 ? upper.slice(0, 22) : upper,
    nodes: [
      { id: 'one', x: 90, y: 320, w: 900, h: 90, fill: '2196F3', border: 'FFFFFF', label: '1   What it is', stage: 1 },
      { id: 'two', x: 90, y: 720, w: 900, h: 90, fill: '7B1FA2', border: 'FFFFFF', label: '2   How it works', stage: 2 },
      { id: 'three', x: 90, y: 880, w: 900, h: 90, fill: 'F57C00', border: 'FFEB3B', label: '3   Why FAANG asks', stage: 3, highlightStage: 3 },
    ],
    edges: [],
  };
}

/**
 * Resolve a topic slug (e.g. "kafka-consumer-groups") to a diagram
 * template via prefix/keyword fuzzy match. Returns the generic 3-point
 * fallback if no template matches — so every body scene gets a
 * concept visualization, even for new topics in the bank.
 */
export function getConceptDiagram(topicSlug: string, displayLabel?: string): ConceptDiagram {
  const slug = topicSlug.toLowerCase();
  const label = displayLabel ?? topicSlug.replace(/-/g, ' ');
  if (slug.includes('kafka') && (slug.includes('consumer') || slug.includes('group'))) return kafkaConsumerGroupsDiagram();
  if (slug.includes('kafka') && slug.includes('partition')) return kafkaPartitioningDiagram();
  if (slug.includes('kafka')) return kafkaConsumerGroupsDiagram();
  if (slug.includes('load') && slug.includes('balanc')) return loadBalancerDiagram();
  if (slug.includes('cache') || slug.includes('redis')) return redisCachingDiagram();
  if (slug.includes('pubsub') || slug.includes('pub-sub') || slug.includes('publish-subscribe')) return pubSubDiagram();
  if (slug.includes('microservice') || slug.includes('monolith')) return microservicesDiagram();
  if (slug.includes('index') && (slug.includes('database') || slug.includes('db') || slug.includes('sql'))) return dbIndexingDiagram();
  if (slug.includes('oauth') || slug.includes('jwt') || slug.includes('auth')) return oauthDiagram();
  if (slug.includes('websocket') || slug.includes('socket')) return websocketDiagram();
  return genericThreePointDiagram(label);
}

/** Escape a string for safe use inside ffmpeg drawtext text='...'. */
function escapeDrawtext(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%');
}

/**
 * Compute the absolute reveal time (in seconds, scene-local) for a
 * given stage index, given the scene's total duration. Stages start
 * at t=1.9s on the body scene (right after the mid-promise drawer at
 * t=1.8s) — but on the closing scene (no mid-promise drawer) we can
 * start at t=0.3 since the diagram region is empty out of the gate.
 *
 * Reveal pacing aims for "fully built by scene-mid" so the assembled
 * graph holds visible for the back half. If the entire scene is
 * shorter than ~3s, stages collapse onto a single early reveal —
 * better than half the diagram getting cut off mid-build.
 */
function paceStage(stage: number, totalStages: number, sceneDur: number, startT: number): number {
  const start = startT;
  // Pack all reveals into the first 60% of the post-startT window so
  // the diagram is fully assembled with ~40% of the scene left to
  // hold. Was: reveal-window=full-scene which left only ~0.3s of
  // "fully-built hold" before the cut.
  const revealWindowEnd = start + Math.max(0.6, (sceneDur - start) * 0.6);
  const end = Math.max(start + 0.4, Math.min(revealWindowEnd, sceneDur - 0.2));
  if (totalStages <= 1) return start;
  const span = end - start;
  const t = start + (span * (stage - 1)) / (totalStages - 1);
  return Math.max(start, Math.min(t, sceneDur - 0.05));
}

export interface DiagramFilterOptions {
  /** ffmpeg `:fontfile=...` arg fragment for Latin glyphs. */
  fontArg: string;
  /**
   * Resolver that returns the right `:fontfile=...` arg for a given
   * label. Mirrors composer.ts fontArgFor so Devanagari falls through
   * to the lohit/noto font when a sublabel contains Hindi script.
   */
  fontArgFor: (line: string) => string;
  /**
   * Earliest scene-local time (sec) at which stage 0 may reveal.
   * On a body scene that carries a mid-promise drawer (t=0..1.8s)
   * pass startT=1.9 so the diagram doesn't compete with the drawer.
   * On the closing scene (no drawer) pass startT=0.3 to maximize
   * on-screen visibility. Default 1.9.
   */
  startT?: number;
  /**
   * Scene-local time (sec) at which the diagram should hide. Used on
   * the closing scene to cede the y=200..1060 region to the end-card
   * CTA in the last 2s. Pass `sceneDur - 2.0` for the closing scene;
   * omit on body scenes (diagram visible to end of scene).
   */
  hideAfter?: number;
  /**
   * If true, ALL stages reveal at `startT` instead of pacing across
   * the scene. Used on the closing scene where the diagram has
   * already "lived" through the body scene — the viewer expects to
   * see it fully assembled the moment the scene cut lands, not to
   * watch it rebuild stage-by-stage.
   */
  instant?: boolean;
}

/**
 * Build the ffmpeg filter-chain fragments that draw `diagram` over the
 * scene video. Returns an array of filter strings ready to be pushed
 * into the existing `filters` array in composer.processScene.
 *
 * Background panels are TRANSPARENT (no fill drawboxes) — the viewer
 * sees the underlying B-roll/synthetic gradient through the diagram,
 * with each node defined by a colored 3-px border ring. Labels carry
 * a thick black stroke (borderw=5) so text stays legible against any
 * background luminance. Per Panel-21 user feedback: solid drawbox
 * fills made the diagram feel like a static slide overlaid on top of
 * the video — losing the "live teaching" feel. Transparent borders
 * keep the diagram structurally clear while the footage breathes
 * through.
 */
export function buildDiagramFilters(
  diagram: ConceptDiagram,
  sceneDurationSec: number,
  opts: DiagramFilterOptions,
): string[] {
  const filters: string[] = [];
  const startT = opts.startT ?? 1.9;
  const hideAfter = opts.hideAfter;
  const allStages = [
    0,
    ...diagram.nodes.map(n => n.stage),
    ...diagram.nodes.flatMap(n => n.highlightStage !== undefined ? [n.highlightStage] : []),
    ...diagram.edges.map(e => e.stage),
  ];
  const maxStage = Math.max(...allStages);

  const enableFor = (stage: number): string => {
    const t = opts.instant
      ? startT
      : paceStage(stage, maxStage + 1, sceneDurationSec, startT);
    if (hideAfter !== undefined) {
      return `enable='gte(t,${t.toFixed(3)})*lt(t,${hideAfter.toFixed(3)})'`;
    }
    return `enable='gte(t,${t.toFixed(3)})'`;
  };

  // Title bar: TRANSPARENT — only a 3-px yellow border ring + the text
  // itself with a heavy black outline. No fill drawbox so the underlying
  // footage shows through. Was: 0E1B2C@0.92 fill, which created an
  // opaque "slide overlay" feel that the user explicitly called out.
  const titleEnable = enableFor(0);
  filters.push(`drawbox=x=60:y=${DIAGRAM_TOP}:w=960:h=80:color=0x${TITLE_BORDER}@0.95:t=3:${titleEnable}`);
  filters.push(
    `drawtext=text='${escapeDrawtext(diagram.title)}'${opts.fontArgFor(diagram.title)}:` +
    `fontcolor=white:fontsize=44:borderw=5:bordercolor=black@0.95:` +
    `x=(w-text_w)/2:y=${DIAGRAM_TOP + 18}:${titleEnable}`,
  );

  // Nodes: transparent fill, colored border ring, label with thick
  // black stroke. Highlight ring stays (it's a visual punchline cue,
  // not a fill). Drop-shadow removed — it leaks dark blobs under the
  // transparent borders and reads as a render artifact.
  for (const n of diagram.nodes) {
    if (n.y < DIAGRAM_TOP || n.y + n.h > DIAGRAM_BOTTOM) {
      continue;
    }
    const enable = enableFor(n.stage);
    filters.push(`drawbox=x=${n.x}:y=${n.y}:w=${n.w}:h=${n.h}:color=0x${n.fill}@0.95:t=3:${enable}`);

    if (n.highlightStage !== undefined) {
      const hEnable = enableFor(n.highlightStage);
      filters.push(`drawbox=x=${n.x - 6}:y=${n.y - 6}:w=${n.w + 12}:h=${n.h + 12}:color=0xFFEB3B@0.95:t=4:${hEnable}`);
    }

    const labelFs = n.label.length > 16 ? 30 : 36;
    const labelY = n.sublabel ? n.y + 12 : n.y + Math.round((n.h - labelFs) / 2) - 4;
    filters.push(
      `drawtext=text='${escapeDrawtext(n.label)}'${opts.fontArgFor(n.label)}:` +
      `fontcolor=white:fontsize=${labelFs}:borderw=5:bordercolor=black@0.95:` +
      `x=${n.x}+(${n.w}-text_w)/2:y=${labelY}:${enable}`,
    );
    if (n.sublabel) {
      filters.push(
        `drawtext=text='${escapeDrawtext(n.sublabel)}'${opts.fontArgFor(n.sublabel)}:` +
        `fontcolor=white:fontsize=22:borderw=4:bordercolor=black@0.95:` +
        `x=${n.x}+(${n.w}-text_w)/2:y=${n.y + n.h - 30}:${enable}`,
      );
    }
  }

  // Edges (vertical-down preferred; arrowhead = a small triangle drawbox).
  const nodeById = new Map(diagram.nodes.map(n => [n.id, n]));
  for (const e of diagram.edges) {
    const a = nodeById.get(e.from);
    const b = nodeById.get(e.to);
    if (!a || !b) continue;
    const enable = enableFor(e.stage);
    const x1 = a.x + Math.round(a.w / 2);
    const y1 = a.y + a.h;
    const x2 = b.x + Math.round(b.w / 2);
    const y2 = b.y;
    if (y2 <= y1 + 4) continue;

    if (Math.abs(x1 - x2) < 4) {
      // Straight vertical line.
      filters.push(`drawbox=x=${x1 - 2}:y=${y1}:w=4:h=${y2 - y1 - 8}:color=0xFFEB3B@0.9:t=fill:${enable}`);
    } else {
      // L-shape: down to mid-Y, across, then short stub down.
      const midY = y1 + Math.round((y2 - y1) / 2);
      filters.push(`drawbox=x=${x1 - 2}:y=${y1}:w=4:h=${midY - y1}:color=0xFFEB3B@0.9:t=fill:${enable}`);
      const fromX = Math.min(x1, x2);
      const segW = Math.abs(x2 - x1);
      filters.push(`drawbox=x=${fromX}:y=${midY - 2}:w=${segW}:h=4:color=0xFFEB3B@0.9:t=fill:${enable}`);
      filters.push(`drawbox=x=${x2 - 2}:y=${midY}:w=4:h=${y2 - midY - 8}:color=0xFFEB3B@0.9:t=fill:${enable}`);
    }
    // Arrowhead triangle approximated as 3 stacked drawboxes pointing down.
    filters.push(`drawbox=x=${x2 - 12}:y=${y2 - 10}:w=24:h=4:color=0xFFEB3B@0.95:t=fill:${enable}`);
    filters.push(`drawbox=x=${x2 - 8}:y=${y2 - 6}:w=16:h=4:color=0xFFEB3B@0.95:t=fill:${enable}`);
    filters.push(`drawbox=x=${x2 - 4}:y=${y2 - 2}:w=8:h=4:color=0xFFEB3B@0.95:t=fill:${enable}`);
  }

  return filters;
}
