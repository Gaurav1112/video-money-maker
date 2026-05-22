/**
 * lead-magnets.ts — Per-topic lead magnet configuration
 *
 * Maps each topic to a specific, named cheat sheet / PDF asset
 * that drives email capture from Shorts CTAs.
 *
 * URL pattern: guru-sishya.in/cheat-sheet/{topicSlug}
 */

export interface LeadMagnet {
  /** Display name shown in video CTA */
  title: string;
  /** URL path for the landing page */
  url: string;
  /** Short description for YouTube/IG description */
  description: string;
}

function toDisplay(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Auto-generate lead magnets for all topics
function generateLeadMagnet(topicSlug: string): LeadMagnet {
  const display = toDisplay(topicSlug);
  return {
    title: `${display} Cheat Sheet`,
    url: `https://guru-sishya.in/cheat-sheet/${topicSlug}`,
    description: `Free ${display} production cheat sheet — configs, common mistakes, and interview answers.`,
  };
}

// Topic-specific overrides for higher-value lead magnets
const CUSTOM_LEAD_MAGNETS: Record<string, Partial<LeadMagnet>> = {
  kafka: {
    title: 'Kafka Production Config Checklist',
    description:
      'The 7 Kafka configs that prevent silent data loss — used by Netflix, LinkedIn, Uber.',
  },
  kubernetes: {
    title: 'K8s Debugging Playbook',
    description: '15-step K8s debugging checklist — from pod crashes to network policies.',
  },
  database: {
    title: 'Database Scaling Decision Tree',
    description: 'When to shard, replicate, or cache — a one-page decision flowchart.',
  },
  microservices: {
    title: 'Microservices Patterns Cheat Sheet',
    description: '12 essential patterns with when-to-use decision matrix.',
  },
  docker: {
    title: 'Docker Security Checklist',
    description: '10 Docker security hardening steps most teams skip.',
  },
  sql: {
    title: 'SQL Performance Cheat Sheet',
    description: 'Index strategies, query optimization, and EXPLAIN plan reading guide.',
  },
  authentication: {
    title: 'Auth Security Checklist',
    description: 'JWT, OAuth2, session management — the security checklist.',
  },
  caching: {
    title: 'Caching Strategy Decision Tree',
    description: 'Cache-aside vs write-through vs write-behind — when to use each.',
  },
  'load-balancing': {
    title: 'Load Balancer Config Guide',
    description: 'Health checks, algorithms, and session persistence — production config.',
  },
  'distributed-systems': {
    title: 'Distributed Systems Patterns',
    description: 'CAP, PACELC, consensus, and failure modes — one-page reference.',
  },
  'system-design': {
    title: 'System Design Interview Template',
    description: 'The 4-step framework that passes 90% of system design rounds.',
  },
  'dynamic-programming': {
    title: 'DP Patterns Cheat Sheet',
    description: '5 DP patterns that solve 80% of interview problems.',
  },
  'binary-search': {
    title: 'Binary Search Template',
    description: 'The 3 binary search templates that handle every edge case.',
  },
  graphs: {
    title: 'Graph Algorithm Cheat Sheet',
    description: 'BFS, DFS, Dijkstra, topological sort — when to use which.',
  },
  trees: {
    title: 'Tree Traversal Cheat Sheet',
    description: 'Pre/in/post-order, level-order, Morris traversal — complete reference.',
  },
};

/**
 * Get the lead magnet for a topic.
 * Uses custom override if available, otherwise auto-generates.
 */
export function getLeadMagnet(topicSlug: string): LeadMagnet {
  const base = generateLeadMagnet(topicSlug);
  const custom = CUSTOM_LEAD_MAGNETS[topicSlug];
  if (custom) {
    return { ...base, ...custom };
  }
  return base;
}

/**
 * Get the YouTube description snippet for a topic's lead magnet.
 */
export function getLeadMagnetDescriptionLine(topicSlug: string): string {
  const lm = getLeadMagnet(topicSlug);
  return `📥 FREE: ${lm.title} → ${lm.url}\n${lm.description}`;
}
