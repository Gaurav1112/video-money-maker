/**
 * Deterministic hook generation from topic + session content.
 * No AI, no randomness — same input always produces same output.
 * Uses seeded selection based on topic + sessionNumber hash.
 */

export interface HookFormula {
  id: string;
  type: 'statistic' | 'contrarian' | 'fear' | 'promise' | 'question' | 'story' | 'myth' | 'challenge' | 'insider' | 'comparison';
  template: string;
}

export const HOOK_FORMULAS: HookFormula[] = [
  { id: 'shocking-stat', type: 'statistic', template: '{company} handles {number} {metric} per day. Here\'s how.' },
  { id: 'contrarian', type: 'contrarian', template: 'Stop learning {topic} the wrong way. Here\'s what actually works.' },
  { id: 'fear-fail', type: 'fear', template: '90% of candidates fail this {topic} interview question.' },
  { id: 'promise-time', type: 'promise', template: 'Understand {topic} in {duration}. No fluff.' },
  { id: 'question-why', type: 'question', template: 'Why does {company} use {topic} instead of {alternative}?' },
  { id: 'story-fail', type: 'story', template: 'A {company} engineer told me the secret to {topic}.' },
  { id: 'myth-bust', type: 'myth', template: 'Everything you know about {topic} is wrong.' },
  { id: 'challenge', type: 'challenge', template: 'Can you explain {topic} in one sentence? Most engineers can\'t.' },
  { id: 'insider', type: 'insider', template: 'The {topic} trick that FAANG interviewers look for.' },
  { id: 'comparison', type: 'comparison', template: '{optionA} vs {optionB} — the answer might surprise you.' },
  { id: 'behind-scenes', type: 'insider', template: 'Here\'s what happens inside {company} when {scenario}.' },
  { id: 'time-pressure', type: 'fear', template: 'Learn {topic} before your next interview. You\'ll thank me.' },
  { id: 'authority', type: 'statistic', template: 'The {company} engineering team does this with {topic}. You should too.' },
  { id: 'result-first', type: 'promise', template: 'Master {topic} and you\'ll never fail a system design round again.' },
  { id: 'hot-take', type: 'contrarian', template: '{topic} is making your system SLOWER, not faster.' },
  { id: 'curiosity-gap', type: 'question', template: 'There\'s a reason every FAANG company asks about {topic}...' },
  { id: 'pain-point', type: 'fear', template: 'Tired of getting rejected at the system design round?' },
  { id: 'before-after', type: 'story', template: 'My system design before vs after learning {topic}.' },
  { id: 'list-tease', type: 'promise', template: '{count} {topic} patterns that appear in every Google interview.' },
  { id: 'prediction', type: 'statistic', template: '{topic} will be the most asked topic in 2026 interviews.' },
];

interface TopicData {
  companies: string[];
  numbers: string[];
  metrics: string[];
  alternatives: string[];
  scenarios: string[];
  durations: string[];
  counts: string[];
  optionPairs: [string, string][];
}

const TOPIC_DATA: Record<string, TopicData> = {
  'load-balancing': {
    companies: ['Google', 'Netflix', 'Amazon'],
    numbers: ['8.5 billion', '100 billion', '1 million'],
    metrics: ['requests', 'API calls', 'connections'],
    alternatives: ['round robin', 'random routing'],
    scenarios: ['a server crashes mid-request', 'traffic spikes 10x'],
    durations: ['45 seconds', '2 minutes'],
    counts: ['3', '5'],
    optionPairs: [['Round Robin', 'Consistent Hashing'], ['L4', 'L7 Load Balancer']],
  },
  'caching': {
    companies: ['Netflix', 'Facebook', 'Twitter'],
    numbers: ['250 million', '2 billion', '500 million'],
    metrics: ['cache hits', 'reads per second', 'objects cached'],
    alternatives: ['hitting the database every time', 'no caching'],
    scenarios: ['the cache goes down', 'cache invalidation fails'],
    durations: ['30 seconds', '1 minute'],
    counts: ['4', '5'],
    optionPairs: [['Redis', 'Memcached'], ['Write-Through', 'Write-Behind']],
  },
  'database-design': {
    companies: ['Amazon', 'Uber', 'Spotify'],
    numbers: ['100 million', '1 billion', '50 petabytes'],
    metrics: ['rows', 'queries per second', 'transactions'],
    alternatives: ['a single monolithic database', 'NoSQL only'],
    scenarios: ['you need to scale to 10x users', 'a partition fails'],
    durations: ['2 minutes', '3 minutes'],
    counts: ['5', '7'],
    optionPairs: [['SQL', 'NoSQL'], ['Sharding', 'Replication']],
  },
  'api-gateway': {
    companies: ['Netflix', 'Amazon', 'Uber'],
    numbers: ['2 billion', '100 million', '50 million'],
    metrics: ['API calls per day', 'requests per second', 'endpoints'],
    alternatives: ['direct client-to-service calls', 'no gateway'],
    scenarios: ['rate limiting kicks in', 'authentication fails'],
    durations: ['45 seconds', '90 seconds'],
    counts: ['3', '6'],
    optionPairs: [['Kong', 'AWS API Gateway'], ['REST', 'GraphQL']],
  },
  'microservices': {
    companies: ['Netflix', 'Amazon', 'Uber'],
    numbers: ['700', '1,000', '2,500'],
    metrics: ['microservices', 'deployments per day', 'service calls'],
    alternatives: ['a monolith', 'SOA'],
    scenarios: ['one service fails', 'you need to deploy 100 times a day'],
    durations: ['2 minutes', '3 minutes'],
    counts: ['5', '8'],
    optionPairs: [['Monolith', 'Microservices'], ['Sync', 'Async Communication']],
  },
};

const DEFAULT_DATA: TopicData = {
  companies: ['Google', 'Amazon', 'Netflix'],
  numbers: ['millions of', 'billions of', '100x more'],
  metrics: ['operations', 'requests', 'transactions'],
  alternatives: ['the naive approach', 'brute force'],
  scenarios: ['scale increases 10x', 'things go wrong'],
  durations: ['60 seconds', '2 minutes'],
  counts: ['3', '5'],
  optionPairs: [['Option A', 'Option B']],
};

function deterministicHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function generateHooks(topic: string, sessionNumber: number, heading?: string): string[] {
  const topicKey = topic.toLowerCase().replace(/\s+/g, '-');
  const data = TOPIC_DATA[topicKey] || DEFAULT_DATA;
  const seed = deterministicHash(topicKey + '-' + sessionNumber);
  const hooks: string[] = [];
  const usedFormulas = new Set<number>();

  for (let i = 0; i < 5; i++) {
    let formulaIdx = (seed + i * 7) % HOOK_FORMULAS.length;
    while (usedFormulas.has(formulaIdx)) {
      formulaIdx = (formulaIdx + 1) % HOOK_FORMULAS.length;
    }
    usedFormulas.add(formulaIdx);

    const formula = HOOK_FORMULAS[formulaIdx];
    const companyIdx = (seed + i) % data.companies.length;
    const numIdx = (seed + i * 3) % data.numbers.length;
    const metricIdx = (seed + i * 2) % data.metrics.length;
    const altIdx = (seed + i) % data.alternatives.length;
    const scenarioIdx = (seed + i) % data.scenarios.length;
    const durIdx = (seed + i) % data.durations.length;
    const countIdx = (seed + i) % data.counts.length;
    const pairIdx = (seed + i) % data.optionPairs.length;

    const displayTopic = heading || topic.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const hook = formula.template
      .replace(/\{topic\}/g, displayTopic)
      .replace(/\{company\}/g, data.companies[companyIdx])
      .replace(/\{number\}/g, data.numbers[numIdx])
      .replace(/\{metric\}/g, data.metrics[metricIdx])
      .replace(/\{alternative\}/g, data.alternatives[altIdx])
      .replace(/\{scenario\}/g, data.scenarios[scenarioIdx])
      .replace(/\{duration\}/g, data.durations[durIdx])
      .replace(/\{count\}/g, data.counts[countIdx])
      .replace(/\{optionA\}/g, data.optionPairs[pairIdx][0])
      .replace(/\{optionB\}/g, data.optionPairs[pairIdx][1])
      .replace(/\{result\}/g, 'ace your interview');

    hooks.push(hook);
  }

  return hooks;
}

export function selectBestHook(topic: string, sessionNumber: number, heading?: string): string {
  return generateHooks(topic, sessionNumber, heading)[0];
}
