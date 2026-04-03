/** Technical terms that should trigger visual emphasis in pattern interrupts */
export const TECH_TERMS = new Set([
  // Data structures
  'array', 'hashmap', 'tree', 'graph', 'queue', 'stack', 'heap', 'trie',
  'linked list', 'binary tree', 'hash table', 'priority queue',
  // Algorithms
  'binary search', 'sorting', 'recursion', 'dynamic programming', 'BFS', 'DFS',
  'greedy', 'backtracking', 'divide and conquer',
  // System design
  'load balancer', 'cache', 'database', 'microservices', 'API gateway',
  'message queue', 'CDN', 'sharding', 'replication', 'consistent hashing',
  'rate limiting', 'circuit breaker', 'reverse proxy', 'websocket',
  // Complexity
  'O(1)', 'O(n)', 'O(log n)', 'O(n log n)', 'O(n^2)',
  // Concepts
  'latency', 'throughput', 'availability', 'scalability', 'partition',
  'CAP theorem', 'ACID', 'BASE', 'REST', 'GraphQL', 'gRPC',
  'TCP', 'UDP', 'HTTP', 'DNS', 'SSL', 'TLS',
]);

/** Check if a word or phrase is a technical term */
export function isTechTerm(word: string): boolean {
  const lower = word.toLowerCase().replace(/[^a-z0-9() ]/g, '');
  if (TECH_TERMS.has(lower)) return true;
  // Check for abbreviations (2+ consecutive uppercase letters)
  if (/^[A-Z]{2,}$/.test(word.replace(/[^A-Z]/g, '')) && word.length >= 2) return true;
  return false;
}
