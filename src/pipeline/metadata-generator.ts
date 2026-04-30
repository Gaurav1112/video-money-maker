import { Storyboard } from '../types';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface YouTubeMetadata {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  chapters: { time: string; title: string }[];
  category: number;
  language: string;
  playlist: string;
  thumbnailText: string;
  thumbnailPrompt: string;
  endScreen: string;
  cardLink: string;
  pinnedComment: string;
  communityPost: string;
  /** @deprecated Use `category` instead */
  categoryId?: string;
}

export interface InstagramMetadata {
  caption: string;
  hashtags: string[];
  coverText: string;
}

export interface SeoMetadata {
  keywords: string[];
  metaDescription: string;
}

export interface VideoMetadata {
  youtube: YouTubeMetadata;
  instagram: InstagramMetadata;
  seo: SeoMetadata;
}

export interface ShortMetadata {
  id: string;
  segment: string;
  youtube: {
    title: string;
    description: string;
    tags: string[];
  };
  instagram: {
    caption: string;
    hashtags: string[];
    coverText: string;
  };
}

export interface ShortsMetadata {
  shorts: ShortMetadata[];
}

// ─── Deterministic Seeding ────────────────────────────────────────────────────

/**
 * Deterministic pseudo-random number in range [0, max) seeded by topic + session.
 * Same inputs always produce the same output — required for reproducible builds.
 */
function seededIndex(topic: string, sessionNumber: number, salt: number, max: number): number {
  let hash = salt;
  const key = `${topic}:${sessionNumber}:${salt}`;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0; // Convert to 32-bit int
  }
  return Math.abs(hash) % max;
}

// ─── Topic Classifier ─────────────────────────────────────────────────────────

type TopicType = 'data-structure' | 'algorithm' | 'system-design' | 'concept' | 'language';

function classifyTopic(topic: string): TopicType {
  const lower = topic.toLowerCase();

  const dataStructures = ['array', 'linked list', 'tree', 'graph', 'heap', 'stack', 'queue',
    'hash map', 'hashmap', 'trie', 'deque', 'set', 'map', 'matrix'];
  const algorithms = ['sort', 'search', 'bfs', 'dfs', 'dynamic programming', 'recursion',
    'binary search', 'greedy', 'backtracking', 'sliding window', 'two pointer'];
  const systemDesign = ['load balancing', 'caching', 'database', 'microservices', 'api',
    'docker', 'kubernetes', 'cdn', 'rate limiting', 'sharding', 'replication',
    'message queue', 'kafka', 'redis', 'distributed'];
  const languages = ['python', 'java', 'typescript', 'javascript', 'go', 'rust', 'sql'];

  if (dataStructures.some(ds => lower.includes(ds))) return 'data-structure';
  if (algorithms.some(alg => lower.includes(alg))) return 'algorithm';
  if (systemDesign.some(sd => lower.includes(sd))) return 'system-design';
  if (languages.some(lang => lower.includes(lang))) return 'language';
  return 'concept';
}

// ─── Title Templates ──────────────────────────────────────────────────────────
// SEO-optimized: keyword-first, under 60 chars, power words. Curiosity gaps + numbers.

const TITLE_TEMPLATES_BY_TYPE: Record<TopicType, string[][]> = {
  'data-structure': [
    // Session variants [s1, s2, s3]
    ['{topic} Explained in {duration} — FAANG Interview Prep', 'I Coded {topic} From Scratch — Every Dev Needs This', '{topic} Advanced Patterns — The Senior Engineer Guide'],
    ['Stop Using {topic} Wrong — Here\'s the Fix', 'Why 90% of Devs Get {topic} Wrong (With Code)', '{topic} Deep Dive — What Google Actually Tests'],
    ['{topic} in {duration} (Interview Ready)', '{topic} Algorithms You Must Know for FAANG', 'The {topic} Trick Nobody Teaches — Final Boss Level'],
    ['Why Most Devs Get {topic} Wrong', 'I Built {topic} in Python — Watch This Before Interviews', 'Master {topic} — The Complete System Design Guide'],
  ],
  'algorithm': [
    ['{topic} Explained in {duration} | Interview Ready', 'I Coded Every {topic} Pattern in Python', '{topic} — The Patterns That Get You Hired'],
    ['Why {topic} Breaks Most Code (And How to Fix It)', '{topic} With Code — Stop Memorizing, Start Understanding', '{topic} Advanced — What FAANG Actually Tests'],
    ['{topic} in {duration} — From Zero to Interview Ready', '5 {topic} Patterns Every Dev Must Know', 'The {topic} Secret Senior Engineers Use'],
    ['Stop Memorizing {topic} — Do This Instead', 'I Solved 100 {topic} Problems — Here\'s What I Learned', '{topic} Master Class — The Complete Guide'],
  ],
  'system-design': [
    ['{topic} Explained in {duration} | System Design Interview', 'I Coded {topic} From Scratch in Python | System Design', '{topic} — The Senior Engineer Answer | System Design'],
    ['How Netflix Uses {topic} (Most Tutorials Get This Wrong)', '{topic} Algorithms Deep Dive — With Python Code', 'Layer 4 vs Layer 7 {topic} — Pick Wrong and You\'re Done'],
    ['{topic} in {duration} — What Google Actually Tests', '{topic} With Code — 5 Algorithms You Must Know', '{topic} Complete Guide — From Junior to Senior'],
    ['Why {topic} Crashes at Scale (And How to Fix It)', 'Stop Building {topic} Wrong — Here\'s the Right Way', 'The {topic} Trade-offs Nobody Tells You About'],
  ],
  'concept': [
    ['{topic} Explained in {duration} — Simplified', 'I Built {topic} From Scratch — With Code', '{topic} Advanced — The Complete Deep Dive'],
    ['Why {topic} Trips Up Senior Devs', '{topic} With Code — Stop Getting It Wrong', '{topic} — What No Tutorial Teaches You'],
    ['{topic} in {duration} — Interview Ready', '5 {topic} Patterns Every Dev Must Know', 'The {topic} Insight That Changes Everything'],
    ['Most Devs Get {topic} Wrong. Do You?', 'I Spent 100 Hours Learning {topic} — Here\'s Everything', '{topic} Master Class — The Final Guide'],
  ],
  'language': [
    ['{topic} Tricks Most Devs Don\'t Know', 'Advanced {topic} Patterns — With Code', '{topic} Deep Dive — Senior Level'],
    ['Stop Writing Bad {topic} Code — Do This', '{topic} Tips That 10x Your Speed', '{topic} Secrets Senior Engineers Use'],
    ['{topic} in {duration} — Interview Ready', '5 {topic} Patterns You Must Know', 'The {topic} Guide Nobody Made Until Now'],
    ['Why Your {topic} Code Is Slow (Fix It Now)', 'Clean {topic} Code — Step by Step', '{topic} Optimization — The Complete Guide'],
  ],
};

function generateTitle(topic: string, sessionNumber: number, durationSecs: number): string {
  const type = classifyTopic(topic);
  const templateSets = TITLE_TEMPLATES_BY_TYPE[type];
  const setIdx = seededIndex(topic, sessionNumber, 17, templateSets.length);
  const sessionIdx = Math.min(sessionNumber - 1, 2); // 0, 1, or 2
  const mins = Math.round(durationSecs / 60);
  const duration = `${mins} Minutes`;

  let raw = templateSets[setIdx][sessionIdx]
    .replace('{topic}', topic)
    .replace('{duration}', duration);

  // Truncate to 60 chars max (SEO research: titles over 60 get cut off in search)
  if (raw.length > 60) {
    raw = raw.slice(0, 59).trimEnd() + '…';
  }
  return raw;
}

// ─── Thumbnail Text Templates ─────────────────────────────────────────────────
// 3-5 words max. High curiosity / shock value.

const THUMBNAIL_TEMPLATES_BY_TYPE: Record<TopicType, string[][]> = {
  'data-structure': [
    ['DON\'T Use {topic}!', '{topic}\nCODED', '{topic}\nFinal Boss'],
    ['{topic} = O(1) Trick', '5 Algorithms\nYou MUST Know', 'The REAL\nDifference'],
    ['Google Asked This', 'I CODED\nEvery Pattern', '{topic}\nMaster Class'],
    ['90% Get This Wrong', '{topic}\nWith Python', 'Senior vs Junior\n{topic}'],
  ],
  'algorithm': [
    ['This Pattern = Hired', 'I CODED\n5 Patterns', '{topic}\nAdvanced'],
    ['Stop Brute Forcing!', 'The SECRET\nPattern', '{topic}\nComplete Guide'],
    ['FAANG Loves This', '{topic}\nin Python', 'The Missing\nInsight'],
    ['90% Fail This', '5 Algorithms\nCoded', 'Know THIS\nor Fail'],
  ],
  'system-design': [
    ['{topic}\nExplained', 'I CODED\n5 Algorithms', 'L4 vs L7\nThe REAL Difference'],
    ['Netflix Does THIS', '{topic}\nWith Python', 'Pick Wrong\n= Cooked'],
    ['This Crashes\nat Scale', 'The Interview\nSecret', 'Senior vs Junior\nAnswer'],
    ['Scale to\n1B Users', '{topic}\nDeep Dive', 'The Complete\nPicture'],
  ],
  'concept': [
    ['This Changes\nEverything', '{topic}\nCoded', '{topic}\nAdvanced'],
    ['90% Get\nThis Wrong', 'The SECRET\nInsight', 'Complete\nGuide'],
    ['Know THIS\nor Fail', '5 Patterns\nYou Need', 'Master\nClass'],
    ['Interview\nKiller', 'With Code\n+ Examples', 'The Final\nBoss'],
  ],
  'language': [
    ['Stop Writing\nBad Code', '10x Your\nSpeed', '{topic}\nAdvanced'],
    ['This 1 Trick\n= 10x', 'Senior Dev\nSecret', 'The Complete\nGuide'],
    ['Most Devs\nMiss This', 'Clean Code\nin 5 Min', 'Master\nClass'],
    ['Write Code\nLike THIS', '5 Patterns\nYou Need', '{topic}\nFinal Boss'],
  ],
};

function generateThumbnailText(topic: string, sessionNumber: number): string {
  const type = classifyTopic(topic);
  const templateSets = THUMBNAIL_TEMPLATES_BY_TYPE[type];
  const setIdx = seededIndex(topic, sessionNumber, 31, templateSets.length);
  const sessionIdx = Math.min(sessionNumber - 1, 2);
  const shortTopic = topic.split(' ')[0];
  return templateSets[setIdx][sessionIdx].replace('{topic}', shortTopic);
}

// ─── YouTube Tags ─────────────────────────────────────────────────────────────

const UNIVERSAL_TAGS = [
  'guru sishya', 'guru-sishya', 'guru sishya interview prep', 'guru-sishya.in',
  'coding interview', 'interview prep', 'software engineer', 'leetcode',
  'faang interview', 'tech interview', 'software engineering',
  'programming tutorial', 'learn to code', 'coding tips',
];

const LANGUAGE_TAGS: Record<string, string[]> = {
  python: ['python tutorial', 'python programming', 'python interview', 'learn python', 'python tips'],
  java: ['java tutorial', 'java programming', 'java interview', 'learn java', 'java tips'],
  typescript: ['typescript tutorial', 'typescript tips', 'typescript interview', 'ts programming'],
  javascript: ['javascript tutorial', 'javascript tips', 'javascript interview', 'learn javascript'],
};

const TYPE_TAGS: Record<TopicType, string[]> = {
  'data-structure': ['data structures', 'data structures and algorithms', 'dsa', 'algorithms'],
  'algorithm': ['algorithms', 'dsa', 'data structures and algorithms', 'algorithm tutorial'],
  'system-design': ['system design', 'system design interview', 'distributed systems', 'backend engineering'],
  'concept': ['computer science', 'programming concepts', 'backend development', 'software architecture'],
  'language': ['programming', 'clean code', 'coding best practices', 'developer tips'],
};

const SESSION_SPECIFIC_TAGS: Record<TopicType, string[][]> = {
  'system-design': [
    ['fundamentals', 'explained', 'tutorial', 'health checks', 'failover'],
    ['algorithms', 'implementation', 'python code', 'deep dive', 'with code'],
    ['advanced', 'layer 4', 'layer 7', 'complete guide', 'senior engineer'],
  ],
  'data-structure': [
    ['fundamentals', 'explained', 'basics', 'tutorial', 'introduction'],
    ['implementation', 'code walkthrough', 'with code', 'python', 'patterns'],
    ['advanced', 'optimization', 'complete guide', 'master class', 'trade-offs'],
  ],
  'algorithm': [
    ['fundamentals', 'explained', 'basics', 'tutorial', 'introduction'],
    ['implementation', 'patterns', 'with code', 'python', 'deep dive'],
    ['advanced', 'optimization', 'complete guide', 'master class', 'interview'],
  ],
  'concept': [
    ['fundamentals', 'explained', 'basics', 'tutorial', 'introduction'],
    ['implementation', 'with code', 'deep dive', 'patterns', 'examples'],
    ['advanced', 'complete guide', 'master class', 'trade-offs', 'architecture'],
  ],
  'language': [
    ['basics', 'tutorial', 'for beginners', 'introduction', 'fundamentals'],
    ['intermediate', 'patterns', 'tips', 'tricks', 'deep dive'],
    ['advanced', 'optimization', 'best practices', 'master class', 'senior'],
  ],
};

function generateTags(topic: string, language: string, sessionNumber: number): string[] {
  const type = classifyTopic(topic);
  const topicLower = topic.toLowerCase();
  const langLower = language.toLowerCase() as keyof typeof LANGUAGE_TAGS;
  const sessionIdx = Math.min(sessionNumber - 1, 2);

  // Priority-ordered: exact match → long-tail → universal → language → brand
  // 15-20 tags is optimal (SEO research: too many dilutes relevance)
  const priorityTags = [
    topicLower,                                      // exact match
    `${topicLower} explained`,                       // topic variation
    `${topicLower} interview questions`,             // long-tail
    `${topicLower} tutorial`,                        // tutorial keyword
    `coding interview ${topicLower}`,                // audience keyword
    `${topicLower} system design`,                   // related
    `FAANG interview ${topicLower}`,                 // FAANG
    'guru sishya',                                   // brand
    'coding interview prep',                         // universal
    'system design interview',                       // universal
    `${topicLower} ${langLower}`,                    // language: python
    `${topicLower} java`,                            // language: java
    `${topicLower} for beginners`,                   // level
    `${topicLower} advanced`,                        // level
    'DSA tutorial',                                  // universal
  ];

  // Add session-specific tags
  const sessionTags = (SESSION_SPECIFIC_TAGS[type]?.[sessionIdx] || []).map(
    t => `${topicLower} ${t}`
  );

  const all = [...priorityTags, ...sessionTags];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const tag of all) {
    const t = tag.trim().toLowerCase();
    if (!seen.has(t)) {
      seen.add(t);
      unique.push(tag);
    }
    if (unique.length >= 20) break;
  }
  return unique;
}

// ─── YouTube Hashtags ─────────────────────────────────────────────────────────

// Exactly 3 hashtags shown above title (SEO research: 3 is optimal, YouTube displays them above title)
const TOPIC_HASHTAG_BY_TYPE: Record<TopicType, string> = {
  'data-structure': '#DSA',
  'algorithm': '#Algorithms',
  'system-design': '#SystemDesign',
  'concept': '#Programming',
  'language': '#CodingTips',
};

function generateHashtags(topic: string, _sessionNumber: number): string[] {
  const type = classifyTopic(topic);
  const topicTag = TOPIC_HASHTAG_BY_TYPE[type];
  // Exactly 3 hashtags: topic-specific, universal, brand
  return [topicTag, '#CodingInterview', '#GuruSishya'];
}

// ─── YouTube Description ──────────────────────────────────────────────────────

const DESCRIPTION_HOOKS_BY_TYPE: Record<TopicType, string[][]> = {
  'data-structure': [
    [
      'Most developers use {topic} every day — but almost nobody understands WHY it works.\nIn this video, I break down {topic} step by step with code, and show you exactly how to answer it in interviews.',
      'You memorized the theory. But can you actually CODE it?\nIn this video, I implement {topic} operations from scratch in {language} — and show you the interview patterns that matter.',
      'This is the video that takes you from "I know {topic}" to "I can design systems with {topic}."\nAdvanced patterns, real-world trade-offs, and the answer template senior engineers use.',
    ],
    [
      'If you can\'t explain {topic} clearly in 30 seconds, this video is for you.\nCore concept + {language} code + interview answer template — everything in one video.',
      'Theory is useless without code. In this video, every {topic} pattern gets implemented in {language}.\nCopy the code, understand the pattern, ace the interview.',
      '{topic} at scale is a completely different game. This video covers what most tutorials skip:\nthe failure modes, the performance cliffs, and what Google engineers actually worry about.',
    ],
  ],
  'algorithm': [
    [
      'Most candidates fail {topic} problems because they\'re memorizing solutions instead of patterns.\nWatch this to understand the pattern — and you\'ll solve any {topic} variant on the fly.',
      'Stop grinding problems. Start understanding patterns.\nIn this video, I code every major {topic} pattern in {language} and explain WHEN to use each one.',
      'This is the {topic} knowledge that separates senior from junior engineers.\nAdvanced patterns, edge cases, and the exact answer that gets you the offer.',
    ],
    [
      'Stop grinding {topic} problems without understanding WHY they work.\nThis video teaches the core insight that makes {topic} click instantly — with {language} code.',
      'Five {topic} patterns. All coded. All explained.\nThis is the video I wish existed when I was preparing for my FAANG interview.',
      'The advanced {topic} concepts that most tutorials skip entirely.\nReal trade-offs, production patterns, and what interviewers at Google/Meta actually test.',
    ],
  ],
  'system-design': [
    [
      'One wrong decision about {topic} can bring down your entire system at scale.\nHere\'s how to think about {topic} the way senior engineers at Google and Netflix actually do.',
      'You memorized the names. But can you actually CODE them?\nIn this video, I implement all the major {topic} approaches from scratch in {language} — and reveal the interview secret that separates senior from junior answers.',
      'This is the question that separates mid-level from senior engineers in system design interviews.\nIf you can\'t explain the trade-offs, you\'re not getting the senior offer.',
    ],
    [
      'System design interviews always ask about {topic} — and most candidates answer the same generic way.\nWatch this to give an answer that actually impresses senior engineers.',
      '{topic} isn\'t just theory — it\'s code you can run.\nThis video implements every major approach in {language} with the decision framework interviewers want to hear.',
      'The {topic} deep dive that covers what 99% of tutorials skip.\nLayers, protocols, real-world architecture — and the exact answer template for FAANG interviews.',
    ],
  ],
  'concept': [
    [
      'If {topic} is still fuzzy for you, this video will make it click.\nClear visuals, real code, and the interview-ready answer — all in one video.',
      'Theory meets code. In this video, every {topic} concept gets implemented in {language}.\nNo hand-waving, no "left as an exercise" — actual working code.',
      'This is the {topic} video that ties everything together.\nAdvanced patterns, real-world applications, and the complete mental model.',
    ],
    [
      'Here\'s the honest explanation of {topic} that most tutorials skip.\nNo jargon, no filler — just the concept, the code, and what interviewers actually want to hear.',
      '{topic} patterns that separate the good from the great.\nFive approaches, all coded in {language}, with the decision framework that impresses interviewers.',
      'The advanced {topic} guide that nobody else made.\nTrade-offs, failure modes, and the answer that gets you hired at senior level.',
    ],
  ],
  'language': [
    [
      'Writing {language} code that\'s slow, messy, or hard to maintain? {topic} will fix that.\nThis video covers the patterns and techniques that senior {language} engineers use every day.',
      'Five {topic} patterns that will transform your {language} code.\nEach one implemented, explained, and ready to use in your next project.',
      'The advanced {topic} knowledge that separates 10x engineers from everyone else.\nReal-world patterns, performance insights, and production-grade code.',
    ],
    [
      'Most {language} developers pick up bad {topic} habits and never realize it.\nHere\'s what to do instead — with clean code examples you can use immediately.',
      '{topic} in {language} is more powerful than you think.\nThis video breaks down the advanced patterns that will level up your code quality right now.',
      'The complete {topic} guide for {language} — from fundamentals to advanced patterns.\nEverything you need in one video.',
    ],
  ],
};

function generateDescriptionHook(topic: string, language: string, sessionNumber: number): string {
  const type = classifyTopic(topic);
  const hookSets = DESCRIPTION_HOOKS_BY_TYPE[type];
  const setIdx = seededIndex(topic, sessionNumber, 43, hookSets.length);
  const sessionIdx = Math.min(sessionNumber - 1, 2);
  return hookSets[setIdx][sessionIdx]
    .replace(/{topic}/g, topic)
    .replace(/{language}/g, language);
}

function generateChapters(storyboard: Storyboard): { time: string; title: string }[] {
  const seen = new Set<string>();
  const chapters: { time: string; title: string }[] = [];

  for (const scene of storyboard.scenes) {
    const label = scene.heading || scene.type.charAt(0).toUpperCase() + scene.type.slice(1);
    // Skip duplicate headings, overly long headings, and generic types
    if (seen.has(label) || label.length > 60 || label === 'text') continue;
    seen.add(label);

    const seconds = Math.floor(scene.startFrame / storyboard.fps);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const time = `${mins}:${String(secs).padStart(2, '0')}`;
    chapters.push({ time, title: label });
  }

  return chapters;
}

function formatChaptersForDescription(chapters: { time: string; title: string }[]): string {
  return chapters.map(c => `${c.time} ${c.title}`).join('\n');
}

// ─── Session Navigation ──────────────────────────────────────────────────────

function generateSessionNav(sessionNumber: number, topic: string, totalSessions = 3): string {
  const lines: string[] = [];
  for (let i = 1; i <= totalSessions; i++) {
    const marker = i === sessionNumber ? '★' : i < sessionNumber ? '←' : '→';
    const suffix = i === sessionNumber ? ' (You are here)' : '';
    lines.push(`${marker} Session ${i}${suffix}`);
  }
  return lines.join('\n');
}

function generateEndScreen(topic: string, sessionNumber: number, totalSessions = 3): string {
  if (sessionNumber < totalSessions) {
    return `Session ${sessionNumber + 1} goes even deeper — don't miss it! Subscribe + Bell for the full ${topic} series.`;
  }
  return `You just completed the entire ${topic} series! Subscribe for the next system design topic — more interview-critical content dropping soon!`;
}

function generateCardLink(topic: string, sessionNumber: number, totalSessions = 3): string {
  if (sessionNumber < totalSessions) {
    return `Session ${sessionNumber + 1}: ${topic} Deep Dive → [link to S${sessionNumber + 1}]`;
  }
  return `Next Topic Coming Soon → [link]`;
}

function generateDescription(
  storyboard: Storyboard,
  language: string,
  chapters: { time: string; title: string }[],
): string {
  const { topic, sessionNumber } = storyboard;
  const type = classifyTopic(topic);
  const durationSecs = Math.round(storyboard.durationInFrames / storyboard.fps);
  const mins = Math.round(durationSecs / 60);

  const hook = generateDescriptionHook(topic, language, sessionNumber);
  const chaptersText = formatChaptersForDescription(chapters);
  const sessionNav = generateSessionNav(sessionNumber, topic);
  const hashtags = generateHashtags(topic, sessionNumber);

  const topicSlug = topic.toLowerCase().replace(/\s+/g, '-');

  // First 150 chars: unique per video, contains primary keyword, drives clicks from search
  const sessionLabel = sessionNumber === 1 ? 'fundamentals' : sessionNumber === 2 ? 'implementation with code' : 'advanced patterns';
  return `${topic} (${sessionLabel}) — master this for your FAANG interview. FREE practice with 1,988 questions at guru-sishya.in/${topicSlug}

${hook}

⏱️ Chapters:
${chaptersText}

──────────────────────────────────────
🔥 FREE Interview Prep: https://guru-sishya.in/${topicSlug}
📺 Full Playlist: https://www.youtube.com/@GuruSishya-India
📱 Instagram: https://instagram.com/guru_sishya.in
──────────────────────────────────────

📌 Series:
${sessionNav}

${hashtags.join(' ')}`;
}

// ─── Instagram ────────────────────────────────────────────────────────────────

const INSTAGRAM_HOOKS_BY_TYPE: Record<TopicType, string[][]> = {
  'data-structure': [
    [
      '90% of developers can\'t explain {topic} under pressure 👀',
      'I coded every {topic} operation from scratch. Here\'s what I learned 🧠',
      'The {topic} knowledge that gets you the SENIOR offer 🎯',
    ],
    [
      'The {topic} interview question that trips everyone up 🎯',
      '{topic} with real code — stop memorizing, start understanding 💡',
      'This is the {topic} video that ties everything together 🔥',
    ],
  ],
  'algorithm': [
    [
      'Stop memorizing {topic} patterns. Understand THIS instead 🔥',
      'I coded ALL {topic} patterns in Python. Here\'s what clicked 🧠',
      'The {topic} patterns that get you hired at FAANG 🎯',
    ],
    [
      '{topic} clicked for me the moment I understood THIS 🤯',
      '5 {topic} patterns, all coded, all explained ⚡',
      'Advanced {topic} — the stuff that separates senior from junior 💡',
    ],
  ],
  'system-design': [
    [
      'This {topic} mistake will crash your system at scale 🚨',
      'I coded ALL {topic} algorithms from scratch in Python 🧠',
      '{topic} — this is the question that separates senior from junior 🎯',
    ],
    [
      'How Netflix actually uses {topic} (most tutorials get this wrong) 👀',
      'The {topic} interview secret that gets you hired 🤫',
      'Layer 4 vs Layer 7 {topic} — pick wrong and you\'re cooked 🍳',
    ],
  ],
  'concept': [
    [
      '{topic} explained in a way nobody else does 🧠',
      'I built {topic} from scratch. The code is simpler than you think 💡',
      'The advanced {topic} guide that nobody made until now 🔥',
    ],
    [
      'This is how {topic} actually works under the hood 🔥',
      '{topic} patterns that separate the good from the great ⚡',
      '{topic} master class — the complete picture 🎯',
    ],
  ],
  'language': [
    [
      'Stop writing bad {language} code. Do THIS instead 🔥',
      '5 {language} patterns that will transform your code 💡',
      'Advanced {language} — the stuff senior engineers use daily 🧠',
    ],
    [
      'The {language} trick that 10x\'s your productivity 🚀',
      '{language} patterns you\'ve been using wrong this whole time 😬',
      'The complete {language} guide — from basics to advanced 🎯',
    ],
  ],
};

const INSTAGRAM_HASHTAG_SETS: string[] = [
  '#coding', '#developer', '#programmer', '#tech', '#softwareengineering',
  '#interviewprep', '#programminglife', '#devlife', '#computerscience',
  '#leetcode', '#dsa', '#webdevelopment', '#techinterview', '#softwareengineer',
  '#motivation', '#education', '#careergoals',
];

const INSTAGRAM_TYPE_HASHTAGS: Record<TopicType, string[]> = {
  'data-structure': ['#datastructures', '#algorithms'],
  'algorithm': ['#algorithms', '#problemsolving'],
  'system-design': ['#systemdesign', '#backend', '#distributedsystems'],
  'concept': ['#programming', '#computerscience'],
  'language': ['#cleancode', '#codequality'],
};

export function generateInstagramCaption(topic: string, language: string, sessionNumber = 1): string {
  const type = classifyTopic(topic);
  const hookSets = INSTAGRAM_HOOKS_BY_TYPE[type];
  const setIdx = seededIndex(topic, sessionNumber, 67, hookSets.length);
  const sessionIdx = Math.min(sessionNumber - 1, 2);
  const hook = hookSets[setIdx][sessionIdx]
    .replace(/{topic}/g, topic)
    .replace(/{language}/g, language);

  const topicHashtag = `#${topic.replace(/\s+/g, '').toLowerCase()}`;
  const langHashtag = `#${language.toLowerCase()}`;
  const typeHashtags = INSTAGRAM_TYPE_HASHTAGS[type];

  // 8-10 hashtags max — research shows 30 hurts reach in 2026
  const allHashtags = [topicHashtag, langHashtag, '#codinginterview', '#faang',
    ...typeHashtags, '#interviewprep', '#tech', '#developer', '#dsa', '#programming']
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 10);

  return `${hook}

💾 Save this for your interview prep
📤 Send to someone preparing for FAANG

🔗 Full course FREE at guru-sishya.in (link in bio)

${allHashtags.join(' ')}`;
}

function generateInstagramMetadata(topic: string, language: string, sessionNumber: number): InstagramMetadata {
  const caption = generateInstagramCaption(topic, language, sessionNumber);
  const type = classifyTopic(topic);
  const topicHashtag = `#${topic.replace(/\s+/g, '').toLowerCase()}`;
  const langHashtag = `#${language.toLowerCase()}`;
  const typeHashtags = INSTAGRAM_TYPE_HASHTAGS[type];

  // 8-10 hashtags max — research shows 30 hurts reach in 2026
  const hashtags = [topicHashtag, langHashtag, '#codinginterview', '#faang',
    ...typeHashtags, '#interviewprep', '#tech', '#developer', '#dsa', '#programming']
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 10);

  const shortTopic = topic.length > 15 ? topic.split(' ')[0] : topic;
  const coverTexts = [
    [`${shortTopic}\nExplained`, `${shortTopic}\nWith Code`, `${shortTopic}\nAdvanced`],
    [`${shortTopic}\nin ${Math.round(sessionNumber * 3)} Min`, `5 Algorithms\nCoded`, `The Senior\nAnswer`],
  ];
  const coverIdx = seededIndex(topic, sessionNumber, 101, coverTexts.length);
  const sessionIdx = Math.min(sessionNumber - 1, 2);

  return {
    caption,
    hashtags,
    coverText: coverTexts[coverIdx][sessionIdx],
  };
}

// ─── SEO Metadata ─────────────────────────────────────────────────────────────

function generateSeoMetadata(topic: string, language: string, sessionNumber: number, durationSecs: number): SeoMetadata {
  const type = classifyTopic(topic);
  const mins = Math.round(durationSecs / 60);
  const topicLower = topic.toLowerCase();

  const baseKeywords = [
    `${topicLower} explained`,
    `${topicLower} ${language.toLowerCase()}`,
    `${topicLower} interview`,
    `${topicLower} system design`,
    `${topicLower} tutorial`,
  ];

  const sessionKeywords: string[][] = [
    [`${topicLower} fundamentals`, `${topicLower} for beginners`, `what is ${topicLower}`, `${topicLower} basics`],
    [`${topicLower} algorithms`, `${topicLower} implementation`, `${topicLower} code`, `${topicLower} patterns`],
    [`${topicLower} advanced`, `${topicLower} deep dive`, `${topicLower} architecture`, `${topicLower} trade-offs`],
  ];

  const typeKeywords: Record<TopicType, string[]> = {
    'system-design': ['system design interview prep', 'FAANG system design', 'distributed systems'],
    'data-structure': ['data structures interview', 'DSA prep', 'coding interview prep'],
    'algorithm': ['algorithm interview', 'coding patterns', 'FAANG coding prep'],
    'concept': ['programming concepts', 'computer science fundamentals', 'software engineering'],
    'language': [`${language} best practices`, `${language} patterns`, `${language} interview`],
  };

  const sessionIdx = Math.min(sessionNumber - 1, 2);
  const keywords = [...baseKeywords, ...sessionKeywords[sessionIdx], ...typeKeywords[type]]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 15);

  const metaDescription = `Master ${topic} for system design interviews in ${mins} minutes. Session ${sessionNumber} covers ${
    sessionNumber === 1 ? 'fundamentals, algorithms, and core concepts' :
    sessionNumber === 2 ? 'implementation with code, algorithm comparison, and decision frameworks' :
    'advanced patterns, trade-offs, and the senior engineer answer template'
  } — essential FAANG interview prep.`;

  return { keywords, metaDescription };
}

// ─── Shorts Metadata ──────────────────────────────────────────────────────────

const SHORTS_TITLE_TEMPLATES: Record<TopicType, string[]> = {
  'system-design': [
    'Wait, THIS is how Netflix handles 200M users?! 🤯',
    '90% of Devs Get {topic} Wrong 😳',
    'The {topic} Secret That Gets You Hired 🤫',
    '{topic} in 60 Seconds — Save This ⚡',
    'Your server just DIED. Now what? 💀',
    'Junior vs Senior: {topic} Answer ⚔️',
  ],
  'data-structure': [
    'Stop Using {topic} Wrong! Here\'s Why 😤',
    '{topic} in 60 Seconds — Interview Ready ⚡',
    'Google Asked This {topic} Question 🎯',
    'The {topic} Trick Nobody Teaches 🤫',
    '90% of Devs Get {topic} Wrong 😳',
    '{topic} = O(1)? Here\'s the Secret 🔥',
  ],
  'algorithm': [
    'This {topic} Pattern = Instant Hire 🔥',
    'Stop Memorizing {topic}! Do This Instead 🧠',
    '{topic} in 60 Seconds — With Code ⚡',
    'FAANG Loves This {topic} Trick 🎯',
    'The {topic} Insight That Changes Everything 💡',
    '90% Fail This {topic} Question 😬',
  ],
  'concept': [
    '{topic} Explained in 60 Seconds 🧠',
    'Most Devs Get {topic} Wrong 😳',
    'The {topic} Concept That Trips Everyone 🎯',
    '{topic} — What No Tutorial Teaches 🤫',
    'Know {topic} or Fail Your Interview 💀',
    '{topic} Made Simple — Save This ⚡',
  ],
  'language': [
    'Stop Writing Bad {language} Code! 🔥',
    '{language} Trick That 10x\'s Your Speed 🚀',
    'Senior {language} Devs Do THIS 💡',
    '{language} in 60 Seconds — Level Up ⚡',
    'Most {language} Devs Miss This 😬',
    'Clean {language} Code — The Secret 🤫',
  ],
};

// ─── Viral Short Title Templates ───────────────────────────────────────────
// Proven viral templates that rotate based on session + clip index.
// {topic} and {language} are interpolated at generation time.

const VIRAL_SHORT_TITLES = [
  'This {topic} trick saved my interview 🤯',
  '{topic} in 60 seconds ⚡',
  'Stop writing code like this ❌',
  'Google asked this in their interview 👀',
  'Most developers don\'t know this {topic} trick',
  '{topic}: What they don\'t teach you',
  'I wish I knew this before my interview 😤',
  '5 {topic} mistakes you\'re making right now',
  'This is why your code is slow 💀',
  'How Netflix handles 200M users with {topic}',
  '{topic} explained like you\'re 5 🧒',
  'The {topic} question that fails 90% of candidates',
  'Senior devs do THIS differently 👨‍💻',
  '{topic} -- the RIGHT way ✅',
  'Why Amazon rejected me (and how I fixed it)',
  '3 lines of code that changed everything',
  '{topic} is NOT what you think',
  'The only {topic} video you\'ll ever need',
  'POV: You finally understand {topic} 🧠',
  'If you don\'t know {topic}, you\'re cooked 🔥',
];

// ─── Type-Specific Hashtag for Shorts ──────────────────────────────────────
// Dynamic lookup replaces the old hardcoded #SystemDesign on all shorts.

const TYPE_HASHTAG: Record<string, string> = {
  'system-design': '#SystemDesign',
  'data-structure': '#DSA',
  'algorithm': '#Algorithms',
  'database': '#Database',
  'network': '#Networking',
  'language': '#CodingTips',
  'concept': '#CS',
  'default': '#Coding',
};

function generateShortsTitle(topic: string, language: string, sessionNumber: number, shortIndex: number): string {
  const type = classifyTopic(topic);
  const typeHashtag = TYPE_HASHTAG[type] || TYPE_HASHTAG['default'];

  // Alternate between type-specific templates and viral templates so each
  // short from the same video gets a different title.
  const useViral = shortIndex % 2 === 1;
  let title: string;

  if (useViral) {
    // Rotate through viral templates based on session + clip index
    const viralIdx = seededIndex(topic, sessionNumber * 10 + shortIndex, 71, VIRAL_SHORT_TITLES.length);
    title = VIRAL_SHORT_TITLES[viralIdx]
      .replace(/{topic}/g, topic)
      .replace(/{language}/g, language);
  } else {
    const templates = SHORTS_TITLE_TEMPLATES[type];
    const idx = seededIndex(topic, sessionNumber * 10 + shortIndex, 53, templates.length);
    title = templates[idx]
      .replace(/{topic}/g, topic)
      .replace(/{language}/g, language);
  }

  // YouTube Shorts: 3-5 hashtags (not 1-2)
  return `${title} #Shorts #Coding ${typeHashtag} #InterviewPrep #FAANG`;
}

// ─── Playlist Name ────────────────────────────────────────────────────────────

function generatePlaylist(topic: string): string {
  const type = classifyTopic(topic);
  const category = type === 'system-design' ? 'System Design' :
    type === 'data-structure' ? 'Data Structures' :
    type === 'algorithm' ? 'Algorithms' :
    type === 'language' ? 'Programming' : 'Computer Science';
  return `${category} - ${topic} (Complete Series)`;
}

// ─── Pinned Comment & Community Post ──────────────────────────────────────────

// ─── Expert 4 (Rajan Mehta): SEO-Optimized Pinned Comments ──────────────────
// Pinned comments are indexed by YouTube search, boost comment count (engagement
// signal), and drive traffic. Each template ends with a question to encourage
// replies — more replies = higher engagement = more algorithmic promotion.

const PINNED_COMMENT_TEMPLATES: Record<TopicType, string[]> = {
  'system-design': [
    `Want to practice {topic} with real interview questions? I built a FREE platform with 5,800+ questions at guru-sishya.in/{slug}\n\nWhich company's {topic} architecture should I break down next? Drop it below!`,
    `This took 40+ hours to research. If it helped you, a like genuinely helps the channel grow.\n\nFREE practice: guru-sishya.in/{slug}\n\nDrop your interview experience with {topic} — I read every comment!`,
    `Timestamps in the description if you want to jump to specific sections.\n\nFREE prep: guru-sishya.in/{slug}\n\nWhat's the trickiest {topic} question you've been asked? Let me know and I'll solve it in a future video!`,
  ],
  'data-structure': [
    `Solved 100+ {topic} problems and found 5 core patterns. All covered here.\n\nFREE practice: guru-sishya.in/{slug}\n\nWhat's the hardest {topic} problem you've seen? Drop it below!`,
    `This is the {topic} video I wish existed when I was preparing for interviews.\n\nFREE prep: guru-sishya.in/{slug}\n\nWhich {topic} operation confuses you the most? I'll make a dedicated video!`,
  ],
  'algorithm': [
    `Stop memorizing — understand the PATTERN. That's what this video teaches.\n\nFREE practice: guru-sishya.in/{slug}\n\nWhich {topic} variant should I cover next?`,
    `Every {topic} pattern you need, coded and explained.\n\nFREE prep: guru-sishya.in/{slug}\n\nDrop your favorite {topic} trick in the comments!`,
  ],
  'concept': [
    `If this helped {topic} click for you, drop a comment — it helps the algorithm show this to more students.\n\nFREE practice: guru-sishya.in/{slug}\n\nWhat concept should I explain next?`,
  ],
  'language': [
    `These {topic} patterns will genuinely make you a better developer.\n\nFREE practice: guru-sishya.in/{slug}\n\nWhat {topic} feature trips you up the most? Let me know!`,
  ],
};

export function generatePinnedComment(topic: string, topicSlug: string, sessionNumber = 1): string {
  const type = classifyTopic(topic);
  const templates = PINNED_COMMENT_TEMPLATES[type];
  const idx = seededIndex(topic, sessionNumber, 139, templates.length);
  return templates[idx]
    .replace(/{topic}/g, topic)
    .replace(/{slug}/g, topicSlug);
}

// ─── Expert 4 (Rajan Mehta): Community Post Templates ────────────────────────
// Community posts with polls get 2-3x more interaction than plain text.
// Post a teaser 2 hours BEFORE upload for the "velocity hack" — primes
// subscribers to click immediately when the video goes live.

export function generateCommunityPost(topic: string, title: string, objectives: string[], topicSlug: string): string {
  const options = objectives.slice(0, 3);
  const option1 = options[0] || `${topic} Advanced Patterns`;
  const option2 = options[1] || `${topic} Interview Questions`;
  const option3 = options[2] || `System Design with ${topic}`;
  return `NEW VIDEO dropping at 7:15 PM tonight!\n\n${topic} \u2014 the question that separates 12 LPA from 45 LPA answers.\n\nSet a reminder. This one's important.\n\nPoll: What's your biggest struggle with ${topic}?\n\u25a1 Understanding the concept\n\u25a1 Implementing in code\n\u25a1 Explaining in interviews\n\u25a1 Knowing when to use it\n\nFull prep at guru-sishya.in/${topicSlug}`;
}

export function generatePostReleaseCommunityPost(topic: string, title: string, sessionNumber: number, topicSlug: string): string {
  return `Just dropped: ${title}\n\nThis is Session ${sessionNumber} of the complete ${topic} series.\n\nWatch now and tell me what clicked for you.\n\nFREE practice: guru-sishya.in/${topicSlug}`;
}

// ─── DALL-E Thumbnail Prompts (category-aware) ──────────────────────────────

const THUMBNAIL_DALLE_PROMPTS: Record<string, string> = {
  'system-design': 'Dark background #0C0A15, glowing server architecture diagram, neon teal (#1DD1A1) connection lines, futuristic minimal style, no text, 1280x720',
  'data-structure': 'Dark navy background, glowing data structure visualization, saffron (#E85D26) nodes with gold edges, minimal clean style, no text, 1280x720',
  'algorithm': 'Dark background #0C0A15, glowing flowchart with algorithm steps, neon teal (#1DD1A1) arrows, futuristic minimal, no text, 1280x720',
  'concept': 'Dark background #0C0A15, abstract code visualization with neon accents, futuristic tech aesthetic, no text, 1280x720',
  'language': 'Dark background #0C0A15, clean code editor with syntax highlighting, neon teal (#1DD1A1) cursor glow, minimal style, no text, 1280x720',
};

function generateThumbnailPrompt(topic: string): string {
  const type = classifyTopic(topic);
  return THUMBNAIL_DALLE_PROMPTS[type] || THUMBNAIL_DALLE_PROMPTS['concept'];
}

// ─── Primary Exports ──────────────────────────────────────────────────────────

export function generateYouTubeMetadata(storyboard: Storyboard, language: string): YouTubeMetadata {
  const { topic, sessionNumber } = storyboard;
  const durationSecs = Math.round(storyboard.durationInFrames / storyboard.fps);
  const topicSlug = topic.toLowerCase().replace(/\s+/g, '-');

  const title = generateTitle(topic, sessionNumber, durationSecs);
  const chapters = generateChapters(storyboard);
  const description = generateDescription(storyboard, language, chapters);
  const tags = generateTags(topic, language, sessionNumber);
  const hashtags = generateHashtags(topic, sessionNumber);

  return {
    title,
    description,
    tags,
    hashtags,
    chapters,
    category: 27,
    language: 'en',
    playlist: generatePlaylist(topic),
    thumbnailText: generateThumbnailText(topic, sessionNumber),
    thumbnailPrompt: generateThumbnailPrompt(topic),
    endScreen: generateEndScreen(topic, sessionNumber),
    cardLink: generateCardLink(topic, sessionNumber),
    pinnedComment: generatePinnedComment(topic, topicSlug),
    communityPost: generateCommunityPost(topic, title, [], topicSlug),
  };
}

/**
 * Generate all viral-optimized metadata in one call.
 * All selections are deterministic — same topic + sessionNumber always
 * produces the same title, thumbnail text, and captions.
 */
export function generateMetadata(storyboard: Storyboard, language: string): VideoMetadata {
  const { topic, sessionNumber } = storyboard;
  const durationSecs = Math.round(storyboard.durationInFrames / storyboard.fps);

  return {
    youtube: generateYouTubeMetadata(storyboard, language),
    instagram: generateInstagramMetadata(topic, language, sessionNumber),
    seo: generateSeoMetadata(topic, language, sessionNumber, durationSecs),
  };
}

/**
 * Generate metadata for shorts derived from a long-form session.
 * Creates 3 shorts per session with viral-optimized titles and captions.
 */
export function generateShortsMetadataFromStoryboard(
  storyboard: Storyboard,
  language: string,
  shortSegments?: string[],
): ShortsMetadata {
  const { topic, sessionNumber } = storyboard;
  const type = classifyTopic(topic);

  // Default segments based on session content
  const segments = shortSegments || [
    'Key Concept',
    'The Interview Secret',
    'Code Implementation',
  ];

  const topicSlug = topic.toLowerCase().replace(/\s+/g, '-');

  const shorts: ShortMetadata[] = segments.map((segment, i) => {
    const title = generateShortsTitle(topic, language, sessionNumber, i);
    const topicHashtag = `#${topic.replace(/\s+/g, '')}`;
    const langHashtag = `#${language}`;

    return {
      id: `s${sessionNumber}-short-${i + 1}`,
      segment,
      youtube: {
        title,
        description: `${segment} — ${topic} explained in 60 seconds.\n\nFREE prep: https://guru-sishya.in/${topicSlug}\nFull video on our channel!\n\n#Shorts #Coding ${TYPE_HASHTAG[type] || TYPE_HASHTAG['default']} #InterviewPrep #FAANG ${topicHashtag}`,
        tags: generateTags(topic, language, sessionNumber).slice(0, 15),
      },
      instagram: {
        caption: generateInstagramCaption(topic, language, sessionNumber),
        hashtags: generateInstagramMetadata(topic, language, sessionNumber).hashtags,
        coverText: generateThumbnailText(topic, sessionNumber),
      },
    };
  });

  return { shorts };
}
