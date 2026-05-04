/**
 * thumbnail-text.ts — Deterministic 4-word punchy hook-text generator.
 *
 * Rules (from specialist-findings.md Thumbnail Engineering Review §C):
 *   • Max 4 words — enforced: truncated to 4 if over
 *   • ALL CAPS output
 *   • Pattern: <TECH> <STRONG-VERB/ADJ>? (optional) + curiosity gap / fear of loss
 *   • Must work for: Kafka, System Design, DSA, Redis, Kubernetes, gRPC, React, JWT…
 *   • Fully deterministic — no Math.random(), uses djb2 hash on topic string
 */

// ---------------------------------------------------------------------------
// djb2 hash — integer, deterministic, collision-resistant enough for UX use
// ---------------------------------------------------------------------------

export function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash;
}

// ---------------------------------------------------------------------------
// Topic → canonical tech label (for display in hook text)
// ---------------------------------------------------------------------------

function extractTechLabel(topic: string): string {
  const lower = topic.toLowerCase();

  const exactMap: Record<string, string> = {
    kafka: 'KAFKA',
    redis: 'REDIS',
    kubernetes: 'K8S',
    docker: 'DOCKER',
    graphql: 'GRAPHQL',
    grpc: 'GRPC',
    nginx: 'NGINX',
    postgresql: 'POSTGRES',
    postgres: 'POSTGRES',
    mongodb: 'MONGODB',
    elasticsearch: 'ELASTIC',
    rabbitmq: 'RABBITMQ',
    websocket: 'WEBSOCKET',
    jwt: 'JWT',
    oauth: 'OAUTH',
    react: 'REACT',
    typescript: 'TYPESCRIPT',
    javascript: 'JAVASCRIPT',
    java: 'JAVA',
    python: 'PYTHON',
    golang: 'GOLANG',
    rust: 'RUST',
  };

  for (const [key, label] of Object.entries(exactMap)) {
    if (lower.includes(key)) return label;
  }

  // Fallback: take first "word" of topic, uppercase, max 8 chars
  const firstWord = topic.trim().split(/[\s_-]/)[0].toUpperCase().slice(0, 8);
  return firstWord || 'THIS';
}

// ---------------------------------------------------------------------------
// Hook-text pattern banks — indexed by category
// Each entry is exactly 4 words (or fewer — all are <= 4 after split)
// ---------------------------------------------------------------------------

type PatternBank = readonly string[];

const MESSAGING_PATTERNS: PatternBank = [
  '{TECH} WRONG? WATCH THIS',
  '90% MISS {TECH}',
  '{TECH} TRAP EXPOSED',
  // Panel-18 Dist P0 (Schiffer/Blake): 'FAANG USES {TECH} WHY' was a
  // grammatically incomplete English fragment that read like noise on
  // the Shorts shelf for 4 consecutive batches (P15-P17 flagged it,
  // P18 escalated to P0). 'WHY FAANG RUNS {TECH}' restores natural
  // English question rhythm while keeping the FAANG salary trigger
  // and {TECH} slot. ≤4 words after substitution.
  'WHY FAANG RUNS {TECH}',
  '{TECH} KILLS YOUR APP',
  'STOP MISUSING {TECH}',
  '{TECH} IN 60 SECS',
];

const DATABASE_PATTERNS: PatternBank = [
  '{TECH} OR YOU LOSE',
  '90% INDEX WRONG',
  '{TECH} QUERY KILLS APP',
  'FAANG ASKS {TECH} THIS',
  '{TECH} TRAP AHEAD',
  'CACHE THIS NOT THAT',
  'SQL VS {TECH} WINNER',
];

const DSA_PATTERNS: PatternBank = [
  'FAANG ASKS THIS DAILY',
  '90% FAIL THIS',
  'TRICK THEY HIDE',
  'SOLVE IN 3 MINS',
  'FAANG TRICK EXPOSED',
  'ONE PATTERN WINS ALL',
  'STOP BRUTE FORCING NOW',
];

const ARCHITECTURE_PATTERNS: PatternBank = [
  '{TECH} DONE WRONG',
  'SYSTEM DESIGN TRAP',
  'FAANG DESIGNS THIS WAY',
  '90% MISS THIS STEP',
  'SCALE OR FAIL FAST',
  '{TECH} BREAKS AT SCALE',
  'SENIOR DEV TRICK HERE',
];

const NETWORKING_PATTERNS: PatternBank = [
  '{TECH} WRONG? FIX NOW',
  'FAANG USES {TECH} THIS',
  '{TECH} VS REST WINNER',
  'NEVER DO THIS {TECH}',
  '{TECH} IN 60 SECS',
  '90% MISS THIS {TECH}',
  'HIDDEN {TECH} TRICK HERE',
];

const SECURITY_PATTERNS: PatternBank = [
  '{TECH} EXPOSES YOUR APP',
  'STOP DOING THIS {TECH}',
  'HACKERS EXPLOIT THIS',
  '{TECH} DONE RIGHT FAST',
  'YOUR {TECH} IS BROKEN',
  'FAANG SECURES THIS WAY',
  // Panel-17 Eng P1 (Hejlsberg): was 'FIX THIS OR GET HACKED' (5
  // words → truncated to 'FIX THIS OR GET'). 4-word version keeps
  // the threat punchline intact.
  '{TECH} HACK EXPOSED NOW',
];

const DEVOPS_PATTERNS: PatternBank = [
  '{TECH} MISTAKE KILLS PROD',
  'PROD DOWN? BLAME {TECH}',
  '{TECH} IN 3 STEPS',
  'NEVER DEPLOY LIKE THIS',
  'FAANG DEPLOYS THIS WAY',
  '{TECH} BREAKS EVERYTHING',
  // Panel-17 Eng P1 (Hejlsberg): was 'FIX THIS OR LOSE PROD' (5
  // words → truncated to 'FIX THIS OR LOSE'). 4-word version keeps
  // the consequence intact.
  '{TECH} KILLED OUR PROD',
];

const FRONTEND_PATTERNS: PatternBank = [
  '{TECH} WRONG? HERE\'S WHY',
  'FAANG UI TRICK REVEALED',
  '90% RENDER THIS WRONG',
  '{TECH} PATTERN THAT WINS',
  'STOP THIS {TECH} MISTAKE',
  '{TECH} PERF FIX NOW',
  // Panel-17 Eng P0 (Hejlsberg): was 'NEVER DO THIS IN {TECH}' which is
  // structurally 5 words; after substitution enforceMaxFourWords always
  // truncated to 'NEVER DO THIS IN' (tech label silently dropped).
  // 'STOP THIS IN {TECH}' is 4 words — keeps the label intact.
  'STOP THIS IN {TECH}',
];

const GENERIC_PATTERNS: PatternBank = [
  'FAANG ASKS THIS DAILY',
  '90% GET THIS WRONG',
  'SENIOR DEV TRICK HERE',
  'STOP DOING THIS NOW',
  'TRICK THEY NEVER TEACH',
  'FIX THIS BEFORE INTERVIEW',
  'FAANG TRICK EXPOSED',
  'ONE TRICK CHANGES ALL',
];

// ---------------------------------------------------------------------------
// Category detection — same keyword sets as Thumbnail.tsx getTopicColors()
// ---------------------------------------------------------------------------

type Category =
  | 'messaging'
  | 'database'
  | 'dsa'
  | 'architecture'
  | 'networking'
  | 'security'
  | 'devops'
  | 'frontend'
  | 'generic';

function detectCategory(topic: string): Category {
  const lower = topic.toLowerCase();
  if (['kafka', 'rabbit', 'message', 'queue', 'event', 'pub/sub', 'stream'].some(k => lower.includes(k))) return 'messaging';
  if (['database', 'sql', 'nosql', 'postgres', 'mongo', 'redis', 'cache', 'memcache', 'storage', 'index'].some(k => lower.includes(k))) return 'database';
  if (['algo', 'sort', 'tree', 'graph', 'array', 'string', 'hash', 'dynamic', 'dp', 'recursion', 'stack', 'linked list', 'binary', 'bfs', 'dfs', 'greedy', 'heap', 'trie'].some(k => lower.includes(k))) return 'dsa';
  if (['design pattern', 'architecture', 'system design', 'microservice', 'solid', 'clean', 'domain'].some(k => lower.includes(k))) return 'architecture';
  if (['network', 'tcp', 'http', 'dns', 'api', 'rest', 'graphql', 'grpc', 'gateway', 'proxy', 'websocket'].some(k => lower.includes(k))) return 'networking';
  if (['security', 'auth', 'oauth', 'jwt', 'encrypt', 'rate limit', 'throttl', 'firewall', 'xss', 'csrf'].some(k => lower.includes(k))) return 'security';
  if (['docker', 'kubernetes', 'k8s', 'ci/cd', 'deploy', 'aws', 'cloud', 'nginx', 'terraform', 'helm'].some(k => lower.includes(k))) return 'devops';
  if (['react', 'frontend', 'css', 'html', 'vue', 'angular', 'next', 'svelte', 'typescript', 'javascript'].some(k => lower.includes(k))) return 'frontend';
  return 'generic';
}

const CATEGORY_PATTERNS: Record<Category, PatternBank> = {
  messaging: MESSAGING_PATTERNS,
  database: DATABASE_PATTERNS,
  dsa: DSA_PATTERNS,
  architecture: ARCHITECTURE_PATTERNS,
  networking: NETWORKING_PATTERNS,
  security: SECURITY_PATTERNS,
  devops: DEVOPS_PATTERNS,
  frontend: FRONTEND_PATTERNS,
  generic: GENERIC_PATTERNS,
};

/**
 * Panel-17 Eng P0 (Hejlsberg): exposed for test-time word-count
 * assertion. enforceMaxFourWords silently truncates 5-word patterns to
 * 4, dropping the {TECH} label when it sits in the 5th slot — the bug
 * that shipped to production in FRONTEND_PATTERNS[6] / SECURITY[6] /
 * DEVOPS[6]. Tests now scan EVERY entry to make this class of regression
 * impossible to merge.
 */
export const __ALL_CATEGORY_PATTERNS_FOR_TEST: ReadonlyArray<readonly [Category, PatternBank]> =
  (Object.entries(CATEGORY_PATTERNS) as Array<[Category, PatternBank]>);

// ---------------------------------------------------------------------------
// Enforce max-4-words contract
// ---------------------------------------------------------------------------

function enforceMaxFourWords(text: string): string {
  const words = text.trim().split(/\s+/);
  return words.slice(0, 4).join(' ');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ThumbnailTextResult {
  /** Hook text, ALL CAPS, max 4 words */
  hookText: string;
  /** Category detected for the topic */
  category: Category;
  /** Hash used for deterministic selection */
  hash: number;
  /** Index within the pattern bank that was selected */
  patternIndex: number;
}

/**
 * Generate a punchy 4-word hook text for a YouTube thumbnail.
 *
 * Fully deterministic — same `topic` always returns the same `hookText`.
 *
 * @example
 * generateThumbnailHookText('kafka')
 * // → { hookText: 'KAFKA WRONG? WATCH THIS', category: 'messaging', ... }
 *
 * generateThumbnailHookText('binary search tree')
 * // → { hookText: 'FAANG ASKS THIS DAILY', category: 'dsa', ... }
 */
export function generateThumbnailHookText(topic: string): ThumbnailTextResult {
  const hash = djb2(topic.toLowerCase().trim());
  const category = detectCategory(topic);
  const bank = CATEGORY_PATTERNS[category];
  const patternIndex = hash % bank.length;
  const pattern = bank[patternIndex];
  const techLabel = extractTechLabel(topic);

  const raw = pattern.replace(/\{TECH\}/g, techLabel);
  const hookText = enforceMaxFourWords(raw.toUpperCase());

  return { hookText, category, hash, patternIndex };
}

/**
 * Convenience: return just the hook text string.
 */
export function hookTextFor(topic: string): string {
  return generateThumbnailHookText(topic).hookText;
}

/**
 * Select thumbnail layout variant from topic hash.
 * Deterministic: same topic → same variant always.
 * Returns 'A' | 'B' | 'C'
 */
export function variantFor(topic: string): 'A' | 'B' | 'C' {
  const hash = djb2(topic.toLowerCase().trim());
  return (['A', 'B', 'C'] as const)[hash % 3];
}
