/**
 * shorts-generator.ts — Generate standalone 45-second YouTube Shorts
 *
 * Each of 66 topics generates 10 unique Short formats = 660 Shorts total.
 * At daily posting = ~22 months of content with zero repeats.
 *
 * 100% deterministic: hash(topicSlug + shortIndex) drives all content selection.
 * No LLM, no Math.random(), no network calls.
 */

import { getTopicExample, TOPIC_EXAMPLES } from '../lib/topic-examples';
import { getTopicCategory } from '../lib/topic-categories';
import type { Scene, SceneType } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ShortEpisode {
  /** Unique ID: topicSlug-short-N */
  id: string;
  /** Punchy title, max 55 chars, no #Shorts */
  title: string;
  /** Full narration text, max 120 words (~45s at 2.5 words/sec) */
  narration: string;
  /** Topic slug for content lookup */
  topicSlug: string;
  /** Short format index 0-9 */
  shortIndex: number;
  /** Format name for logging */
  formatName: string;
  /** Scenes for Remotion composition */
  scenes: Scene[];
  /** Heading text displayed on screen */
  heading: string;
  /** Bullet points displayed (max 3) */
  bullets: string[];
  /** Visual cue hint for the composition */
  visualCue: 'concept' | 'comparison' | 'list' | 'interview' | 'cheatsheet';
}

// ─── Deterministic Hashing ──────────────────────────────────────────────────

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededPick<T>(items: T[], seed: string): T {
  return items[djb2(seed) % items.length];
}

// ─── Topic Registry ─────────────────────────────────────────────────────────
// All 66 topics from the guru-sishya content library.
// This is the canonical list — order matters for deterministic day-to-topic mapping.

export const ALL_TOPICS: string[] = [
  'caching', 'load-balancing', 'api-gateway', 'kafka', 'database',
  'microservices', 'distributed-systems', 'message-queue', 'authentication',
  'rate-limiting', 'monitoring', 'consistent-hashing', 'cdn', 'queue',
  'dns', 'docker', 'kubernetes', 'sql', 'nosql', 'ci-cd',
  'rest-api', 'graphql', 'grpc', 'websocket', 'http',
  'sharding', 'indexing', 'replication', 'cap-theorem', 'acid',
  'event-sourcing', 'cqrs', 'saga-pattern', 'circuit-breaker', 'bulkhead',
  'service-mesh', 'api-versioning', 'idempotency', 'pagination', 'search',
  'logging', 'tracing', 'alerting', 'sla-slo-sli', 'chaos-engineering',
  'blue-green-deployment', 'canary-release', 'feature-flags', 'a-b-testing', 'load-testing',
  'binary-search', 'sorting', 'dynamic-programming', 'trees', 'graphs',
  'arrays', 'linked-list', 'hash-map', 'heap', 'trie',
  'bfs-dfs', 'backtracking', 'greedy', 'sliding-window', 'two-pointers',
  'design-patterns',
];

export const TOTAL_SHORTS = ALL_TOPICS.length * 10; // 660

// ─── Short Format Definitions ───────────────────────────────────────────────

interface ShortFormat {
  name: string;
  visualCue: ShortEpisode['visualCue'];
  titleTemplate: (topic: string) => string;
  generateContent: (topicSlug: string, topicDisplay: string, example: ReturnType<typeof getTopicExample>) => {
    narration: string;
    heading: string;
    bullets: string[];
  };
}

function toDisplay(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function truncTitle(title: string, max: number = 55): string {
  return title.length <= max ? title : title.slice(0, max - 3) + '...';
}

const SHORT_FORMATS: ShortFormat[] = [
  // 0: "X in 60 seconds" — concept explainer
  {
    name: 'concept-explainer',
    visualCue: 'concept',
    titleTemplate: (t) => truncTitle(`${t} in 60 Seconds`),
    generateContent: (_slug, topic, ex) => ({
      narration: `${topic} in 60 seconds. Here is the simplest way to understand it. ${ex.company} ${ex.useCase}. The problem? ${ex.problem}. The solution? ${ex.solution}. Think of it like a highway. When one lane gets crowded, you add more lanes. That is ${topic} at its core. ${ex.company} handles ${ex.scale} using this exact pattern. Now you know more than most junior developers. Save this for your next interview.`,
      heading: `${topic} Explained`,
      bullets: [`Problem: ${ex.problem}`, `Solution: ${ex.solution}`, `Scale: ${ex.scale}`],
    }),
  },
  // 1: "3 mistakes in X" — mistake format
  {
    name: 'three-mistakes',
    visualCue: 'list',
    titleTemplate: (t) => truncTitle(`3 Mistakes Devs Make with ${t}`),
    generateContent: (_slug, topic, ex) => ({
      narration: `Three mistakes developers make with ${topic}. Mistake one: not understanding the problem it solves. ${ex.problem} is real. Mistake two: over-engineering from day one. Start simple, scale later. ${ex.company} started with a basic setup before reaching ${ex.scale}. Mistake three: ignoring failure modes. What happens when ${topic} goes down? Always have a fallback. Fix these three and you are ahead of ninety percent of developers.`,
      heading: `3 ${topic} Mistakes`,
      bullets: ['Not understanding the core problem', 'Over-engineering from day one', 'Ignoring failure modes'],
    }),
  },
  // 2: "X vs Y" — quick comparison
  {
    name: 'versus',
    visualCue: 'comparison',
    titleTemplate: (t) => truncTitle(`${t}: When to Use What`),
    generateContent: (slug, topic, ex) => {
      const category = getTopicCategory(slug);
      const altMap: Record<string, string> = {
        'system-design': 'monolith',
        'databases': 'flat files',
        'caching': 'direct DB queries',
        'networking': 'polling',
        'api': 'direct service calls',
        'dsa': 'brute force',
        'general': 'the naive approach',
      };
      const alt = altMap[category] || 'the alternative';
      return {
        narration: `${topic} versus ${alt}. When should you use which? Use ${alt} when your system is small. Less than a hundred users? Keep it simple. But once you hit ${ex.scale}, you need ${topic}. ${ex.company} made this exact switch. They went from ${ex.problem} to ${ex.solution}. The rule of thumb: start simple, switch when the pain is real. Not before.`,
        heading: `${topic} vs ${alt.charAt(0).toUpperCase() + alt.slice(1)}`,
        bullets: [`Small scale: Use ${alt}`, `At ${ex.scale}: Use ${topic}`, 'Switch when pain is real'],
      };
    },
  },
  // 3: "This X concept got me 25L" — salary bait
  {
    name: 'salary-bait',
    visualCue: 'concept',
    titleTemplate: (t) => truncTitle(`This ${t} Concept Got Me 25 LPA`),
    generateContent: (_slug, topic, ex) => ({
      narration: `This ${topic} concept helped me crack a twenty-five LPA offer. The interviewer asked how ${ex.company} handles ${ex.scale}. Most candidates say something vague. I explained exactly how ${ex.solution} works. Then I drew the architecture on the whiteboard. The interviewer smiled. That was the moment I knew I had the offer. Learn ${topic} properly. It shows up in every senior developer interview.`,
      heading: `${topic} = Higher Salary`,
      bullets: [`Asked at ${ex.company}-level interviews`, 'Whiteboard architecture matters', 'Senior devs must know this'],
    }),
  },
  // 4: "Interview POV: X" — interview scenario
  {
    name: 'interview-pov',
    visualCue: 'interview',
    titleTemplate: (t) => truncTitle(`Interview POV: Explain ${t}`),
    generateContent: (_slug, topic, ex) => ({
      narration: `Interview POV. The interviewer says: explain ${topic} like I am five. You say: imagine a restaurant. When too many orders come in, the kitchen slows down. ${topic} is like adding more kitchens. ${ex.company} uses this to handle ${ex.scale}. Their problem was ${ex.problem}. Their fix? ${ex.solution}. The interviewer nods. You just explained a complex system in thirty seconds. That is how you crack it.`,
      heading: `Interview: ${topic}`,
      bullets: ['Use real-world analogies', `Reference ${ex.company}`, 'Keep it under 30 seconds'],
    }),
  },
  // 5: "Stop doing X wrong" — hot take
  {
    name: 'hot-take',
    visualCue: 'concept',
    titleTemplate: (t) => truncTitle(`Stop Using ${t} Wrong`),
    generateContent: (_slug, topic, ex) => ({
      narration: `Stop using ${topic} wrong. I see this mistake every week in code reviews. Developers add ${topic} to every project without thinking. But ${topic} is not a silver bullet. It solves one specific problem: ${ex.problem}. If you do not have that problem, you are adding complexity for nothing. ${ex.company} uses it because they handle ${ex.scale}. Your side project with ten users does not need this. Use it when you need it. Not because it looks cool on your resume.`,
      heading: `${topic}: Used Wrong`,
      bullets: [`Solves: ${ex.problem}`, 'Not every project needs it', 'Complexity has a cost'],
    }),
  },
  // 6: "90% of devs get X wrong" — stat hook
  {
    name: 'stat-hook',
    visualCue: 'list',
    titleTemplate: (t) => truncTitle(`90% of Devs Get ${t} Wrong`),
    generateContent: (_slug, topic, ex) => ({
      narration: `Ninety percent of developers get ${topic} wrong. They think it is just about ${ex.solution}. But the real power is understanding why. The why is simple: ${ex.problem}. Without ${topic}, ${ex.company} would not handle ${ex.scale}. Here is what the top ten percent know. First, start with the problem, not the solution. Second, measure before optimizing. Third, design for failure. Now you are in the top ten percent.`,
      heading: `${topic}: Top 10% Knowledge`,
      bullets: ['Start with the problem', 'Measure before optimizing', 'Design for failure'],
    }),
  },
  // 7: "X explained like you're 5" — simple explainer
  {
    name: 'eli5',
    visualCue: 'concept',
    titleTemplate: (t) => truncTitle(`${t} Explained Simply`),
    generateContent: (_slug, topic, ex) => ({
      narration: `${topic} explained like you are five. Imagine you are at a birthday party. Everyone wants cake at the same time. If there is one person cutting cake, the line is huge. That is ${ex.problem}. Now imagine five people cutting cake. Everyone gets served fast. That is ${topic}. ${ex.company} uses this idea to serve ${ex.scale}. Same concept, massive scale. That is all there is to it. Simple, right?`,
      heading: `${topic} for Beginners`,
      bullets: ['Real-world analogy', `Used by ${ex.company}`, `Handles ${ex.scale}`],
    }),
  },
  // 8: "Senior vs Junior: X" — level comparison
  {
    name: 'senior-vs-junior',
    visualCue: 'comparison',
    titleTemplate: (t) => truncTitle(`Senior vs Junior: ${t}`),
    generateContent: (_slug, topic, ex) => ({
      narration: `How juniors and seniors think about ${topic} differently. A junior says: let me add ${topic} because I read about it. A senior asks: do we actually need it? What problem does it solve? The junior implements it and adds complexity. The senior measures first, then decides. When ${ex.company} was small, they did not use ${topic}. They added it only when ${ex.problem} became real. Think like a senior. Solve real problems, not imaginary ones.`,
      heading: `Junior vs Senior: ${topic}`,
      bullets: ['Junior: adds it because it is cool', 'Senior: adds it when needed', 'Always measure first'],
    }),
  },
  // 9: "The X cheat sheet" — rapid-fire facts
  {
    name: 'cheat-sheet',
    visualCue: 'cheatsheet',
    titleTemplate: (t) => truncTitle(`${t} Cheat Sheet`),
    generateContent: (_slug, topic, ex) => ({
      narration: `${topic} cheat sheet. Save this. What is it? It solves ${ex.problem}. Who uses it? ${ex.company} at ${ex.scale}. When to use it? When your system outgrows a single point. When not to use it? When you have less than a thousand users. How does it work? ${ex.solution}. Key metric to watch? Latency and throughput. Common mistake? Adding it too early. Interview tip? Always mention the trade-offs. Screenshot this. You will need it.`,
      heading: `${topic} Cheat Sheet`,
      bullets: [`What: Solves ${ex.problem}`, `Who: ${ex.company}`, 'When: System outgrows single point'],
    }),
  },
];

// ─── Main Generator ─────────────────────────────────────────────────────────

/**
 * Generate a standalone Short episode for the given topic and format index.
 * 100% deterministic — same inputs always produce the same output.
 */
export function generateShort(topicSlug: string, shortIndex: number): ShortEpisode {
  const format = SHORT_FORMATS[shortIndex % SHORT_FORMATS.length];
  const topicDisplay = toDisplay(topicSlug);
  const example = getTopicExample(topicSlug);
  const { narration, heading, bullets } = format.generateContent(topicSlug, topicDisplay, example);

  // Enforce 120-word limit
  const words = narration.split(/\s+/);
  const clampedNarration = words.length > 120 ? words.slice(0, 120).join(' ') + '.' : narration;

  const title = format.titleTemplate(topicDisplay);

  // Build scenes for the AtomicShort composition
  const scenes = buildShortScenes(heading, clampedNarration, bullets, format.visualCue);

  return {
    id: `${topicSlug}-short-${shortIndex}`,
    title,
    narration: clampedNarration,
    topicSlug,
    shortIndex,
    formatName: format.name,
    scenes,
    heading,
    bullets,
    visualCue: format.visualCue,
  };
}

/**
 * Given a global short number (0-659), resolve to topic + format index.
 * Deterministic: shortNumber → always the same Short.
 */
export function resolveShortNumber(shortNumber: number): { topicSlug: string; shortIndex: number } {
  const clamped = ((shortNumber % TOTAL_SHORTS) + TOTAL_SHORTS) % TOTAL_SHORTS;
  const topicIdx = Math.floor(clamped / 10);
  const shortIdx = clamped % 10;
  return {
    topicSlug: ALL_TOPICS[topicIdx],
    shortIndex: shortIdx,
  };
}

/**
 * Given a Date, return which Short to render that day.
 * Uses day-of-year so every day maps to a unique Short for ~22 months.
 */
export function getShortForDate(date: Date): { topicSlug: string; shortIndex: number; shortNumber: number } {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  // Combine year and day for uniqueness across years
  const shortNumber = ((date.getFullYear() - 2026) * 366 + dayOfYear) % TOTAL_SHORTS;
  const { topicSlug, shortIndex } = resolveShortNumber(shortNumber);
  return { topicSlug, shortIndex, shortNumber };
}

// ─── Scene Builder ──────────────────────────────────────────────────────────

function buildShortScenes(
  heading: string,
  narration: string,
  bullets: string[],
  visualCue: ShortEpisode['visualCue'],
): Scene[] {
  // Split narration into 3 chunks for 3 scenes (~15s each)
  const sentences = narration.split(/(?<=[.!?])\s+/).filter(Boolean);
  const third = Math.ceil(sentences.length / 3);

  const chunks = [
    sentences.slice(0, third).join(' '),
    sentences.slice(third, third * 2).join(' '),
    sentences.slice(third * 2).join(' '),
  ].filter(Boolean);

  const sceneType: SceneType = visualCue === 'comparison' ? 'table'
    : visualCue === 'interview' ? 'interview'
    : 'text';

  const fps = 30;
  const totalFrames = 1350; // 45 seconds
  const framesPerScene = Math.floor(totalFrames / chunks.length);

  return chunks.map((chunk, i) => ({
    type: sceneType,
    content: chunk,
    narration: chunk,
    duration: framesPerScene / fps,
    startFrame: i * framesPerScene,
    endFrame: (i + 1) * framesPerScene,
    heading: i === 0 ? heading : undefined,
    bullets: i === 0 ? bullets : undefined,
  }));
}

/**
 * List all 660 Shorts in deterministic order.
 * Useful for debugging and preview.
 */
export function listAllShorts(): Array<{ shortNumber: number; topicSlug: string; shortIndex: number; title: string }> {
  const result: Array<{ shortNumber: number; topicSlug: string; shortIndex: number; title: string }> = [];
  for (let i = 0; i < TOTAL_SHORTS; i++) {
    const { topicSlug, shortIndex } = resolveShortNumber(i);
    const episode = generateShort(topicSlug, shortIndex);
    result.push({ shortNumber: i, topicSlug, shortIndex, title: episode.title });
  }
  return result;
}
