// src/lib/quiz-content.ts

export interface QuizQuestion {
  topic: string;
  hookText: string;           // Bold text shown on screen (works on mute)
  spokenHook: string;         // TTS narration for hook (2-3s)
  question: string;           // The quiz question
  options: [string, string, string]; // 3 options (A, B, C)
  correctIndex: number;       // 0, 1, or 2
  explanation: string;        // 15-20s spoken explanation after reveal
  twist: string;              // Counterintuitive insight / hot take
  endQuestion: string;        // Comment-driving question at the end
  title: string;              // YouTube title
}

// High-performing topics (based on real channel data + search volume expansion)
export const FOCUS_TOPICS = [
  'kafka', 'api-gateway', 'load-balancing', 'database',
  'microservices', 'docker', 'kubernetes', 'redis',
  'system-design', 'rest-api', 'authentication', 'cicd',
] as const;

/**
 * Per-topic SEO tag arrays. ~12 deep tags per topic, used by the YouTube
 * upload metadata. Combined with generic tags by the render script.
 * Hand-curated; do not auto-generate.
 */
export const TOPIC_TAGS: Record<string, string[]> = {
  kafka: [
    'kafka', 'apache kafka', 'kafka tutorial', 'kafka interview',
    'event streaming', 'distributed systems', 'message queue',
    'kafka producer', 'kafka consumer', 'kafka partitions',
    'kafka exactly once', 'kafka acks',
  ],
  'api-gateway': [
    'api gateway', 'api design', 'microservices', 'kong',
    'aws api gateway', 'rate limiting', 'reverse proxy', 'nginx',
    'system design interview', 'backend for frontend',
    'api gateway pattern', 'service mesh',
  ],
  'load-balancing': [
    'load balancing', 'load balancer', 'round robin',
    'least connections', 'nginx load balancer', 'haproxy',
    'l4 vs l7', 'consistent hashing', 'cdn',
    'system design interview', 'horizontal scaling',
    'high availability',
  ],
  database: [
    'database design', 'sql', 'postgres', 'mysql', 'mongodb',
    'database sharding', 'master slave replication',
    'cap theorem', 'acid transactions', 'database scaling',
    'system design interview', 'oltp vs olap',
  ],
};

/**
 * Generic tags applied to every Short. Combined with topic-specific tags.
 */
export const GENERIC_TAGS = [
  'system design',
  'coding interview',
  'software engineer',
  'tech shorts',
  'computer science',
];

/**
 * Build the final tags array for a quiz. Caps total chars at 480 (under
 * YouTube's 500 limit). Deduplicates.
 */
export function buildTags(topic: string): string[] {
  const topicTags = TOPIC_TAGS[topic] ?? [];
  const merged = [...new Set([...topicTags, ...GENERIC_TAGS])];
  // Cap at 480 chars total (YouTube hard limit ~500)
  const out: string[] = [];
  let total = 0;
  for (const t of merged) {
    const cost = t.length + 2; // ~2 chars overhead for quoting/comma
    if (total + cost > 480) break;
    out.push(t);
    total += cost;
  }
  return out;
}

export const QUIZ_BANK: QuizQuestion[] = [
  // ── KAFKA (12 questions) ──────────────────────────────────────────
  {
    topic: 'kafka',
    hookText: 'Only 2% of devs\nget this right',
    spokenHook: 'Only two percent of developers get this Kafka question right.',
    question: 'If your Kafka producer sets acks=0 and the broker crashes, what happens to your message?',
    options: ['It retries automatically', 'Gone forever', 'Consumer replays it'],
    correctIndex: 1,
    explanation: 'The answer is B — gone forever. acks=0 means fire and forget. Your producer does not even wait for confirmation. Most production systems lose data this way and do not know for months. LinkedIn processes 7 trillion messages per day and every single one uses acks=all.',
    twist: 'The scary part? acks=0 is not even the default. acks=1 is — and that is ALSO unsafe if the leader crashes before replication.',
    endQuestion: 'Are you acks=all or acks=1? Comment below.',
    title: '90% of devs get Kafka acks WRONG',
  },
  {
    topic: 'kafka',
    hookText: 'This Kafka mistake\ncosts $10M+',
    spokenHook: 'This one Kafka configuration mistake has cost companies over ten million dollars.',
    question: 'What happens when a Kafka consumer dies mid-batch without committing offsets?',
    options: ['Messages are lost', 'Messages are reprocessed', 'Kafka auto-commits'],
    correctIndex: 1,
    explanation: 'Messages get reprocessed. Kafka tracks consumer progress via offsets. If you crash before committing, the next consumer in the group picks up from the last committed offset — replaying everything. This is called at-least-once delivery. Uber lost trip data in 2019 because of this exact issue.',
    twist: 'Here is the part nobody tells you: auto-commit is ON by default. Every 5 seconds. So your "safe" consumer is actually committing offsets for messages you have not finished processing.',
    endQuestion: 'Did you know about auto-commit? Comment YES or NO.',
    title: 'This Kafka bug cost Uber $10M',
  },
  {
    topic: 'kafka',
    hookText: 'Your Kafka is\nsilently losing data',
    spokenHook: 'Your Kafka setup is silently losing data right now and you have no idea.',
    question: 'What does min.insync.replicas=1 actually mean?',
    options: ['At least 1 replica must confirm', 'Only the leader confirms', 'All replicas confirm'],
    correctIndex: 1,
    explanation: 'It means only the leader needs to be alive. If the leader crashes after acknowledging but before replicating, your message is gone. LinkedIn sets min.insync.replicas=2 and acks=all on every production topic. Three config lines separate data safety from data loss.',
    twist: 'Most Kafka tutorials on YouTube teach you the WRONG defaults. They show you acks=1 and never mention min.insync.replicas.',
    endQuestion: 'Check your Kafka config right now. What is your min.insync.replicas?',
    title: '90% of Kafka setups are LOSING data silently',
  },
  {
    topic: 'kafka',
    hookText: 'Google asked me\nthis in round 2',
    spokenHook: 'Google asked me this exact Kafka question in the second round of my system design interview.',
    question: 'How does Kafka achieve ordering guarantees?',
    options: ['Global ordering across all topics', 'Per-partition ordering only', 'No ordering guarantee'],
    correctIndex: 1,
    explanation: 'Kafka only guarantees ordering within a single partition. Messages across partitions have no ordering guarantee. This is the number one mistake candidates make in system design interviews. The interviewer wants to hear: use a single partition key for related events.',
    twist: 'Here is the follow-up that trips people: if you add more partitions for throughput, you lose ordering for existing keys because of partition reassignment.',
    endQuestion: 'Would you get this right in an interview? Be honest.',
    title: 'The Kafka question Google asks in round 2',
  },
  {
    topic: 'kafka',
    hookText: 'Netflix processes\n7 TRILLION messages/day',
    spokenHook: 'Netflix processes seven trillion messages per day through Kafka. Here is the config that makes it possible.',
    question: 'What is the main bottleneck in a Kafka cluster at Netflix scale?',
    options: ['CPU on brokers', 'Disk I/O', 'Network bandwidth'],
    correctIndex: 2,
    explanation: 'At Netflix scale, network bandwidth is the bottleneck. Kafka is designed to be disk-sequential which makes I/O fast. But replicating 7 trillion messages across brokers saturates network links. Netflix solved this by putting Kafka brokers on dedicated 25Gbps network interfaces.',
    twist: 'Most teams optimize Kafka for disk speed. Netflix engineers told me: the disk is never the problem. The network always is.',
    endQuestion: 'What would you optimize first? Disk or network? Comment.',
    title: 'How Netflix handles 7 TRILLION Kafka messages/day',
  },
  {
    topic: 'kafka',
    hookText: 'Senior devs\nknow this trick',
    spokenHook: 'Senior Kafka developers all know this one trick that juniors always miss.',
    question: 'What is the purpose of the Kafka consumer group rebalance?',
    options: ['Load balance across consumers', 'Reset offsets to zero', 'Flush unread messages'],
    correctIndex: 0,
    explanation: 'Rebalancing redistributes partitions across consumers in the group. When a consumer joins or leaves, Kafka reassigns partitions to maintain even distribution. The problem: during rebalance, ALL consumers stop processing. This can take 30 seconds to several minutes.',
    twist: 'The fix most teams miss: incremental cooperative rebalancing. One config flag and your rebalance goes from 30 seconds of downtime to zero.',
    endQuestion: 'Are you using cooperative rebalancing? Comment.',
    title: '90% of Kafka teams miss this ONE config',
  },
  {
    topic: 'kafka',
    hookText: 'This interview answer\nis worth $40K/year',
    spokenHook: 'This Kafka interview answer is the difference between an L4 and L5 offer.',
    question: 'Can Kafka guarantee exactly-once delivery?',
    options: ['Yes, always', 'No, impossible', 'Yes, with specific config'],
    correctIndex: 2,
    explanation: 'Kafka can achieve exactly-once semantics but ONLY with idempotent producers enabled plus transactional APIs. The default is at-least-once. Most candidates say "Kafka is exactly-once" without knowing the configuration required. Interviewers at Amazon and Google specifically test this nuance.',
    twist: 'The real interview insight: exactly-once is between producer and broker only. End-to-end exactly-once requires your consumer to be idempotent too. That part is YOUR job, not Kafka\'s.',
    endQuestion: 'Have you ever been asked this? Comment your experience.',
    title: 'This Kafka answer is worth $40K/year',
  },
  {
    topic: 'kafka',
    hookText: 'Uber learned this\nthe hard way',
    spokenHook: 'Uber learned this Kafka lesson the hard way during a peak hour outage.',
    question: 'What happens when a Kafka topic runs out of disk space?',
    options: ['Old messages are deleted', 'New messages are rejected', 'Broker crashes'],
    correctIndex: 1,
    explanation: 'New messages get rejected with a NotEnoughReplicasException. Kafka does NOT automatically delete old messages when disk is full. The retention policy runs on a timer, not on disk pressure. Uber hit this during a surge event when log volume spiked 10x and filled the disks in 2 hours.',
    twist: 'The fix is embarrassingly simple: set log.retention.bytes alongside log.retention.hours. Time-based retention alone is a ticking time bomb.',
    endQuestion: 'Do you have log.retention.bytes set? Check now.',
    title: 'The Kafka config that crashed Uber',
  },
  {
    topic: 'kafka',
    hookText: 'Stop explaining\nKafka like this',
    spokenHook: 'If you explain Kafka as a message queue in your interview, you will get rejected.',
    question: 'What is Kafka fundamentally?',
    options: ['A message queue', 'A distributed commit log', 'A database'],
    correctIndex: 1,
    explanation: 'Kafka is a distributed commit log. Not a message queue. The key difference: messages in Kafka are NOT deleted after consumption. They persist until the retention period expires. Multiple consumer groups can read the same data independently. This is why Kafka is used for event sourcing, audit trails, and stream processing — not just message passing.',
    twist: 'Here is the mic drop answer for interviews: Kafka is closer to a database than a queue. It has persistence, replication, and consumer offsets that act like cursors.',
    endQuestion: 'Message queue or commit log? Comment your answer.',
    title: '90% of devs explain Kafka WRONG in interviews',
  },
  {
    topic: 'kafka',
    hookText: 'Amazon asks this\nin EVERY system design',
    spokenHook: 'Amazon asks this Kafka question in every single system design interview.',
    question: 'How would you handle message ordering across multiple partitions?',
    options: ['You cannot', 'Use a global sequence number', 'Use consistent hashing on a key'],
    correctIndex: 2,
    explanation: 'Use a consistent partition key. All events for the same entity — same user, same order, same transaction — go to the same partition. Within that partition, ordering is guaranteed. This is the answer Amazon interviewers want: you do not need global ordering. You need entity-level ordering via partition keys.',
    twist: 'The follow-up trap: "What if one partition gets all the traffic?" The answer: custom partitioner that spreads hot keys across sub-partitions with a sequence number for reassembly.',
    endQuestion: 'Could you answer the follow-up? Comment.',
    title: 'The Kafka question Amazon asks EVERY time',
  },
  {
    topic: 'kafka',
    hookText: 'Your lag is\na TICKING BOMB',
    spokenHook: 'If your Kafka consumer lag is growing, you have a ticking time bomb.',
    question: 'What does growing consumer lag indicate?',
    options: ['Network issues', 'Consumer is slower than producer', 'Kafka is dropping messages'],
    correctIndex: 1,
    explanation: 'Consumer lag means your consumer cannot keep up with the rate of incoming messages. The lag number is the count of unprocessed messages. If it keeps growing, you will eventually hit retention limits and LOSE data. This is the number one operational metric for Kafka that most teams ignore.',
    twist: 'The counterintuitive fix: adding more consumers does NOT always help. If you have fewer consumers than partitions, add consumers. If you have equal consumers and partitions, you need to optimize processing speed or add partitions.',
    endQuestion: 'Do you monitor consumer lag? Comment YES or NO.',
    title: '90% of Kafka teams ignore THIS critical metric',
  },
  {
    topic: 'kafka',
    hookText: 'LinkedIn built Kafka\nbecause of THIS',
    spokenHook: 'LinkedIn built Kafka in 2010 because no existing system could solve this one problem.',
    question: 'Why did LinkedIn build Kafka instead of using RabbitMQ?',
    options: ['RabbitMQ was too slow', 'They needed replay capability', 'RabbitMQ was too expensive'],
    correctIndex: 1,
    explanation: 'LinkedIn needed the ability to REPLAY messages. Traditional message queues delete messages after delivery. LinkedIn needed multiple teams to independently consume the same activity feed data at their own pace. This is the fundamental insight: Kafka decouples producers from consumers with a persistent log that any number of consumers can read.',
    twist: 'RabbitMQ is actually FASTER than Kafka for single-consumer scenarios. Kafka wins when you have multiple consumers reading the same stream. If you only have one consumer, RabbitMQ is the better choice.',
    endQuestion: 'Kafka or RabbitMQ for your use case? Comment.',
    title: 'Why LinkedIn BUILT Kafka (not what you think)',
  },

  // ── API GATEWAY (6 questions) ─────────────────────────────────────
  {
    topic: 'api-gateway',
    hookText: '90% of devs\nget this WRONG',
    spokenHook: 'Ninety percent of developers get API Gateway wrong in interviews.',
    question: 'What is the PRIMARY purpose of an API Gateway?',
    options: ['Load balancing', 'Single entry point + cross-cutting concerns', 'Database caching'],
    correctIndex: 1,
    explanation: 'An API Gateway is a single entry point that handles cross-cutting concerns: authentication, rate limiting, logging, request routing, and protocol translation. It is NOT a load balancer. Google, Amazon, and Netflix all have dedicated API Gateways separate from their load balancers. Confusing the two is the fastest way to fail a system design interview.',
    twist: 'Hot take: most startups do NOT need an API Gateway. A simple reverse proxy with 20 lines of nginx config does 90% of what Kong or AWS API Gateway does. The API Gateway industry is built on over-engineering.',
    endQuestion: 'Do you use an API Gateway? Or is nginx enough? Comment.',
    title: '90% of devs get API Gateway WRONG',
  },
  {
    topic: 'api-gateway',
    hookText: 'Netflix API Gateway\nhandles 2B requests/day',
    spokenHook: 'Netflix API Gateway Zuul handles over 2 billion requests per day. Here is how.',
    question: 'What pattern does Netflix use for its API Gateway?',
    options: ['Backend for Frontend', 'Service Mesh', 'Direct client-to-service'],
    correctIndex: 0,
    explanation: 'Netflix uses the Backend for Frontend pattern. Each client type — iOS, Android, TV, web — gets its own API Gateway instance that assembles responses from multiple microservices. This means the mobile app gets a compact response while the TV app gets a rich one. Same backend services, different API shapes per client.',
    twist: 'Netflix open-sourced Zuul but then replaced it internally with a custom solution because Zuul could not handle their scale. The open source version is literally the version they STOPPED using.',
    endQuestion: 'Are you still using Zuul? Comment.',
    title: 'How Netflix handles 2 BILLION API requests/day',
  },
  {
    topic: 'api-gateway',
    hookText: 'Stripe rejected me\nbecause of THIS',
    spokenHook: 'Stripe rejected me because I could not explain API Gateway rate limiting properly.',
    question: 'Where should rate limiting be implemented in a microservices architecture?',
    options: ['In each microservice', 'At the API Gateway', 'In the database layer'],
    correctIndex: 1,
    explanation: 'Rate limiting belongs at the API Gateway. It is the single entry point, so it can enforce global limits before requests even reach your services. If you rate-limit inside each microservice, a DDoS attack still consumes network bandwidth and connection pools across all services. Stripe processes billions of API calls and their gateway rejects bad traffic in under 1 millisecond.',
    twist: 'The advanced answer Stripe wants: you need BOTH. Gateway-level for global protection, and service-level for tenant isolation. One without the other leaves a gap.',
    endQuestion: 'Where do you rate limit? Gateway or service? Comment.',
    title: 'Stripe rejected me because of THIS API answer',
  },
  {
    topic: 'api-gateway',
    hookText: 'API Gateway vs\nService Mesh — WRONG answer',
    spokenHook: 'If you confuse API Gateway with Service Mesh, your interview is over.',
    question: 'What is the key difference between an API Gateway and a Service Mesh?',
    options: ['No difference — same thing', 'Gateway is north-south, Mesh is east-west', 'Mesh is for external traffic only'],
    correctIndex: 1,
    explanation: 'API Gateway handles north-south traffic — requests coming from external clients into your system. Service Mesh handles east-west traffic — communication between internal microservices. Istio, Linkerd, and Consul Connect are service meshes. Kong, AWS API Gateway, and Zuul are API Gateways. Google Cloud uses both: Cloud Endpoints for the gateway and Istio for the mesh.',
    twist: 'Here is what trips senior engineers: some API Gateways like Kong now include service mesh features. The boundary is blurring. In 2 years this distinction might not exist.',
    endQuestion: 'Do you use a service mesh? Or just an API Gateway? Comment.',
    title: 'API Gateway vs Service Mesh — 90% get this WRONG',
  },
  {
    topic: 'api-gateway',
    hookText: 'This Gateway pattern\nsaved Amazon $2M/year',
    spokenHook: 'This one API Gateway pattern saved an Amazon team over two million dollars a year.',
    question: 'What is the Gateway Aggregation pattern?',
    options: ['Combining multiple APIs into one endpoint', 'Load balancing across gateways', 'Caching API responses'],
    correctIndex: 0,
    explanation: 'Gateway Aggregation combines multiple backend calls into a single client request. Instead of the mobile app making 5 API calls to load a dashboard, the gateway makes all 5 calls internally and returns one merged response. This reduces mobile round trips from 5 to 1, cutting latency by 80% on slow networks. Amazon uses this for their product page — one API call assembles data from 15 different services.',
    twist: 'The trap: if you aggregate too aggressively, your gateway becomes a monolith. Amazon calls this the "God Gateway" anti-pattern. The rule: aggregate for the client, never for business logic.',
    endQuestion: 'How many API calls does your app make per screen? Comment the number.',
    title: 'This API pattern saved Amazon $2M per year',
  },
  {
    topic: 'api-gateway',
    hookText: 'Your API Gateway\nis a SINGLE POINT of failure',
    spokenHook: 'Your API Gateway is a single point of failure and you probably have not noticed.',
    question: 'How do you make an API Gateway highly available?',
    options: ['Just add more instances', 'Active-passive failover', 'Multiple instances behind a load balancer'],
    correctIndex: 2,
    explanation: 'You put multiple API Gateway instances behind a load balancer or DNS round-robin. If one gateway instance dies, the load balancer routes to another. AWS API Gateway does this automatically — it runs across multiple availability zones. But if you self-host Kong or Zuul, you MUST set this up yourself. Most teams deploy a single gateway instance and pray.',
    twist: 'The irony: you need a load balancer in front of your API Gateway, which is supposed to replace your load balancer. This is why cloud-managed gateways exist — they hide this complexity.',
    endQuestion: 'Is your API Gateway highly available? Be honest. Comment.',
    title: 'Your API Gateway is a SINGLE POINT of failure',
  },

  // ── LOAD BALANCING (5 questions) ──────────────────────────────────
  {
    topic: 'load-balancing',
    hookText: 'Round robin is\nKILLING your servers',
    spokenHook: 'If you are using round-robin load balancing, you are killing your servers.',
    question: 'Why does round-robin load balancing fail at scale?',
    options: ['It is too slow', 'It ignores server health', 'It requires too much memory'],
    correctIndex: 1,
    explanation: 'Round robin sends requests to each server in order regardless of whether that server is healthy, overloaded, or processing a slow request. At scale, this creates hot spots. One slow server gets the same traffic as fast ones, causing cascading failures. Google uses weighted round-robin with health checks. The weight changes based on real-time server response times.',
    twist: 'The algorithm that beats everything for most use cases: least connections. Two words. It automatically routes to the server with the fewest active connections. No configuration needed.',
    endQuestion: 'What load balancing algorithm do you use? Comment.',
    title: '90% of devs use the WRONG load balancing algorithm',
  },
  {
    topic: 'load-balancing',
    hookText: 'L4 vs L7 —\nthis answer is worth $50K',
    spokenHook: 'The difference between L4 and L7 load balancing is a fifty thousand dollar interview answer.',
    question: 'When should you use Layer 7 load balancing instead of Layer 4?',
    options: ['Always — L7 is better', 'When you need content-based routing', 'When you need maximum throughput'],
    correctIndex: 1,
    explanation: 'Layer 7 inspects HTTP headers, cookies, and URLs to make routing decisions. Route /api/users to the user service and /api/orders to the order service — that is L7. Layer 4 only sees IP and port — it is faster but dumb. Netflix uses L7 for its API traffic and L4 for internal service communication where speed matters more than routing intelligence.',
    twist: 'The counterintuitive truth: L4 load balancers handle 10x more connections per second than L7. If you do not need content-based routing, L7 is wasting CPU cycles inspecting every packet.',
    endQuestion: 'L4 or L7 for your API? Comment your choice.',
    title: 'L4 vs L7 load balancing — this answer is worth $50K',
  },
  {
    topic: 'load-balancing',
    hookText: 'Google uses THIS\nnot round robin',
    spokenHook: 'Google does not use round robin. They use a load balancing algorithm most devs have never heard of.',
    question: 'What load balancing algorithm does Google use internally?',
    options: ['Least connections', 'Weighted round robin with subsetting', 'Random selection'],
    correctIndex: 1,
    explanation: 'Google uses weighted round robin with subsetting. Each client only knows about a subset of backends, reducing connection overhead. The weights change dynamically based on backend health, CPU, and queue depth. Google published this in their Maglev paper. It handles millions of requests per second across their global network.',
    twist: 'The real insight from Google: the load balancing algorithm matters less than health checking. A bad algorithm with great health checks beats a great algorithm with no health checks every time.',
    endQuestion: 'Have you read the Maglev paper? Comment YES or NO.',
    title: 'The load balancing algorithm Google actually uses',
  },
  {
    topic: 'load-balancing',
    hookText: 'Sticky sessions\nare a TRAP',
    spokenHook: 'If you are using sticky sessions, you have fallen into a trap most architects never escape.',
    question: 'Why are sticky sessions considered an anti-pattern?',
    options: ['They are too slow', 'They prevent horizontal scaling', 'They use too much memory'],
    correctIndex: 1,
    explanation: 'Sticky sessions tie a user to a specific server. If that server dies, the user loses their session. If one server gets all the power users, it becomes overloaded while others sit idle. You cannot add or remove servers without disrupting users. Amazon moved away from sticky sessions in 2012 by externalizing session state to Redis.',
    twist: 'The dirty secret: most teams use sticky sessions because their app stores state in memory. The fix is not a better load balancer — it is making your app stateless. But nobody wants to refactor.',
    endQuestion: 'Are your apps stateless? Or still using sticky sessions? Comment.',
    title: 'Sticky sessions are a TRAP — here is why',
  },
  {
    topic: 'load-balancing',
    hookText: 'Discord handles\n15M concurrent users',
    spokenHook: 'Discord handles fifteen million concurrent users. Their load balancing secret is surprisingly simple.',
    question: 'How does Discord distribute WebSocket connections across servers?',
    options: ['Round robin', 'Consistent hashing on user ID', 'Random assignment'],
    correctIndex: 1,
    explanation: 'Discord uses consistent hashing on guild ID to route WebSocket connections. All users in the same server land on the same backend node, making message broadcasting efficient. When a node is added or removed, consistent hashing only moves a fraction of connections instead of reshuffling everything. This is how they maintain real-time messaging for millions of concurrent users.',
    twist: 'Regular load balancing would scatter guild members across all nodes, requiring cross-node communication for every single message. Consistent hashing turns an O(N) broadcast into an O(1) local delivery.',
    endQuestion: 'Have you used consistent hashing in production? Comment.',
    title: 'How Discord handles 15M concurrent users',
  },

  // ── DATABASE (5 questions) ────────────────────────────────────────
  {
    topic: 'database',
    hookText: 'This SQL mistake\ncrashed GitLab',
    spokenHook: 'This one SQL mistake crashed GitLab and deleted six hours of production data.',
    question: 'What did GitLab accidentally run on their production database in 2017?',
    options: ['DROP TABLE users', 'DELETE FROM projects WHERE true', 'rm -rf on the data directory'],
    correctIndex: 2,
    explanation: 'A tired engineer ran rm-rf on the production database directory at 11pm trying to fix replication lag. The backups? Five different backup methods, ALL broken. LVM snapshots — not configured. Regular pg_dump — silently failing for months. Azure disk snapshots — only took one 6 hours ago. GitLab lost 6 hours of data and live-streamed the recovery on YouTube.',
    twist: 'The real lesson is not "do not run rm." It is: test your backups. GitLab had FIVE backup systems and NONE worked. If you have not restored from backup in the last 30 days, you do not have backups. You have hopes.',
    endQuestion: 'When did you last test your backups? Be honest. Comment.',
    title: 'The SQL mistake that DESTROYED GitLab',
  },
  {
    topic: 'database',
    hookText: 'INDEX everything?\nThat is WRONG',
    spokenHook: 'If your strategy is to index everything, you are making your database slower, not faster.',
    question: 'Why can too many indexes hurt database performance?',
    options: ['Indexes use too much RAM', 'Every write must update every index', 'Indexes corrupt data'],
    correctIndex: 1,
    explanation: 'Every INSERT, UPDATE, and DELETE must update every index on that table. A table with 10 indexes means every single write does 10 additional B-tree modifications. Shopify found that removing unused indexes on their orders table improved write throughput by 40 percent. Reads get faster with indexes, but writes get slower — linearly with the number of indexes.',
    twist: 'The rule of thumb: if an index is used in less than 5 percent of your queries, drop it. PostgreSQL has pg_stat_user_indexes that shows exactly which indexes are unused. Most teams have never checked.',
    endQuestion: 'How many indexes does your biggest table have? Comment the number.',
    title: '90% of devs use database indexes WRONG',
  },
  {
    topic: 'database',
    hookText: 'SQL vs NoSQL —\nthe answer that got me hired',
    spokenHook: 'This SQL versus NoSQL answer is the one that got me hired at a FAANG company.',
    question: 'When should you choose NoSQL over a relational database?',
    options: ['When you need ACID transactions', 'When your schema changes frequently', 'When you have complex joins'],
    correctIndex: 1,
    explanation: 'NoSQL shines when your data model is evolving rapidly — think early-stage startups or event logging where the schema changes weekly. MongoDB, DynamoDB, and Cassandra let you add fields without migrations. But the moment you need complex joins or strict consistency, you want PostgreSQL. Instagram started on PostgreSQL and STILL uses it at 2 billion users.',
    twist: 'The hot take that wins interviews: most teams that chose NoSQL regret it within 2 years. They trade schema flexibility for a nightmare of data consistency bugs. Start with PostgreSQL. Move to NoSQL only when PostgreSQL cannot handle your specific access pattern.',
    endQuestion: 'SQL or NoSQL for your next project? Comment.',
    title: 'SQL vs NoSQL — the answer that got me into FAANG',
  },
  {
    topic: 'database',
    hookText: 'This N+1 query\ncrashed production',
    spokenHook: 'This one N plus 1 query brought down a production database serving ten million users.',
    question: 'What is the N+1 query problem?',
    options: ['Running N queries in a loop instead of one JOIN', 'Having N+1 database connections', 'A query that returns N+1 rows'],
    correctIndex: 0,
    explanation: 'The N+1 problem: you fetch a list of 100 orders with 1 query, then fetch each order\'s items with 100 separate queries. That is 101 queries instead of 1 query with a JOIN. GitHub discovered N+1 queries were responsible for 70 percent of their slow pages. Each query is fast individually but 100 round trips to the database adds up to seconds of latency.',
    twist: 'ORMs are the biggest N+1 offender. Rails Active Record, Django ORM, and Hibernate all make it trivially easy to write N+1 queries without realizing it. The ORM hides the SQL, which hides the problem.',
    endQuestion: 'Have you been bitten by N+1 queries? Comment your worst story.',
    title: 'The N+1 query that crashed GitHub',
  },
  {
    topic: 'database',
    hookText: 'Amazon banned\nDELETE in production',
    spokenHook: 'Amazon banned the DELETE statement in production databases. Here is why.',
    question: 'What is the safer alternative to DELETE in production systems?',
    options: ['TRUNCATE', 'Soft delete with a deleted_at column', 'DROP and recreate'],
    correctIndex: 1,
    explanation: 'Soft delete marks records with a deleted_at timestamp instead of physically removing them. The data is still there if you need to recover it. Amazon, Stripe, and most fintech companies mandate soft deletes for audit trails and regulatory compliance. A hard DELETE is irreversible — if you delete the wrong records, your only hope is a backup that might be hours old.',
    twist: 'The cost of soft deletes: your table grows forever. Stripe runs a background job that hard-deletes soft-deleted records older than 90 days. Without this, their largest tables would be 60 percent deleted rows — wasting storage and slowing queries.',
    endQuestion: 'Soft delete or hard delete? What does your team use? Comment.',
    title: 'Amazon BANNED the DELETE statement — here is why',
  },

  // ── MICROSERVICES (5 questions) ───────────────────────────────────
  {
    topic: 'microservices',
    hookText: 'Amazon rejected me\nfor THIS answer',
    spokenHook: 'Amazon rejected me in the system design round because of this one microservices mistake.',
    question: 'What is the biggest risk of synchronous communication between microservices?',
    options: ['High latency', 'Cascading failures', 'Data duplication'],
    correctIndex: 1,
    explanation: 'Synchronous calls create tight coupling. If Service A calls Service B which calls Service C, and C goes down, the failure cascades back through B to A. Your entire system fails because ONE service is down. Amazon learned this when a single internal service outage took down the entire checkout flow in 2012. They now mandate async communication for non-critical paths.',
    twist: 'The solution is not "make everything async." The real answer: use the circuit breaker pattern. When Service C fails, Service B returns a degraded response instead of failing. Netflix invented Hystrix for exactly this — and it saved them from thousands of cascading outages.',
    endQuestion: 'Do you use circuit breakers? Comment YES or NO.',
    title: 'Amazon rejected me for THIS microservices answer',
  },
  {
    topic: 'microservices',
    hookText: 'Monolith beats\nmicroservices — PROOF',
    spokenHook: 'A monolith beats microservices for ninety percent of teams. Here is the proof.',
    question: 'What did Amazon Prime Video do that shocked the industry in 2023?',
    options: ['Migrated to serverless', 'Moved from microservices back to monolith', 'Adopted Kubernetes'],
    correctIndex: 1,
    explanation: 'Amazon Prime Video moved their video monitoring service from microservices back to a monolith and reduced costs by 90 percent. The microservices version had so much inter-service communication overhead that it was 10x more expensive. The monolith processed the same workload on a single instance. This made headlines because it came from AMAZON — the company that popularized microservices.',
    twist: 'The lesson is NOT "monoliths are better." The lesson is: microservices are a SCALING solution, not a starting solution. If your team is under 50 engineers, a monolith is almost certainly the right choice.',
    endQuestion: 'Monolith or microservices for YOUR team size? Comment.',
    title: 'Amazon MOVED BACK to a monolith — here is why',
  },
  {
    topic: 'microservices',
    hookText: 'Distributed transactions\nare a LIE',
    spokenHook: 'Distributed transactions across microservices are a lie that architects tell themselves.',
    question: 'How do you handle transactions that span multiple microservices?',
    options: ['Two-phase commit', 'Saga pattern', 'Just use a single database'],
    correctIndex: 1,
    explanation: 'The Saga pattern breaks a distributed transaction into a sequence of local transactions. Each service completes its part and publishes an event. If one step fails, compensating transactions undo the previous steps. Uber uses Sagas for their ride booking — payment, matching, notification each run independently. If payment fails, the ride is cancelled with a compensating action.',
    twist: 'Two-phase commit sounds correct but it is a death trap at scale. It locks resources across all services until everyone agrees. One slow service and your entire system freezes. Google abandoned 2PC for Sagas in their internal payment systems.',
    endQuestion: 'Sagas or 2PC? Comment what you use.',
    title: 'Distributed transactions are a LIE',
  },
  {
    topic: 'microservices',
    hookText: 'Netflix has 1000+\nmicroservices — this is how',
    spokenHook: 'Netflix runs over one thousand microservices. This one pattern makes it possible.',
    question: 'How does Netflix allow each microservice team to deploy independently?',
    options: ['Shared database for all services', 'Each service owns its data', 'Central deployment queue'],
    correctIndex: 1,
    explanation: 'Database per service. Each microservice owns its data and exposes it only through APIs. No direct database access from other services. This means the user service can migrate from MySQL to PostgreSQL without any other team knowing or caring. Netflix enforces this rule strictly — if you access another team\'s database directly, your code review is rejected.',
    twist: 'The hidden cost: data duplication. Netflix has the same user data copied across dozens of services. They accept this because the alternative — a shared database — means one team\'s bad query can take down everyone.',
    endQuestion: 'Does your team share databases across services? Comment honestly.',
    title: 'How Netflix manages 1000+ microservices',
  },
  {
    topic: 'microservices',
    hookText: 'This pattern makes\nor breaks your career',
    spokenHook: 'This microservices pattern is the one that makes or breaks your system design interview.',
    question: 'What is the Strangler Fig pattern?',
    options: ['Gradually replace a monolith with microservices', 'Kill failing microservices automatically', 'Route traffic away from slow services'],
    correctIndex: 0,
    explanation: 'The Strangler Fig pattern incrementally replaces a monolith by routing specific endpoints to new microservices while the old monolith continues handling everything else. Over months, more and more traffic moves to microservices until the monolith is empty. Shopify used this to migrate their Rails monolith — it took 3 years but had zero downtime throughout.',
    twist: 'Most teams try "big bang" rewrites and fail. The Strangler Fig works because you can stop at any point and still have a working system. If the new service is worse, just route traffic back. Zero risk.',
    endQuestion: 'Are you mid-migration right now? Comment your progress.',
    title: 'This pattern makes or breaks your system design interview',
  },

  // ── DOCKER (4 questions) ──────────────────────────────────────────
  {
    topic: 'docker',
    hookText: 'Your Docker image\nis 10x too big',
    spokenHook: 'Your Docker image is probably ten times bigger than it needs to be.',
    question: 'What is the most effective way to reduce Docker image size?',
    options: ['Use Alpine base image', 'Multi-stage builds', 'Compress the image'],
    correctIndex: 1,
    explanation: 'Multi-stage builds use one stage to compile your code and a second minimal stage to run it. The build tools, source code, and dependencies are left behind in the first stage. Google reduced their Go service images from 1.2GB to 12MB using multi-stage builds. The production image contains ONLY the compiled binary and nothing else.',
    twist: 'Alpine seems like the answer but it uses musl libc instead of glibc. This causes subtle bugs in Node.js, Python, and Java applications. Google and Distroless images are safer choices for production than Alpine.',
    endQuestion: 'What is your smallest Docker image? Comment the size.',
    title: 'Your Docker image is 10x TOO BIG',
  },
  {
    topic: 'docker',
    hookText: 'Running as ROOT\nin Docker? FIRED.',
    spokenHook: 'If your Docker containers run as root, you should be fired. Here is why.',
    question: 'Why should you never run Docker containers as root?',
    options: ['It uses more memory', 'Container escape gives full host access', 'Root is slower'],
    correctIndex: 1,
    explanation: 'If an attacker escapes a container running as root, they get root access to the HOST machine. Container escapes are real — CVE-2019-5736 allowed exactly this in runc. Every major cloud provider was affected. The fix: add USER nonroot to your Dockerfile. Three words that prevent a catastrophic security breach. Stripe mandates non-root containers in every service.',
    twist: 'The default Docker behavior is to run as root. Every Docker tutorial that does not include a USER instruction is teaching you to build insecure containers. That is most tutorials on YouTube.',
    endQuestion: 'Check your Dockerfiles right now. Running as root? Comment.',
    title: 'Running as ROOT in Docker will get you FIRED',
  },
  {
    topic: 'docker',
    hookText: 'Docker layer caching\nsaves 10 minutes per build',
    spokenHook: 'This Docker layer caching trick saves ten minutes on every single build.',
    question: 'What is the most common Docker layer caching mistake?',
    options: ['Not using .dockerignore', 'COPY . . before installing dependencies', 'Using too many RUN commands'],
    correctIndex: 1,
    explanation: 'If you COPY your entire source code before running npm install, EVERY code change invalidates the dependency cache. The fix: COPY package.json first, run npm install, THEN copy the source code. Dependencies are cached until package.json changes. Shopify cut their CI build times from 12 minutes to 2 minutes with this one reorder.',
    twist: 'This applies to every language. Python: copy requirements.txt first. Go: copy go.mod first. Java: copy pom.xml first. The pattern is universal but most Dockerfile tutorials get the order wrong.',
    endQuestion: 'What is your Docker build time? Comment in minutes.',
    title: 'This Docker trick saves 10 MINUTES per build',
  },
  {
    topic: 'docker',
    hookText: 'Docker Compose\nvs Kubernetes — SETTLED',
    spokenHook: 'Docker Compose versus Kubernetes. This debate is finally settled.',
    question: 'When should you use Docker Compose instead of Kubernetes?',
    options: ['Never — Kubernetes is always better', 'Single-host development and small deployments', 'Only for testing'],
    correctIndex: 1,
    explanation: 'Docker Compose is for single-host deployments and local development. If your app runs on one server with under 10 containers, Compose is simpler and faster. Kubernetes is for multi-host orchestration with auto-scaling, self-healing, and rolling deployments. Using Kubernetes for a 3-container app is like driving a semi-truck to pick up groceries.',
    twist: 'Here is the truth nobody admits: most startups that adopted Kubernetes too early spent more time managing Kubernetes than building their product. Basecamp runs a multi-million dollar business on Docker Compose. Not everything needs Kubernetes.',
    endQuestion: 'Compose or Kubernetes? Comment what you use in production.',
    title: 'Docker Compose vs Kubernetes — finally SETTLED',
  },

  // ── KUBERNETES (4 questions) ──────────────────────────────────────
  {
    topic: 'kubernetes',
    hookText: 'Your pods are\ncrashing — here is why',
    spokenHook: 'Your Kubernetes pods are crashing and you do not know the real reason.',
    question: 'What is the most common cause of Kubernetes OOMKilled errors?',
    options: ['Memory leak in the app', 'Resource limits set too low', 'Node ran out of memory'],
    correctIndex: 1,
    explanation: 'OOMKilled usually means your container hit its memory LIMIT, not that the node is out of memory. Most teams copy-paste resource limits from examples without profiling their actual usage. A Java app with a 512MB heap needs at least 768MB as the container limit because the JVM uses extra memory for thread stacks, GC, and native code. Spotify reduced OOMKills by 80 percent by right-sizing limits based on actual metrics.',
    twist: 'The counterintuitive fix: REMOVE memory limits entirely in development. Let your app use what it needs, observe the real usage with metrics, THEN set limits 20 percent above the observed peak. Most teams do it backwards.',
    endQuestion: 'How did you set your resource limits? Guessing or metrics? Comment.',
    title: 'Why your Kubernetes pods keep CRASHING',
  },
  {
    topic: 'kubernetes',
    hookText: 'Google rejected me\nfor THIS K8s answer',
    spokenHook: 'Google rejected me because I could not explain the difference between a Deployment and a StatefulSet.',
    question: 'When should you use a StatefulSet instead of a Deployment in Kubernetes?',
    options: ['For any production workload', 'When pods need stable network identity and persistent storage', 'When you need more than 3 replicas'],
    correctIndex: 1,
    explanation: 'StatefulSets give each pod a stable hostname like mysql-0, mysql-1 and persistent storage that follows the pod across rescheduling. Databases, Kafka brokers, and ZooKeeper nodes need this because they must know WHO they are and WHERE their data is. A Deployment treats all pods as identical and interchangeable — perfect for stateless web servers, wrong for anything that stores data.',
    twist: 'The expert answer: avoid running databases in Kubernetes entirely. Use managed services like RDS or Cloud SQL. Running PostgreSQL on Kubernetes is possible but you are now a database operator AND a Kubernetes operator. Most teams do not have the expertise for both.',
    endQuestion: 'Do you run databases in Kubernetes? Comment YES or NO.',
    title: 'Google rejected me for THIS Kubernetes answer',
  },
  {
    topic: 'kubernetes',
    hookText: 'Kubernetes autoscaling\nis LYING to you',
    spokenHook: 'Kubernetes autoscaling is lying to you and your production traffic is suffering.',
    question: 'Why does Kubernetes Horizontal Pod Autoscaler often scale too late?',
    options: ['It only checks every 30 seconds', 'It waits for 3 minutes of sustained load', 'It scales based on average, not peak CPU'],
    correctIndex: 2,
    explanation: 'HPA uses AVERAGE CPU across all pods. If 3 out of 10 pods are at 100 percent and 7 are at 20 percent, the average is 44 percent — below the default 50 percent threshold. No scaling happens while 3 pods are overloaded. Discord solved this by using custom metrics — requests per second per pod instead of CPU. This scales on actual demand, not a misleading average.',
    twist: 'Even worse: HPA has a default cooldown of 5 minutes for scale-down. During a traffic spike, it scales up fast but then keeps those expensive pods running for 5 minutes after traffic drops. Your cloud bill thanks you.',
    endQuestion: 'What metrics do you scale on? CPU or custom? Comment.',
    title: 'Kubernetes autoscaling is LYING to you',
  },
  {
    topic: 'kubernetes',
    hookText: 'This K8s secret\ncost a startup $500K',
    spokenHook: 'This one Kubernetes secret management mistake cost a startup half a million dollars.',
    question: 'Why are Kubernetes Secrets not actually secret by default?',
    options: ['They are stored in plain text', 'They are only base64 encoded, not encrypted', 'They are visible to all namespaces'],
    correctIndex: 1,
    explanation: 'Kubernetes Secrets are base64 encoded, not encrypted. Anyone with etcd access or API access can read them in plain text. Base64 is an encoding, not encryption — it takes one command to decode. A startup stored their Stripe API keys in K8s Secrets, an engineer exported the cluster state for debugging, committed it to GitHub, and leaked production payment credentials. Cost: $500K in fraudulent charges.',
    twist: 'The fix: enable etcd encryption at rest and use an external secret manager like HashiCorp Vault or AWS Secrets Manager. But here is the kicker: even with encryption, anyone with kubectl access can still read Secrets via the API. RBAC is your real security layer.',
    endQuestion: 'Are your K8s secrets encrypted at rest? Check now. Comment.',
    title: 'Kubernetes Secrets are NOT actually secret',
  },

  // ── REDIS / CACHING (4 questions) ─────────────────────────────────
  {
    topic: 'redis',
    hookText: 'Your cache is\nSERVING STALE DATA',
    spokenHook: 'Your cache is serving stale data right now and your users are seeing wrong information.',
    question: 'What is the Cache Invalidation problem and why is it so hard?',
    options: ['Caches use too much memory', 'Knowing WHEN to update the cache after data changes', 'Caches are too slow'],
    correctIndex: 1,
    explanation: 'Cache invalidation means keeping your cache consistent with your database. When data changes, do you update the cache immediately? What if the update fails? What about race conditions where two processes update the same key? Phil Karlton said: there are only two hard things in computer science — cache invalidation and naming things. Facebook spent years building a system called TAO just to solve cache consistency across their data centers.',
    twist: 'The simplest pattern that works: cache-aside with a TTL. Never update the cache — just delete the key when data changes and let the next read repopulate it. This eliminates most race conditions. Twitter uses this for their timeline cache.',
    endQuestion: 'Cache-aside or write-through? Comment your pattern.',
    title: 'Your cache is serving STALE DATA right now',
  },
  {
    topic: 'redis',
    hookText: 'Redis is single-threaded\nbut BEATS everything',
    spokenHook: 'Redis is single-threaded but it beats every multi-threaded database. Here is why.',
    question: 'Why is single-threaded Redis faster than multi-threaded databases for caching?',
    options: ['It uses less memory', 'No context switching or lock contention', 'It compresses data better'],
    correctIndex: 1,
    explanation: 'A single thread means zero lock contention, zero context switches, and zero synchronization overhead. Redis handles 100K operations per second on a single core. Multi-threaded databases spend significant CPU time on locks and thread coordination. Discord uses Redis for presence data — tracking which of their 150 million users are online — because the single-threaded model gives them predictable microsecond latency.',
    twist: 'Redis 7 actually added multi-threading — but only for network I/O, not for command execution. The core logic is still single-threaded. This is the best of both worlds: fast networking without lock contention on data operations.',
    endQuestion: 'Did you know Redis added multi-threading? Comment YES or NO.',
    title: 'Redis is single-threaded but FASTER than everything',
  },
  {
    topic: 'redis',
    hookText: 'This Redis mistake\ntook down Instagram',
    spokenHook: 'This Redis anti-pattern took down Instagram during a celebrity post event.',
    question: 'What is the Thundering Herd problem in Redis caching?',
    options: ['Too many Redis connections', 'All clients request the same expired key simultaneously', 'Redis runs out of memory'],
    correctIndex: 1,
    explanation: 'When a popular cache key expires, thousands of requests simultaneously miss the cache and hit the database. The database gets overwhelmed and crashes. Instagram hit this when a celebrity posted — the cached follower list expired and 50,000 requests per second hammered PostgreSQL. The fix: cache stampede protection. Only one request regenerates the cache while others wait or get a slightly stale value.',
    twist: 'An even better fix: probabilistic early expiration. Each client randomly refreshes the cache slightly BEFORE it expires. This spreads the load over time instead of creating a cliff. Redis does not do this natively — you have to implement it in your application.',
    endQuestion: 'Have you experienced thundering herd? Comment your war story.',
    title: 'This Redis mistake CRASHED Instagram',
  },
  {
    topic: 'redis',
    hookText: 'Redis as a\nDATABASE? Seriously?',
    spokenHook: 'Companies are using Redis as a primary database. This is either genius or insanity.',
    question: 'Is Redis safe to use as a primary database?',
    options: ['Yes — Redis is durable by default', 'No — Redis loses data on restart', 'Only with AOF persistence enabled'],
    correctIndex: 2,
    explanation: 'Redis can be durable with AOF — Append Only File. Every write is logged to disk. With AOF set to fsync every second, you lose at most 1 second of data on a crash. Twitter uses Redis as a primary store for their ad targeting data. But most teams use Redis with default settings which means RDB snapshots every few minutes — a crash loses ALL data since the last snapshot.',
    twist: 'The real risk is not data loss — it is cost. Redis stores everything in RAM. A 100GB dataset costs thousands per month in memory. The same data in PostgreSQL costs 10 dollars on disk. Use Redis for hot data only, not as a general-purpose database.',
    endQuestion: 'Would you trust Redis as your primary database? Comment.',
    title: 'Redis as a DATABASE — genius or insanity?',
  },

  // ── SYSTEM DESIGN INTERVIEW (5 questions) ─────────────────────────
  {
    topic: 'system-design',
    hookText: 'Design Twitter —\nthe answer that got me L5',
    spokenHook: 'This Design Twitter answer is the one that got me an L5 offer at a top tech company.',
    question: 'In designing Twitter, what is the most critical architectural decision?',
    options: ['Choice of database', 'Fan-out on write vs fan-out on read', 'Which programming language to use'],
    correctIndex: 1,
    explanation: 'Fan-out on write pre-computes every user\'s timeline when a tweet is posted. Fan-out on read assembles the timeline at request time by querying all followed users. Twitter uses BOTH — fan-out on write for normal users and fan-out on read for celebrities with millions of followers. Pre-computing timelines for a celebrity with 50 million followers would be insanely expensive.',
    twist: 'The follow-up that separates L4 from L5: "What about a celebrity retweeting another celebrity?" This creates a fan-out explosion. Twitter solved it with a hybrid approach and real-time ranking that most candidates never mention.',
    endQuestion: 'Fan-out on write or read? Comment your answer.',
    title: 'Design Twitter — the answer worth an L5 offer',
  },
  {
    topic: 'system-design',
    hookText: 'Design URL Shortener —\n90% miss THIS',
    spokenHook: 'Ninety percent of candidates miss the key insight when designing a URL shortener.',
    question: 'What is the biggest challenge in designing a URL shortener like bit.ly?',
    options: ['Generating unique short codes', 'Handling redirect latency', 'Storing billions of URLs'],
    correctIndex: 0,
    explanation: 'Generating globally unique short codes at scale without collisions is the core challenge. If two servers generate the same code simultaneously, one URL overwrites the other. Solutions: pre-generate ranges of IDs per server, use base62 encoding of a distributed counter like Snowflake IDs, or use a hash with collision resolution. Bit.ly generates over 600 million links and uses a counter-based approach for guaranteed uniqueness.',
    twist: 'Most candidates jump to hashing the URL. But MD5 and SHA produce 128+ bit hashes that you truncate to 7 characters — creating collision probability. A counter is simpler, faster, and collision-free. Sometimes the boring solution is the right solution.',
    endQuestion: 'Hash or counter for short URLs? Comment your approach.',
    title: 'Design URL Shortener — 90% miss THIS insight',
  },
  {
    topic: 'system-design',
    hookText: 'Design a Rate Limiter —\nStripe asked me this',
    spokenHook: 'Stripe asked me to design a rate limiter and my answer tripled my offer.',
    question: 'Which rate limiting algorithm is best for API traffic?',
    options: ['Fixed window counter', 'Token bucket', 'Simple queue'],
    correctIndex: 1,
    explanation: 'Token bucket allows bursts while maintaining an average rate. A bucket holds N tokens and refills at a fixed rate. Each request consumes a token. If the bucket is empty, the request is rejected. AWS, Stripe, and Google all use token bucket for their public APIs. It handles bursty traffic gracefully — unlike fixed window which allows double the rate at window boundaries.',
    twist: 'The fixed window boundary problem: if your limit is 100 requests per minute and a client sends 100 requests at 0:59 and 100 more at 1:01, they sent 200 requests in 2 seconds but both windows show only 100. Sliding window or token bucket eliminates this loophole.',
    endQuestion: 'Token bucket or sliding window? Comment what you would pick.',
    title: 'The rate limiter answer that TRIPLED my Stripe offer',
  },
  {
    topic: 'system-design',
    hookText: 'Design WhatsApp —\nthe answer NO ONE gives',
    spokenHook: 'Everyone designs WhatsApp wrong in interviews. Here is the answer no one gives.',
    question: 'What is the hardest part of designing WhatsApp at scale?',
    options: ['Message delivery guarantees', 'End-to-end encryption', 'Presence tracking for 2B users'],
    correctIndex: 2,
    explanation: 'Tracking who is online right now across 2 billion users is the hardest part. Every time someone opens or closes the app, that event must propagate to all their contacts. With an average of 200 contacts, one user going online triggers 200 presence updates. Multiply by 500 million daily active users and you get 100 billion presence events per day. WhatsApp uses a heartbeat system with eventual consistency — your "last seen" might be 30 seconds stale.',
    twist: 'The reason most candidates miss this: they focus on message delivery which is a solved problem with message queues. Presence is unsolved at scale — even WhatsApp sometimes shows wrong online status. That is a feature, not a bug.',
    endQuestion: 'Did you think about presence tracking? Comment honestly.',
    title: 'Design WhatsApp — the answer NO ONE gives',
  },
  {
    topic: 'system-design',
    hookText: 'How does YouTube\nstore 800M videos?',
    spokenHook: 'YouTube stores over 800 million videos. The storage architecture is mind-blowing.',
    question: 'How does YouTube handle video storage and delivery at scale?',
    options: ['One giant server farm', 'CDN edge caching with tiered storage', 'Peer-to-peer like BitTorrent'],
    correctIndex: 1,
    explanation: 'YouTube uses tiered storage with CDN edge caching. Popular videos are cached on CDN edge servers close to users — that is why trending videos load instantly. Older or less popular videos live on cheaper cold storage and take slightly longer to load. The key insight: 80 percent of views come from 20 percent of videos. By caching only the popular ones at the edge, YouTube serves most requests without touching origin servers.',
    twist: 'YouTube also transcodes every video into dozens of formats and resolutions. A single 10-minute upload generates 20+ versions. The storage cost is not the original video — it is all the transcoded copies. This is why YouTube compression is so aggressive.',
    endQuestion: 'How would you design video storage differently? Comment.',
    title: 'How YouTube stores 800 MILLION videos',
  },

  // ── REST API (4 questions) ────────────────────────────────────────
  {
    topic: 'rest-api',
    hookText: 'Your REST API is\nNOT actually RESTful',
    spokenHook: 'Your REST API is not actually RESTful and you do not even know it.',
    question: 'What makes a REST API truly RESTful?',
    options: ['Using JSON responses', 'Using proper HTTP methods', 'Statelessness + HATEOAS + uniform interface'],
    correctIndex: 2,
    explanation: 'True REST requires statelessness, a uniform interface, HATEOAS (links in responses that guide the client), and a layered system. Most APIs that call themselves RESTful are just JSON over HTTP. They use POST for everything, ignore status codes, and have zero hypermedia links. Roy Fielding, who invented REST, has publicly said most so-called REST APIs are not REST at all.',
    twist: 'Here is the controversial truth: nobody actually implements HATEOAS. Not Google, not Amazon, not Stripe. The industry decided that "REST" means JSON plus HTTP methods plus good URL design. True REST is an academic ideal that adds complexity without much practical value for most APIs.',
    endQuestion: 'Does your API implement HATEOAS? Comment honestly.',
    title: 'Your REST API is NOT actually RESTful',
  },
  {
    topic: 'rest-api',
    hookText: 'PUT vs PATCH —\nthis mistake costs jobs',
    spokenHook: 'Confusing PUT and PATCH has cost more candidates more job offers than any other API question.',
    question: 'What is the difference between PUT and PATCH?',
    options: ['PUT updates, PATCH creates', 'PUT replaces the entire resource, PATCH updates partially', 'No difference — they are interchangeable'],
    correctIndex: 1,
    explanation: 'PUT replaces the ENTIRE resource. If you PUT a user object without the email field, the email is deleted. PATCH updates only the fields you send. Stripe API uses PATCH for updates — you can update just the customer name without touching their payment methods. Sending a PUT to the same endpoint would wipe all fields you did not include.',
    twist: 'The real interview trap: PUT is idempotent — calling it twice produces the same result. PATCH is NOT guaranteed to be idempotent. If your PATCH increments a counter, calling it twice increments twice. This nuance separates senior from junior candidates.',
    endQuestion: 'PUT or PATCH for your update endpoints? Comment.',
    title: 'PUT vs PATCH — this mistake costs JOB OFFERS',
  },
  {
    topic: 'rest-api',
    hookText: 'API versioning —\nthe wrong choice KILLS you',
    spokenHook: 'Choose the wrong API versioning strategy and your team will suffer for years.',
    question: 'What is the best practice for REST API versioning?',
    options: ['Version in the URL path', 'Version in the header', 'Never version — just evolve'],
    correctIndex: 0,
    explanation: 'URL path versioning like /v1/users and /v2/users is the most practical approach. It is visible, cacheable, and easy to understand. Stripe, GitHub, and Google Maps all use URL versioning. Header versioning is technically "more RESTful" but makes debugging harder — you cannot test different versions by changing the URL in a browser. Practicality wins over purity.',
    twist: 'The real hot take: the best versioning strategy is to NOT need versioning. Design your API to be backwards compatible from day one. Add new fields, never remove old ones. Stripe has maintained backwards compatibility since 2011 — their v1 API still works.',
    endQuestion: 'How do you version your API? Comment your strategy.',
    title: 'The API versioning choice that KILLS your team',
  },
  {
    topic: 'rest-api',
    hookText: 'REST vs GraphQL —\nthe REAL answer',
    spokenHook: 'REST versus GraphQL. The real answer is not what the hype says.',
    question: 'When should you choose GraphQL over REST?',
    options: ['Always — GraphQL is newer and better', 'When clients need flexible queries over complex data', 'When you need maximum performance'],
    correctIndex: 1,
    explanation: 'GraphQL shines when different clients need different data shapes from the same API. A mobile app needs 3 fields while the web dashboard needs 30. With REST, you either over-fetch or create dozens of endpoints. GitHub switched to GraphQL because their integrators needed wildly different data subsets. But for simple CRUD APIs with predictable access patterns, REST is simpler and faster.',
    twist: 'GraphQL has a hidden cost: every query can be a denial-of-service attack. A deeply nested query can join millions of rows. Facebook, who CREATED GraphQL, had to build query complexity analysis and depth limiting to prevent this. Most teams adopt GraphQL without these safeguards.',
    endQuestion: 'REST or GraphQL for your next project? Comment.',
    title: 'REST vs GraphQL — the REAL answer',
  },

  // ── AUTHENTICATION / JWT (4 questions) ────────────────────────────
  {
    topic: 'authentication',
    hookText: 'Your JWT is\na SECURITY HOLE',
    spokenHook: 'Your JWT implementation has a security hole that hackers are actively exploiting.',
    question: 'What is the biggest security risk with JWT tokens?',
    options: ['JWTs are too large', 'JWTs cannot be revoked once issued', 'JWTs expire too quickly'],
    correctIndex: 1,
    explanation: 'JWTs are stateless — the server does not track them. Once issued, a JWT is valid until it expires, even if the user changes their password or gets banned. If a token is stolen, you cannot invalidate it. The attacker has access until expiration. Auth0 recommends short-lived access tokens of 15 minutes plus refresh tokens to mitigate this. Discord learned this the hard way when compromised tokens were used for days.',
    twist: 'The "solution" most teams implement — a token blacklist — defeats the entire purpose of JWT. If you need to check a blacklist on every request, you might as well use server-side sessions. You just rebuilt sessions but worse.',
    endQuestion: 'How long are your JWT tokens valid? Comment the duration.',
    title: 'Your JWT is a SECURITY HOLE',
  },
  {
    topic: 'authentication',
    hookText: 'OAuth was NEVER meant\nfor authentication',
    spokenHook: 'OAuth was never meant for authentication and using it that way is dangerous.',
    question: 'What is the difference between OAuth 2.0 and OpenID Connect?',
    options: ['No difference — same protocol', 'OAuth is for authorization, OIDC adds authentication', 'OIDC replaces OAuth'],
    correctIndex: 1,
    explanation: 'OAuth 2.0 is an AUTHORIZATION protocol — it grants access to resources. It was designed so apps could post to your Facebook wall, not to verify WHO you are. OpenID Connect adds an identity layer on top of OAuth that provides authentication — an ID token that proves the user\'s identity. Using raw OAuth for login is like using a car key to prove you own the house. Google and Microsoft both mandate OIDC for authentication.',
    twist: 'Thousands of apps use "Sign in with Google" via plain OAuth without OIDC. This works but has a subtle vulnerability: the access token can be replayed. OIDC\'s ID token includes an audience claim that prevents this. If you are using OAuth for login, you probably have this vulnerability.',
    endQuestion: 'OAuth or OIDC for your login? Comment what you use.',
    title: 'OAuth was NEVER meant for authentication',
  },
  {
    topic: 'authentication',
    hookText: 'Storing passwords?\n90% do it WRONG',
    spokenHook: 'Ninety percent of applications store passwords incorrectly. Is yours one of them?',
    question: 'What is the correct way to store user passwords?',
    options: ['SHA-256 hash', 'bcrypt with salt', 'AES encryption'],
    correctIndex: 1,
    explanation: 'bcrypt is designed to be SLOW — that is the point. A GPU can compute 10 billion SHA-256 hashes per second but only 50,000 bcrypt hashes. This makes brute force attacks impractical. The salt prevents rainbow table attacks by making each hash unique even for identical passwords. Dropbox uses bcrypt and was unaffected when 68 million password hashes were leaked in 2016 — because cracking bcrypt at scale is computationally infeasible.',
    twist: 'SHA-256 is a great hash function but TERRIBLE for passwords because it is designed to be fast. Fast is the enemy of password security. The newer alternative to bcrypt is Argon2, which won the Password Hashing Competition in 2015 and also resists GPU attacks by requiring large amounts of memory.',
    endQuestion: 'What hash function does your app use? Comment honestly.',
    title: '90% of devs store passwords WRONG',
  },
  {
    topic: 'authentication',
    hookText: 'Session vs JWT —\nthe debate is OVER',
    spokenHook: 'The session versus JWT debate is finally over. And the answer surprises most developers.',
    question: 'When should you use server-side sessions instead of JWT?',
    options: ['Never — JWT is always better', 'When you need instant token revocation', 'Only for legacy applications'],
    correctIndex: 1,
    explanation: 'Server-side sessions are superior when you need to immediately revoke access — banning a user, forced logout, password change invalidation. With sessions, you delete the session record and the user is instantly locked out. With JWT, the user keeps access until the token expires. GitHub uses server-side sessions for exactly this reason. When they detect a compromised account, they need instant revocation, not "wait 15 minutes."',
    twist: 'The industry swung too hard toward JWT. For most web applications, server-side sessions with Redis are simpler, more secure, and perform just as well. JWT makes sense for microservices and API-to-API communication, not for user login sessions.',
    endQuestion: 'Sessions or JWT for your user auth? Comment.',
    title: 'Session vs JWT — the debate is finally OVER',
  },

  // ── CI/CD (3 questions) ───────────────────────────────────────────
  {
    topic: 'cicd',
    hookText: 'Your CI pipeline\ntakes 30 minutes? WRONG.',
    spokenHook: 'If your CI pipeline takes more than ten minutes, you are doing it wrong.',
    question: 'What is the most effective way to speed up a slow CI/CD pipeline?',
    options: ['Buy faster runners', 'Parallelize tests and cache dependencies', 'Skip tests on small changes'],
    correctIndex: 1,
    explanation: 'Parallelizing tests and caching dependencies gives the biggest speedup. Shopify runs 170,000 tests by splitting them across 200 parallel workers — a 3-hour test suite runs in 10 minutes. Dependency caching avoids re-downloading npm packages or Docker layers on every build. GitHub Actions, CircleCI, and GitLab CI all support both. The companies with the fastest pipelines are not using faster hardware — they are using smarter parallelization.',
    twist: 'Skipping tests on small changes sounds smart but it is how bugs slip into production. Netflix runs ALL tests on every commit — they just run them in parallel so it takes 4 minutes. Speed and coverage are not tradeoffs if you parallelize correctly.',
    endQuestion: 'How long is your CI pipeline? Comment the time in minutes.',
    title: 'Your CI pipeline is TOO SLOW — fix it now',
  },
  {
    topic: 'cicd',
    hookText: 'Blue-green vs canary —\nwrong choice = OUTAGE',
    spokenHook: 'Blue-green versus canary deployment. The wrong choice causes production outages.',
    question: 'When should you use canary deployment instead of blue-green?',
    options: ['Always — canary is safer', 'When you need to test with real production traffic', 'Only for frontend changes'],
    correctIndex: 1,
    explanation: 'Canary deployment routes a small percentage — say 5 percent — of real production traffic to the new version. If error rates spike, you roll back immediately with minimal impact. Blue-green switches ALL traffic at once. Google uses canary deployments for every production change. They start at 1 percent, monitor for 30 minutes, then gradually increase to 100 percent over hours. One bad deploy only affects 1 percent of users instead of everyone.',
    twist: 'Blue-green has a hidden advantage: instant rollback. Just switch traffic back to the old version. Canary rollback requires draining connections from the canary. For stateful services, blue-green is actually safer. The answer depends on your specific system.',
    endQuestion: 'Canary or blue-green? Comment what you use.',
    title: 'Blue-green vs canary — the wrong choice = OUTAGE',
  },
  {
    topic: 'cicd',
    hookText: 'Feature flags\nchanged everything at Netflix',
    spokenHook: 'Feature flags changed everything at Netflix and most teams still do not use them properly.',
    question: 'What is the primary benefit of feature flags in CI/CD?',
    options: ['Faster builds', 'Decouple deployment from release', 'Reduce code size'],
    correctIndex: 1,
    explanation: 'Feature flags let you deploy code to production with new features turned OFF. You deploy on Monday, test internally on Tuesday, enable for 10 percent of users on Wednesday, and fully release on Thursday. If anything breaks, flip the flag — no rollback, no redeploy. Netflix deploys hundreds of times per day because feature flags make every deployment safe. The code is live but the feature is dark until you are ready.',
    twist: 'The dark side of feature flags: flag debt. Netflix has thousands of flags and some have been "temporary" for 3 years. Old flags create dead code paths, make testing harder, and slow down developers. LaunchDarkly recommends a lifecycle: create, activate, evaluate, retire. Most teams skip the retire step.',
    endQuestion: 'How many feature flags does your codebase have? Comment.',
    title: 'Feature flags changed EVERYTHING at Netflix',
  },
];

/**
 * Get quiz questions for a specific topic.
 */
export function getQuizQuestions(topic: string): QuizQuestion[] {
  return QUIZ_BANK.filter(q => q.topic === topic);
}

/**
 * Get a specific quiz by global index (deterministic).
 */
export function getQuizByIndex(index: number): QuizQuestion {
  return QUIZ_BANK[index % QUIZ_BANK.length];
}

/**
 * Get today's quiz based on date (deterministic daily rotation).
 */
export function getDailyQuiz(date: Date = new Date()): QuizQuestion {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return getQuizByIndex(dayOfYear);
}

/**
 * Get all available topics with their question counts.
 */
export function getTopicStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const q of QUIZ_BANK) {
    stats[q.topic] = (stats[q.topic] || 0) + 1;
  }
  return stats;
}
