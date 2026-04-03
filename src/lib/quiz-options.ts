/**
 * Generate 3 plausible wrong answers for a quiz question.
 * Deterministic via seed (topic + sessionNumber + sceneIndex).
 */

const CONCEPT_GROUPS: Record<string, string[]> = {
  'load-balancing': ['Round Robin', 'Least Connections', 'IP Hash', 'Weighted Round Robin', 'Random Selection', 'Consistent Hashing'],
  'caching': ['Write-Through', 'Write-Behind', 'Cache-Aside', 'Read-Through', 'Write-Around', 'No Cache'],
  'database': ['Sharding', 'Replication', 'Indexing', 'Partitioning', 'Denormalization', 'Normalization'],
  'consistency': ['Strong Consistency', 'Eventual Consistency', 'Causal Consistency', 'Read-Your-Writes', 'Monotonic Reads', 'Linearizability'],
  'scaling': ['Horizontal Scaling', 'Vertical Scaling', 'Auto-Scaling', 'Manual Scaling', 'Diagonal Scaling', 'No Scaling'],
  'messaging': ['Pub/Sub', 'Point-to-Point', 'Fan-Out', 'Request/Reply', 'Competing Consumers', 'Dead Letter Queue'],
  'api': ['REST', 'GraphQL', 'gRPC', 'WebSocket', 'SOAP', 'Server-Sent Events'],
  'general': ['O(1)', 'O(n)', 'O(log n)', 'O(n log n)', 'O(n²)', 'O(2ⁿ)'],
};

function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateQuizOptions(
  correctAnswer: string,
  topic: string,
  sessionNumber: number,
  sceneIndex: number,
): string[] {
  const seed = hashSeed(`${topic}-${sessionNumber}-${sceneIndex}`);
  const topicLower = topic.toLowerCase().replace(/\s+/g, '-');

  // Find the best concept group
  let pool: string[] = CONCEPT_GROUPS.general;
  for (const [key, group] of Object.entries(CONCEPT_GROUPS)) {
    if (topicLower.includes(key) || key.includes(topicLower)) {
      pool = group;
      break;
    }
  }

  // Filter out the correct answer and pick 3 distractors
  const available = pool.filter(
    opt => opt.toLowerCase() !== correctAnswer.toLowerCase()
  );

  const distractors: string[] = [];
  for (let i = 0; i < 3 && i < available.length; i++) {
    const idx = (seed + i * 7) % available.length;
    const pick = available[idx];
    if (!distractors.includes(pick)) {
      distractors.push(pick);
    } else {
      // Collision — pick next available
      const next = available.find(a => !distractors.includes(a) && a !== pick);
      if (next) distractors.push(next);
    }
  }

  // Shuffle correct answer into the options
  const options = [...distractors, correctAnswer];
  // Deterministic shuffle using seed
  for (let i = options.length - 1; i > 0; i--) {
    const j = (seed + i) % (i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }

  return options;
}
