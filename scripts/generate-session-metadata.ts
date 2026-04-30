#!/usr/bin/env npx tsx
/**
 * generate-session-metadata.ts — Comprehensive Viral Metadata Generator
 *
 * Reads all topic content from guru-sishya and generates a rich .md metadata
 * file for EVERY session of EVERY topic at:
 *   ~/Documents/guru-sishya/{topic-slug}/session-{n}/metadata.md
 *
 * Each file contains YouTube long/short metadata, Instagram reel metadata,
 * production notes, hook scripts, cross-promotion templates, and SEO keywords.
 *
 * Usage:
 *   npx tsx scripts/generate-session-metadata.ts
 *   npx tsx scripts/generate-session-metadata.ts --topics load-balancing,caching
 *   npx tsx scripts/generate-session-metadata.ts --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Configuration ──────────────────────────────────────────────────────────

const GURU_SISHYA_CONTENT = path.resolve(__dirname, '../../guru-sishya/public/content');
const OUTPUT_BASE = path.join(process.env.HOME || '~', 'Documents', 'guru-sishya');
const BRAND_URL = 'www.guru-sishya.in';
const INSTAGRAM_HANDLE = '@guru_sishya.in';
const YOUTUBE_CHANNEL = '@GuruSishya-India';
const YOUTUBE_URL = 'https://www.youtube.com/@GuruSishya-India';
const INSTAGRAM_URL = 'https://instagram.com/guru_sishya.in';
const TOTAL_QUESTIONS = '1,988';
const TOTAL_TOPICS = '141';

// The 4 core system design topics with 10 sessions each
const CORE_TOPICS: TopicConfig[] = [
  {
    slug: 'load-balancing',
    name: 'Load Balancing',
    category: 'system-design',
    sessions: [
      { n: 1, title: 'What is Load Balancing & Why It Matters', focus: 'fundamentals, types, hardware vs software' },
      { n: 2, title: 'Round Robin & Weighted Round Robin', focus: 'basic algorithms, implementation, when to use' },
      { n: 3, title: 'Least Connections & IP Hash', focus: 'advanced algorithms, session persistence' },
      { n: 4, title: 'Consistent Hashing for Load Balancers', focus: 'ring-based hashing, virtual nodes, minimal disruption' },
      { n: 5, title: 'Health Checks & Failover Strategies', focus: 'passive, active, deep health checks, circuit breakers' },
      { n: 6, title: 'Layer 4 vs Layer 7 Load Balancing', focus: 'transport vs application layer, tradeoffs, when to use each' },
      { n: 7, title: 'SSL Termination & TLS Offloading', focus: 'encryption at scale, certificate management, performance' },
      { n: 8, title: 'Global Server Load Balancing (GSLB)', focus: 'GeoDNS, multi-region, latency-based routing' },
      { n: 9, title: 'Load Balancing at Netflix, Uber & Google', focus: 'real-world architectures, case studies, lessons' },
      { n: 10, title: 'Complete Interview Masterclass', focus: 'model answers, common mistakes, cheat sheet' },
    ],
  },
  {
    slug: 'caching',
    name: 'Caching',
    category: 'system-design',
    sessions: [
      { n: 1, title: 'What is Caching & Why Every System Needs It', focus: 'fundamentals, latency reduction, cache hit/miss' },
      { n: 2, title: 'Cache Eviction Policies (LRU, LFU, FIFO)', focus: 'algorithms, implementation, tradeoffs' },
      { n: 3, title: 'Write-Through, Write-Behind & Cache-Aside', focus: 'write strategies, consistency patterns' },
      { n: 4, title: 'Redis Deep Dive — Architecture & Data Types', focus: 'Redis internals, strings, hashes, sorted sets' },
      { n: 5, title: 'Memcached vs Redis — The Real Difference', focus: 'comparison, when to use which, benchmarks' },
      { n: 6, title: 'Cache Invalidation — The Hardest Problem', focus: 'TTL, event-driven, versioning, stampede prevention' },
      { n: 7, title: 'CDN Caching & Edge Computing', focus: 'CloudFront, Cloudflare, edge caching strategies' },
      { n: 8, title: 'Distributed Caching at Scale', focus: 'consistent hashing, replication, partition tolerance' },
      { n: 9, title: 'Caching at Instagram, Twitter & Discord', focus: 'real-world case studies, architecture decisions' },
      { n: 10, title: 'Complete Interview Masterclass', focus: 'model answers, cache design problems, cheat sheet' },
    ],
  },
  {
    slug: 'database-design',
    name: 'Database Design',
    category: 'system-design',
    sessions: [
      { n: 1, title: 'SQL vs NoSQL — The Decision Framework', focus: 'when to use each, ACID vs BASE, CAP theorem' },
      { n: 2, title: 'Database Indexing Deep Dive', focus: 'B-tree, hash index, composite indexes, query optimization' },
      { n: 3, title: 'Database Sharding Strategies', focus: 'horizontal partitioning, shard keys, range vs hash' },
      { n: 4, title: 'Database Replication & High Availability', focus: 'master-slave, multi-master, consensus protocols' },
      { n: 5, title: 'Schema Design for Scale', focus: 'normalization vs denormalization, embedding vs referencing' },
      { n: 6, title: 'Transactions & Isolation Levels', focus: 'ACID deep dive, read phenomena, MVCC' },
      { n: 7, title: 'NoSQL Deep Dive — MongoDB, Cassandra, DynamoDB', focus: 'document, wide-column, key-value stores' },
      { n: 8, title: 'Database Connection Pooling & Performance', focus: 'connection management, query optimization, N+1' },
      { n: 9, title: 'Database at Uber, Airbnb & Stripe', focus: 'real-world migrations, lessons learned' },
      { n: 10, title: 'Complete Interview Masterclass', focus: 'model answers, design problems, cheat sheet' },
    ],
  },
  {
    slug: 'api-gateway',
    name: 'API Gateway',
    category: 'system-design',
    sessions: [
      { n: 1, title: 'What is an API Gateway & Why You Need One', focus: 'fundamentals, single entry point, microservices routing' },
      { n: 2, title: 'Rate Limiting & Throttling', focus: 'token bucket, sliding window, distributed rate limiting' },
      { n: 3, title: 'Authentication & Authorization at the Gateway', focus: 'JWT, OAuth2, API keys, zero-trust' },
      { n: 4, title: 'Request Routing & Load Distribution', focus: 'path-based, header-based, canary deployments' },
      { n: 5, title: 'API Versioning Strategies', focus: 'URL vs header versioning, backward compatibility' },
      { n: 6, title: 'Circuit Breaker & Retry Patterns', focus: 'resilience patterns, fallbacks, bulkhead isolation' },
      { n: 7, title: 'API Gateway Products — Kong, Nginx, AWS', focus: 'comparison, open-source vs managed, migration' },
      { n: 8, title: 'GraphQL Gateway & BFF Pattern', focus: 'GraphQL federation, backend-for-frontend, aggregation' },
      { n: 9, title: 'API Gateway at Netflix, Amazon & Spotify', focus: 'Zuul, API Gateway, real-world patterns' },
      { n: 10, title: 'Complete Interview Masterclass', focus: 'model answers, design problems, cheat sheet' },
    ],
  },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface TopicConfig {
  slug: string;
  name: string;
  category: string;
  sessions: SessionConfig[];
}

interface SessionConfig {
  n: number;
  title: string;
  focus: string;
}

// ─── Deterministic Seeding (from metadata-generator.ts) ─────────────────────

function seededIndex(topic: string, sessionNumber: number, salt: number, max: number): number {
  let hash = salt;
  const key = `${topic}:${sessionNumber}:${salt}`;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % max;
}

function seededPick<T>(arr: T[], topic: string, session: number, salt: number): T {
  return arr[seededIndex(topic, session, salt, arr.length)];
}

// ─── YouTube Long Video Title Generator ─────────────────────────────────────
// Rotating formula templates, keyword-first, under 60 chars

const LONG_TITLE_FORMULAS = [
  // Curiosity gap
  (t: string, s: string) => `${t}: ${s} (Most Devs Miss This)`,
  (t: string, s: string) => `${t} — ${s} | FAANG Interview Prep`,
  // Number + promise
  (t: string, s: string) => `${t} Explained: ${s}`,
  (t: string, s: string) => `${s} — ${t} Complete Guide`,
  // Shock/authority
  (t: string, s: string) => `How Netflix Uses ${t}: ${s}`,
  (t: string, s: string) => `${t}: ${s} (With Code)`,
  // Challenge
  (t: string, s: string) => `${t} Deep Dive: ${s}`,
  (t: string, s: string) => `Master ${t}: ${s} | System Design`,
  // Direct value
  (t: string, s: string) => `${t} — ${s} (Interview Ready)`,
  (t: string, s: string) => `${s} in ${t} — What Google Tests`,
];

function generateLongTitle(topic: TopicConfig, session: SessionConfig): string {
  const formula = seededPick(LONG_TITLE_FORMULAS, topic.name, session.n, 17);
  let raw = formula(topic.name, session.title);
  if (raw.length > 60) {
    raw = raw.slice(0, 59).trimEnd() + '\u2026';
  }
  return raw;
}

// ─── YouTube Long Description ───────────────────────────────────────────────

const DESCRIPTION_HOOKS = [
  (t: string, f: string) =>
    `One wrong decision about ${t} can bring down your entire system at scale.\nIn this session, we cover ${f} — the way senior engineers at Google and Netflix actually think about it.`,
  (t: string, f: string) =>
    `Most developers can explain ${t} at a surface level. But can you answer the follow-up questions?\nThis video covers ${f} — with real code and the exact interview answer template.`,
  (t: string, f: string) =>
    `This ${t} knowledge separates mid-level from senior engineers.\nWe go deep into ${f} — no hand-waving, no filler, just the concepts and code that get you hired.`,
  (t: string, f: string) =>
    `${t} is asked in every system design interview. Most candidates give the same generic answer.\nThis session covers ${f} — giving you the edge that impresses interviewers.`,
  (t: string, f: string) =>
    `You memorized the theory. But can you actually implement it?\nIn this video, we implement ${f} from scratch — and reveal the ${t} secrets that senior engineers know.`,
];

function generateLongDescription(topic: TopicConfig, session: SessionConfig, title: string): string {
  const hook = seededPick(DESCRIPTION_HOOKS, topic.name, session.n, 43);
  const hookText = hook(topic.name, session.focus);
  const topicSlug = topic.slug;

  const sessionLabel = session.n <= 3 ? 'fundamentals' : session.n <= 7 ? 'deep dive with code' : 'advanced patterns & case studies';

  const sessionNav = topic.sessions.map((s, i) => {
    const marker = s.n === session.n ? '>> ' : '   ';
    const suffix = s.n === session.n ? ' (You are here)' : '';
    return `${marker}Session ${s.n}: ${s.title}${suffix}`;
  }).join('\n');

  return `${topic.name} (${sessionLabel}) — master this for your FAANG interview. FREE practice with ${TOTAL_QUESTIONS} questions at ${BRAND_URL}/${topicSlug}

${hookText}

\u23f1\ufe0f Chapters:
0:00 Introduction & Hook
0:30 Why This Matters
1:30 Core Concepts: ${session.focus}
4:00 Code Implementation (Python + Java)
6:30 Interview Insight
7:30 Common Mistakes
8:30 Real-World Architecture
9:30 Summary & Next Session

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\ud83d\udd25 FREE Interview Prep (${TOTAL_QUESTIONS} questions, ${TOTAL_TOPICS} topics): https://${BRAND_URL}/${topicSlug}
\ud83d\udcfa Full Playlist: ${YOUTUBE_URL}
\ud83d\udcf1 Instagram: ${INSTAGRAM_URL}
\ud83d\udcdd LinkedIn: https://linkedin.com/company/guru-sishya
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

\ud83d\udccc Full ${topic.name} Series (10 Sessions):
${sessionNav}

#SystemDesign #CodingInterview #GuruSishya`;
}

// ─── YouTube Tags ───────────────────────────────────────────────────────────

function generateTags(topic: TopicConfig, session: SessionConfig): string[] {
  const t = topic.name.toLowerCase();
  const slug = topic.slug;

  const sessionLevel = session.n <= 3 ? 'fundamentals' : session.n <= 7 ? 'deep dive' : 'advanced';

  const tags = [
    t,
    `${t} explained`,
    `${t} interview questions`,
    `${t} tutorial`,
    `${t} system design`,
    `${t} ${sessionLevel}`,
    `coding interview ${t}`,
    `FAANG interview ${t}`,
    'system design interview',
    'coding interview prep',
    'guru sishya',
    'guru-sishya',
    `${t} python`,
    `${t} java`,
    `${t} with code`,
    `${t} for beginners`,
    'software engineering interview',
    'backend engineering',
    'distributed systems',
    'tech interview prep',
  ];

  // Deduplicate and limit to 20
  const seen = new Set<string>();
  return tags.filter(tag => {
    const lower = tag.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  }).slice(0, 20);
}

// ─── YouTube Hashtags ───────────────────────────────────────────────────────

function generateHashtags(topic: TopicConfig): string[] {
  const topicTag = `#${topic.name.replace(/\s+/g, '')}`;
  return [topicTag, '#CodingInterview', '#GuruSishya'];
}

// ─── DALL-E Thumbnail Prompt ────────────────────────────────────────────────

const THUMBNAIL_PROMPTS: Record<string, string[]> = {
  'load-balancing': [
    'Dark background #0C0A15, futuristic server rack with glowing teal (#1DD1A1) load balancer distributing traffic lines to 5 servers, neon arrows, minimal clean style, no text, 1280x720',
    'Dark background, dramatic split view: overloaded single server (red glow) vs balanced server farm (teal glow), cyberpunk minimal style, no text, 1280x720',
    'Dark #0C0A15 background, glowing network topology with round-robin arrows in saffron (#E85D26), server nodes pulsing teal, futuristic holographic style, no text, 1280x720',
  ],
  'caching': [
    'Dark background #0C0A15, glowing Redis logo-inspired crystal with data streams flowing through it, teal (#1DD1A1) and gold (#FDB813) highlights, futuristic minimal, no text, 1280x720',
    'Dark background, dramatic speed comparison: slow database query (red clock) vs instant cache hit (teal lightning), cyberpunk style, no text, 1280x720',
    'Dark #0C0A15 background, layered caching architecture (L1/L2/L3) with glowing saffron nodes and teal connection lines, futuristic holographic, no text, 1280x720',
  ],
  'database-design': [
    'Dark background #0C0A15, split database diagram SQL vs NoSQL with glowing teal (#1DD1A1) schema lines and saffron (#E85D26) document nodes, futuristic minimal, no text, 1280x720',
    'Dark background, dramatic sharding visualization with data partitions glowing in different colors across server nodes, cyberpunk style, no text, 1280x720',
    'Dark #0C0A15 background, B-tree index structure with glowing gold (#FDB813) nodes and teal search path highlighted, holographic style, no text, 1280x720',
  ],
  'api-gateway': [
    'Dark background #0C0A15, futuristic gateway portal with multiple API routes fanning out in teal (#1DD1A1) neon lines, shield icon for auth, minimal style, no text, 1280x720',
    'Dark background, dramatic rate limiter visualization with token bucket filling and draining, saffron tokens, teal bucket glow, cyberpunk, no text, 1280x720',
    'Dark #0C0A15 background, microservices mesh with central glowing API gateway node, circuit breaker patterns in gold (#FDB813), futuristic, no text, 1280x720',
  ],
};

function generateThumbnailPrompt(topic: TopicConfig, session: SessionConfig): string {
  const prompts = THUMBNAIL_PROMPTS[topic.slug] || THUMBNAIL_PROMPTS['load-balancing'];
  return seededPick(prompts, topic.name, session.n, 77);
}

// ─── Pinned Comment ─────────────────────────────────────────────────────────

const PINNED_COMMENT_TEMPLATES = [
  (t: string, slug: string, focus: string) =>
    `Want to practice ${t} with real interview questions? I built a FREE platform with ${TOTAL_QUESTIONS} questions across ${TOTAL_TOPICS} topics.\n\nhttps://${BRAND_URL}/${slug}\n\nWhich part of ${focus} do you find hardest? Drop it below and I'll make a dedicated video on it!`,
  (t: string, slug: string, focus: string) =>
    `If this video helped you understand ${t}, smash that like button so more people can find it.\n\nFREE practice: https://${BRAND_URL}/${slug}\n\nDrop your toughest ${t} interview question below. I'll answer every single one.`,
  (t: string, slug: string, focus: string) =>
    `I spent 200+ hours building this ${t} series so you don't have to struggle the way I did.\n\nFREE prep platform: https://${BRAND_URL}/${slug} (${TOTAL_QUESTIONS} questions)\n\nWhat topic should I cover next? Comment below!`,
];

function generatePinnedComment(topic: TopicConfig, session: SessionConfig): string {
  const template = seededPick(PINNED_COMMENT_TEMPLATES, topic.name, session.n, 89);
  return template(topic.name, topic.slug, session.focus);
}

// ─── Community Post (Poll Format) ───────────────────────────────────────────

function generateCommunityPost(topic: TopicConfig, session: SessionConfig, title: string): string {
  const nextSession = topic.sessions.find(s => s.n === session.n + 1);
  const pollOptions = [
    session.focus.split(',')[0]?.trim() || `${topic.name} Advanced`,
    nextSession ? nextSession.title : `${topic.name} Interview Questions`,
    `Real-World ${topic.name} Case Studies`,
    'Something else (comment below!)',
  ];

  return `\ud83d\udd25 New video dropped: ${title}

Session ${session.n}/10 of the complete ${topic.name} series is LIVE!

What should I deep-dive into next?
\u25a1 ${pollOptions[0]}
\u25a1 ${pollOptions[1]}
\u25a1 ${pollOptions[2]}
\u25a1 ${pollOptions[3]}

Full prep (FREE): https://${BRAND_URL}/${topic.slug}`;
}

// ─── YouTube Short Title ────────────────────────────────────────────────────

const SHORT_TITLE_TEMPLATES = [
  (t: string) => `Wait, THIS is how ${t} actually works?!`,
  (t: string) => `90% of Devs Get ${t} Wrong`,
  (t: string) => `${t} in 60 Seconds \u2014 Save This`,
  (t: string) => `The ${t} Secret That Gets You Hired`,
  (t: string) => `Junior vs Senior: ${t} Answer`,
  (t: string) => `Stop Getting ${t} Wrong in Interviews`,
  (t: string) => `Google Asked This ${t} Question`,
  (t: string) => `${t} Explained Like You're 5`,
  (t: string) => `This ${t} Trick Changed Everything`,
  (t: string) => `If You Don't Know ${t}, You're Cooked`,
];

function generateShortTitle(topic: TopicConfig, session: SessionConfig): string {
  const template = seededPick(SHORT_TITLE_TEMPLATES, topic.name, session.n, 53);
  let title = template(topic.name);
  if (title.length > 60) title = title.slice(0, 59).trimEnd() + '\u2026';
  return title;
}

// ─── YouTube Short Description ──────────────────────────────────────────────

function generateShortDescription(topic: TopicConfig, session: SessionConfig): string {
  return `${topic.name} \u2014 ${session.title} explained in 60 seconds.

FREE practice: https://${BRAND_URL}/${topic.slug}
${TOTAL_QUESTIONS} interview questions across ${TOTAL_TOPICS} topics \u2014 completely FREE.

Full video on our channel!

#Shorts #${topic.name.replace(/\s+/g, '')} #CodingInterview #SystemDesign #FAANG #InterviewPrep #GuruSishya`;
}

// ─── Instagram Caption ──────────────────────────────────────────────────────

const INSTAGRAM_HOOKS = [
  (t: string, f: string) => `This ${t} mistake will crash your system at scale \ud83d\udea8`,
  (t: string, f: string) => `90% of developers can't explain ${t} under pressure \ud83d\udc40`,
  (t: string, f: string) => `How Netflix actually handles ${t} (most tutorials get this wrong) \ud83e\udd2f`,
  (t: string, f: string) => `The ${t} knowledge that gets you the SENIOR offer \ud83c\udfaf`,
  (t: string, f: string) => `I coded ${f} from scratch. Here's what I learned \ud83e\udde0`,
  (t: string, f: string) => `Stop memorizing ${t}. Understand THIS instead \ud83d\udd25`,
  (t: string, f: string) => `${t} \u2014 the question that separates senior from junior \u2694\ufe0f`,
  (t: string, f: string) => `If you can't explain ${t} in 30 seconds, watch this \u26a1`,
];

function generateInstagramCaption(topic: TopicConfig, session: SessionConfig): string {
  const hook = seededPick(INSTAGRAM_HOOKS, topic.name, session.n, 67);
  const hookText = hook(topic.name, session.focus);

  const hashtags = [
    `#${topic.name.replace(/\s+/g, '').toLowerCase()}`,
    '#systemdesign',
    '#codinginterview',
    '#faang',
    '#interviewprep',
    '#programming',
    '#tech',
    '#developer',
  ].join(' ');

  return `${hookText}

Session ${session.n}/10: ${session.title}

\ud83d\udcbe Save this for your interview prep
\ud83d\udce4 Send to someone preparing for FAANG
\ud83d\udd17 Full course FREE at ${BRAND_URL} (link in bio)

${hashtags}`;
}

// ─── Instagram Cover Text ───────────────────────────────────────────────────

const COVER_TEXT_TEMPLATES = [
  (t: string) => `${t.split(' ')[0]}\nEXPLAINED`,
  (t: string) => `${t.split(' ')[0]}\nWITH CODE`,
  (t: string) => `STOP GETTING\n${t.split(' ')[0]} WRONG`,
  (t: string) => `SENIOR vs\nJUNIOR`,
  (t: string) => `THE SECRET\nTO ${t.split(' ')[0].toUpperCase()}`,
];

function generateCoverText(topic: TopicConfig, session: SessionConfig): string {
  const template = seededPick(COVER_TEXT_TEMPLATES, topic.name, session.n, 101);
  return template(topic.name);
}

// ─── Best Posting Times ─────────────────────────────────────────────────────

const POSTING_TIMES = [
  { day: 'Monday', time: '7:00 AM IST', reason: 'Morning commute learning spike' },
  { day: 'Tuesday', time: '12:30 PM IST', reason: 'Lunch break peak engagement' },
  { day: 'Wednesday', time: '7:00 PM IST', reason: 'Post-work study session' },
  { day: 'Thursday', time: '8:00 AM IST', reason: 'Early morning study crowd' },
  { day: 'Friday', time: '6:00 PM IST', reason: 'Weekend prep kickoff' },
  { day: 'Saturday', time: '10:00 AM IST', reason: 'Weekend deep-study window' },
  { day: 'Sunday', time: '11:00 AM IST', reason: 'Sunday study marathon' },
];

function getBestPostingTime(topic: TopicConfig, session: SessionConfig): typeof POSTING_TIMES[0] {
  return POSTING_TIMES[(session.n - 1) % POSTING_TIMES.length];
}

// ─── Hook Scripts (first 15 seconds) ────────────────────────────────────────

const HOOK_SCRIPTS = [
  (t: string, f: string) =>
    `"Every single system design interview asks about ${t}. And 90% of candidates give the exact same generic answer. In the next 10 minutes, I'm going to show you ${f} — the answer that actually gets you hired."`,
  (t: string, f: string) =>
    `"Netflix serves 200 million subscribers. Amazon processes 400 million requests per second. Uber matches 20 million rides a day. None of this works without ${t}. Today we're covering ${f} — with real code."`,
  (t: string, f: string) =>
    `"Here's a question that was asked at Google last month: explain ${f} in ${t}. Most candidates fumble it. After this video, you won't."`,
  (t: string, f: string) =>
    `"I've reviewed over 500 system design interview answers. The number one mistake? Getting ${t} wrong. Specifically, ${f}. Let me show you the right way."`,
  (t: string, f: string) =>
    `"If your system gets ${t} wrong, it doesn't matter how good the rest of your architecture is. Everything falls apart. Today: ${f} — the complete guide."`,
  (t: string, f: string) =>
    `"One wrong decision about ${t} cost a company I worked at 2 million dollars. The mistake? They didn't understand ${f}. Let me make sure you never make the same mistake."`,
];

function generateHookScript(topic: TopicConfig, session: SessionConfig): string {
  const template = seededPick(HOOK_SCRIPTS, topic.name, session.n, 31);
  return template(topic.name, session.focus);
}

// ─── Key Visual Moments ─────────────────────────────────────────────────────

function generateKeyVisualMoments(topic: TopicConfig, session: SessionConfig): string {
  const focusParts = session.focus.split(',').map(s => s.trim());
  const moments = [
    `0:00-0:05 \u2014 Hook text overlay: dramatic question about ${topic.name}`,
    `0:05-0:30 \u2014 Problem setup with animated architecture diagram`,
    `0:30-1:30 \u2014 Why this matters: real-world scale numbers (Netflix, Amazon, Google)`,
  ];

  focusParts.forEach((part, i) => {
    const startMin = 1.5 + i * 2;
    const endMin = startMin + 2;
    const startStr = `${Math.floor(startMin)}:${String(Math.round((startMin % 1) * 60)).padStart(2, '0')}`;
    const endStr = `${Math.floor(endMin)}:${String(Math.round((endMin % 1) * 60)).padStart(2, '0')}`;
    moments.push(`${startStr}-${endStr} \u2014 Deep dive: ${part} with animated visualization`);
  });

  moments.push(
    `7:00-8:00 \u2014 Code implementation split-screen (Python left, Java right)`,
    `8:00-8:30 \u2014 Interview insight callout with golden border animation`,
    `8:30-9:00 \u2014 Common mistakes with red X / green check animation`,
    `9:00-9:30 \u2014 Summary cheat sheet card + subscribe CTA`,
  );

  return moments.map(m => `- ${m}`).join('\n');
}

// ─── SEO Keywords ───────────────────────────────────────────────────────────

function generateSEOKeywords(topic: TopicConfig, session: SessionConfig): { primary: string; secondary: string[]; longTail: string[] } {
  const t = topic.name.toLowerCase();

  return {
    primary: `${t} system design interview`,
    secondary: [
      `${t} explained`,
      `${t} tutorial`,
      `${t} interview questions`,
      `${t} with code`,
      `system design ${t}`,
      `${t} python java`,
      `FAANG ${t} interview`,
    ],
    longTail: [
      `how does ${t} work in system design`,
      `${t} interview questions and answers`,
      `${t} ${session.focus.split(',')[0]?.trim()} explained`,
      `${t} for beginners complete guide`,
      `how to explain ${t} in interview`,
      `${t} real world examples netflix uber`,
    ],
  };
}

// ─── Trending Topic Alignment ───────────────────────────────────────────────

const TREND_ALIGNMENTS: Record<string, string[]> = {
  'load-balancing': [
    'AI/ML model serving requires intelligent load balancing across GPU clusters',
    'Kubernetes auto-scaling and service mesh (Istio/Envoy) use advanced LB algorithms',
    'Edge computing and 5G push load balancing closer to users',
    'Serverless architectures change how we think about traffic distribution',
  ],
  'caching': [
    'AI inference caching (KV cache) is the hottest topic in LLM optimization',
    'Redis 8.0 and Dragonfly DB pushing in-memory caching boundaries',
    'Edge caching with Cloudflare Workers and Vercel Edge Functions',
    'Vector databases use caching for similarity search acceleration',
  ],
  'database-design': [
    'NewSQL databases (CockroachDB, TiDB) combining SQL and horizontal scale',
    'AI-powered query optimization and auto-indexing in modern databases',
    'Multi-model databases supporting documents + graphs + time-series',
    'Serverless databases (PlanetScale, Neon) changing deployment patterns',
  ],
  'api-gateway': [
    'AI-powered API gateways with automatic rate limiting and anomaly detection',
    'gRPC and HTTP/3 support in modern gateways',
    'API-first design and OpenAPI 4.0 driving gateway evolution',
    'Zero-trust security architecture centering on gateway authentication',
  ],
};

function generateTrendAlignment(topic: TopicConfig, session: SessionConfig): string {
  const trends = TREND_ALIGNMENTS[topic.slug] || TREND_ALIGNMENTS['load-balancing'];
  return seededPick(trends, topic.name, session.n, 113);
}

// ─── Cross-Promotion Templates ──────────────────────────────────────────────

function generateLinkedInPost(topic: TopicConfig, session: SessionConfig, title: string): string {
  return `${topic.name} is asked in EVERY system design interview.

Session ${session.n}/10 just dropped: ${session.title}
Covering: ${session.focus}

Watch the full video: [YouTube link]
Practice FREE: https://${BRAND_URL}/${topic.slug}

#SystemDesign #SoftwareEngineering #InterviewPrep`;
}

function generateTwitterPost(topic: TopicConfig, session: SessionConfig): string {
  const hooks = [
    `New ${topic.name} video: ${session.title}\n\n90% of devs get this wrong in interviews.\n\nWatch + FREE practice: ${BRAND_URL}/${topic.slug}`,
    `Session ${session.n}/10 of my ${topic.name} series is LIVE.\n\nCovering: ${session.focus}\n\nFREE prep: ${BRAND_URL}/${topic.slug}`,
    `If you can't explain ${session.title.toLowerCase()} in an interview, this video is for you.\n\n${BRAND_URL}/${topic.slug}`,
  ];
  let post = seededPick(hooks, topic.name, session.n, 127);
  if (post.length > 280) post = post.slice(0, 277) + '...';
  return post;
}

function generateRedditSubreddits(topic: TopicConfig): string[] {
  const base = [
    'r/cscareerquestions',
    'r/ExperiencedDevs',
    'r/leetcode',
    'r/systemdesign',
    'r/programming',
  ];

  const topicSpecific: Record<string, string[]> = {
    'load-balancing': ['r/devops', 'r/sysadmin', 'r/aws', 'r/kubernetes'],
    'caching': ['r/redis', 'r/devops', 'r/aws', 'r/webdev'],
    'database-design': ['r/Database', 'r/PostgreSQL', 'r/mongodb', 'r/sql'],
    'api-gateway': ['r/webdev', 'r/microservices', 'r/aws', 'r/node'],
  };

  return [...base, ...(topicSpecific[topic.slug] || [])];
}

function generateWhatsAppMessage(topic: TopicConfig, session: SessionConfig): string {
  return `Hey! Just watched this amazing ${topic.name} video \u2014 Session ${session.n}: ${session.title}

If you're preparing for system design interviews, this is a MUST watch. They also have a free platform with ${TOTAL_QUESTIONS} questions.

Video: [YouTube link]
Free practice: https://${BRAND_URL}/${topic.slug}`;
}

// ─── Assemble the Markdown ──────────────────────────────────────────────────

function generateMetadataMd(topic: TopicConfig, session: SessionConfig): string {
  const longTitle = generateLongTitle(topic, session);
  const longDescription = generateLongDescription(topic, session, longTitle);
  const tags = generateTags(topic, session);
  const hashtags = generateHashtags(topic);
  const thumbnailPrompt = generateThumbnailPrompt(topic, session);
  const pinnedComment = generatePinnedComment(topic, session);
  const communityPost = generateCommunityPost(topic, session, longTitle);
  const shortTitle = generateShortTitle(topic, session);
  const shortDescription = generateShortDescription(topic, session);
  const instagramCaption = generateInstagramCaption(topic, session);
  const coverText = generateCoverText(topic, session);
  const postingTime = getBestPostingTime(topic, session);
  const hookScript = generateHookScript(topic, session);
  const keyVisuals = generateKeyVisualMoments(topic, session);
  const seoKeywords = generateSEOKeywords(topic, session);
  const trendAlignment = generateTrendAlignment(topic, session);
  const linkedInPost = generateLinkedInPost(topic, session, longTitle);
  const twitterPost = generateTwitterPost(topic, session);
  const redditSubs = generateRedditSubreddits(topic);
  const whatsappMsg = generateWhatsAppMessage(topic, session);

  const instagramHashtags = [
    `#${topic.name.replace(/\s+/g, '').toLowerCase()}`,
    '#systemdesign',
    '#codinginterview',
    '#faang',
    '#interviewprep',
    '#programming',
    '#tech',
    '#developer',
  ];

  return `# ${topic.name} \u2014 Session ${session.n}: ${session.title}
## Brand: ${BRAND_URL} | ${INSTAGRAM_HANDLE}

---

## \ud83d\udcfa YOUTUBE LONG VIDEO

### Title (under 60 chars, keyword-first)
${longTitle}

### Description (first 150 chars critical)
${longDescription}

### Tags (${tags.length}, priority ordered)
${tags.join(', ')}

### Hashtags (exactly 3, shown above title)
${hashtags.join(' ')}

### Thumbnail DALL-E Prompt
${thumbnailPrompt}

### Pinned Comment
${pinnedComment}

### Community Post (poll format)
${communityPost}

---

## \ud83d\udcf1 YOUTUBE SHORT

### Title
${shortTitle}

### Description
${shortDescription}

### Hashtags
#Shorts #${topic.name.replace(/\s+/g, '')} #CodingInterview

---

## \ud83d\udcf8 INSTAGRAM REEL

### Caption
${instagramCaption}

### Cover Text
${coverText}

### Best Posting Time
${postingTime.day} ${postingTime.time} \u2014 ${postingTime.reason}

### Hashtags
${instagramHashtags.join(' ')}

---

## \ud83c\udfac VIDEO PRODUCTION NOTES

### Voice Pacing
- Long video: 150-160 WPM (clear, teaching pace)
- Short/Reel: 180-200 WPM (fast, punchy)
- Speed up TTS by 1.15x for shorts
- Voice: en-IN-PrabhatNeural (Indian English Male, FREE, unlimited)

### Hook Script (first 15 seconds)
${hookScript}

### Key Visual Moments
${keyVisuals}

### SEO Keywords (for discoverability)
**Primary:** ${seoKeywords.primary}
**Secondary:** ${seoKeywords.secondary.join(', ')}
**Long-tail:** ${seoKeywords.longTail.join(', ')}

### Trending Topic Alignment
${trendAlignment}

---

## \ud83d\udd17 CROSS-PROMOTION

### LinkedIn Post
${linkedInPost}

### Twitter/X Post
${twitterPost}

### Reddit Subreddits
${redditSubs.join(', ')}

### WhatsApp Message
${whatsappMsg}
`;
}

// ─── Main Execution ─────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  // Filter topics if --topics flag provided
  let topicsToProcess = CORE_TOPICS;
  const topicsIdx = args.indexOf('--topics');
  if (topicsIdx !== -1 && args[topicsIdx + 1]) {
    const requested = args[topicsIdx + 1].split(',').map(s => s.trim().toLowerCase());
    topicsToProcess = CORE_TOPICS.filter(t => requested.includes(t.slug));
  }

  console.log('\n\ud83c\udfac Guru Sishya \u2014 Viral Metadata Generator');
  console.log(`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
  console.log(`Topics: ${topicsToProcess.map(t => t.name).join(', ')}`);
  console.log(`Sessions per topic: 10`);
  console.log(`Total files: ${topicsToProcess.length * 10}`);
  console.log(`Output: ${OUTPUT_BASE}/{topic-slug}/session-{n}/metadata.md`);
  if (dryRun) console.log('MODE: Dry run (no files written)\n');
  else console.log('');

  let totalGenerated = 0;

  for (const topic of topicsToProcess) {
    console.log(`\n\ud83d\udcda ${topic.name} (${topic.sessions.length} sessions)`);

    for (const session of topic.sessions) {
      const md = generateMetadataMd(topic, session);
      const outputDir = path.join(OUTPUT_BASE, topic.slug, `session-${session.n}`);
      const outputFile = path.join(outputDir, 'metadata.md');

      if (dryRun) {
        console.log(`  \u2502 S${session.n}: ${session.title}`);
        console.log(`  \u2502   Would write: ${outputFile}`);
        console.log(`  \u2502   Title: ${generateLongTitle(topic, session)}`);
      } else {
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(outputFile, md, 'utf-8');
        console.log(`  \u2714 S${session.n}: ${session.title} \u2192 ${outputFile}`);
        totalGenerated++;
      }
    }
  }

  console.log(`\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
  if (dryRun) {
    console.log(`Dry run complete. ${topicsToProcess.length * 10} files would be generated.`);
  } else {
    console.log(`Done! Generated ${totalGenerated} metadata.md files.`);
  }
  console.log(`Output: ${OUTPUT_BASE}/\n`);
}

main();
