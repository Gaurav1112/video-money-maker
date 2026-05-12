/**
 * shorts-generator.ts — Generate standalone 45-second YouTube Shorts
 *
 * Each of 66 topics generates 14 unique Short formats = 924 Shorts total.
 * At daily posting = ~28 months of content with zero repeats.
 *
 * 100% deterministic: hash(topicSlug + shortIndex) drives all content selection.
 * No LLM, no Math.random(), no network calls.
 */

import { getTopicExample, TOPIC_EXAMPLES } from '../lib/topic-examples';
import { getTopicCategory } from '../lib/topic-categories';
import { getDeepContent, hasDeepContent } from '../lib/topic-deep-content';
import { getLeadMagnetDescriptionLine } from '../lib/lead-magnets';
import type { Scene, SceneType } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ShortEpisode {
  /** Unique ID: topicSlug-short-N */
  id: string;
  /** Punchy title, max 55 chars, no #Shorts */
  title: string;
  /** Full narration text, max 135 words (~45s at 2.5-3 words/sec) */
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
  /** YouTube description — 2 lines + hashtags */
  description: string;
  /** Topic hashtags for YouTube discovery */
  hashtags: string[];
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

const DSA_TOPICS = new Set([
  'binary-search', 'sorting', 'dynamic-programming', 'trees', 'graphs',
  'arrays', 'linked-list', 'hash-map', 'heap', 'trie',
  'bfs-dfs', 'backtracking', 'greedy', 'sliding-window', 'two-pointers',
  'design-patterns',
]);

function isDSATopic(slug: string): boolean {
  return DSA_TOPICS.has(slug);
}

function truncTitle(title: string, max: number = 80): string {
  return title.length <= max ? title : title.slice(0, max - 3) + '...';
}

const SHORT_FORMATS: ShortFormat[] = [
  // 0: Fireship rapid-fire — ultra-short sentences, punchy, staccato rhythm
  {
    name: 'concept-explainer',
    visualCue: 'concept',
    titleTemplate: (t) => truncTitle(`${t} in 45 Seconds — Finally Explained`),
    generateContent: (_slug, topic, ex) => ({
      narration: `Your system is slow. You add ${topic}. Fast now. Problem solved — until you hit ${ex.scale}. Then ${ex.problem}. All at once. Not gradual. A cliff. ${ex.company} hit that cliff. Their fix? ${ex.solution}. Not a rewrite. Not a new framework. A specific architectural decision that took twenty minutes to implement. The tradeoff — you now operate a distributed component. More moving parts. More failure modes. Worth it above ${ex.scale}. Below that? Skip it. Seriously. The pain of operating ${topic} has to exceed the pain of not having it. That is the only rule.`,
      heading: `${topic} Explained`,
      bullets: [`Problem: ${ex.problem}`, `Solution: ${ex.solution}`, `Scale: ${ex.scale}`],
    }),
  },
  // 1: List format — dramatic pauses, numbered mistakes, rhythmic repetition
  {
    name: 'three-mistakes',
    visualCue: 'list',
    titleTemplate: (t) => truncTitle(`${t} Is Silently Killing Your System`),
    generateContent: (_slug, topic, ex) => ({
      narration: `Mistake number one. You left ${topic} on default settings. Defaults are for demos — not production. ${ex.company} ran defaults for eighteen months. Then ${ex.scale} happened. Mistake number two. You assumed ${topic} scales linearly. It doesn't. There is a cliff where ${ex.problem}. No warning. No gradual slowdown. Just failure. Mistake number three — and this is the one that actually hurts. No fallback. When ${topic} goes down, everything behind it goes down. The fix for all three? ${ex.solution}. One afternoon of work. Three incidents prevented. Your move.`,
      heading: `3 ${topic} Mistakes`,
      bullets: ['Default configs in production', 'Assuming linear scaling', 'No fallback plan'],
    }),
  },
  // 2: Debate format — two sides, dramatic pivot, clear verdict
  {
    name: 'versus',
    visualCue: 'comparison',
    titleTemplate: (t) => truncTitle(`Nobody Tells You This About ${t}`),
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
        narration: `On one side — ${alt}. Simple. Boring. Works. On the other — ${topic}. Powerful. Complex. Expensive. At small scale, ${alt} wins. Every single time. Faster to build, easier to debug, cheaper to run. But there is a cliff. At ${ex.scale}, ${alt} stops working. Not slowly — abruptly. ${ex.company} found that cliff. ${ex.problem} hit them overnight. No amount of tuning ${alt} fixes this. You need ${ex.solution}. That capability only exists in ${topic}. The verdict? Stay with ${alt} until the pain is real. Then switch fast. Not during the incident — before it.`,
        heading: `${topic} vs ${alt.charAt(0).toUpperCase() + alt.slice(1)}`,
        bullets: [`Small scale: Use ${alt}`, `At ${ex.scale}: Use ${topic}`, 'Switch before the cliff'],
      };
    },
  },
  // 3: First-person story — confessional, personal failure, redemption arc
  {
    name: 'salary-bait',
    visualCue: 'concept',
    titleTemplate: (t) => truncTitle(`The ${t} Question That Fails Senior Engineers`),
    generateContent: (_slug, topic, ex) => ({
      narration: `I bombed this question in my interview. They asked about ${topic} at ${ex.scale}. I started listing tools — Kibana, Datadog, PagerDuty. The interviewer went quiet. Bad sign. What I should have said: "${ex.problem} is the root cause pattern here. Before touching any tool, you check three metrics." That is what the ten percent who get offers say. They name the problem first. Tools second. ${ex.company} asks this exact question. The answer they want is ${ex.solution} — framed as a debugging story, not a technology pitch. I know that now. Cost me one rejection to learn it.`,
      heading: `${topic} = Higher Salary`,
      bullets: [`Asked at ${ex.company}-level interviews`, 'Name the problem before tools', 'Frame it as debugging'],
    }),
  },
  // 4: Dialogue format — back-and-forth, quoted speech, interview simulation
  {
    name: 'interview-pov',
    visualCue: 'interview',
    titleTemplate: (t) => truncTitle(`Interview POV: Explain ${t}`),
    generateContent: (_slug, topic, ex) => ({
      narration: `"Design a system that handles ${ex.scale}." I pause. "What breaks first?" The interviewer nods. That is the answer they wanted — a question, not a diagram. Most candidates grab the marker and start drawing boxes. Wrong move. The right move: "${ex.problem} breaks first at this scale. Here is exactly why." Two sentences. Then silence. Let them redirect you. They say, "How would you fix it?" Now you say: "${ex.solution}." Still no boxes. The candidates who get ${ex.company}-level offers never explain what ${topic} is. They explain what problem it kills. There is a difference. A big one.`,
      heading: `Interview: ${topic}`,
      bullets: ['Ask what breaks first', `Reference ${ex.company}`, 'Problems before solutions'],
    }),
  },
  // 5: Confrontational — short aggressive sentences, accusatory tone, urgent
  {
    name: 'hot-take',
    visualCue: 'concept',
    titleTemplate: (t) => truncTitle(`Your ${t} Config Has a Silent Bug`),
    generateContent: (_slug, topic, ex) => ({
      narration: `The documentation is lying to you. Page one of the ${topic} docs says the defaults are safe. They are not. ${ex.company} found out at ${ex.scale}. Data loss. No error message. No alert. Nothing. Silent corruption for weeks before anyone noticed. The fix is not more code. It is three config lines buried in section four of the docs — the section nobody reads. ${ex.solution} — that is what those lines do. ${ex.company} added them after their incident. They are not optional. Your config is missing them right now. Go check. Seriously — stop this video and go check.`,
      heading: `${topic}: Used Wrong`,
      bullets: [`Solves: ${ex.problem}`, 'Defaults are unsafe', 'Three config lines fix it'],
    }),
  },
  // 6: Numbers-first — lead with the stat, build tension around a threshold
  {
    name: 'stat-hook',
    visualCue: 'list',
    titleTemplate: (t) => truncTitle(`90% of Devs Get ${t} Wrong`),
    generateContent: (_slug, topic, ex) => ({
      narration: `${ex.scale}. That is the number. Remember it. Below that number, your ${topic} setup works fine. Looks healthy. Passes every test. Above it — ${ex.problem}. No warning. The engineers at ${ex.company} ran default config for eighteen months below that threshold. Then traffic grew. They crossed it on a Tuesday at 2am. Six-hour incident. The fix? Three lines of config. Four minutes to deploy. The reason nobody warns you: this threshold only matters at scale, and by the time you need the fix, you are already in the incident. Write these three lines down before you forget.`,
      heading: `${topic}: Top 10% Knowledge`,
      bullets: [`Threshold: ${ex.scale}`, `Below: looks fine`, `Above: ${ex.problem}`],
    }),
  },
  // 7: Analogy-first — physical world metaphor, build to technical reveal
  {
    name: 'eli5',
    visualCue: 'concept',
    titleTemplate: (t) => truncTitle(`${t} Explained So Simply It Clicks Instantly`),
    generateContent: (_slug, topic, ex) => ({
      narration: `Imagine a library. Every book request takes five minutes — the librarian walks to the back, searches the shelves, walks back. Now imagine the ten most popular books sitting on a shelf at the front desk. Two seconds instead of five minutes. That is ${topic}. Simple idea. Massive impact. ${ex.company} used exactly this approach when they hit ${ex.scale}. Before ${topic}, they had ${ex.problem}. After — ${ex.solution}. Same system. Same hardware. Different architecture. The catch? Your front desk shelf has limited space. Pick the wrong books and you wasted the shelf. Pick the right ones and your system feels ten times faster without spending a dollar.`,
      heading: `${topic} for Beginners`,
      bullets: ['Library analogy', `Used by ${ex.company}`, `Handles ${ex.scale}`],
    }),
  },
  // 8: Contrast pairs — alternating junior/senior lines, terse, rhythmic
  {
    name: 'senior-vs-junior',
    visualCue: 'comparison',
    titleTemplate: (t) => truncTitle(`How Senior Engineers Think About ${t}`),
    generateContent: (_slug, topic, ex) => ({
      narration: `Junior adds ${topic} because it is cool. Senior measures first, then decides. Junior configures defaults. Senior reads page four of the docs. Junior deploys Friday afternoon. Senior asks what the rollback plan is. Junior sees ${ex.scale} and panics. Senior has already built for it. Here is the real difference. When ${ex.company} was small, they skipped ${topic} entirely. Worked fine. Then ${ex.problem} became real — not theoretical, real. That is when seniors act. Not before. Not after. At the moment the data says "now." The data said ${ex.solution}. They shipped it in one sprint.`,
      heading: `Junior vs Senior: ${topic}`,
      bullets: ['Junior: adds it because it is cool', 'Senior: measures then decides', 'Data drives the decision'],
    }),
  },
  // 9: Rapid-fire numbered list — four numbers, no filler, save-worthy
  {
    name: 'cheat-sheet',
    visualCue: 'cheatsheet',
    titleTemplate: (t) => truncTitle(`${t} Cheat Sheet — Save This`),
    generateContent: (_slug, topic, ex) => ({
      narration: `Four numbers. Memorize them. One — ${ex.scale}. That is your ceiling on default config. Two — under ten milliseconds. That is your latency target after ${topic} is tuned. Three — ${ex.company} adopted this at a hundred million users. Not before. Not for fun. Because ${ex.problem}. Four — default config gets you sixty percent of the way there. The other forty percent? Three settings nobody documents. ${ex.solution} is the mechanism behind all four numbers. Interviewers love this format. Four numbers, four facts, forty-five seconds. Screenshot this. You will need it.`,
      heading: `${topic} Cheat Sheet`,
      bullets: [`What: Solves ${ex.problem}`, `Who: ${ex.company}`, 'When: System outgrows defaults'],
    }),
  },
  // 10: War story — past tense, 2am vibes, narrative tension
  {
    name: 'real-incident',
    visualCue: 'concept',
    titleTemplate: (t) => truncTitle(`The ${t} Incident Nobody Talks About`),
    generateContent: (slug, topic, ex) => {
      const deep = getDeepContent(slug);
      if (deep) {
        return {
          narration: `It was 2am. The alerts fired. ${deep.realIncident} Eighteen months of clean operation — then this. The engineers pulled up dashboards. Everything looked normal. Except it wasn't. ${deep.defaultConfigProblem} The config that caused it: ${deep.configKey}. Everyone assumed ${deep.misconception}. Wrong. ${deep.misconceptionCorrection} Four minutes to deploy the fix. Six hours of downtime. ${deep.zeigarnikHook}`,
          heading: `The ${topic} Incident`,
          bullets: [
            deep.configKey,
            deep.catchphrase,
            'Real production war story',
          ],
        };
      }
      return {
        narration: `It was 2am. The alerts fired. ${ex.company}'s system had been running fine for eighteen months. Then ${ex.problem} — all at once. Not a gradual degradation. A cliff. The on-call engineer pulled up dashboards. Everything looked normal at first glance. But the system was processing ${ex.scale} and the default config had never been tested at that load. The fix took four minutes. ${ex.solution}. One config change. The outage lasted six hours because nobody knew to look there. Now you know. Check your defaults before the 2am call comes for you.`,
        heading: `The ${topic} Incident`,
        bullets: [`What broke: ${ex.problem}`, `The fix: ${ex.solution}`, `Check your config now`],
      };
    },
  },

  // 11: Side-by-side contrast — wrong passes tests, right survives production
  {
    name: 'wrong-right',
    visualCue: 'comparison',
    titleTemplate: (t) => truncTitle(`Everyone Writes ${t} Wrong`),
    generateContent: (slug, topic, ex) => {
      const deep = getDeepContent(slug);
      if (deep) {
        return {
          narration: `This is the wrong way. It compiles. It passes all tests. It ships to production. Then it fails. ${deep.defaultConfigProblem} Here is the right way. Same code. Two config lines different. ${deep.oneLinerFix} That is it. Zero application code changes. The wrong version and the right version are identical — except for configuration that ships broken by default. Most teams discover this difference during an incident. You are discovering it now. Go diff your config against the right version. If those two lines are missing, you are running the wrong way in production right now.`,
          heading: `${topic}: Wrong vs Right`,
          bullets: [
            `Wrong: ${deep.configKey} default`,
            `Right: ${deep.oneLinerFix.slice(0, 55)}`,
            'Zero code changes needed',
          ],
        };
      }
      return {
        narration: `This is the wrong way. It passes all tests. It handles a hundred users perfectly. It ships to production. Then ${ex.scale} hits and ${ex.problem}. Here is the right way. Same code. Same logic. Two config lines different. ${ex.solution}. One — the timeout values. Two — the error handling mode. The rest is identical. Wrong version fails silently. Right version fails loudly and recovers automatically. Most teams ship the wrong version because it works in staging. Staging never hits ${ex.scale}. Production does. Check yours.`,
        heading: `${topic}: Wrong vs Right`,
        bullets: [
          `Wrong: default config at scale`,
          `Right: ${ex.solution.slice(0, 55)}`,
          'Same code, different outcome',
        ],
      };
    },
  },

  // 12: Question-driven — constraints first, Socratic, interview coach voice
  {
    name: 'design-it',
    visualCue: 'concept',
    titleTemplate: (t) => truncTitle(`Can You Design ${t}? Try This`),
    generateContent: (slug, topic, ex) => {
      const deep = getDeepContent(slug);
      const incident = deep ? deep.incidentScenario : `${ex.problem} at ${ex.scale}`;
      const fix = deep ? deep.oneLinerFix : ex.solution;
      return {
        narration: `System design interview. You need ${topic} at ${ex.scale}. Where do you start? Not the solution. The constraints. Constraint one — what is your read-to-write ratio? This determines everything. Constraint two — consistency requirement. Strict or eventual? Wrong answer here means wrong architecture everywhere. Constraint three — what does failure look like? Because ${incident}. Those three answers shape the entire design. ${fix}. If you jumped to the solution, you built the wrong system for the wrong constraints. The interviewer knows. That is why they let you talk. They are waiting to see if you ask first — or assume first.`,
        heading: `Design ${topic}`,
        bullets: [
          'Start with constraints',
          `Key constraint: ${deep?.configKey ?? 'read/write ratio'}`,
          'Failure mode defines architecture',
        ],
      };
    },
  },

  // 13: Clinical retrospective — structured post-mortem, dry tone, lessons
  {
    name: 'post-mortem',
    visualCue: 'list',
    titleTemplate: (t) => truncTitle(`The ${t} Incident That Changed Everything`),
    generateContent: (slug, topic, ex) => {
      const deep = getDeepContent(slug);
      if (deep) {
        return {
          narration: `Root cause: ${deep.configKey} misconfiguration. Duration: six hours. Engineers paged: three. Time to detect: five hours and fifty-six minutes. Time to fix: four minutes. ${deep.realIncident} The post-mortem revealed: ${deep.defaultConfigProblem} Specifically — ${deep.misconceptionCorrection} The remediation: ${deep.oneLinerFix}. Every team that read this post-mortem added that line to their deployment checklist within a week. The lesson for ${topic} — your default config is a ticking clock. Not broken. Not safe. Just waiting for scale. You are reading this post-mortem now. Add it to your checklist.`,
          heading: `${topic} Post-Mortem`,
          bullets: [
            `Root cause: ${deep.configKey}`,
            deep.catchphrase,
            `Fix: ${deep.oneLinerFix.slice(0, 55)}`,
          ],
        };
      }
      return {
        narration: `Root cause: default configuration. Duration: six hours. Engineers paged: three. Time to fix: twelve minutes. ${ex.company} had been running ${topic} for two years. No incidents. Then they hit ${ex.scale}. ${ex.problem} — a failure mode that only triggers at scale. The config had been wrong since day one. Nobody noticed because the threshold was never crossed. Post-mortem finding: default configuration is not production configuration. Remediation: ${ex.solution}. Action item added to every deployment checklist. Time between this incident and the config audit that would have prevented it — zero. They just never ran one.`,
        heading: `${topic} Post-Mortem`,
        bullets: [
          `Root cause: default config`,
          `Fix: ${ex.solution.slice(0, 55)}`,
          'Add config audit to deploys',
        ],
      };
    },
  },
];

export const TOTAL_SHORTS = ALL_TOPICS.length * SHORT_FORMATS.length; // 924

// ─── Zeigarnik Topic-Specific Endings ───────────────────────────────────────

const ZEIGARNIK_ENDINGS: Record<string, string[]> = {
  'caching': [
    'The TTL race condition that serves stale data for hours. Next.',
    'Why cache-aside fails silently under write-heavy loads. Next video.',
    'The thundering herd problem — one expired key takes down your DB.',
  ],
  'load-balancing': [
    'Least-connections beats round-robin — except in one scenario. Next.',
    'The health check interval that makes your balancer route to dead nodes.',
    'Why sticky sessions break horizontal scaling in subtle ways. Next.',
  ],
  'api-gateway': [
    'The gateway timeout that silently retries and doubles your writes.',
    'Why rate limiting at the gateway misses request bursts. Next video.',
    'The routing rule that sends 5% of traffic to the wrong service. Next.',
  ],
  'kafka': [
    'But there\'s one Kafka setting that silently changes everything. Next video.',
    'The one consumer config nobody puts in their tutorial. It\'s next.',
    'What actually happens when your Kafka broker dies mid-write? Next.',
  ],
  'database': [
    'The index type that slows down writes by 40%. Most teams use it wrong.',
    'What VACUUM actually does — and why skipping it kills performance.',
    'The connection pool size that causes deadlocks at exactly 100 QPS.',
  ],
  'microservices': [
    'The circuit breaker threshold that triggers false positives. Next.',
    'Why service discovery cache staleness causes phantom routing. Next.',
    'The shared database anti-pattern that couples your deploys. Next.',
  ],
  'distributed-systems': [
    'The vector clock conflict that split-brain can\'t resolve. Next.',
    'Why exactly-once delivery is impossible — but you can fake it. Next.',
    'The Lamport timestamp edge case that reorders your events. Next.',
  ],
  'message-queue': [
    'The dead letter queue that silently drops messages after 3 retries.',
    'Why prefetch count of 1 kills your throughput but saves correctness.',
    'The poison message that blocks your entire queue consumer. Next.',
  ],
  'authentication': [
    'The JWT expiry window that lets revoked tokens work for 15 minutes.',
    'Why bcrypt cost factor 10 is too low for modern GPUs. Next video.',
    'The OAuth redirect URI vulnerability most apps still ship with. Next.',
  ],
  'rate-limiting': [
    'Why token bucket leaks requests at the boundary of each window.',
    'The sliding window log that uses 100x more memory than you expect.',
    'Fixed window rate limiting has a burst hole at the boundary. Next.',
  ],
  'monitoring': [
    'The percentile aggregation mistake that hides your worst latencies.',
    'Why averaging p99 across instances gives you meaningless numbers.',
    'The cardinality explosion that crashes your metrics backend. Next.',
  ],
  'consistent-hashing': [
    'Why 150 virtual nodes is the magic number for even distribution.',
    'The hot partition problem that consistent hashing doesn\'t solve.',
    'What happens when you remove a node mid-rebalance. Next video.',
  ],
  'cdn': [
    'The Cache-Control header that makes your CDN serve stale HTML forever.',
    'Why CDN purge propagation takes 30 seconds — and what breaks. Next.',
    'The origin shield misconfiguration that 10x your origin traffic.',
  ],
  'queue': [
    'The visibility timeout that causes duplicate message processing.',
    'Why FIFO queues sacrifice throughput — and when it\'s worth it.',
    'The at-least-once delivery guarantee that creates duplicate orders.',
  ],
  'dns': [
    'The low TTL that causes a DNS query storm during failover. Next.',
    'Why DNS round-robin isn\'t load balancing — and what breaks. Next.',
    'The negative caching TTL that blocks recovery for 5 minutes. Next.',
  ],
  'docker': [
    'The multi-stage build mistake that leaks build secrets into prod.',
    'Why the latest tag causes different images across your fleet. Next.',
    'The PID 1 zombie reaping problem most Dockerfiles ignore. Next.',
  ],
  'kubernetes': [
    'The K8s probe that stops your pod from restarting. Most teams skip it.',
    'One resource limit setting causes 60% of OOMKilled events. Next video.',
    'Why kubectl describe lies to you about the real failure. Next.',
  ],
  'sql': [
    'The SELECT N+1 query that turns 1 query into 10,000. Next video.',
    'Why covering indexes eliminate disk reads entirely. Next.',
    'The implicit type cast in WHERE that prevents index usage. Next.',
  ],
  'nosql': [
    'The partition key choice that creates a hot shard at scale. Next.',
    'Why secondary indexes in DynamoDB cost 2x the writes. Next video.',
    'The eventual consistency read that returns data from 5 seconds ago.',
  ],
  'ci-cd': [
    'The pipeline cache key that causes builds to use stale dependencies.',
    'Why parallel test stages hide flaky test ordering bugs. Next.',
    'The deploy rollback that doesn\'t roll back your database migration.',
  ],
  'rest-api': [
    'The PUT vs PATCH confusion that causes silent data overwrites.',
    'Why 200 OK with an error body breaks every client integration.',
    'The ETag header that eliminates redundant data transfers. Next.',
  ],
  'graphql': [
    'The nested query that lets clients fetch your entire database. Next.',
    'Why depth limiting alone doesn\'t prevent GraphQL abuse. Next video.',
    'The N+1 DataLoader problem that makes GraphQL slower than REST.',
  ],
  'grpc': [
    'The keepalive setting that causes silent connection drops. Next.',
    'Why unary calls miss gRPC\'s biggest advantage — streaming. Next.',
    'The protobuf field number reuse that corrupts your messages. Next.',
  ],
  'websocket': [
    'The heartbeat interval that lets zombie connections pile up. Next.',
    'Why WebSocket reconnection without backoff causes a connect storm.',
    'The missing close frame that leaks server memory per connection.',
  ],
  'http': [
    'The Connection: keep-alive misuse that exhausts your socket pool.',
    'Why HTTP/2 multiplexing makes head-of-line blocking worse. Next.',
    'The Transfer-Encoding chunked edge case that breaks proxies. Next.',
  ],
  'sharding': [
    'The shard key that puts 80% of writes on one node. Next video.',
    'Why range-based sharding creates hot spots during time-series ingestion.',
    'The cross-shard join that turns a 5ms query into 500ms. Next.',
  ],
  'indexing': [
    'The composite index column order that makes your query ignore it.',
    'Why a covering index avoids the table lookup entirely. Next video.',
    'The partial index on status=active that shrinks your index 10x.',
  ],
  'replication': [
    'The replication lag read that shows a deleted record as still alive.',
    'Why synchronous replication halves your write throughput. Next.',
    'The split-brain scenario that creates two primary databases. Next.',
  ],
  'cap-theorem': [
    'Why choosing CP doesn\'t mean zero availability — just degraded.',
    'The network partition that makes your AP system return stale reads.',
    'CAP only applies during partitions — the rest of the time you get all 3.',
  ],
  'acid': [
    'The isolation level that causes phantom reads in your transaction.',
    'Why READ COMMITTED still allows non-repeatable reads. Next video.',
    'The serializable isolation penalty — 10x slower but actually correct.',
  ],
  'event-sourcing': [
    'The event schema migration that breaks replay of old events. Next.',
    'Why snapshotting every 100 events prevents 30-second rebuild times.',
    'The projection rebuild that takes 4 hours because nobody paginated.',
  ],
  'cqrs': [
    'The read model staleness that shows an order as pending for 10 seconds.',
    'Why separate write and read databases doubles your infra cost. Next.',
    'The eventual consistency gap that makes users click submit twice.',
  ],
  'saga-pattern': [
    'The compensating transaction that fails — now you have a partial saga.',
    'Why orchestration sagas become a single point of failure. Next.',
    'The choreography event lost between services that orphans an order.',
  ],
  'circuit-breaker': [
    'The half-open state probe that hits your sickest instance. Next.',
    'Why a 50% error threshold opens the circuit too late. Next video.',
    'The circuit breaker that never closes because health checks hit cache.',
  ],
  'bulkhead': [
    'The thread pool size that starves your critical path. Next video.',
    'Why bulkheads without timeouts just move the bottleneck. Next.',
    'The shared connection pool that lets one slow service block all others.',
  ],
  'service-mesh': [
    'The sidecar proxy that adds 2ms latency to every internal call.',
    'Why mTLS in the mesh doesn\'t protect against compromised pods. Next.',
    'The Envoy misconfiguration that routes traffic to the wrong cluster.',
  ],
  'api-versioning': [
    'The URL path versioning that forces clients to update every endpoint.',
    'Why header-based versioning breaks when CDNs strip custom headers.',
    'The breaking change in a "minor" version that took down 200 clients.',
  ],
  'idempotency': [
    'The idempotency key stored in memory that disappears on restart.',
    'Why client-generated UUIDs don\'t guarantee idempotency. Next video.',
    'The retry storm that creates 50 duplicate payments. Next.',
  ],
  'pagination': [
    'The OFFSET pagination that gets slower on every page. Next video.',
    'Why cursor-based pagination breaks when rows are deleted mid-page.',
    'The keyset pagination edge case with duplicate sort values. Next.',
  ],
  'search': [
    'The analyzer mismatch that makes Elasticsearch return zero results.',
    'Why fuzzy search with edit distance 2 returns garbage matches. Next.',
    'The inverted index update lag that hides new documents for 1 second.',
  ],
  'logging': [
    'The structured log field that leaks PII into your log aggregator.',
    'Why log level INFO in production generates 10 GB per hour. Next.',
    'The missing correlation ID that makes distributed tracing useless.',
  ],
  'tracing': [
    'The trace sampling rate that misses all your slow requests. Next.',
    'Why baggage propagation across services leaks internal metadata.',
    'The span context lost at the async boundary that breaks your trace.',
  ],
  'alerting': [
    'The alert threshold that pages you 50 times during every deploy.',
    'Why alerting on averages misses the p99 spikes that matter. Next.',
    'The missing runbook link that adds 20 minutes to incident response.',
  ],
  'sla-slo-sli': [
    'The error budget burn rate that should have paged you 2 hours ago.',
    'Why 99.9% availability still means 8 hours of downtime per year.',
    'The SLI measurement point that misses client-side failures. Next.',
  ],
  'chaos-engineering': [
    'The chaos experiment that found a retry storm nobody knew existed.',
    'Why killing a random pod isn\'t chaos engineering — it\'s just noise.',
    'The blast radius miscalculation that took down prod for 45 minutes.',
  ],
  'blue-green-deployment': [
    'The database migration that makes blue-green rollback impossible.',
    'Why both environments hitting the same DB defeats the purpose. Next.',
    'The DNS switch delay that sends traffic to the old version for 60s.',
  ],
  'canary-release': [
    'The canary metric that looks healthy but hides a memory leak. Next.',
    'Why 1% canary traffic misses the bug that only appears at 10%. Next.',
    'The sticky session that keeps test users on the canary forever. Next.',
  ],
  'feature-flags': [
    'The flag evaluation that makes a network call on every request.',
    'Why stale flag cache serves the old variant for 5 minutes. Next.',
    'The boolean flag that should have been a multivariate config. Next.',
  ],
  'a-b-testing': [
    'The sample size too small to reach statistical significance. Next.',
    'Why peeking at results early inflates your false positive rate.',
    'The interaction effect between two simultaneous A/B tests. Next.',
  ],
  'load-testing': [
    'The ramp-up period too short that triggers artificial failures.',
    'Why load testing against a single endpoint misses the real bottleneck.',
    'The connection pool exhaustion that only appears at 500 concurrent.',
  ],
  'binary-search': [
    'The mid = (lo + hi) / 2 overflow bug that hid in Java for 9 years.',
    'Why off-by-one in the exit condition makes binary search loop forever.',
    'The rotated sorted array variant that trips up 90% of candidates.',
  ],
  'sorting': [
    'Why quicksort degrades to O(n squared) on already-sorted input.',
    'The merge sort space overhead that matters when memory is tight.',
    'When insertion sort beats quicksort — arrays under 16 elements. Next.',
  ],
  'dynamic-programming': [
    'The overlapping subproblem you missed that turns O(n) into O(2^n).',
    'Why bottom-up DP avoids the stack overflow that top-down hits. Next.',
    'The state transition you forgot that gives wrong answers on edge cases.',
  ],
  'trees': [
    'The unbalanced BST that degrades to a linked list on sorted input.',
    'Why red-black trees beat AVL trees for write-heavy workloads. Next.',
    'The tree serialization trick that reconstructs from preorder alone.',
  ],
  'graphs': [
    'The missing visited set that turns DFS into an infinite loop. Next.',
    'Why adjacency matrix wastes memory on sparse graphs. Next video.',
    'The negative weight cycle that makes Dijkstra give wrong answers.',
  ],
  'arrays': [
    'The in-place reversal trick that solves rotation in O(1) space.',
    'Why the Dutch National Flag partition handles 3-way splits. Next.',
    'The prefix sum precomputation that turns range queries into O(1).',
  ],
  'linked-list': [
    'The fast-slow pointer trick that detects cycles in O(1) space.',
    'Why reversing a linked list in-place is the most reused subroutine.',
    'The dummy head node that eliminates every null-check edge case. Next.',
  ],
  'hash-map': [
    'The load factor 0.75 threshold that triggers a full rehash. Next.',
    'Why chaining beats open addressing when deletion is frequent. Next.',
    'The hash collision attack that turns O(1) lookup into O(n). Next.',
  ],
  'heap': [
    'The heapify trick that builds a heap in O(n), not O(n log n). Next.',
    'Why a min-heap solves "top K largest" — not a max-heap. Next video.',
    'The index math error that breaks parent-child in 0-indexed heaps.',
  ],
  'trie': [
    'The compressed trie that uses 10x less memory on sparse datasets.',
    'Why trie beats hash map for prefix autocomplete. Next video.',
    'The trie node boolean flag that marks end-of-word incorrectly. Next.',
  ],
  'bfs-dfs': [
    'Why BFS finds shortest path in unweighted graphs but DFS doesn\'t.',
    'The iterative DFS stack order that reverses traversal vs recursive.',
    'The BFS level-order trick that solves "minimum steps" problems. Next.',
  ],
  'backtracking': [
    'The pruning condition that turns 2^n into polynomial time. Next.',
    'Why forgetting to undo your choice corrupts all remaining branches.',
    'The constraint propagation trick that eliminates 90% of branches.',
  ],
  'greedy': [
    'The greedy choice that looks optimal locally but fails globally.',
    'Why the exchange argument proves your greedy approach is correct.',
    'The activity selection variant where greedy gives the wrong answer.',
  ],
  'sliding-window': [
    'The window shrink condition that most candidates get wrong. Next.',
    'Why variable-size window needs a while loop, not an if. Next video.',
    'The deque trick that tracks the window maximum in O(1). Next.',
  ],
  'two-pointers': [
    'The three-sum reduction to two-pointer that drops a factor of n.',
    'Why opposite-end pointers only work on sorted input. Next video.',
    'The fast-slow pointer variant that finds the duplicate number. Next.',
  ],
  'design-patterns': [
    'The singleton that breaks in multi-threaded code without DCL. Next.',
    'Why the observer pattern creates memory leaks without unsubscribe.',
    'The strategy pattern that eliminates your 500-line switch statement.',
  ],
  'default': [
    'The edge case at exactly 1000 QPS that nobody load-tested. Next.',
    'Why the default timeout of 30 seconds causes cascading failures.',
    'The retry policy without jitter that creates a synchronized storm.',
    'The off-by-one error in the boundary condition that corrupts state.',
    'Why the fallback path was never tested — until it was needed. Next.',
  ],
};

export function getZeigarnikEnding(topicSlug: string, shortIndex: number): string {
  const endings = ZEIGARNIK_ENDINGS[topicSlug] || ZEIGARNIK_ENDINGS['default'];
  return endings[shortIndex % endings.length];
}

// ─── Main Generator ─────────────────────────────────────────────────────────

/**
 * Generate a standalone Short episode for the given topic and format index.
 * 100% deterministic — same inputs always produce the same output.
 */
export function generateShort(topicSlug: string, shortIndex: number): ShortEpisode {
  const format = SHORT_FORMATS[shortIndex % SHORT_FORMATS.length];
  const topicDisplay = toDisplay(topicSlug);
  const example = getTopicExample(topicSlug);
  let { narration, heading, bullets } = format.generateContent(topicSlug, topicDisplay, example);

  // Upgrade with deep content if available (beats generic placeholder content)
  const deep = getDeepContent(topicSlug);
  if (deep) {
    // Override with format-specific voice using deep content
    if (format.name === 'concept-explainer') {
      narration = `${deep.bbgScenario} Boom. ${deep.realIncident} The fix? ${deep.catchphrase}. Specifically — ${deep.oneLinerFix}. Done. Not a rewrite. A config change.`;
    } else if (format.name === 'three-mistakes') {
      narration = `Mistake number one. ${deep.misconception}. That is what most engineers believe. Wrong. ${deep.misconceptionCorrection} Mistake number two. Ignoring this until production breaks. ${deep.incidentScenario} Mistake number three. No remediation plan. The fix for all three? ${deep.oneLinerFix}. Your move.`;
    } else if (format.name === 'hot-take') {
      narration = `The docs are lying to you. ${deep.fireshipsummary} Go check your config. Seriously — stop this video and go check.`;
    } else if (format.name === 'stat-hook') {
      narration = `${deep.specificNumbers} That is the number. Remember it. ${deep.fireshipsummary} Write it down before you forget. ${deep.zeigarnikHook}`;
    }
    // Always override heading for deep-content topics
    heading = `${deep.displayName}: What They Don't Teach You`;
    bullets = [
      deep.catchphrase,
      `Default config problem: ${deep.defaultConfigProblem.slice(0, 60)}...`,
      deep.oneLinerFix.slice(0, 60),
    ];
  }

  // DSA topics: override system-design-focused formats with algorithm-specific narration
  if (isDSATopic(topicSlug)) {
    const algo = topicDisplay;
    if (format.name === 'concept-explainer') {
      narration = `${algo}. One of those algorithms everyone uses but few truly understand. The naive approach? Brute force. O(n) or worse. The insight that changes everything? ${example.solution}. That one optimization takes you from timing out on large inputs to solving in milliseconds. ${example.company} uses this at ${example.scale}. The edge case that trips everyone up: ${example.problem}. Most implementations get it wrong on the boundary. Here is how to get it right.`;
    } else if (format.name === 'salary-bait') {
      narration = `This ${algo} question separates junior developers from senior. The interviewer writes the problem on the board. Most candidates jump straight to code. Wrong move. The senior move: "What are the constraints?" Array sorted? Duplicates allowed? That one question changes the algorithm from O(n squared) to O(n log n). ${example.solution} is the pattern. Learn to recognize it in two seconds. That recognition speed is what interviewers are actually testing.`;
    } else if (format.name === 'design-it') {
      narration = `Coding interview. You get a ${algo} problem. Where do you start? Not the code. The examples. Walk through two examples by hand. Find the pattern. Then ask: what is the subproblem? ${example.solution}. That framing turns a hard problem into a pattern you have seen before. The implementation is straightforward once you see the structure. ${example.problem} is the edge case. Handle it first. Then the rest writes itself.`;
    } else if (format.name === 'post-mortem') {
      narration = `The ${algo} bug that hid for nine years. The code looked correct. All tests passed. Then someone fed it an array of two billion elements. Integer overflow on the midpoint calculation. Mid equals left plus right divided by two — except left plus right overflows a 32-bit integer. The fix: mid equals left plus right minus left divided by two. One line. Nine years. Joshua Bloch wrote about this in 2006. Your implementation probably has the same bug. Check it.`;
    }
  }

  // Enforce 135-word limit (110-135 target range for ~45s at 2.5 words/sec)
  const words = narration.split(/\s+/);
  const clampedNarration = words.length > 135 ? words.slice(0, 135).join(' ') + '.' : narration;

  const title = format.titleTemplate(topicDisplay);

  // Build scenes for the AtomicShort composition
  const scenes = buildShortScenes(heading, clampedNarration, bullets, format.visualCue);

  // Generate SEO description
  const category = getTopicCategory(topicSlug);
  const leadMagnetLine = getLeadMagnetDescriptionLine(topicSlug);
  const description = `${title} — ${topicDisplay} explained in 45 seconds.\n${leadMagnetLine}\n\n${heading} | Full course at guru-sishya.in`;
  const hashtags = [
    `#${topicDisplay.replace(/\s+/g, '')}`,
    `#SystemDesign`,
    `#${category === 'dsa' ? 'CodingInterview' : 'SoftwareEngineering'}`,
    '#TechShorts',
    `#${topicDisplay.replace(/\s+/g, '')}Explained`,
  ];

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
    description,
    hashtags,
  };
}

/**
 * Given a global short number (0-725), resolve to topic + format index.
 * Deterministic: shortNumber → always the same Short.
 */
export function resolveShortNumber(shortNumber: number): { topicSlug: string; shortIndex: number } {
  const clamped = ((shortNumber % TOTAL_SHORTS) + TOTAL_SHORTS) % TOTAL_SHORTS;
  // Interleave: day 0 = topic 0 format 0, day 1 = topic 1 format 0, ...
  // day 66 = topic 0 format 1, day 67 = topic 1 format 1, etc.
  const topicIdx = clamped % ALL_TOPICS.length;
  const shortIdx = Math.floor(clamped / ALL_TOPICS.length);
  return {
    topicSlug: ALL_TOPICS[topicIdx],
    shortIndex: shortIdx % SHORT_FORMATS.length,
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
 * List all 924 Shorts in deterministic order.
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
