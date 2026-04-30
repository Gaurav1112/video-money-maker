type TopicCategory = 'system-design' | 'dsa' | 'databases' | 'networking' | 'api' | 'caching' | 'general';

const CATEGORY_MAP: Record<string, TopicCategory> = {
  'load-balancing': 'system-design',
  'load balancing': 'system-design',
  'microservices': 'system-design',
  'system-design': 'system-design',
  'distributed-systems': 'system-design',
  'scalability': 'system-design',
  'message-queue': 'system-design',
  'caching': 'caching',
  'cache': 'caching',
  'redis': 'caching',
  'cdn': 'caching',
  'api-gateway': 'api',
  'api gateway': 'api',
  'rest-api': 'api',
  'graphql': 'api',
  'grpc': 'api',
  'database-design': 'databases',
  'database': 'databases',
  'sql': 'databases',
  'nosql': 'databases',
  'sharding': 'databases',
  'indexing': 'databases',
  'networking': 'networking',
  'tcp': 'networking',
  'http': 'networking',
  'dns': 'networking',
  'websocket': 'networking',
  'binary-search': 'dsa',
  'sorting': 'dsa',
  'dynamic-programming': 'dsa',
  'trees': 'dsa',
  'graphs': 'dsa',
  'arrays': 'dsa',
  'linked-list': 'dsa',
  'hash-map': 'dsa',
};

export function getTopicCategory(topicSlug: string): TopicCategory {
  const lower = topicSlug.toLowerCase().replace(/\s+/g, '-');
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  // Partial match
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return cat;
  }
  return 'general';
}
