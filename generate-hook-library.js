const fs = require('fs');
const path = require('path');

// Deterministic hash function
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash) & 0x7FFFFFFF;
}

// Hook strength calculator
function calculateStrength(hook) {
  let score = 0;
  
  // Curiosity gap (0-40)
  const curiosityGapPatterns = ['why', 'secret', 'mistake', '?', 'never knew', 'actually', 'true', 'really'];
  const curiosityGapScore = curiosityGapPatterns.reduce((acc, pattern) => 
    acc + (hook.toLowerCase().includes(pattern) ? 8 : 0), 0
  );
  score += Math.min(curiosityGapScore, 40);
  
  // Urgency (0-30)
  const urgencyPatterns = ['90%', 'fail', 'wrong', 'costing', 'before', 'now', 'never', 'must', 'immediately'];
  const urgencyScore = urgencyPatterns.reduce((acc, pattern) => 
    acc + (hook.toLowerCase().includes(pattern) ? 6 : 0), 0
  );
  score += Math.min(urgencyScore, 30);
  
  // Specificity (0-30)
  const hasNumber = /\d+/.test(hook);
  const hasCompanyRef = /(google|amazon|netflix|meta|uber|stripe|paypal|microsoft|apple|stripe)/i.test(hook);
  const hasMetric = /(lakhs|crores|engineers|developers|candidates|interviews|system design|coding|question)/i.test(hook);
  let specificityScore = 0;
  if (hasNumber) specificityScore += 10;
  if (hasCompanyRef) specificityScore += 10;
  if (hasMetric) specificityScore += 10;
  score += specificityScore;
  
  // Normalize to 0-100 scale, then to 0-10
  return Math.round((Math.min(score, 100) / 100) * 10 * 10) / 10;
}

// 50+ unique hook patterns organized by psychological trigger
const hookPatterns = {
  'shock': {
    desc: 'Shocking statistics that grab attention',
    templates: [
      '90% Engineers Get {topic} WRONG',
      '{company} Rejects {percent}% Candidates on {topic}',
      '{metric} Per Second — Here\'s Why Most Miss It',
      'The {topic} Mistake Costing You ₹{amount}LPA',
    ]
  },
  'curiosity': {
    desc: 'Questions that create curiosity gaps',
    templates: [
      'Why Does {company} Use {topic} Instead of {alternative}?',
      'There\'s a Reason Every FAANG Asks About {topic}...',
      'Can You Explain {topic} in One Sentence?',
      'What {company} Engineers Know That You Don\'t',
    ]
  },
  'contrast': {
    desc: 'Contrarian takes that flip expectations',
    templates: [
      'Everything You Know About {topic} Is Wrong',
      '{topic} Is Making Your System SLOWER, Not Faster',
      'Stop Learning {topic} The Wrong Way',
      '{topic} Isn\'t What You Think It Is',
    ]
  },
  'urgency': {
    desc: 'Time-sensitive pressure tactics',
    templates: [
      'Master {topic} Before Your Next Interview',
      'The {topic} Question Everyone\'s Getting Wrong',
      'Learn This {topic} Trick in {duration}',
      'Your Next Interview Will Definitely Ask This',
    ]
  },
  'story': {
    desc: 'Personal narrative hooks',
    templates: [
      'A {company} Engineer Told Me The Secret to {topic}',
      'My System Design Before vs After {topic}',
      'I Failed {company} Interview Because of {topic}',
      'Here\'s What Happened When I Finally Understood {topic}',
    ]
  },
  'fear': {
    desc: 'Fear of missing out and rejection',
    templates: [
      'Tired of Getting Rejected at System Design?',
      '{percent}% of Candidates Fail This {topic} Question',
      'Most Developers Never Master {topic}',
      'This {topic} Gap Is Costing You Jobs',
    ]
  },
  'promise': {
    desc: 'Outcome-focused benefits',
    templates: [
      'Understand {topic} in {duration}. No Fluff.',
      'Master {topic} and Never Fail Again',
      '{count} {topic} Patterns That Appear in Every Interview',
      'The {topic} Formula That Gets You Hired',
    ]
  },
  'insider': {
    desc: 'Insider information positioning',
    templates: [
      'The {topic} Trick FAANG Interviewers Look For',
      'Here\'s What Happens Inside {company} When {scenario}',
      'The Secret {topic} Strategy Top Engineers Use',
      'What {count} Top Companies Do With {topic}',
    ]
  },
  'comparison': {
    desc: 'Head-to-head comparisons',
    templates: [
      '{optionA} vs {optionB} — The Answer Might Surprise You',
      'Why {company} Chose {optionA} Over {optionB}',
      '{optionA}: The {company} Way vs The {alternative} Way',
      'Comparing {count} Ways to Solve {topic}',
    ]
  },
  'bold-claim': {
    desc: 'Provocative assertions',
    templates: [
      '{topic} Will Be The Most Asked Question in 2026',
      'I\'m Calling It: {topic} Changed Everything',
      'The {topic} Revolution Nobody\'s Talking About',
      'This Is How {company} Dominated With {topic}',
    ]
  },
  'mystery': {
    desc: 'Mysterious setup that creates loops',
    templates: [
      'Most Engineers Get This {topic} Wrong...',
      'The {topic} Question That Breaks {percent}% of Candidates',
      'What I Didn\'t Know About {topic} (Until Now)',
      'The Hidden {topic} Pattern Everyone Misses',
    ]
  },
  'authority': {
    desc: 'Authority and credibility positioning',
    templates: [
      'The {company} Engineering Team Does This With {topic}',
      '{company}\'s Senior Engineer Just Revealed: {topic}',
      'Here\'s What {count} Tech Leads Say About {topic}',
      'The {topic} Standard {company} Uses (You Should Too)',
    ]
  },
  'vulnerability': {
    desc: 'Relatable personal struggles',
    templates: [
      'I Struggled With {topic} For Years',
      'Nobody Explained {topic} This Way Before',
      'The {topic} Breakthrough I Had Last Week',
      'Why {topic} Confused Me (And Probably You Too)',
    ]
  },
  'challenge': {
    desc: 'Direct challenges to viewer capabilities',
    templates: [
      'Can You Design {topic} Under Pressure?',
      'Most Engineers Can\'t Explain {topic}',
      'Try Explaining {topic} Without Stuttering',
      'The {topic} Challenge That Stumps Everyone',
    ]
  },
  'pattern-break': {
    desc: 'Unexpected format or pacing shifts',
    templates: [
      'Wait — {company} Does {topic} Differently Than We Thought',
      'Hold Up: The {topic} Method Nobody Uses',
      'Plot Twist: {topic} Actually Works This Way',
      'Spoiler: The Best {topic} Strategy Isn\'t What You Think',
    ]
  },
  'specificity': {
    desc: 'Highly specific number-driven claims',
    templates: [
      '{number} Requests Per Second — Here\'s How {company} Handles {topic}',
      '{metric} With {topic}: The {company} Story',
      '{count} Core {topic} Patterns You Need to Know',
      '{duration} Complete Master Class in {topic}',
    ]
  },
  'hindsight': {
    desc: 'What you wish you knew earlier',
    templates: [
      'I Wish Someone Taught Me {topic} This Way',
      '{company} Secret: The {topic} Lesson Nobody Gets',
      'The {topic} Truth They Don\'t Teach You',
      'What I Should Have Known About {topic} Earlier',
    ]
  },
  'gamification': {
    desc: 'Game-like hooks with wins/leveling',
    templates: [
      'Level Up Your {topic} Game in {duration}',
      'The {topic} Speedrun: {count} Steps to Mastery',
      'Beat the {topic} Interview: New Strategy Inside',
      'Unlock {topic} Mastery: {count} Key Techniques',
    ]
  },
  'social-proof': {
    desc: 'Majority or crowd-based validation',
    templates: [
      'Every {company} Engineer Knows This {topic} Trick',
      '{percent}% of Hired Candidates Know This {topic} Secret',
      'All Top Engineers Agree: This {topic} Strategy Works',
      '{count} Senior Devs Endorsed This {topic} Approach',
    ]
  },
  'scarcity': {
    desc: 'Limited-time or exclusive framing',
    templates: [
      'This {topic} Interview Technique Is Getting Harder to Use',
      'The {topic} Edge: A Shrinking Advantage',
      'Soon Everyone Will Know This {topic} Trick',
      'The {company} {topic} Strategy Before Everyone Else',
    ]
  },
  'contradiction': {
    desc: 'Logical contradictions that perplex',
    templates: [
      'The {topic} Paradox Most Miss',
      'Why {company} Does {topic} Backwards (And Gets Better Results)',
      'The {topic} Truth That Contradicts Everything',
      'The Counterintuitive {topic} Move That Works',
    ]
  },
  'emotion': {
    desc: 'Emotionally resonant angles',
    templates: [
      'I Got Emotional About {topic} After Seeing This',
      'The {topic} Story That Changed How I Code',
      'Why {topic} Matters More Than You Think',
      'The Beauty of {topic} Explained Simply',
    ]
  },
  'surprise': {
    desc: 'Unexpected twists and revelations',
    templates: [
      'Plot Twist: {company} Solves {topic} With {optionA}',
      'The {topic} Secret That Surprised Me Most',
      'Unexpected: How {company} Really Uses {topic}',
      'This {topic} Finding Shocked Me',
    ]
  },
  'value-stacking': {
    desc: 'Multiple benefits in rapid succession',
    templates: [
      'Learn {topic}, Ace Interviews, Design Better Systems',
      '{topic} Mastery: Better Jobs, Better Pay, Better Code',
      'Master {topic}: Interview Ready in {duration}',
      'The {topic} Breakthrough: {count} Instant Benefits',
    ]
  },
  'narrative-arc': {
    desc: 'Story-like progression hooks',
    templates: [
      'From Struggling With {topic} to {company} Interview Ace',
      'The {topic} Journey: My 3-Month Transformation',
      'How {topic} Changed Everything for My Career',
      'The {topic} Breakthrough That Opened Doors',
    ]
  },
  'fear-of-missing': {
    desc: 'FOMO-driven urgency',
    templates: [
      '{company} Is Already Using This {topic} Strategy',
      'If You Don\'t Know {topic}, You\'re Behind',
      'Everyone Else Is Mastering {topic} Right Now',
      'Don\'t Be The Engineer Who Doesn\'t Know {topic}',
    ]
  },
  'intimacy': {
    desc: 'Close, personal connection to viewer',
    templates: [
      'Let Me Share My Deepest {topic} Secret',
      'This Is What I Tell My Friends About {topic}',
      'The {topic} Truth I Keep to Myself',
      'Here\'s What My Mentor Told Me About {topic}',
    ]
  },
  'dare': {
    desc: 'Challenge-based provocations',
    templates: [
      'I Dare You to Master {topic} in {duration}',
      'Bet You Can\'t Explain {topic} This Simply',
      'Challenge: Design {topic} Under {duration} Pressure',
      'Can You Handle The {topic} Truth?',
    ]
  },
  'guaranteed': {
    desc: 'Strong guarantee positioning',
    templates: [
      'Guarantee: You\'ll Understand {topic} After This',
      'I Guarantee This {topic} Strategy Works',
      'Promise: {topic} Will Never Confuse You Again',
      'Guaranteed: This Interview Question Uses {topic}',
    ]
  },
  'myth-busting': {
    desc: 'Debunking false beliefs',
    templates: [
      'The {topic} Myth That\'s Ruining Your Interviews',
      'Stop Believing The {topic} Lie',
      '{company} Exposed The {topic} Misconception',
      'The {topic} Falsehood Everyone Believes',
    ]
  },
  'optimization': {
    desc: 'Efficiency and performance angles',
    templates: [
      'Optimize {topic}: {company}\'s Secret Method',
      'The {topic} Performance Hack Everyone Misses',
      '10x Your {topic} Understanding in {duration}',
      'The Fastest Way to Master {topic}',
    ]
  },
  'psychology': {
    desc: 'Human behavior and bias-based hooks',
    templates: [
      'Why Your Brain Gets {topic} Wrong',
      'The Psychological Trick Behind {topic}',
      'How {company} Engineers Think About {topic}',
      'The Cognitive Bias In Your {topic} Approach',
    ]
  },
  'health': {
    desc: 'Wellbeing and career sustainability angles',
    templates: [
      'Stop Burning Out On {topic} Interviews',
      'The {topic} Hack For Work-Life Balance',
      'Why Understanding {topic} Reduces Stress',
      'The Mental Model That Makes {topic} Easier',
    ]
  },
  'money': {
    desc: 'Financial impact and ROI',
    templates: [
      'This {topic} Knowledge Is Worth ₹{amount}LPA',
      'The {topic} Secret Every High-Earner Knows',
      'Master {topic}: +{amount}% Salary Boost',
      'The {topic} Skill Paying Top Developers',
    ]
  },
  'simplicity': {
    desc: 'Demystifying complex concepts',
    templates: [
      'The Simple {topic} Explanation',
      'How A {count}-Year-Old Could Understand {topic}',
      'The {topic} Breakdown In Plain English',
      'Making {topic} Ridiculously Simple',
    ]
  },
  'speed': {
    desc: 'Time and efficiency focused',
    templates: [
      '{topic} Mastery in {duration}: The Fast Track',
      'The Quick {topic} Trick That Works Instantly',
      '{count} Minute {topic} Crash Course',
      'Master {topic} Before Your Next Meeting',
    ]
  },
  'power': {
    desc: 'Empowerment and capability building',
    templates: [
      'Become A {topic} Power User',
      'The {topic} Superpower You\'re Missing',
      'Unlock Your Full {topic} Potential',
      'The {topic} Mastery That Changes Everything',
    ]
  },
  'tribe': {
    desc: 'Belonging and community positioning',
    templates: [
      'Join The Elite {topic} Engineers',
      'The {topic} Secret Handshake',
      'If You Know {topic}, You\'re In The Top {percent}%',
      'The Exclusive {topic} Club',
    ]
  },
  'journey': {
    desc: 'Character development arcs',
    templates: [
      'My {{topic}} Journey: From Zero to FAANG',
      'How {topic} Became My Competitive Edge',
      'The {{topic}} Quest: A Developer\'s Story',
      'From Novice to {{topic}} Master',
    ]
  },
  'wisdom': {
    desc: 'Timeless, principle-based hooks',
    templates: [
      'The Timeless {{topic}} Principle',
      'Ancient Wisdom About {{topic}}: Surprisingly Relevant',
      'The {{topic}} Truth That Never Gets Old',
      'What Great {{topic}} Engineers Know',
    ]
  },
  'trend': {
    desc: 'Trending and current angles',
    templates: [
      '{{topic}} Is Trending In Tech Right Now',
      'Why {{company}} Just Shifted To {{topic}}',
      'The {{topic}} Trend Changing 2026 Interviews',
      'Hot Take: {{topic}} Is The Future',
    ]
  },
  'reverse': {
    desc: 'Opposite or inverse positioning',
    templates: [
      'The Reverse {{topic}} Approach Nobody Tries',
      'What If You Did {{topic}} Backwards?',
      'The Unconventional {{topic}} Strategy',
      'The {{topic}} Method Everyone Gets Upside Down',
    ]
  },
  'transformation': {
    desc: 'Before/after metamorphosis',
    templates: [
      'How {{topic}} Transformed My Career',
      'The {{topic}} Turnaround Story',
      'When I Finally Got {{topic}}, Everything Changed',
      'The {{topic}} Awakening',
    ]
  },
  'science': {
    desc: 'Data and research-driven',
    templates: [
      'The Science Behind {{topic}}',
      'Research Shows: {{topic}} Actually Works This Way',
      'The {{company}} Study On {{topic}}',
      'Why {{topic}} Actually Makes Sense (Scientifically)',
    ]
  },
  'irony': {
    desc: 'Ironic or humorous angles',
    templates: [
      'The Irony Of {{topic}}: What Everyone Gets Wrong',
      'Funny Story About {{topic}}: It Actually Explains It',
      'The Hilarious {{topic}} Truth',
      'Why {{topic}} Is More Obvious Than You Think',
    ]
  },
};

// Topic data for templating
const topicData = {
  'load-balancing': {
    companies: ['Google', 'Netflix', 'Amazon', 'Meta', 'Uber'],
    alternatives: ['round-robin', 'random routing', 'sticky sessions', 'least-connections'],
    scenarios: [
      'a server crashes mid-request',
      'traffic spikes 10x',
      'geographic regions fail',
      'one datacenter goes down'
    ],
    numbers: ['8.5 billion', '100 billion', '1 million', '500 million', '2 trillion'],
    metrics: ['requests/sec', 'API calls/day', 'connections', 'packets/second'],
    durations: ['45 seconds', '2 minutes', '5 minutes', '90 seconds'],
    counts: ['3', '5', '7', '4', '6'],
    amounts: ['50', '75', '100', '25', '40'],
    percents: ['90', '75', '85', '95', '70'],
    optionPairs: [
      ['Round Robin', 'Consistent Hashing'],
      ['L4', 'L7 Load Balancer'],
      ['Sticky Sessions', 'Stateless'],
      ['Hardware LB', 'Software LB']
    ]
  },
  'caching': {
    companies: ['Netflix', 'Facebook', 'Twitter', 'Amazon', 'Google'],
    alternatives: ['hitting database', 'no caching', 'direct computation', 'disk access'],
    scenarios: [
      'cache goes down',
      'cache invalidation fails',
      'stampede hits cache',
      'cache fills up'
    ],
    numbers: ['250 million', '2 billion', '500 million', '1.5 billion', '50 million'],
    metrics: ['cache hits/sec', 'reads/second', 'objects cached', 'hit ratio %'],
    durations: ['30 seconds', '1 minute', '3 minutes', '2 minutes'],
    counts: ['4', '5', '6', '3', '7'],
    amounts: ['50', '60', '75', '100', '40'],
    percents: ['80', '85', '90', '75', '95'],
    optionPairs: [
      ['Redis', 'Memcached'],
      ['Write-Through', 'Write-Behind'],
      ['LRU', 'LFU'],
      ['Client-side', 'Server-side']
    ]
  },
  'database-design': {
    companies: ['Amazon', 'Uber', 'Spotify', 'Netflix', 'LinkedIn'],
    alternatives: ['monolithic database', 'NoSQL only', 'single server', 'no sharding'],
    scenarios: [
      'scale to 10x users',
      'partition fails',
      'replication lag',
      'hot shard problem'
    ],
    numbers: ['100 million', '1 billion', '50 petabytes', '500TB', '2 exabytes'],
    metrics: ['rows/table', 'queries/sec', 'transactions', 'p99 latency'],
    durations: ['2 minutes', '3 minutes', '5 minutes', '4 minutes'],
    counts: ['5', '7', '8', '6', '4'],
    amounts: ['75', '100', '50', '125', '60'],
    percents: ['90', '85', '80', '95', '70'],
    optionPairs: [
      ['SQL', 'NoSQL'],
      ['Sharding', 'Replication'],
      ['Normalized', 'Denormalized'],
      ['ACID', 'BASE']
    ]
  },
  'api-gateway': {
    companies: ['Netflix', 'Amazon', 'Uber', 'Google', 'Stripe'],
    alternatives: ['direct calls', 'no gateway', 'monolithic routing', 'ad-hoc'],
    scenarios: [
      'rate limiting activates',
      'auth fails',
      'versioning breaks',
      'routing table corrupts'
    ],
    numbers: ['2 billion', '100 million', '50 million', '1 billion', '500M'],
    metrics: ['API calls/day', 'requests/sec', 'endpoints', 'latency p95'],
    durations: ['45 seconds', '90 seconds', '3 minutes', '2 minutes'],
    counts: ['3', '6', '8', '5', '4'],
    amounts: ['50', '100', '75', '125', '60'],
    percents: ['85', '90', '80', '75', '95'],
    optionPairs: [
      ['Kong', 'AWS API Gateway'],
      ['REST', 'GraphQL'],
      ['BFF', 'Monolithic'],
      ['Async', 'Sync']
    ]
  },
  'microservices': {
    companies: ['Netflix', 'Amazon', 'Uber', 'Airbnb', 'GitHub'],
    alternatives: ['monolith', 'SOA', 'layered', 'traditional MVC'],
    scenarios: [
      'service fails',
      'need 100x daily deploys',
      'cascading failure',
      'versioning chaos'
    ],
    numbers: ['700', '1000', '2500', '1200', '500'],
    metrics: ['services', 'deploys/day', 'service calls', 'latency'],
    durations: ['2 minutes', '3 minutes', '5 minutes', '4 minutes'],
    counts: ['5', '8', '6', '7', '4'],
    amounts: ['50', '100', '75', '125', '60'],
    percents: ['90', '85', '80', '75', '95'],
    optionPairs: [
      ['Monolith', 'Microservices'],
      ['Sync', 'Async'],
      ['Centralized', 'Decentralized'],
      ['SLA', 'Best effort']
    ]
  },
};

const DEFAULT_DATA = {
  companies: ['Google', 'Amazon', 'Netflix', 'Meta', 'Microsoft'],
  alternatives: ['naive approach', 'brute force', 'basic method', 'outdated way'],
  scenarios: ['scale increases', 'things break', 'performance drops', 'edge case hits'],
  numbers: ['millions', 'billions', '100x', '1000x', 'petabyte-scale'],
  metrics: ['operations', 'requests', 'transactions', 'concurrent users'],
  durations: ['60 seconds', '2 minutes', '5 minutes', '3 minutes'],
  counts: ['3', '5', '7', '4', '6'],
  amounts: ['50', '75', '100', '25', '40'],
  percents: ['90', '75', '85', '95', '70'],
  optionPairs: [
    ['Option A', 'Option B'],
    ['Approach 1', 'Approach 2'],
    ['Method X', 'Method Y'],
    ['Strategy 1', 'Strategy 2']
  ]
};

function getTopicData(topic) {
  const key = topic.toLowerCase().replace(/\s+/g, '-');
  return topicData[key] || DEFAULT_DATA;
}

function interpolateTemplate(template, topic, data) {
  let result = template;
  const hash = djb2Hash(topic);
  
  const getByHash = (arr) => arr[hash % arr.length];
  
  result = result.replace(/\{topic\}/gi, topic);
  result = result.replace(/\{company\}/gi, getByHash(data.companies));
  result = result.replace(/\{alternative\}/gi, getByHash(data.alternatives));
  result = result.replace(/\{scenario\}/gi, getByHash(data.scenarios));
  result = result.replace(/\{number\}/gi, getByHash(data.numbers));
  result = result.replace(/\{metric\}/gi, getByHash(data.metrics));
  result = result.replace(/\{duration\}/gi, getByHash(data.durations));
  result = result.replace(/\{count\}/gi, getByHash(data.counts));
  result = result.replace(/\{amount\}/gi, getByHash(data.amounts));
  result = result.replace(/\{percent\}/gi, getByHash(data.percents));
  
  const pair = getByHash(data.optionPairs);
  result = result.replace(/\{optionA\}/gi, pair[0]);
  result = result.replace(/\{optionB\}/gi, pair[1]);
  
  return result;
}

// Generate library
const library = {
  version: '1.0.0',
  generated: new Date().toISOString(),
  metadata: {
    totalPatterns: Object.keys(hookPatterns).length,
    targetStrength: 8.5,
    templateCount: 0,
  },
  patterns: []
};

let totalTemplates = 0;

Object.entries(hookPatterns).forEach(([patternId, pattern]) => {
  const patternEntry = {
    id: patternId,
    name: patternId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    description: pattern.desc,
    templates: []
  };
  
  pattern.templates.forEach((template, idx) => {
    const topicKey = Object.keys(topicData)[idx % Object.keys(topicData).length];
    const topic = topicKey.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const data = getTopicData(topicKey);
    
    const claim = interpolateTemplate(template, topic, data);
    const strength = calculateStrength(claim);
    
    patternEntry.templates.push({
      id: `${patternId}-${idx}`,
      claim,
      topic: topicKey,
      strength,
      type: patternId
    });
    
    totalTemplates++;
  });
  
  library.patterns.push(patternEntry);
});

// Generate additional templates by combining patterns across topics
const extraTopics = ['message-queuing', 'service-mesh', 'container-orchestration', 'disaster-recovery', 'observability'];
const extraPatterns = ['shock', 'curiosity', 'contrast', 'urgency', 'fear'];

extraTopics.forEach((topic) => {
  extraPatterns.forEach((patternId) => {
    const pattern = hookPatterns[patternId];
    if (pattern && pattern.templates.length > 0) {
      const template = pattern.templates[0];
      const data = getTopicData(topic);
      const topicDisplay = topic.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const claim = interpolateTemplate(template, topicDisplay, data);
      const strength = calculateStrength(claim);
      
      // Add to existing pattern
      const patternEntry = library.patterns.find(p => p.id === patternId);
      if (patternEntry) {
        patternEntry.templates.push({
          id: `${patternId}-${patternEntry.templates.length}`,
          claim,
          topic,
          strength,
          type: patternId
        });
        totalTemplates++;
      }
    }
  });
});

library.metadata.templateCount = totalTemplates;
library.metadata.averageStrength = 
  library.patterns.reduce((sum, p) => 
    sum + p.templates.reduce((psum, t) => psum + t.strength, 0),
    0) / totalTemplates;

const output = {
  library,
  stats: {
    totalPatterns: library.patterns.length,
    totalTemplates,
    averageStrength: library.metadata.averageStrength.toFixed(2),
    strengthDistribution: {
      excellent: library.patterns.reduce((sum, p) => 
        sum + p.templates.filter(t => t.strength >= 8.5).length, 0),
      good: library.patterns.reduce((sum, p) => 
        sum + p.templates.filter(t => t.strength >= 7.5 && t.strength < 8.5).length, 0),
      fair: library.patterns.reduce((sum, p) => 
        sum + p.templates.filter(t => t.strength < 7.5).length, 0),
    }
  }
};

console.log(JSON.stringify(output, null, 2));
