/**
 * Topic-specific examples (company, scale, use-case) used across hook generation
 * and script generation. Extracted to its own module to avoid circular imports.
 */

export const TOPIC_EXAMPLES: Record<string, {
  company: string;
  useCase: string;
  scale: string;
  problem: string;
  solution: string;
}> = {
  'caching': {
    company: 'Netflix',
    useCase: 'serves 230 million users worldwide',
    scale: '100 billion hours of content per year',
    problem: 'database queries taking 500ms each',
    solution: 'Redis cache layer reducing latency to 2ms',
  },
  'load balancing': {
    company: 'Swiggy',
    useCase: 'handles 2 million orders during lunch rush',
    scale: '10,000 requests per second at peak',
    problem: 'single server crashing under load',
    solution: 'distributing traffic across 50 servers',
  },
  'api gateway': {
    company: 'Flipkart',
    useCase: 'routes every customer request through one entry point',
    scale: '100 million users during Big Billion Days',
    problem: 'clients calling 20 different services directly',
    solution: 'single gateway handling auth, rate limiting, and routing',
  },
  'kafka': {
    company: 'Uber',
    useCase: 'processes ride data in real-time',
    scale: '1 billion events per day',
    problem: 'losing critical trip data during peak hours',
    solution: 'distributed event streaming with guaranteed delivery',
  },
  'database': {
    company: 'Razorpay',
    useCase: 'processes UPI payments',
    scale: '10,000 transactions per second',
    problem: 'single database becoming a bottleneck',
    solution: 'sharding across multiple database instances',
  },
  'microservices': {
    company: 'PhonePe',
    useCase: 'handles digital payments across India',
    scale: '4 billion monthly transactions',
    problem: 'monolith deployment taking 2 hours',
    solution: 'independent microservices deployed in 5 minutes',
  },
  'distributed': {
    company: 'Zomato',
    useCase: 'syncs restaurant data across all cities',
    scale: '500,000 restaurants in real-time',
    problem: 'network partitions causing stale data',
    solution: 'eventual consistency with conflict resolution',
  },
  'message queue': {
    company: 'Swiggy',
    useCase: 'processes order workflow',
    scale: '2 million orders per day',
    problem: 'synchronous calls causing cascading failures',
    solution: 'async message queues decoupling services',
  },
  'authentication': {
    company: 'Paytm',
    useCase: 'secures 300 million wallets',
    scale: '50 million logins per day',
    problem: 'session tokens being stolen',
    solution: 'JWT with short-lived access tokens and refresh rotation',
  },
  'rate limiting': {
    company: 'Zerodha',
    useCase: 'protects trading APIs',
    scale: '15 million orders per day',
    problem: 'bot attacks overwhelming the system',
    solution: 'token bucket rate limiter at the API gateway',
  },
  'monitoring': {
    company: 'CRED',
    useCase: 'monitors payment health',
    scale: '10,000 metrics per second',
    problem: 'outage discovered 30 minutes late by users',
    solution: 'real-time alerting with P95 latency thresholds',
  },
  'consistent hashing': {
    company: 'Amazon DynamoDB',
    useCase: 'distributes data across nodes',
    scale: 'trillions of requests per day',
    problem: 'adding a server reshuffles all data',
    solution: 'hash ring with virtual nodes for minimal redistribution',
  },
  'cdn': {
    company: 'Hotstar',
    useCase: 'streams IPL cricket to 25 million concurrent viewers',
    scale: '25 Tbps bandwidth at peak',
    problem: 'buffering and high latency for users far from origin server',
    solution: 'edge caching content at 200+ global PoPs',
  },
  'queue': {
    company: 'Razorpay',
    useCase: 'processes payment settlements',
    scale: '5 million daily transactions',
    problem: 'payment service overload during flash sales',
    solution: 'message queue absorbing burst traffic for async processing',
  },
  'dns': {
    company: 'Cloudflare',
    useCase: 'resolves domain names globally',
    scale: '1.2 trillion DNS queries per day',
    problem: 'DNS lookup adding 200ms to every request',
    solution: 'anycast routing to the nearest resolver',
  },
  'docker': {
    company: 'Spotify',
    useCase: 'deploys microservices for 500 million users',
    scale: '1,000+ microservices in production',
    problem: '"works on my machine" breaking in production',
    solution: 'containerized deployments with identical environments everywhere',
  },
  'kubernetes': {
    company: 'Flipkart',
    useCase: 'orchestrates thousands of containers during Big Billion Days',
    scale: '100 million users, 10,000+ pods',
    problem: 'manual scaling and deployment failures',
    solution: 'auto-scaling, self-healing container orchestration',
  },
  'sql': {
    company: 'Zerodha',
    useCase: 'stores trading and portfolio data',
    scale: '15 million daily orders',
    problem: 'complex queries slowing down as data grows',
    solution: 'optimized indexes and query plans for sub-ms reads',
  },
  'nosql': {
    company: 'Swiggy',
    useCase: 'stores restaurant menus and real-time delivery data',
    scale: '500,000 restaurant listings updated in real-time',
    problem: 'rigid schema blocking rapid feature iteration',
    solution: 'flexible document store for schema-less data',
  },
  'ci/cd': {
    company: 'Razorpay',
    useCase: 'ships payment features safely',
    scale: '100+ deploys per day',
    problem: 'manual deployment causing 2-hour outages',
    solution: 'automated pipelines with canary releases and instant rollback',
  },
};

/**
 * Lookup topic-specific example. Matches by substring so "Load Balancing Algorithms"
 * still matches the "load balancing" entry.
 */
export function getTopicExample(topic: string): typeof TOPIC_EXAMPLES[string] {
  const lower = topic.toLowerCase();
  for (const [key, example] of Object.entries(TOPIC_EXAMPLES)) {
    if (lower.includes(key)) return example;
  }
  // Fallback — generic but still useful
  return {
    company: 'Google',
    useCase: 'handles search at scale',
    scale: '8.5 billion searches per day',
    problem: 'server overload during traffic spikes',
    solution: 'distributed architecture with graceful degradation',
  };
}
