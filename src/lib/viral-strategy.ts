/**
 * viral-strategy.ts
 *
 * Algorithm-optimized title generation and distribution strategy
 * for a new channel with zero subscribers.
 *
 * Pivot: generic "system design explained" (saturated) →
 *   controversy, trend-jacking, challenge, and story formats.
 */

import { getTopicCategory } from './topic-categories';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UploadSlot {
  platform: string;
  time: string;
  type: string;
}

export interface CommunityTarget {
  platform: string;
  community: string;
  postStyle: string;
}

type TitleFormula = (topic: string, narration: string) => string;

// ─── Internal Helpers ────────────────────────────────────────────────────────

function humanize(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Extract a dollar amount or company name from narration if present */
function extractIncident(narration: string): { company: string; amount: string } | null {
  const companyMatch = narration.match(
    /\b(Google|Amazon|Meta|Netflix|Uber|Cloudflare|GitHub|Stripe|Twitter|Facebook|Microsoft|Apple|Slack|LinkedIn)\b/i
  );
  const amountMatch = narration.match(/\$[\d,.]+\s*(million|billion|M|B|k)?/i);
  if (companyMatch) {
    return {
      company: companyMatch[1],
      amount: amountMatch ? amountMatch[0] : '$100M',
    };
  }
  return null;
}

/** Pick a "popular alternative" for contrarian titles */
function getPopularAlternative(topicSlug: string): string {
  const alternatives: Record<string, string> = {
    kafka: 'RabbitMQ',
    'message-queue': 'RabbitMQ',
    redis: 'Memcached',
    graphql: 'REST',
    'rest-api': 'GraphQL',
    grpc: 'REST',
    kubernetes: 'Docker Compose',
    microservices: 'Monoliths',
    nosql: 'SQL',
    sql: 'NoSQL',
    'dynamic-programming': 'Brute Force',
    cdn: 'Origin Servers',
    'load-balancing': 'Single Server',
    sharding: 'Single Database',
    mongodb: 'PostgreSQL',
    postgresql: 'MongoDB',
  };
  const lower = topicSlug.toLowerCase();
  return alternatives[lower] || 'the old way';
}

// ─── Title Formulas ──────────────────────────────────────────────────────────

const TITLE_FORMULAS: Record<string, TitleFormula[]> = {
  controversy: [
    (topic) => `I switched to ${humanize(topic)} and it BROKE everything`,
    (topic) => `${humanize(topic)} is DYING. Here's the proof.`,
    (topic) => `${getPopularAlternative(topic)} fans won't like this about ${humanize(topic)}`,
    (topic) => `I asked ChatGPT about ${humanize(topic)}. The answer was WRONG.`,
    (topic) => `Stop using ${getPopularAlternative(topic)}. ${humanize(topic)} is better. Here's why.`,
  ],
  trendjack: [
    (topic) => `The NEW ${humanize(topic)} that changes everything in 2026`,
    (topic) => `${humanize(topic)} in 2026 is NOT what you think`,
    (topic) => `Everyone is switching to ${humanize(topic)}. Here's why.`,
    (topic) => `Google just made ${humanize(topic)} obsolete (or did they?)`,
    (topic) => `The ${humanize(topic)} update that nobody is talking about`,
  ],
  challenge: [
    (topic) => `Can you solve this ${humanize(topic)} problem in 10 seconds?`,
    (topic) => `Only 1% of devs get this ${humanize(topic)} question right`,
    (topic) => `Senior devs FAIL this ${humanize(topic)} quiz`,
    (topic) => `99% of devs don't know this ${humanize(topic)} trick`,
    (topic) => `I bet you can't explain ${humanize(topic)} in 30 seconds`,
  ],
  story: [
    (topic, narration) => {
      const incident = extractIncident(narration);
      if (incident) return `How ${incident.company} lost ${incident.amount} because of ${humanize(topic)}`;
      return `The ${humanize(topic)} mistake that cost a startup $2M`;
    },
    (topic) => `A single ${humanize(topic)} bug took down the entire system`,
    (topic, narration) => {
      const incident = extractIncident(narration);
      if (incident) return `${incident.company} is HIDING this about ${humanize(topic)}`;
      return `Big Tech is HIDING this about ${humanize(topic)}`;
    },
    (topic) => `This ${humanize(topic)} trick saved me 200 hours`,
    (topic) => `The ${humanize(topic)} secret that got me hired at FAANG`,
  ],
};

// ─── Format Selection Based on Content ───────────────────────────────────────

function selectFormatsForContent(
  topicSlug: string,
  formatName: string,
  narration: string
): string[] {
  // If explicit format requested, use it
  if (formatName && TITLE_FORMULAS[formatName]) {
    return [formatName];
  }

  const formats: string[] = [];
  const lowerNarration = narration.toLowerCase();

  // Story format if narration has incident signals
  if (
    extractIncident(narration) ||
    lowerNarration.includes('outage') ||
    lowerNarration.includes('failure') ||
    lowerNarration.includes('crash') ||
    lowerNarration.includes('lost')
  ) {
    formats.push('story');
  }

  // Challenge format for DSA or quiz-like content
  const category = getTopicCategory(topicSlug);
  if (category === 'dsa' || lowerNarration.includes('question') || lowerNarration.includes('solve')) {
    formats.push('challenge');
  }

  // Controversy for anything comparing technologies
  if (
    lowerNarration.includes('vs') ||
    lowerNarration.includes('better') ||
    lowerNarration.includes('worse') ||
    lowerNarration.includes('replace')
  ) {
    formats.push('controversy');
  }

  // Always include trendjack as a safe pick
  formats.push('trendjack');

  return [...new Set(formats)];
}

// ─── Exported Functions ──────────────────────────────────────────────────────

/**
 * Generate 5 viral title variants optimized for YouTube Shorts algorithm.
 * Returns titles sorted by estimated CTR potential (most aggressive first).
 */
export function generateViralTitle(
  topicSlug: string,
  formatName: string,
  narration: string
): string[] {
  const formats = selectFormatsForContent(topicSlug, formatName, narration);
  const titles: string[] = [];

  for (const format of formats) {
    const formulas = TITLE_FORMULAS[format];
    if (!formulas) continue;
    for (const formula of formulas) {
      titles.push(formula(topicSlug, narration));
      if (titles.length >= 8) break;
    }
    if (titles.length >= 8) break;
  }

  // Deduplicate and limit to 5
  const unique = [...new Set(titles)];

  // Score by viral signals: caps, numbers, personal pronouns, short length
  const scored = unique.map((title) => {
    let score = 0;
    if (/[A-Z]{2,}/.test(title)) score += 3; // ALL CAPS words
    if (/\d/.test(title)) score += 2; // numbers
    if (/\bI\b/.test(title)) score += 2; // first person
    if (/\?$/.test(title)) score += 1; // question
    if (title.length < 50) score += 2; // short titles get more clicks
    if (title.length < 40) score += 1;
    if (/\$/.test(title)) score += 2; // money signals
    return { title, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 5).map((s) => s.title);
}

/**
 * Returns optimal upload schedule for a given day of week.
 * Day: 0=Sunday, 1=Monday, ..., 6=Saturday
 *
 * Based on research from channels that grew 0→100K:
 * - YouTube Shorts: Tue-Thu 7-9am EST
 * - TikTok: Mon-Fri 6-9pm local
 * - LinkedIn: Tue-Wed 8-10am EST
 * - Twitter/X: Mon-Fri 12-1pm EST
 * - Reddit: Mon-Wed 8-10am EST
 */
export function getUploadSchedule(dayOfWeek: number): UploadSlot[] {
  const slots: UploadSlot[] = [];

  // YouTube Shorts: Tue(2), Wed(3), Thu(4) at 7-9am EST
  if (dayOfWeek >= 2 && dayOfWeek <= 4) {
    slots.push({ platform: 'youtube', time: '07:30 EST', type: 'short' });
    slots.push({ platform: 'youtube', time: '08:30 EST', type: 'short' });
  }

  // TikTok: Mon(1)-Fri(5), 6-9pm local
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    slots.push({ platform: 'tiktok', time: '18:00 local', type: 'short' });
    slots.push({ platform: 'tiktok', time: '20:00 local', type: 'short' });
  }

  // LinkedIn: Tue(2), Wed(3), 8-10am EST
  if (dayOfWeek === 2 || dayOfWeek === 3) {
    slots.push({ platform: 'linkedin', time: '08:30 EST', type: 'carousel-or-short' });
  }

  // Twitter/X: Mon(1)-Fri(5), 12-1pm EST
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    slots.push({ platform: 'twitter', time: '12:15 EST', type: 'thread-or-clip' });
  }

  // Reddit: Mon(1), Tue(2), Wed(3), 8-10am EST
  if (dayOfWeek >= 1 && dayOfWeek <= 3) {
    slots.push({ platform: 'reddit', time: '08:00 EST', type: 'text-post-with-link' });
  }

  return slots;
}

/**
 * Maps a topic slug to relevant communities for cross-posting.
 * Each community has a tailored post style to avoid looking spammy.
 */
export function getCommunityTargets(topicSlug: string): CommunityTarget[] {
  const category = getTopicCategory(topicSlug);
  const topic = humanize(topicSlug);

  const targets: CommunityTarget[] = [];

  // Topic-specific communities
  const topicCommunities: Record<string, CommunityTarget[]> = {
    kafka: [
      { platform: 'reddit', community: 'r/apachekafka', postStyle: 'technical-discussion' },
      { platform: 'devto', community: 'kafka tag', postStyle: 'tutorial-with-embed' },
      { platform: 'slack', community: 'Confluent Community Slack', postStyle: 'help-thread-contribution' },
    ],
    'message-queue': [
      { platform: 'reddit', community: 'r/apachekafka', postStyle: 'technical-discussion' },
      { platform: 'reddit', community: 'r/rabbitmq', postStyle: 'comparison-discussion' },
    ],
    kubernetes: [
      { platform: 'reddit', community: 'r/kubernetes', postStyle: 'technical-discussion' },
      { platform: 'slack', community: 'CNCF Slack', postStyle: 'resource-share' },
      { platform: 'discord', community: 'Kubernetes Discord', postStyle: 'beginner-question' },
    ],
    microservices: [
      { platform: 'reddit', community: 'r/microservices', postStyle: 'architecture-discussion' },
      { platform: 'reddit', community: 'r/softwarearchitecture', postStyle: 'case-study' },
    ],
    redis: [
      { platform: 'reddit', community: 'r/redis', postStyle: 'technical-discussion' },
      { platform: 'discord', community: 'Redis Discord', postStyle: 'resource-share' },
    ],
    docker: [
      { platform: 'reddit', community: 'r/docker', postStyle: 'tip-share' },
      { platform: 'slack', community: 'Docker Community Slack', postStyle: 'resource-share' },
    ],
  };

  const lower = topicSlug.toLowerCase();
  if (topicCommunities[lower]) {
    targets.push(...topicCommunities[lower]);
  }

  // Category-level communities
  const categoryCommunities: Record<string, CommunityTarget[]> = {
    databases: [
      { platform: 'reddit', community: 'r/database', postStyle: 'technical-discussion' },
      { platform: 'reddit', community: 'r/PostgreSQL', postStyle: 'performance-tip' },
      { platform: 'stackexchange', community: 'DBA Stack Exchange', postStyle: 'self-answer-qa' },
    ],
    'system-design': [
      { platform: 'reddit', community: 'r/softwarearchitecture', postStyle: 'case-study' },
      { platform: 'reddit', community: 'r/ExperiencedDevs', postStyle: 'discussion-starter' },
    ],
    dsa: [
      { platform: 'reddit', community: 'r/leetcode', postStyle: 'solution-walkthrough' },
      { platform: 'reddit', community: 'r/cscareerquestions', postStyle: 'interview-prep-tip' },
    ],
    networking: [
      { platform: 'reddit', community: 'r/networking', postStyle: 'explainer' },
      { platform: 'reddit', community: 'r/sysadmin', postStyle: 'practical-tip' },
    ],
    api: [
      { platform: 'reddit', community: 'r/webdev', postStyle: 'comparison-discussion' },
      { platform: 'devto', community: 'api tag', postStyle: 'tutorial-with-embed' },
    ],
    caching: [
      { platform: 'reddit', community: 'r/redis', postStyle: 'technical-discussion' },
      { platform: 'reddit', community: 'r/webdev', postStyle: 'performance-tip' },
    ],
    general: [
      { platform: 'reddit', community: 'r/programming', postStyle: 'informational' },
      { platform: 'reddit', community: 'r/learnprogramming', postStyle: 'eli5-explainer' },
    ],
  };

  if (categoryCommunities[category]) {
    targets.push(...categoryCommunities[category]);
  }

  // Universal targets for all topics
  targets.push(
    { platform: 'reddit', community: 'r/programming', postStyle: 'informational' },
    { platform: 'reddit', community: 'r/cscareerquestions', postStyle: 'career-angle' },
    { platform: 'hackernews', community: 'Hacker News', postStyle: 'show-hn-or-link' },
    { platform: 'devto', community: `Dev.to ${topic} tag`, postStyle: 'article-with-video' },
    { platform: 'twitter', community: `#${topicSlug.replace(/-/g, '')} hashtag`, postStyle: 'thread-with-clip' }
  );

  // Deduplicate by community name
  const seen = new Set<string>();
  return targets.filter((t) => {
    const key = `${t.platform}:${t.community}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Generate a subreddit-appropriate title (no clickbait for technical subs,
 * career-focused for career subs, beginner-friendly for learning subs).
 */
export function generateRedditTitle(
  topicSlug: string,
  narration: string,
  subreddit: string
): string {
  const topic = humanize(topicSlug);
  const incident = extractIncident(narration);
  const lowerSub = subreddit.toLowerCase().replace(/^r\//, '');

  // r/programming, r/softwarearchitecture — informational, no clickbait
  if (
    lowerSub === 'programming' ||
    lowerSub === 'softwarearchitecture' ||
    lowerSub === 'experienceddevs' ||
    lowerSub === 'networking' ||
    lowerSub === 'sysadmin'
  ) {
    if (incident) {
      return `${incident.company}'s ${topic} incident: what went wrong and lessons learned`;
    }
    return `${topic}: a visual explanation of how it works under the hood`;
  }

  // r/cscareerquestions — career-focused angle
  if (lowerSub === 'cscareerquestions') {
    return `Is ${topic} still worth learning in 2026 for interviews? (visual breakdown)`;
  }

  // r/learnprogramming — beginner-friendly question format
  if (lowerSub === 'learnprogramming') {
    return `ELI5: How does ${topic} actually work? (I made a visual explainer)`;
  }

  // r/leetcode — solution/interview angle
  if (lowerSub === 'leetcode') {
    return `Visual walkthrough: ${topic} pattern for coding interviews`;
  }

  // Technology-specific subs (r/redis, r/kubernetes, r/apachekafka, etc.)
  if (
    lowerSub === 'redis' ||
    lowerSub === 'kubernetes' ||
    lowerSub === 'apachekafka' ||
    lowerSub === 'docker' ||
    lowerSub === 'postgresql' ||
    lowerSub === 'rabbitmq'
  ) {
    if (incident) {
      return `Real-world ${topic} failure analysis: ${incident.company} postmortem (visual)`;
    }
    return `Created a visual explainer on ${topic} internals — feedback welcome`;
  }

  // r/webdev — practical focus
  if (lowerSub === 'webdev') {
    return `${topic} explained visually — wish I had this when I started`;
  }

  // Default: safe informational style
  if (incident) {
    return `How ${incident.company}'s ${topic} issue caused a major outage (visual breakdown)`;
  }
  return `${topic} explained visually in 60 seconds`;
}
