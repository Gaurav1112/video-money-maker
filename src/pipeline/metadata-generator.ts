import { Storyboard } from '../types';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface YouTubeMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  chapters: string;
}

export interface VideoMetadata {
  youtube: YouTubeMetadata;
  instagramCaption: string;
  thumbnailText: string;
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
// Each template is under 60 chars when formatted with a typical topic.
// Curiosity-driven patterns proven to lift CTR on YouTube.

const TITLE_TEMPLATES_BY_TYPE: Record<TopicType, string[]> = {
  'data-structure': [
    'Stop Using {topic} Wrong',
    'Why Most Devs Get {topic} Wrong',
    '{topic} in 5 Minutes (Interview Ready)',
    '{topic} vs Arrays: Which to Use?',
    'The {topic} Trick Nobody Teaches You',
    'Master {topic} Before Your Interview',
    '{topic} Explained in 4 Minutes',
    'Google Asked This {topic} Question',
  ],
  'algorithm': [
    'Why {topic} Breaks Most Code',
    '{topic} in 5 Minutes (With Code)',
    'Stop Memorizing {topic} — Do This',
    'The {topic} Pattern You Must Know',
    'Crack Any {topic} Interview Question',
    '{topic} Explained Simply (With Code)',
    'Why You Keep Failing {topic} Problems',
    '{topic}: The O(1) Secret',
  ],
  'system-design': [
    'Why {topic} Crashes at Scale',
    'How Netflix Uses {topic} (Explained)',
    '{topic} in 5 Minutes — Interview Prep',
    'Stop Building {topic} Wrong',
    '{topic} Design: What Google Does',
    'Senior vs Junior: {topic} Explained',
    '{topic}: The Trade-offs Nobody Tells You',
    'Design {topic} Like a Senior Engineer',
  ],
  'concept': [
    'Why {topic} Trips Up Senior Devs',
    '{topic} in 5 Minutes — Simplified',
    'Stop Confusing {topic} With This',
    'The {topic} Concept You Must Master',
    'Master {topic} for Your Interview',
    '{topic}: What No Tutorial Teaches',
    'Most Devs Get {topic} Wrong. Do You?',
    '{topic} Explained Like You\'re 5',
  ],
  'language': [
    '{topic} Tricks Most Devs Don\'t Know',
    'Stop Writing Bad {topic} Code',
    '{topic} Tips That 10x Your Speed',
    'Advanced {topic} in 5 Minutes',
    '{topic} Patterns You Must Know',
    'Why Your {topic} Code Is Slow',
    'Clean {topic} Code — Step by Step',
    '{topic}: The Secrets Senior Devs Use',
  ],
};

function truncateTitle(title: string, max = 60): string {
  return title.length > max ? title.slice(0, max - 1).trimEnd() + '…' : title;
}

function generateTitle(topic: string, sessionNumber: number): string {
  const type = classifyTopic(topic);
  const templates = TITLE_TEMPLATES_BY_TYPE[type];
  const idx = seededIndex(topic, sessionNumber, 17, templates.length);
  const raw = templates[idx].replace('{topic}', topic);
  return truncateTitle(raw);
}

// ─── Thumbnail Text Templates ─────────────────────────────────────────────────
// 3-5 words max. High curiosity / shock value. Shown over video thumbnail.

const THUMBNAIL_TEMPLATES_BY_TYPE: Record<TopicType, string[]> = {
  'data-structure': [
    'DON\'T Use {topic}!',
    '{topic} = O(1) Trick',
    'Google Asked This',
    'Stop Using {topic} Wrong',
    '{topic} Secret Revealed',
    '90% Get This Wrong',
    'Know THIS or Fail',
    '{topic} in 60s',
  ],
  'algorithm': [
    'This Pattern = Hired',
    'Stop Brute Forcing!',
    '90% Fail This',
    '{topic} = Easy Wins',
    'O(n) → O(log n)',
    'FAANG Loves This',
    'The Hidden Pattern',
    'Know This, Get Hired',
  ],
  'system-design': [
    'This Crashes at Scale',
    'Netflix Does THIS',
    'Senior vs Junior Design',
    'Trade-offs Nobody Knows',
    'The $14M Mistake',
    'Scale to 1B Users',
    '{topic} = Career Changer',
    'Juniors Miss This',
  ],
  'concept': [
    'This Changes Everything',
    '90% Get This Wrong',
    'You\'re Doing It Wrong',
    'Know THIS or Fail',
    'The Missing Concept',
    'Interview Killer',
    '{topic} = Job Offer',
    'Watch Before Interview',
  ],
  'language': [
    'Stop Writing Bad Code',
    'This 1 Trick = 10x',
    'Senior Dev Secret',
    'Clean Code in 5 Min',
    'Most Devs Miss This',
    'Write Code Like THIS',
    'Instant Code Review',
    '10x Your Code Speed',
  ],
};

function generateThumbnailText(topic: string, sessionNumber: number): string {
  const type = classifyTopic(topic);
  const templates = THUMBNAIL_TEMPLATES_BY_TYPE[type];
  const idx = seededIndex(topic, sessionNumber, 31, templates.length);
  // Replace {topic} but keep it short — only use first word of multi-word topics
  const shortTopic = topic.split(' ')[0];
  return templates[idx].replace('{topic}', shortTopic);
}

// ─── YouTube Tags ─────────────────────────────────────────────────────────────

const UNIVERSAL_TAGS = [
  'coding interview',
  'interview prep',
  'software engineer',
  'leetcode',
  'faang interview',
  'tech interview',
  'software engineering',
  'programming tutorial',
  'learn to code',
  'coding tips',
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

function generateTags(topic: string, language: string): string[] {
  const type = classifyTopic(topic);
  const topicLower = language.toLowerCase() as keyof typeof LANGUAGE_TAGS;

  const topicSpecific = [
    topic.toLowerCase(),
    `${topic.toLowerCase()} interview`,
    `${topic.toLowerCase()} ${language.toLowerCase()}`,
    `${topic.toLowerCase()} tutorial`,
    `${topic.toLowerCase()} explained`,
    `how ${topic.toLowerCase()} works`,
  ];

  const langTags = LANGUAGE_TAGS[topicLower] || LANGUAGE_TAGS['python'];
  const typeTags = TYPE_TAGS[type];

  // Deduplicate and limit to YouTube's 500-char total / 30 tag max recommendation
  const all = [...topicSpecific, ...langTags, ...typeTags, ...UNIVERSAL_TAGS];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const tag of all) {
    const t = tag.trim().toLowerCase();
    if (!seen.has(t)) {
      seen.add(t);
      unique.push(tag);
    }
    if (unique.length >= 25) break;
  }
  return unique;
}

// ─── YouTube Description ──────────────────────────────────────────────────────
// Critical: first 2 lines appear before "Show more" — must hook immediately.

const DESCRIPTION_HOOKS_BY_TYPE: Record<TopicType, string[]> = {
  'data-structure': [
    'Most developers use {topic} every day — but almost nobody understands WHY it works.\nIn this video, I break down {topic} step by step with code, and show you exactly how to answer it in interviews.',
    'If you can\'t explain {topic} clearly in 30 seconds, this video is for you.\nI\'ll teach you the core concept, walk through the code, and give you the exact interview answer template.',
    '{topic} is one of the most common interview topics — and one of the most misunderstood.\nHere\'s everything you need to know, with {language} code examples and real interview strategies.',
  ],
  'algorithm': [
    'Most candidates fail {topic} problems because they\'re memorizing solutions instead of patterns.\nWatch this to understand the pattern — and you\'ll solve any {topic} variant on the fly.',
    'Stop grinding {topic} problems without understanding WHY they work.\nThis video teaches the core insight that makes {topic} click instantly — with {language} code.',
    '{topic} trips up even experienced developers in interviews.\nHere\'s the honest breakdown: why it\'s tricky, what the pattern is, and how to explain it confidently.',
  ],
  'system-design': [
    'One wrong decision about {topic} can bring down your entire system at scale.\nHere\'s how to think about {topic} the way senior engineers at Google and Netflix actually do.',
    'System design interviews always ask about {topic} — and most candidates answer the same generic way.\nWatch this to give an answer that actually impresses senior engineers.',
    '{topic} is not as simple as most tutorials make it sound.\nThis video covers the real trade-offs, the failure modes, and the answer that gets you hired.',
  ],
  'concept': [
    'If {topic} is still fuzzy for you, this 5-minute explanation will make it click.\nClear visuals, real code, and the interview-ready answer — all in one video.',
    'Here\'s the honest explanation of {topic} that most tutorials skip.\nNo jargon, no filler — just the concept, the code, and what interviewers actually want to hear.',
    '{topic} comes up constantly in tech interviews — but most courses explain it wrong.\nThis video gives you the first-principles understanding that sticks.',
  ],
  'language': [
    'Writing {language} code that\'s slow, messy, or hard to maintain? {topic} will fix that.\nThis video covers the patterns and techniques that senior {language} engineers use every day.',
    'Most {language} developers pick up bad {topic} habits and never realize it.\nHere\'s what to do instead — with clean code examples you can use immediately.',
    '{topic} in {language} is more powerful than you think.\nThis video breaks down the advanced patterns that will level up your code quality right now.',
  ],
};

function generateDescriptionHook(topic: string, language: string, sessionNumber: number): string {
  const type = classifyTopic(topic);
  const hooks = DESCRIPTION_HOOKS_BY_TYPE[type];
  const idx = seededIndex(topic, sessionNumber, 43, hooks.length);
  return hooks[idx]
    .replace(/{topic}/g, topic)
    .replace(/{language}/g, language);
}

function generateChapters(storyboard: Storyboard): string {
  return storyboard.scenes.map((scene) => {
    const seconds = Math.floor(scene.startFrame / storyboard.fps);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timestamp = `${mins}:${String(secs).padStart(2, '0')}`;
    const label = scene.heading || scene.type.charAt(0).toUpperCase() + scene.type.slice(1);
    return `${timestamp} ${label}`;
  }).join('\n');
}

const HASHTAG_SETS_BY_TYPE: Record<TopicType, string[]> = {
  'data-structure': ['#DataStructures', '#DSA', '#CodingInterview', '#LeetCode', '#Programming'],
  'algorithm': ['#Algorithms', '#DSA', '#CodingInterview', '#LeetCode', '#TechInterview'],
  'system-design': ['#SystemDesign', '#Backend', '#SoftwareEngineering', '#TechInterview', '#CodingInterview'],
  'concept': ['#Programming', '#SoftwareEngineering', '#CodingInterview', '#LearnToCode', '#TechInterview'],
  'language': ['#Python', '#Java', '#Programming', '#CleanCode', '#SoftwareEngineering'],
};

function generateDescription(
  storyboard: Storyboard,
  language: string,
  chapters: string,
): string {
  const { topic, sessionNumber } = storyboard;
  const type = classifyTopic(topic);

  const hook = generateDescriptionHook(topic, language, sessionNumber);
  const langHashtag = `#${language.charAt(0).toUpperCase()}${language.slice(1)}`;
  const topicHashtag = `#${topic.replace(/\s+/g, '')}`;
  const typeHashtags = HASHTAG_SETS_BY_TYPE[type];
  const allHashtags = [langHashtag, topicHashtag, ...typeHashtags]
    .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
    .join(' ');

  return `${hook}

⏱️ Chapters:
${chapters}

──────────────────────────────
Practice these concepts interactively at guru-sishya.in
Full playlist: https://www.youtube.com/@guru-sishya
──────────────────────────────

${allHashtags} #InterviewPrep #Coding #Developer`;
}

// ─── Instagram Caption ────────────────────────────────────────────────────────
// Pattern: Hook → Value → Share bait → CTA
// First line is the hook (shown in feed before "more").

const INSTAGRAM_HOOKS_BY_TYPE: Record<TopicType, string[]> = {
  'data-structure': [
    '90% of developers can\'t explain {topic} under pressure 👀',
    'The {topic} interview question that trips everyone up 🎯',
    'Why your {topic} code is slower than it should be 🐢',
    'If you don\'t understand {topic}, watch this before your next interview 👇',
    '{topic} explained in a way that actually makes sense 🧠',
  ],
  'algorithm': [
    'Stop memorizing {topic} patterns. Understand THIS instead 🔥',
    'The one {topic} insight that makes all problems easy 💡',
    'Why most devs fail {topic} problems in interviews 😬',
    '{topic} clicked for me the moment I understood THIS 🤯',
    'Solve any {topic} problem with this single pattern 🎯',
  ],
  'system-design': [
    'This {topic} mistake will crash your system at scale 🚨',
    'How Netflix actually uses {topic} (most tutorials get this wrong) 👀',
    'System design interview tip: here\'s what they\'re really testing with {topic} 🎯',
    'The {topic} trade-off nobody talks about 🔥',
    'Junior vs Senior: how they approach {topic} differently 💡',
  ],
  'concept': [
    '{topic} explained in a way nobody else does 🧠',
    'The {topic} concept that separates juniors from seniors 🎯',
    'Why {topic} trips up even experienced developers 👀',
    'This is how {topic} actually works under the hood 🔥',
    'You\'ve been thinking about {topic} wrong this whole time 🤯',
  ],
  'language': [
    'Stop writing bad {language} code. Do THIS instead 🔥',
    'The {language} trick that 10x\'s your productivity 🚀',
    'Senior {language} devs do this. Junior devs don\'t 💡',
    'Most {language} developers skip this step. Big mistake 😬',
    'Clean {language} code in 5 minutes — here\'s how 🧠',
  ],
};

function generateInstagramHook(topic: string, language: string, sessionNumber: number): string {
  const type = classifyTopic(topic);
  const hooks = INSTAGRAM_HOOKS_BY_TYPE[type];
  const idx = seededIndex(topic, sessionNumber, 67, hooks.length);
  return hooks[idx]
    .replace(/{topic}/g, topic)
    .replace(/{language}/g, language);
}

const INSTAGRAM_VALUE_LINES: string[] = [
  'In this video I break it down step by step with real {language} code.',
  'Full breakdown with {language} code examples — watch the whole thing.',
  'Watch the full video for the code walkthrough and interview tips.',
  'I cover the core concept, the code, and exactly what to say in interviews.',
  'Real {language} examples + the interview answer template included.',
];

const INSTAGRAM_HASHTAG_SETS_BY_TYPE: Record<TopicType, string[]> = {
  'data-structure': ['#codinginterview', '#datastructures', '#dsa', '#leetcode', '#programminglife'],
  'algorithm': ['#codinginterview', '#algorithms', '#dsa', '#leetcode', '#softwareengineer'],
  'system-design': ['#systemdesign', '#backend', '#softwareengineer', '#codinginterview', '#techinterview'],
  'concept': ['#coding', '#programminglife', '#softwareengineer', '#codinginterview', '#developer'],
  'language': ['#coding', '#cleancode', '#developer', '#programminglife', '#softwareengineer'],
};

export function generateInstagramCaption(topic: string, language: string, sessionNumber = 1): string {
  const type = classifyTopic(topic);
  const hook = generateInstagramHook(topic, language, sessionNumber);

  const valueIdx = seededIndex(topic, sessionNumber, 89, INSTAGRAM_VALUE_LINES.length);
  const valueLine = INSTAGRAM_VALUE_LINES[valueIdx].replace(/{language}/g, language);

  const typeHashtags = INSTAGRAM_HASHTAG_SETS_BY_TYPE[type];
  const langHashtag = `#${language.toLowerCase()}`;
  const topicHashtag = `#${topic.replace(/\s+/g, '').toLowerCase()}`;
  const hashtags = [langHashtag, topicHashtag, ...typeHashtags]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 8)
    .join(' ');

  return `${hook}

${valueLine}

📤 Send this to a friend who's preparing for interviews

Link in bio for the full course 👆

${hashtags} #interviewprep #coding`;
}

// ─── Primary Exports ──────────────────────────────────────────────────────────

export function generateYouTubeMetadata(storyboard: Storyboard, language: string): YouTubeMetadata {
  const { topic, sessionNumber } = storyboard;

  const title = generateTitle(topic, sessionNumber);
  const chapters = generateChapters(storyboard);
  const description = generateDescription(storyboard, language, chapters);
  const tags = generateTags(topic, language);

  return {
    title,
    description,
    tags,
    categoryId: '27', // Education
    chapters,
  };
}

/**
 * Generate all viral-optimized metadata in one call.
 * All selections are deterministic — same topic + sessionNumber always
 * produces the same title, thumbnail text, and captions.
 */
export function generateMetadata(storyboard: Storyboard, language: string): VideoMetadata {
  const { topic, sessionNumber } = storyboard;

  return {
    youtube: generateYouTubeMetadata(storyboard, language),
    instagramCaption: generateInstagramCaption(topic, language, sessionNumber),
    thumbnailText: generateThumbnailText(topic, sessionNumber),
  };
}
