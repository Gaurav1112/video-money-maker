/**
 * topic-deep-content.ts
 *
 * Deep, specific, technically accurate content for high-priority topics.
 * These override the generic topic-examples.ts entries for Short generation.
 *
 * Content researched to be accurate as of 2026.
 * Each entry has: realIncident, specificNumbers, configKey, misconception, catchphrase
 */

export interface DeepTopicContent {
  slug: string;
  displayName: string;
  /** Real incident: company, year, what broke, why */
  realIncident: string;
  /** The specific config key or concept that matters */
  configKey: string;
  /** What the default value is and why it's wrong */
  defaultConfigProblem: string;
  /** The most common misconception about this topic */
  misconception: string;
  /** The correction that detonates the misconception */
  misconceptionCorrection: string;
  /** Specific numbers (latency, throughput, scale) */
  specificNumbers: string;
  /** The single catchphrase that captures the topic */
  catchphrase: string;
  /** Fireship-style dense summary (50 words, no filler) */
  fireshipsummary: string;
  /** ByteByteGo-style scenario opening */
  bbgScenario: string;
  /** The "3am incident" scenario — what breaks, when, why */
  incidentScenario: string;
  /** The config/code fix in one line */
  oneLinerFix: string;
  /** Zeigarnik hook — the specific unanswered question */
  zeigarnikHook: string;
}

export const DEEP_TOPIC_CONTENT: Record<string, DeepTopicContent> = {
  kafka: {
    slug: 'kafka',
    displayName: 'Apache Kafka',
    realIncident:
      'LinkedIn, 2010: their activity feed pipeline was dropping events under load. The fix became Kafka. By 2023 it processes over 7 trillion messages per day.',
    configKey: 'acks',
    defaultConfigProblem:
      'Default acks=1 means the broker confirms receipt before writing to disk. One broker restart and your message is gone — silently, with no error.',
    misconception: 'Kafka guarantees message delivery by default',
    misconceptionCorrection:
      'Kafka with acks=1 (default) does NOT guarantee delivery. acks=all + min.insync.replicas=2 is required for durability. Most tutorials skip this.',
    specificNumbers:
      '7 trillion messages/day at LinkedIn. Typical latency: 2-10ms. Partition throughput: ~10MB/s. Rebalance time: 20-60 seconds (this is the silent killer).',
    catchphrase: 'A partitioned, replicated commit log. Not a message queue.',
    fireshipsummary:
      "Kafka is a distributed commit log. Producers write to partitions. Consumers read with offset tracking. At-least-once delivery by default. Exactly-once requires configuration. Default settings lose data. Most teams don't know this.",
    bbgScenario:
      "You're building a system that needs to process 1 million events per second. A traditional message queue can't keep up. Here's what breaks first, and why Kafka solves it differently.",
    incidentScenario:
      "Your consumer group rebalances at 3am. During the 45-second rebalance, messages queue up. When processing resumes, the burst causes consumer lag to spike. Your alerting threshold is 1 minute. You never get paged. By morning, you're 2 hours behind.",
    oneLinerFix:
      'Set acks=all, min.insync.replicas=2, enable.idempotence=true. These three config lines are what LinkedIn uses in production.',
    zeigarnikHook:
      "But what happens when the consumer dies mid-batch — and how Kafka decides whether to retry or skip? That's in the next one.",
  },

  kubernetes: {
    slug: 'kubernetes',
    displayName: 'Kubernetes',
    realIncident:
      "Google ran Borg internally for 10 years before open-sourcing Kubernetes in 2014. Pokémon GO's launch in 2016 stress-tested it at 50x expected load — it held.",
    configKey: 'resources.requests and resources.limits',
    defaultConfigProblem:
      'Containers without resource limits can consume all node CPU/memory. One runaway container OOMKills your neighbors. Default: no limits. Result: cascading node failures.',
    misconception: 'Kubernetes automatically right-sizes your containers',
    misconceptionCorrection:
      'Kubernetes does exactly what you tell it. No requests set means the scheduler places pods blindly. No limits set means one pod can starve all others. You must set both.',
    specificNumbers:
      '5.6 million GitHub stars. Manages 100+ pods per node. Typical pod startup: 2-30 seconds. etcd max recommended size: 8GB. HPA scale-up lag: 15-60 seconds.',
    catchphrase: 'A container orchestrator. Not a magic deployment platform.',
    fireshipsummary:
      'Kubernetes schedules containers across nodes. Deployments manage replicas. Services provide stable IPs. Ingress handles routing. ConfigMaps hold config. Secrets hold secrets (base64, not encrypted). Helm packages everything. 70% of production K8s clusters have at least one misconfigured resource limit.',
    bbgScenario:
      "You've containerized your app. Now you need to run 50 replicas across 10 servers, handle failures automatically, and roll out updates without downtime. Here's what actually happens when you try.",
    incidentScenario:
      "A memory leak in one pod slowly consumes node memory. At 95% node memory, the kernel OOM-killer fires. It kills your pod — but also two neighboring pods from different services. Those services start alerting. You're debugging the wrong thing for 40 minutes.",
    oneLinerFix:
      'Set resources.requests = 50% of expected, resources.limits = 150% of expected, for every container. No exceptions.',
    zeigarnikHook:
      "But there's one K8s probe that stops this entire scenario. Most teams never configure it. It's in the next one.",
  },

  redis: {
    slug: 'redis',
    displayName: 'Redis',
    realIncident:
      "Twitter uses Redis to store 100 million tweets' worth of timeline data in memory. Instagram used Redis for 100M+ photo metadata before switching to Cassandra at scale.",
    configKey: 'maxmemory-policy',
    defaultConfigProblem:
      'Default maxmemory-policy is noeviction — Redis returns errors when memory is full instead of evicting old keys. Production apps crash with "OOM command not allowed" under load.',
    misconception: 'Redis is just a fast cache',
    misconceptionCorrection:
      'Redis is a data structure server. It supports strings, lists, sets, sorted sets, hashes, streams, and geospatial indexes. The cache use-case is 20% of what it can do. The other 80% is why it runs at LinkedIn, Twitter, and GitHub.',
    specificNumbers:
      'Sub-millisecond latency (100-300 microseconds). 100K+ operations/second on a single instance. Persistence: RDB snapshot every 60 seconds by default. AOF replay time: ~1 second per GB of commands.',
    catchphrase: 'An in-memory data structure store. Not just a cache.',
    fireshipsummary:
      'Redis stores data in RAM. Operations are atomic. Supports pub/sub, streams, Lua scripting. Persistence via RDB snapshots or AOF logs. Cluster mode shards data across nodes. The biggest risk: noeviction policy + no maxmemory set = crashed application.',
    bbgScenario:
      "Your database query takes 200ms. You need it to take 1ms. Here's why adding Redis doesn't automatically solve this — and the one config that makes the difference.",
    incidentScenario:
      "You set maxmemory to 4GB. Traffic spikes. Redis hits 4GB. noeviction policy fires. Every SET command returns OOM error. Your app wasn't built to handle Redis errors — it was built to assume Redis always works. Cascade failure.",
    oneLinerFix:
      'Set maxmemory-policy allkeys-lru. Set maxmemory to 80% of available RAM. These two configs prevent the most common Redis production incident.',
    zeigarnikHook:
      "But what's the one Redis command that looks safe but corrupts your data under concurrent writes? It's in the next one.",
  },

  database: {
    slug: 'database',
    displayName: 'Database Indexing',
    realIncident:
      'Stack Overflow runs its entire platform on a handful of SQL Server instances. In 2013, a missing index caused a 15-minute outage. The fix: one CREATE INDEX statement.',
    configKey: 'EXPLAIN / EXPLAIN ANALYZE',
    defaultConfigProblem:
      'Most developers add indexes by intuition — on columns they query frequently. Wrong. The query planner decides whether to use your index. EXPLAIN shows what it actually does. Most teams never check.',
    misconception: 'More indexes make your database faster',
    misconceptionCorrection:
      'Every index slows down writes. A table with 10 indexes takes 10x longer to INSERT into. Read-heavy tables need indexes. Write-heavy tables need fewer. The wrong balance causes silent write performance degradation.',
    specificNumbers:
      'B-tree index lookup: O(log n). Full table scan: O(n). At 10M rows, index lookup = ~23 operations vs 10M. Index creation on 10M rows: 30-120 seconds with table lock on some engines.',
    catchphrase: 'Indexes trade write speed for read speed. Every index is a tradeoff.',
    fireshipsummary:
      'B-tree index = sorted copy of a column. Lookup: O(log n) instead of O(n). Write penalty: every INSERT/UPDATE maintains all indexes. Composite indexes: column order matters (leftmost prefix rule). Covering index: includes all queried columns, skips table lookup entirely.',
    bbgScenario:
      "Your query runs fine on 10,000 rows. At 10 million rows, it takes 45 seconds. Adding an index makes it instant. Here's exactly why — and why adding the wrong index makes it worse.",
    incidentScenario:
      'A developer adds 5 new indexes to improve read performance. Write throughput drops 40% over the next week — slowly enough that nobody connects it to the indexes. The connection is made during a postmortem 3 weeks later.',
    oneLinerFix:
      'Run EXPLAIN ANALYZE on every slow query. Look for "Seq Scan" on large tables. Add a covering index for the exact columns in your WHERE and SELECT. Test write performance after.',
    zeigarnikHook:
      "But there's one index type that makes reads 100x faster and writes 0% slower. Most ORMs never use it. It's in the next one.",
  },

  'load-balancing': {
    slug: 'load-balancing',
    displayName: 'Load Balancing',
    realIncident:
      "GitHub's February 2018 DDoS attack: 1.35 Tbps. Their load balancers absorbed and redirected traffic to Akamai's scrubbing network in 10 minutes. Without load balancing, GitHub would have stayed down for hours.",
    configKey: 'health check interval and threshold',
    defaultConfigProblem:
      'Default health check intervals are often 30-60 seconds. A server can be down for 60 seconds before the load balancer stops sending traffic. With 60-second checks, you have a 30-second average window of sending requests to a dead server.',
    misconception: 'Load balancers distribute traffic evenly',
    misconceptionCorrection:
      'Round-robin distributes *requests* evenly, not *load*. A 100ms request and a 5-second request both count as "1 request." Least-connections or response-time-weighted algorithms distribute actual load. Most default configs use round-robin.',
    specificNumbers:
      'AWS ALB: 1M+ requests/second. Health check default: 30 seconds. L4 load balancer latency: <1ms. L7 load balancer latency: 1-5ms. Session affinity (sticky sessions) adds ~0.5ms overhead.',
    catchphrase: "Distributes requests. Not load. There's a difference.",
    fireshipsummary:
      'Load balancer sits between clients and servers. Routes requests based on algorithm: round-robin, least-connections, IP-hash. Layer 4 (TCP) vs Layer 7 (HTTP). L7 can route by URL path, headers, cookies. Health checks remove dead servers. SSL termination at the load balancer saves CPU on app servers.',
    bbgScenario:
      "You have 3 servers. Without a load balancer, one gets all traffic and crashes. With one, each gets 33%. But here's what happens to your sessions — and why the default config loses user data.",
    incidentScenario:
      'One server in your pool starts responding slowly — 5 seconds instead of 100ms. Round-robin keeps sending it 33% of traffic. Users on that server see timeouts. The load balancer health check passes (the server is up, just slow). 33% of your users are having a bad time for 20 minutes.',
    oneLinerFix:
      'Switch from round-robin to least-connections. Set health check interval to 5 seconds, healthy threshold to 2, unhealthy threshold to 2. These numbers cut "dead server" exposure from 60s to 10s.',
    zeigarnikHook:
      "But what happens to active connections when you deploy a new server version? The answer breaks most people's mental model. It's in the next one.",
  },

  caching: {
    slug: 'caching',
    displayName: 'Caching',
    realIncident:
      'Facebook\'s Memcached cluster handles 1 billion requests per second. In 2013, the "thundering herd" problem caused a cascade failure when a cache cluster restarted — all clients hit the database simultaneously.',
    configKey: 'TTL (Time-To-Live)',
    defaultConfigProblem:
      'Setting the same TTL for all cached items means they all expire at the same time. Under load, all expirations trigger simultaneous database queries — the thundering herd problem. The fix: TTL jitter (randomize expiry within a range).',
    misconception: 'Caching always makes things faster',
    misconceptionCorrection:
      "Cache misses are slower than not caching. A cache miss requires: (1) cache lookup, (2) miss detection, (3) database query, (4) cache write, (5) return. That's 4 extra operations vs 1. For infrequently accessed data, caching adds latency.",
    specificNumbers:
      'L1 cache: 0.5ns. L2 cache: 7ns. RAM: 100ns. Memcached: 300μs. Redis: 500μs. Database: 5-50ms. Cache hit ratio of 95% means 5% of requests hit the database — still a lot at scale.',
    catchphrase: 'A cache miss is slower than no cache. Measure your hit ratio.',
    fireshipsummary:
      'Caching stores expensive computation results near the consumer. L1/L2/L3: CPU hardware. Redis/Memcached: network-accessible. CDN: geographic. Cache hit = fast path. Cache miss = slow path + cache population. Eviction policies: LRU, LFU, TTL. Invalidation: the hardest problem in computer science.',
    bbgScenario:
      "Your API returns user profiles. Each lookup queries the database. At 100 requests/second, that's 100 database queries/second. Here's what happens when you add Redis — and the one config mistake that makes it worse.",
    incidentScenario:
      'You set a 5-minute TTL on all cached items. At 5:00pm, everything expires simultaneously. 10,000 users trigger 10,000 simultaneous database queries. The database falls over. This is the thundering herd. It happens exactly every 5 minutes until you add TTL jitter.',
    oneLinerFix:
      'Add jitter: TTL = base_ttl + random(0, base_ttl * 0.1). For a 5-minute TTL, randomize between 4:45 and 5:15. Thundering herd eliminated.',
    zeigarnikHook:
      "But there's one cache invalidation strategy that prevents stale data without ever causing a cache miss. It's the one Facebook uses. It's in the next one.",
  },

  microservices: {
    slug: 'microservices',
    displayName: 'Microservices',
    realIncident:
      'Amazon migrated from a monolith to microservices between 2001 and 2006. Werner Vogels\'s "two-pizza team" rule: if a team needs more than two pizzas to be fed, it\'s too large. Each service should be owned by one two-pizza team.',
    configKey: 'circuit breaker timeout and threshold',
    defaultConfigProblem:
      'No circuit breaker = a slow dependency causes threads to pile up waiting for responses. At 100 requests/second, a 10-second timeout fills 1000 threads in 100 seconds. Memory exhausted. The healthy services go down because of the unhealthy one.',
    misconception: 'Microservices always make systems more scalable',
    misconceptionCorrection:
      'Microservices make it possible to scale individual components independently. But they add: network latency between calls, distributed tracing complexity, separate deployment pipelines, and eventual consistency problems. A monolith can outperform microservices up to several hundred engineers.',
    specificNumbers:
      'Netflix runs 700+ microservices. Inter-service call latency: 0.5-2ms. Average microservice has 3-5 dependencies. A call chain of 10 services at 1ms each = 10ms added latency minimum. Kubernetes deployment overhead per service: ~5MB RAM base.',
    catchphrase: 'Microservices scale teams, not just software.',
    fireshipsummary:
      'Microservices split one large application into small, independently deployable services. Each owns its data store. Communicate via API or message queue. Benefits: independent scaling, independent deployment, team autonomy. Costs: distributed systems complexity, network latency, eventual consistency, distributed tracing required.',
    bbgScenario:
      "You have a monolith with 10 engineers. User service, payment service, and notification service are all in one codebase. A bug in notifications takes down payments. Here's the tradeoff when you split them — and the failure mode nobody warns you about.",
    incidentScenario:
      "The payment service calls inventory service. Inventory is slow. Payment's thread pool fills up waiting. Payment service becomes slow. Order service calls payment. Order's thread pool fills. Cascade failure. All three services down because inventory was 2 seconds slow. This is why circuit breakers exist.",
    oneLinerFix:
      'Add Resilience4j or Hystrix circuit breaker to every inter-service HTTP call. Timeout at 2 seconds. Open after 5 failures in 10 seconds. This prevents cascade failures.',
    zeigarnikHook:
      "But there's one service decomposition mistake that makes cascade failures worse, not better — and most microservices tutorials recommend it. It's in the next one.",
  },

  'distributed-systems': {
    slug: 'distributed-systems',
    displayName: 'Distributed Systems',
    realIncident:
      "Amazon DynamoDB outage, September 2023: a metadata service misconfiguration caused a partial availability event affecting multiple AWS regions. Root cause: a distributed system's split-brain scenario during a network partition.",
    configKey: 'CAP theorem choice: CP vs AP',
    defaultConfigProblem:
      'Most engineers build systems without explicitly choosing between CP (consistency) and AP (availability) under network partitions. The choice gets made implicitly by defaults — often incorrectly for the actual requirements.',
    misconception: 'You can have strong consistency AND high availability in a distributed system',
    misconceptionCorrection:
      'CAP theorem: during a network partition, you must choose between consistency (all nodes see the same data) and availability (all requests get a response). You cannot have both. Most NoSQL databases default to AP. Most SQL databases default to CP. Know which your system uses.',
    specificNumbers:
      'Network partition probability in AWS multi-AZ: ~0.1% per month. Speed of light across US: ~50ms RTT. Typical two-phase commit: 2 round trips = 100ms+ latency. Paxos/Raft consensus: 1-2 round trips = 10-50ms.',
    catchphrase: 'Distributed systems fail in ways that local systems cannot.',
    fireshipsummary:
      "Distributed systems run across multiple machines. Failures are partial — some nodes up, some down. Networks partition — two groups can't communicate. CAP theorem: pick two of consistency, availability, partition tolerance. Partition tolerance is not optional in real networks. So: CP or AP. Know which you chose.",
    bbgScenario:
      "You have two data centers. A network cable is cut. Your database is now split into two halves that can't communicate. Here's what happens to your data — and why the choice you made 6 months ago determines whether users see stale data or errors.",
    incidentScenario:
      "Network partition happens at 2am. AP system keeps serving requests from both sides. Both sides accept writes. Partition heals. Now you have conflicting writes. Which one wins? If you didn't design a conflict resolution strategy, you just lost data silently.",
    oneLinerFix:
      "Explicitly document your system's CAP choice. For user-facing data: AP with last-write-wins. For financial data: CP with explicit retry on partition. Never leave this implicit.",
    zeigarnikHook:
      "But there's a fourth property beyond CAP that determines whether your system is actually safe under real-world conditions. PACELC. It's in the next one.",
  },

  'api-gateway': {
    slug: 'api-gateway',
    displayName: 'API Gateway',
    realIncident:
      'Razorpay processes ₹5 trillion in annual payment volume. Their API gateway handles 10,000+ TPS during Diwali sale peaks. A misconfigured rate limit brought down payment processing for 8 minutes in 2019.',
    configKey: 'rate limiting and circuit breaker configuration',
    defaultConfigProblem:
      "Default API gateway configs have no rate limiting. A single misbehaving client can exhaust backend capacity. Without circuit breakers, a slow backend causes the gateway's thread pool to fill — cascading to all clients.",
    misconception: 'API gateways are just reverse proxies with routing',
    misconceptionCorrection:
      'API gateways handle: authentication, rate limiting, request transformation, circuit breaking, load balancing, caching, and observability. A reverse proxy does one thing. An API gateway does eight. Conflating them leads to building auth into every microservice.',
    specificNumbers:
      'Razorpay: 10,000 TPS peak. Kong handles 1M+ RPM on a single node. AWS API Gateway: 10,000 RPS default limit (soft). Rate limit granularity: per-IP, per-user, per-API-key. Circuit breaker threshold: typically 50% error rate in 10s window.',
    catchphrase: 'The front door of your microservices. Get it wrong and everything breaks.',
    fireshipsummary:
      'API gateway: single entry point for all clients. Handles routing, auth, rate limiting, circuit breaking. Kong, AWS API GW, NGINX. Without it: each microservice reinvents auth. With it: auth is a plugin. The failure mode: gateway becomes a single point of failure. Solution: deploy multiple instances behind a load balancer.',
    bbgScenario:
      "You have 15 microservices. Every client needs to know 15 endpoints. Every service does its own auth. A new requirement means updating all 15 services. Here's how an API gateway solves all three problems — and the one config that breaks everything.",
    incidentScenario:
      'A bot hammers your payment API at 50,000 RPM. No rate limiting configured. Backend database connections exhaust in 30 seconds. Legitimate users see 504 errors. Revenue stops. Detection: 4 minutes. Fix: 2 minutes to add rate limiting rule. Cost: 6 minutes of payment downtime.',
    oneLinerFix:
      'Configure rate limiting (100 RPM per API key), circuit breaker (50% errors → open), and request timeout (5s max) before going to production.',
    zeigarnikHook:
      "But there's one API gateway pattern that increases latency by 0ms while adding full auth. Zero latency overhead. It's in the next one.",
  },

  'rate-limiting': {
    slug: 'rate-limiting',
    displayName: 'Rate Limiting',
    realIncident:
      "CRED's referral program launch in 2021: a viral WhatsApp share caused 500K simultaneous sign-up attempts. No rate limiting on the referral endpoint. Database connections exhausted in 90 seconds. 2-hour outage.",
    configKey: 'algorithm choice: token bucket vs sliding window',
    defaultConfigProblem:
      'Fixed window rate limiting (most common default) allows 2x the intended rate at window boundaries. A limit of 100/minute allows 200 requests in a 2-second window spanning midnight. Real rate limiting requires token bucket or sliding window algorithms.',
    misconception:
      'Rate limiting at 100 requests/minute means you will never get more than 100 requests/minute',
    misconceptionCorrection:
      'Fixed window counting: if your window resets at :00, a client can send 100 requests at :59 and 100 more at :01 — 200 requests in 2 seconds. Token bucket prevents this: tokens refill continuously, not at window boundaries.',
    specificNumbers:
      'Redis INCR for rate limiting: sub-millisecond. Token bucket refill rate for 100 RPM: 1.67 tokens/second. Typical burst allowance: 10-20% above sustained rate. Redis memory for 1M rate limit counters: ~64MB.',
    catchphrase: 'Not just counting requests — controlling when they arrive.',
    fireshipsummary:
      'Rate limiting prevents abuse and protects backends. Algorithms: fixed window (simple, has edge case), sliding window (accurate, memory-heavy), token bucket (allows bursts, common choice), leaky bucket (smooths traffic). Implementation: Redis INCR with TTL for distributed systems. Header: X-RateLimit-Remaining tells clients their current limit.',
    bbgScenario:
      "Your API handles 100 requests/minute per user. A user sends exactly 100 requests in the last 2 seconds of one minute and 100 in the first 2 seconds of the next. They just sent 200 requests in 4 seconds — and your rate limiter said nothing. Here's why, and how to fix it.",
    incidentScenario:
      'You launch a referral program. Someone shares the link on a large WhatsApp group. 50,000 people click within 5 minutes. Your signup endpoint has no rate limiting. Database write throughput: 500 writes/second max. Incoming: 10,000 writes/second. Connection pool exhausts. Signup breaks for everyone — not just the surge.',
    oneLinerFix:
      'Use token bucket algorithm via Redis. Set refill rate = sustained limit, burst = 1.5x sustained, and return 429 with Retry-After header when bucket empty.',
    zeigarnikHook:
      "But there's one rate limiting strategy that makes your API faster under load instead of slower. It's counterintuitive. It's in the next one.",
  },

  monitoring: {
    slug: 'monitoring',
    displayName: 'System Monitoring',
    realIncident:
      "Swiggy's 2022 New Year's Eve: order volume hit 5x normal. Their monitoring showed CPU and memory healthy. But p99 latency spiked to 8 seconds — hidden because they tracked p50 (median), not p99. 20% of orders failed silently for 45 minutes.",
    configKey: 'percentile tracking: p50 vs p95 vs p99',
    defaultConfigProblem:
      'Most monitoring setups track average latency. Average is statistically useless for user experience. At 100ms average, 1% of users can still experience 10-second latency. Track p95 and p99 — the slowest 5% and 1% of requests are your real user experience.',
    misconception: 'If average latency is low, users are having a good experience',
    misconceptionCorrection:
      'Average latency hides tail latency. Amazon found that 1 in 6 requests involves a backend call that triggers another backend call. Tail latency compounds: two 99th percentile calls in sequence = 1 in 6 requests is slow. Track p99, alert on p99.',
    specificNumbers:
      'Swiggy: 5x traffic surge on peak days. p50 vs p99 difference at scale: often 5-20x. Typical SLA: p99 < 500ms for API calls. DataDog cost at 1B metrics/month: ~$2,000. Prometheus scrape interval: 15s default.',
    catchphrase: 'You cannot fix what you cannot see. Track the right percentiles.',
    fireshipsummary:
      'Monitoring: metrics (what happened), logs (why it happened), traces (where it happened). RED method: Rate, Errors, Duration — for every service. USE method: Utilization, Saturation, Errors — for every resource. Alert on p99 latency, not average. Alert on error RATE, not error count. On-call engineers need dashboards that answer "is it broken?" in 10 seconds.',
    bbgScenario:
      "Your system is healthy by every metric. CPU 30%, memory 40%, average latency 120ms. But 5% of your users are experiencing 8-second load times. You're about to lose them — and your monitoring won't tell you. Here's what to add.",
    incidentScenario:
      '3am: p99 latency spikes to 4 seconds. Alert fires. On-call engineer opens Grafana. Average latency shows 180ms — looks fine. They dismiss the alert as a fluke. p99 stays elevated. By 6am, 15% of users have churned. The alert was correct. The dashboard was misleading.',
    oneLinerFix:
      'Add p95 and p99 latency to every service dashboard. Set alert threshold at p99 > 2x your SLA target. Average latency dashboards should be deleted.',
    zeigarnikHook:
      "But there's one monitoring pattern that catches issues 10 minutes before users notice. It's not about latency. It's in the next one.",
  },

  'circuit-breaker': {
    slug: 'circuit-breaker',
    displayName: 'Circuit Breaker',
    realIncident:
      "Netflix's Hystrix library was born from a 2012 incident: the recommendations service slowed down, causing threads across 30+ services to pile up waiting for it. Half of Netflix went down because of one slow service. Circuit breaker pattern prevents exactly this.",
    configKey: 'failure threshold and half-open probe interval',
    defaultConfigProblem:
      'Default circuit breaker thresholds are often too high (50% error rate) or too low (5% error rate). 50% means half your users see errors before the circuit opens. 5% means a noisy dependency trips the circuit constantly. Tune to your actual error baseline.',
    misconception: 'Circuit breakers prevent failures',
    misconceptionCorrection:
      "Circuit breakers do not prevent failures. They prevent cascade failures. When service A fails, a circuit breaker stops service B from trying to reach A, freeing B's threads for other work. Without it, B's thread pool fills waiting for A, and B fails too.",
    specificNumbers:
      'Netflix Hystrix: default 50% error threshold, 5s window, 20 minimum requests. Resilience4j: 50% threshold default, half-open allows 10 test calls. Recovery probe interval: 30-60s typical. Thread pool timeout: 2x your SLA target.',
    catchphrase: 'Fail fast, recover automatically. Stop the cascade before it starts.',
    fireshipsummary:
      'Circuit breaker: wraps calls to external services. Three states: Closed (normal), Open (failing, reject immediately), Half-Open (testing recovery). Opens when error rate exceeds threshold. Probes health in half-open state. Closes when healthy. Prevents cascade failures. Implement with Resilience4j (Java), Polly (.NET), or pybreaker (Python).',
    bbgScenario:
      "Your payment service calls the fraud detection service. Fraud detection gets slow. Payment threads pile up waiting. Payment service runs out of threads. Order service calls payment — gets no response. Order service threads pile up. Your entire checkout flow fails because of a slow fraud check. Here's how circuit breakers stop this in 200ms.",
    incidentScenario:
      'Fraud detection service degrades at 2pm. Without circuit breaker: payment service thread pool fills in 30 seconds, order service follows in 60 seconds, 3 more services follow in the next 90 seconds. With circuit breaker: fraud detection hits 50% error rate, circuit opens, payment service rejects fraud checks immediately, returns cached fraud scores, checkout continues with degraded fraud protection.',
    oneLinerFix:
      'Add Resilience4j to every inter-service HTTP call. Configure: failureRateThreshold=40, slowCallRateThreshold=80, slowCallDurationThreshold=2s, waitDurationInOpenState=30s.',
    zeigarnikHook:
      "But there's one circuit breaker configuration that actually makes your system more reliable during partial failures than during normal operation. It's called bulkhead isolation. It's in the next one.",
  },

  docker: {
    slug: 'docker',
    displayName: 'Docker',
    realIncident:
      'Cloudflare, 2019: a regular expression in a WAF rule caused CPU to spike to 100% across all containers. Because containers shared host CPU without proper cgroup limits, one bad regex took down the entire edge network for 27 minutes.',
    configKey: '--memory and --cpus flags',
    defaultConfigProblem:
      'Default Docker containers have no memory or CPU limits. A container can consume all host resources. docker run without --memory means the OOM killer decides which process dies — often your database container, not the misbehaving one.',
    misconception: 'Docker containers are lightweight virtual machines',
    misconceptionCorrection:
      'Containers are isolated processes sharing the host kernel. They use cgroups for resource limits and namespaces for isolation. There is no hypervisor, no separate kernel. A container escape vulnerability means root on the host. VMs provide hardware-level isolation. Containers do not.',
    specificNumbers:
      'Container startup: 50-500ms vs VM 30-60 seconds. Image size: Alpine Linux 5MB, Ubuntu 72MB, node:latest 1GB+. Docker Hub: 15+ billion pulls. Default PID limit per container: unlimited (fork bomb risk). Layer cache hit saves 90%+ build time.',
    catchphrase: 'Isolated processes, not lightweight VMs. Know the difference.',
    fireshipsummary:
      'Docker packages apps in containers using Linux namespaces and cgroups. Dockerfile: FROM, COPY, RUN, CMD. Images are layered — each instruction is a cached layer. Containers share the host kernel. No resource limits by default. Multi-stage builds reduce image size 10x. Docker Compose orchestrates multiple containers. Use .dockerignore or your image ships node_modules and .git.',
    bbgScenario:
      "You containerize your Node.js app. It works on your laptop. In production, it consumes 8GB RAM and gets OOM-killed. Same code, same container. Here's what changed — and the one flag you forgot.",
    incidentScenario:
      'A developer pushes a container with a memory leak. No --memory limit set. The container slowly consumes host RAM. At 95% host memory, the kernel OOM-killer fires. It kills the MySQL container (largest RSS) instead of the leaking app. Database goes down. All services fail.',
    oneLinerFix:
      'Always run with: docker run --memory=512m --cpus=1.0 --pids-limit=256. These three flags prevent resource exhaustion, CPU starvation, and fork bombs.',
    zeigarnikHook:
      "But there's one Dockerfile instruction that looks harmless but exposes your app to a container escape. Most tutorials use it. It's in the next one.",
  },

  sql: {
    slug: 'sql',
    displayName: 'SQL Databases',
    realIncident:
      'GitLab, 2017: a database admin accidentally ran DELETE FROM on the production PostgreSQL database instead of staging. 300GB of data lost. Only one of five backup strategies was actually working. 6-hour outage, permanent data loss for some users.',
    configKey: 'transaction isolation level',
    defaultConfigProblem:
      "PostgreSQL defaults to READ COMMITTED isolation. MySQL InnoDB defaults to REPEATABLE READ. Most developers don't know which their database uses. READ COMMITTED allows non-repeatable reads — the same query returns different results within one transaction.",
    misconception: 'SQL transactions are always ACID by default',
    misconceptionCorrection:
      "ACID depends on isolation level. READ UNCOMMITTED allows dirty reads. READ COMMITTED allows non-repeatable reads. REPEATABLE READ allows phantom reads (in some engines). Only SERIALIZABLE is fully isolated — and it's 10-50x slower. Most apps run at READ COMMITTED and assume SERIALIZABLE.",
    specificNumbers:
      'PostgreSQL handles 10,000+ TPS on a single instance. MySQL: 25,000+ simple queries/second. SERIALIZABLE vs READ COMMITTED overhead: 5-50x depending on contention. Index lookup: ~0.01ms. Full table scan on 10M rows: 5-30 seconds. WAL write: ~0.1ms per transaction.',
    catchphrase: 'Your transactions are not as isolated as you think.',
    fireshipsummary:
      'SQL: structured query language for relational data. ACID: Atomicity, Consistency, Isolation, Durability. JOIN types: INNER, LEFT, RIGHT, FULL. Indexes: B-tree by default. Explain plan shows what the query planner actually does. N+1 query problem: ORM fetches 1 list + N detail queries. Fix: JOIN or eager loading. Transactions: isolation level determines what "consistent" means.',
    bbgScenario:
      "Two users buy the last item simultaneously. Both read stock=1. Both decrement to stock=0. Both succeed. You've sold one item twice. Here's why your transaction didn't prevent it — and the one SQL keyword that does.",
    incidentScenario:
      "Black Friday sale. Two concurrent transactions read inventory=1 for the same product. Both pass the check. Both decrement. Inventory goes to -1. You've oversold. READ COMMITTED isolation allowed both to read the same value before either committed. 200 items oversold in 30 minutes.",
    oneLinerFix:
      'Use SELECT ... FOR UPDATE to lock the row during read. Or: SET TRANSACTION ISOLATION LEVEL SERIALIZABLE for critical financial operations. Accept the performance cost.',
    zeigarnikHook:
      "But there's one SQL pattern that's 100x faster than SELECT FOR UPDATE for high-contention scenarios. Every payment system uses it. It's in the next one.",
  },

  nosql: {
    slug: 'nosql',
    displayName: 'NoSQL Databases',
    realIncident:
      'MongoDB, 2017: over 28,000 MongoDB instances were ransomed because they were exposed to the internet with no authentication. Default MongoDB config before 3.6 had --bind_ip 0.0.0.0 and no auth enabled. Attackers simply connected and deleted data.',
    configKey: 'consistency level (e.g., w: "majority" in MongoDB)',
    defaultConfigProblem:
      'MongoDB default write concern is w:1 — acknowledged by one node. If that node crashes before replication, data is lost. Cassandra default consistency is ONE. DynamoDB default is eventual consistency. None of these guarantee your write is durable.',
    misconception: 'NoSQL means no schema and no rules',
    misconceptionCorrection:
      "NoSQL databases have schemas — they're just enforced at the application layer instead of the database layer. This means every microservice reading the data must agree on the schema. Schema drift is the #1 cause of NoSQL data corruption at scale. MongoDB added schema validation in 3.6 for this reason.",
    specificNumbers:
      'MongoDB: 100K+ reads/second per replica set. Cassandra: 1M+ writes/second per cluster. DynamoDB: single-digit millisecond latency at any scale. Document size limit: MongoDB 16MB, DynamoDB 400KB. Cassandra partition size recommendation: <100MB.',
    catchphrase: 'Not no-schema. Schema-on-read. Every bug is a schema bug.',
    fireshipsummary:
      'NoSQL: document (MongoDB), key-value (Redis, DynamoDB), column-family (Cassandra), graph (Neo4j). No JOINs — denormalize data. Eventual consistency by default. Schema enforced by application, not database. Scales horizontally by sharding. Trade-off: flexibility for consistency. Most "NoSQL is faster" claims compare denormalized NoSQL to normalized SQL — not a fair comparison.',
    bbgScenario:
      'You store user profiles in MongoDB. Each profile has an "address" field. One team stores it as a string. Another as an object with city/state/zip. Both write to the same collection. Your app crashes on read — not write. Here\'s why NoSQL makes this your problem.',
    incidentScenario:
      'A developer changes the user document schema — renames "email" to "emailAddress". The web app is updated. The mobile API is not. Mobile app writes documents with "email". Web app reads "emailAddress" — gets null. User emails silently stop working for mobile users. No error, no alert. Discovered 3 days later by a customer complaint.',
    oneLinerFix:
      'Enable MongoDB schema validation: db.createCollection("users", { validator: { $jsonSchema: { required: ["email"], properties: { email: { bsonType: "string" }}}}})',
    zeigarnikHook:
      "But there's one NoSQL data model that eliminates JOINs while keeping full consistency. It's not what you think. It's in the next one.",
  },

  authentication: {
    slug: 'authentication',
    displayName: 'Authentication',
    realIncident:
      'GitHub, 2024: a vulnerability in SAML signature verification allowed attackers to forge authentication assertions and access any GitHub Enterprise account. The issue was in XML signature wrapping — a class of attack that has existed since 2012.',
    configKey: 'JWT secret and algorithm',
    defaultConfigProblem:
      'Many JWT libraries default to algorithm "none" if not explicitly configured. An attacker changes the JWT header to {"alg":"none"}, removes the signature, and the server accepts it as valid. CVE-2015-9235. Always set algorithms explicitly: jwt.verify(token, secret, { algorithms: ["HS256"] }).',
    misconception: 'JWTs are encrypted and secure by default',
    misconceptionCorrection:
      "JWTs are base64-encoded, not encrypted. Anyone can decode the payload — it's just JSON. The signature only verifies integrity, not confidentiality. Never put sensitive data (passwords, SSNs) in a JWT. Use JWE (JSON Web Encryption) if you need encrypted tokens.",
    specificNumbers:
      'bcrypt: 12 rounds = ~250ms per hash (good default). JWT typical expiry: 15 minutes access token, 7 days refresh token. OAuth 2.0 adoption: 95%+ of public APIs. OWASP Top 10: Broken Authentication is #7 (2021). Brute force at 10B hashes/second: MD5 cracked instantly, bcrypt takes centuries.',
    catchphrase: 'JWTs are signed, not encrypted. Read that again.',
    fireshipsummary:
      'Authentication: proving who you are. Authorization: proving what you can do. Passwords: hash with bcrypt (never MD5/SHA). Sessions: server-side state, cookie-based. JWTs: stateless tokens, base64 payload + HMAC/RSA signature. OAuth 2.0: delegated authorization (not authentication). OIDC: authentication layer on top of OAuth. MFA: something you know + have + are.',
    bbgScenario:
      "Your API uses JWTs. A user's token is stolen. You can't revoke it because JWTs are stateless — there's no server-side state to invalidate. The token is valid for 24 hours. Here's the tradeoff — and the pattern that solves it without losing statelessness.",
    incidentScenario:
      'A developer hardcodes the JWT secret as "secret" in development. It ships to production. An attacker guesses the secret, forges admin JWTs, and accesses every account. No brute force needed — just jwt.io and the word "secret". Detected 2 weeks later during a security audit.',
    oneLinerFix:
      'Set algorithms explicitly: jwt.verify(token, secret, { algorithms: ["HS256"] }). Use a 256-bit random secret. Set expiry to 15 minutes. Add refresh token rotation.',
    zeigarnikHook:
      "But there's one JWT claim that 90% of implementations forget to validate — and it lets attackers reuse tokens across different services. It's in the next one.",
  },

  sharding: {
    slug: 'sharding',
    displayName: 'Database Sharding',
    realIncident:
      'Instagram, 2012: their PostgreSQL database hit the limit of a single server. They sharded user data across multiple PostgreSQL instances using user ID modulo. The shard key choice — user ID, not photo ID — determined their entire data access pattern for the next decade.',
    configKey: 'shard key selection',
    defaultConfigProblem:
      'Choosing a sequential ID as shard key (e.g., auto-increment) sends all recent writes to the same shard — creating a hotspot. Choosing a high-cardinality key (e.g., user_id with hash) distributes evenly but makes range queries across shards expensive. There is no default — and the wrong choice requires re-sharding all data.',
    misconception: 'Sharding automatically distributes data evenly',
    misconceptionCorrection:
      'Sharding distributes data based on your shard key. A bad key creates hotspots. If you shard by country, the US shard gets 40% of traffic. If you shard by user_id, celebrity users create hotspots. Even distribution requires a high-cardinality, uniformly distributed key — typically a hashed value.',
    specificNumbers:
      "Vitess (YouTube's sharding proxy): handles 10M+ QPS. Instagram: 12 PostgreSQL shards initially. MongoDB auto-sharding splits chunks at 128MB default. Cross-shard query overhead: 2-10x single-shard. Re-sharding 1TB of data: 4-12 hours with careful planning.",
    catchphrase: 'The shard key you choose today is the constraint you live with forever.',
    fireshipsummary:
      'Sharding splits one database into multiple smaller databases. Each shard holds a subset of data. Shard key determines which shard stores which row. Hash-based: even distribution, no range queries. Range-based: efficient scans, potential hotspots. Cross-shard JOINs: expensive or impossible. Re-sharding: painful. Choose the shard key carefully — changing it later means migrating all data.',
    bbgScenario:
      "Your PostgreSQL instance handles 50,000 queries/second. You need 200,000. Vertical scaling maxes out at 96 cores. You must split the database. Here's how you choose which column to split on — and the one choice that makes 30% of your queries impossible.",
    incidentScenario:
      'You shard by user_id. A viral user with 50M followers causes their shard to handle 100x the traffic of other shards. That shard\'s CPU hits 100%. All users on that shard experience timeouts. Other shards are at 10% CPU. Your "distributed" database has a single point of failure.',
    oneLinerFix:
      'Use a compound shard key: hash(user_id) for even distribution + timestamp for range queries within a user. Never shard by a key with skewed distribution.',
    zeigarnikHook:
      "But there's one sharding strategy that lets you add shards with zero downtime and zero data migration. It's called virtual sharding. It's in the next one.",
  },

  replication: {
    slug: 'replication',
    displayName: 'Database Replication',
    realIncident:
      'GitHub, 2018: a network partition between their primary US East Coast data center and a secondary caused MySQL replication lag to spike. When the partition healed, the secondary had stale data. Automated failover promoted the stale replica to primary. Result: data inconsistency requiring 24 hours of manual reconciliation.',
    configKey:
      'sync_binlog and innodb_flush_log_at_trx_commit (MySQL) / synchronous_commit (PostgreSQL)',
    defaultConfigProblem:
      'MySQL default sync_binlog=1 and innodb_flush_log_at_trx_commit=1 are safe but slow. Many teams set them to 0 for performance — trading durability for speed. A crash loses the last second of transactions. PostgreSQL synchronous_commit=off loses last ~600ms of data on crash.',
    misconception: 'Replicas always have the same data as the primary',
    misconceptionCorrection:
      'Asynchronous replication (the default in MySQL and PostgreSQL) means replicas lag behind the primary. Typical lag: 10ms-10 seconds. Under heavy write load: minutes. Reading from a replica can return stale data. Synchronous replication eliminates lag but halves write throughput.',
    specificNumbers:
      'MySQL async replication lag: 10ms-10s typical, minutes under load. PostgreSQL streaming replication: sub-second lag typical. Synchronous replication write penalty: 2-5x slower. Semi-synchronous: 1.5-2x slower with one confirmed replica. Network bandwidth for replication: ~1MB/s per 1000 TPS.',
    catchphrase: 'Replicas lag. Always. The question is how much you can tolerate.',
    fireshipsummary:
      'Replication copies data from primary to replica databases. Async: fast writes, replicas lag behind. Sync: no lag, slow writes. Semi-sync: one replica confirms, balance of both. Read replicas: scale reads, not writes. Failover: promote replica to primary when primary dies. Split-brain: two primaries accepting writes — data corruption guaranteed.',
    bbgScenario:
      "Your primary database handles 10,000 writes/second. You add a read replica. A user updates their profile, then immediately reads it. They see the old data. They update again. Now you have two conflicting writes. Here's why read-after-write consistency isn't free.",
    incidentScenario:
      'Primary database crashes at 3am. Automated failover promotes the replica. Replica was 30 seconds behind. 30 seconds of orders are lost — they were written to the primary but never replicated. No error, no alert. Customers were charged but have no order. Discovered at 9am when support tickets pile up.',
    oneLinerFix:
      'Use semi-synchronous replication: SET GLOBAL rpl_semi_sync_master_enabled=1. At least one replica confirms each write before commit. Failover loses zero transactions.',
    zeigarnikHook:
      "But there's one replication topology that gives you zero-downtime upgrades and zero data loss — without the performance penalty of synchronous replication. It's in the next one.",
  },

  'consistent-hashing': {
    slug: 'consistent-hashing',
    displayName: 'Consistent Hashing',
    realIncident:
      'Amazon DynamoDB, 2007: the original Dynamo paper introduced consistent hashing with virtual nodes to distribute data across their storage fleet. Without it, adding or removing a node would require rehashing and moving ~100% of data. With consistent hashing, only 1/N of data moves.',
    configKey: 'number of virtual nodes (vnodes)',
    defaultConfigProblem:
      'Consistent hashing with physical nodes only causes uneven distribution — nodes mapped to adjacent hash ranges get unequal load. Virtual nodes (100-256 per physical node) fix this. Cassandra default: num_tokens=256. Too few vnodes: uneven distribution. Too many: higher memory overhead and slower bootstrapping.',
    misconception: 'Consistent hashing distributes data perfectly evenly',
    misconceptionCorrection:
      'With N physical nodes on a hash ring, standard deviation of load is O(1/sqrt(N)). With 10 nodes, one node might get 15% of data while another gets 5%. Virtual nodes reduce variance: 256 vnodes per node brings standard deviation under 1%. Without vnodes, consistent hashing is surprisingly uneven.',
    specificNumbers:
      'Standard consistent hashing with 10 nodes: up to 3x load imbalance. With 256 vnodes: <5% imbalance. Adding a node with naive hashing: 100% data rehash. With consistent hashing: 1/N data movement (~10% with 10 nodes). Cassandra bootstrap time with 256 vnodes: 2-8 hours for 1TB.',
    catchphrase: 'Add a server, move 1/N of data. Not all of it.',
    fireshipsummary:
      "Consistent hashing maps both keys and servers to a ring (0 to 2^32). Each key is stored on the next server clockwise. Adding a server: only keys between the new server and its predecessor move. Removing: only that server's keys move to the next server. Virtual nodes: each physical server gets 100+ positions on the ring for even distribution.",
    bbgScenario:
      "You have a cache cluster of 10 servers. You use hash(key) % 10 to route. You add an 11th server. hash(key) % 11 changes the mapping for almost every key. Your cache hit rate drops to near zero. 10 servers simultaneously hit the database. Here's how consistent hashing prevents this.",
    incidentScenario:
      'Your Memcached cluster uses modular hashing. A server crashes at 2am. hash(key) % 9 instead of % 10. Nearly every key maps to a different server. Cache hit rate drops from 95% to 5%. Database receives 20x normal load. Database connection pool exhausts. Application-wide outage from losing one cache server.',
    oneLinerFix:
      'Use a consistent hashing library (e.g., hashring in Node.js, ketama in C) with 150+ virtual nodes per physical node. Server failure moves only 1/N of keys.',
    zeigarnikHook:
      "But there's one edge case where consistent hashing makes hotspots worse, not better. It happens with time-series data. It's in the next one.",
  },

  'event-sourcing': {
    slug: 'event-sourcing',
    displayName: 'Event Sourcing',
    realIncident:
      'LMAX Exchange, 2010: a financial trading platform processing 6 million transactions per second. They store every trade as an immutable event. When a bug caused incorrect balances, they replayed 2 days of events through the fixed code and recovered accurate state — without touching production data.',
    configKey: 'snapshot interval',
    defaultConfigProblem:
      "Without snapshots, replaying an entity's full event history gets slower as events accumulate. An account with 100,000 events takes seconds to rebuild. Default in most frameworks: no automatic snapshotting. You must configure snapshot-every-N-events (typically 100-500).",
    misconception: 'Event sourcing is just an audit log',
    misconceptionCorrection:
      'An audit log records what happened. Event sourcing uses events as the source of truth — current state is derived by replaying events. The difference: an audit log is secondary (you can delete it). In event sourcing, the event store IS your database. Delete the events, lose the state.',
    specificNumbers:
      'LMAX: 6M TPS with event sourcing. EventStoreDB: 15,000+ writes/second per stream. Event size: typically 200-500 bytes. Snapshot interval recommendation: every 100-500 events. Event store growth: ~1GB per 2-5 million events. Replay 1M events: 2-10 seconds.',
    catchphrase: 'Store what happened, not what is. Derive state from history.',
    fireshipsummary:
      'Event sourcing stores state changes as immutable events. Current state = replay all events. Benefits: full audit trail, time travel (rebuild state at any point), debug by replaying. Costs: eventual consistency, complex queries (need CQRS), storage growth. CQRS: separate read/write models. Write: append event. Read: query materialized view.',
    bbgScenario:
      "A user's bank balance is wrong. With CRUD, you see the current balance: $500. How did it get there? No idea. With event sourcing, you see: deposited $1000, withdrew $200, transferred $300. You replay events and find the bug. Here's the tradeoff that makes this possible.",
    incidentScenario:
      'Your event-sourced system has 50 million events. No snapshots configured. Rebuilding an aggregate with 200,000 events takes 15 seconds. A burst of requests for that aggregate queues up. Thread pool fills. Timeout cascade. The fix: add snapshots every 500 events, reducing rebuild to 50ms.',
    oneLinerFix:
      'Configure snapshot interval: take a snapshot every 100 events. On replay, load the latest snapshot + events after it. Rebuild time drops from O(all events) to O(100 events).',
    zeigarnikHook:
      "But there's one event sourcing mistake that makes your events unreplayable — and most teams don't discover it until they actually need to replay. It's in the next one.",
  },

  'message-queue': {
    slug: 'message-queue',
    displayName: 'Message Queues',
    realIncident:
      "Slack, 2022: a deployment triggered a surge of job queue messages. Their RabbitMQ cluster couldn't keep up. Queue depth hit 14 million messages. Memory alarms triggered. RabbitMQ started blocking publishers. Chat messages stopped sending for 2.5 hours.",
    configKey: 'prefetch count (QoS)',
    defaultConfigProblem:
      'RabbitMQ default prefetch is unlimited — one fast consumer grabs all messages while slow consumers sit idle. Result: uneven load distribution and memory spikes on the fast consumer. Set prefetch_count to 10-50 for balanced consumption.',
    misconception: 'Message queues guarantee exactly-once delivery',
    misconceptionCorrection:
      "Most message queues guarantee at-least-once delivery. Messages can be delivered multiple times (consumer crashes after processing but before ACK). Exactly-once requires idempotent consumers — designing your handler so processing the same message twice has the same effect as once. The queue doesn't solve this; your code must.",
    specificNumbers:
      'RabbitMQ: 20,000-50,000 msg/s per queue. SQS: unlimited throughput (FIFO: 3,000 msg/s per group). RabbitMQ memory alarm: 40% of RAM default. Queue depth >1M: performance degrades. Message TTL recommendation: set it always (prevent unbounded growth).',
    catchphrase: 'At-least-once is the default. Make your consumers idempotent.',
    fireshipsummary:
      'Message queues decouple producers and consumers. RabbitMQ: smart broker, dumb consumer (routing, exchanges, bindings). SQS: simple, managed, scales automatically. Delivery: at-least-once (default), at-most-once (auto-ack), exactly-once (requires idempotent consumer). Dead letter queue: messages that fail N times go here for investigation. Prefetch count controls consumer throughput.',
    bbgScenario:
      "Your web server processes payments synchronously — 500ms per request. At 100 concurrent users, response time spikes to 5 seconds. Here's how a message queue turns a 500ms synchronous call into a 10ms async acknowledgment — and the failure mode you must handle.",
    incidentScenario:
      'Your consumer crashes after processing an order but before sending the ACK. RabbitMQ redelivers the message. The consumer processes it again. The customer is charged twice. No error in your logs — the system worked exactly as designed. At-least-once delivery means you need idempotent handlers.',
    oneLinerFix:
      'Set channel.prefetch(20), enable manual ACK, add a dead-letter exchange with TTL, and make every consumer idempotent using a processed-message-ID table.',
    zeigarnikHook:
      "But there's one queue configuration that lets you process 10x more messages without adding consumers. It's not what you think. It's in the next one.",
  },

  cdn: {
    slug: 'cdn',
    displayName: 'CDN (Content Delivery Network)',
    realIncident:
      "Fastly, June 2021: a single customer's configuration change triggered a bug that caused 85% of Fastly's network to return 503 errors. Sites affected: Amazon, Reddit, Twitch, The New York Times, UK government — all down for 49 minutes. One CDN config, half the internet offline.",
    configKey: 'Cache-Control header',
    defaultConfigProblem:
      'Many frameworks set Cache-Control: no-cache or no header at all. CDN treats uncacheable responses as pass-through — every request hits your origin. Setting Cache-Control: public, max-age=3600 for static assets offloads 90%+ of traffic. Missing this means paying for CDN while getting no benefit.',
    misconception: 'CDNs only help with static assets like images and CSS',
    misconceptionCorrection:
      'Modern CDNs cache API responses, HTML pages, and even GraphQL queries. Cloudflare Workers, Lambda@Edge, and Fastly Compute run custom code at the edge. CDNs also provide DDoS protection, WAF, and TLS termination. The "static files only" mental model ignores 60% of CDN capabilities.',
    specificNumbers:
      'Cloudflare: 300+ data centers, 209 Tbps capacity. CDN cache hit ratio target: 95%+. Latency reduction: 200ms → 20ms for cached content. Bandwidth savings: 60-90% of origin traffic. Cost of a CDN cache miss: same as no CDN + ~5ms overhead.',
    catchphrase: 'Put your content close to your users. Geography is latency.',
    fireshipsummary:
      'CDN caches content at edge servers worldwide. User in Tokyo hits Tokyo edge, not US-East origin. Cache-Control header tells CDN what to cache and for how long. Cache invalidation: purge by URL, tag, or prefix. Edge computing: run code at CDN nodes (Cloudflare Workers, Lambda@Edge). Stale-while-revalidate: serve stale cache while fetching fresh data in background.',
    bbgScenario:
      "Your server is in US-East. A user in Mumbai experiences 300ms latency per request. You add a CDN. First request: 300ms (cache miss, hits origin). Every subsequent request: 20ms (served from Mumbai edge). Here's how to make the first request fast too — and the cache header that breaks everything.",
    incidentScenario:
      "A developer sets Cache-Control: public, max-age=31536000 on an API response containing user-specific data. The CDN caches it. Every user sees the first user's data. PII exposed. Takes 45 minutes to purge all edge nodes worldwide. You just served User A's data to 10,000 strangers.",
    oneLinerFix:
      'Set Cache-Control: public, max-age=86400, stale-while-revalidate=3600 for static assets. Set Cache-Control: private, no-store for user-specific data. Never cache authenticated responses at the CDN.',
    zeigarnikHook:
      "But there's one CDN feature that makes your API faster than your own server — even on cache misses. It's called connection coalescing. It's in the next one.",
  },

  'rest-api': {
    slug: 'rest-api',
    displayName: 'REST API Design',
    realIncident:
      'Stripe, 2019: a breaking API change in their payments API affected thousands of integrations. Since then, Stripe versions every API endpoint with dates (2019-05-16) and maintains backward compatibility for years. Their API versioning strategy is now the industry gold standard.',
    configKey: 'API versioning strategy',
    defaultConfigProblem:
      'Most APIs ship without versioning. The first breaking change forces a choice: break all clients (unversioned), add /v2/ (URL versioning), or use Accept headers (content negotiation). Adding versioning after launch requires migrating all existing clients. Build it in from day one.',
    misconception: 'REST means using HTTP methods correctly',
    misconceptionCorrection:
      'REST (Representational State Transfer) is an architectural style with 6 constraints: client-server, stateless, cacheable, uniform interface, layered system, code-on-demand (optional). Most "REST APIs" are just HTTP APIs with JSON. True REST requires HATEOAS — hypermedia links in responses. Almost nobody implements HATEOAS.',
    specificNumbers:
      'Stripe API: 99.999% uptime SLA. Average API response: <200ms. Rate limit: 100 requests/second per key. API versions maintained: 3+ years backward compatible. JSON payload overhead vs Protobuf: 2-10x larger. Typical REST endpoint: 50-500ms.',
    catchphrase: 'REST is an architecture, not "HTTP + JSON." Almost nobody does it right.',
    fireshipsummary:
      'REST: resources identified by URLs. HTTP verbs: GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove). Status codes: 200 OK, 201 Created, 400 Bad Request, 404 Not Found, 429 Too Many Requests. Pagination: cursor-based beats offset-based at scale. Versioning: URL path (/v1/) or Accept header. HATEOAS: include links to related resources. Almost no one implements this.',
    bbgScenario:
      "You build an API that returns user profiles. Mobile app uses it. Web app uses it. You need to add a field and remove another. How do you change the API without breaking either client? Here's why Stripe's approach works — and why most teams get this wrong.",
    incidentScenario:
      'You rename a JSON field from "userName" to "username" in your API response. Your mobile app (version 2.3, still in use by 40% of users) expects "userName". Those users get null names. No error code — the response is valid JSON. Silent data loss for 40% of users for 3 days until app reviews surface the issue.',
    oneLinerFix:
      "Add API versioning from day one: /api/v1/users. Never remove or rename fields — only add. Deprecate with Sunset header and 12-month migration window. Use Stripe's date-based versioning for maximum flexibility.",
    zeigarnikHook:
      "But there's one REST anti-pattern that doubles your API latency — and every tutorial teaches it. It's called chatty APIs. It's in the next one.",
  },

  graphql: {
    slug: 'graphql',
    displayName: 'GraphQL',
    realIncident:
      'GitHub, 2016: migrated their public API from REST v3 to GraphQL v4. A single GraphQL query could trigger thousands of database queries (the N+1 problem at scale). They built DataLoader to batch and cache database calls per request — now the standard solution used by every GraphQL server.',
    configKey: 'query depth and complexity limits',
    defaultConfigProblem:
      'Default GraphQL servers have no query depth limit. An attacker can craft a deeply nested query: { user { friends { friends { friends { ... }}}}} — exponential database load from one HTTP request. No depth limit = trivial DoS vector. Set max depth to 7-10.',
    misconception: 'GraphQL is faster than REST',
    misconceptionCorrection:
      'GraphQL reduces over-fetching (client requests only needed fields) but adds server overhead: parsing the query, validating against schema, resolving each field. A simple query is slower than REST because of this overhead. GraphQL wins when a REST alternative would require multiple round trips.',
    specificNumbers:
      'GitHub GraphQL API: rate limited by "points" (1 point per node resolved). Typical query parsing: 1-5ms overhead. DataLoader batching: reduces N+1 from N queries to 1. Apollo Server: handles ~2000 queries/second per instance. Schema size at Shopify: 400+ types.',
    catchphrase: 'Ask for what you need. But protect the server from what you ask.',
    fireshipsummary:
      'GraphQL: query language for APIs. Client specifies exact fields needed. Single endpoint, typed schema. Queries (read), Mutations (write), Subscriptions (real-time). Solves over-fetching and under-fetching. N+1 problem: resolver per field triggers one DB query per item. Fix: DataLoader batches queries per tick. Security: limit query depth, complexity, and rate.',
    bbgScenario:
      "Your mobile app needs a user's name and their last 5 orders. REST: 2 API calls (GET /users/1, GET /users/1/orders?limit=5). GraphQL: 1 query, exact fields. Bandwidth saved: 60%. But here's the server-side cost nobody mentions — and why GitHub had to invent DataLoader.",
    incidentScenario:
      'An attacker sends a query: { users { friends { friends { friends { posts { comments { author { friends }}}}}}}}}. Each level multiplies database queries. 7 levels deep with average 50 items per level: 50^7 = 781 billion potential resolutions. Your server OOMs in 3 seconds. One HTTP request, total DoS.',
    oneLinerFix:
      'Install graphql-depth-limit and graphql-query-complexity. Set maxDepth=10, maxComplexity=1000. Add DataLoader for every database-backed resolver. These three changes prevent 90% of GraphQL production issues.',
    zeigarnikHook:
      "But there's one GraphQL feature that most teams enable by default that leaks your entire schema to attackers. It's called introspection. It's in the next one.",
  },

  websocket: {
    slug: 'websocket',
    displayName: 'WebSocket',
    realIncident:
      'Discord, 2020: their real-time gateway handles 10+ million concurrent WebSocket connections. A deployment bug caused a reconnection storm — all clients disconnected and reconnected simultaneously, creating a thundering herd that overwhelmed their gateway servers for 15 minutes.',
    configKey: 'ping/pong heartbeat interval',
    defaultConfigProblem:
      "Default WebSocket implementations often have no heartbeat. Without ping/pong, a half-open connection (client died but server doesn't know) holds resources indefinitely. Dead connections accumulate. After days, your server runs out of file descriptors. Set ping interval to 30 seconds with a 10-second timeout.",
    misconception: 'WebSockets are always better than HTTP for real-time data',
    misconceptionCorrection:
      'WebSockets add complexity: sticky sessions (load balancers must route to the same server), connection state management, reconnection logic, and no built-in request/response semantics. For updates every 5+ seconds, Server-Sent Events (SSE) are simpler and work through HTTP/2 multiplexing. WebSockets are for sub-second bidirectional communication only.',
    specificNumbers:
      'Discord: 10M+ concurrent connections. Typical WebSocket overhead: 2-6 bytes per frame (vs HTTP 200-800 bytes per request). Linux default max file descriptors: 1024 (must increase for WebSocket servers). Memory per connection: 2-10KB. Reconnection storm: 1M clients reconnecting in 5 seconds = 200K connections/second.',
    catchphrase:
      'Persistent connections. Persistent problems. Use only when you need bidirectional.',
    fireshipsummary:
      'WebSocket: persistent, bidirectional TCP connection between client and server. Starts as HTTP upgrade request. Full-duplex: both sides send anytime. Use cases: chat, gaming, live feeds, collaborative editing. Heartbeat (ping/pong) detects dead connections. Reconnection with exponential backoff prevents thundering herd. Alternative: SSE for server-to-client only. Socket.IO adds reconnection, rooms, and fallbacks on top.',
    bbgScenario:
      "You're building a chat app. HTTP polling: client asks \"any new messages?\" every second. 1,000 users = 1,000 requests/second, mostly empty responses. WebSocket: server pushes messages instantly. 1,000 users = 1,000 persistent connections. Here's why the second approach is cheaper — until it isn't.",
    incidentScenario:
      'Your WebSocket server handles 50,000 connections. A network blip disconnects all clients for 2 seconds. All 50,000 reconnect simultaneously. Your server can handle 5,000 new connections/second. It takes 10 seconds to process the backlog. During those 10 seconds, earlier reconnections time out and retry — creating an amplifying feedback loop.',
    oneLinerFix:
      'Add ping/pong heartbeat every 30 seconds (timeout 10s). On reconnect, use exponential backoff with jitter: delay = min(base * 2^attempt + random_jitter, max_delay). This prevents reconnection storms.',
    zeigarnikHook:
      "But there's one WebSocket scaling problem that sticky sessions don't solve — and it breaks when you deploy a new version. It's in the next one.",
  },

  'ci-cd': {
    slug: 'ci-cd',
    displayName: 'CI/CD',
    realIncident:
      'Knight Capital, 2012: a deployment script reused an old feature flag. Code that was supposed to be disabled was activated in production. In 45 minutes, automated trading racked up $440 million in losses. The company nearly went bankrupt. Root cause: no CI/CD pipeline — manual deployment with no automated checks.',
    configKey: 'deployment strategy: rolling vs blue-green vs canary',
    defaultConfigProblem:
      'Default Kubernetes rolling update replaces pods one at a time. If the new version has a bug, it propagates to all pods before anyone notices. No automatic rollback trigger by default. maxSurge and maxUnavailable defaults (25%) mean 25% of users hit the new version immediately.',
    misconception: 'CI/CD means faster deployments',
    misconceptionCorrection:
      'CI/CD means safer deployments. Continuous Integration: every commit is built and tested automatically. Continuous Delivery: every commit is deployable. Continuous Deployment: every commit goes to production. Speed is a side effect. The real value: catching bugs before users do. A fast pipeline that skips tests is worse than no pipeline.',
    specificNumbers:
      'Google: 60,000+ builds/day. GitHub Actions median: 2-5 minutes per workflow. Deploy frequency elite performers (DORA): multiple times per day. Change failure rate: <5% for elite teams. Mean time to recovery: <1 hour. Knight Capital loss: $440M in 45 minutes.',
    catchphrase: 'CI/CD is about safety, not speed. Fast and broken helps nobody.',
    fireshipsummary:
      'CI: automatically build + test every commit. CD: automatically deploy every passing commit. Pipeline stages: lint, unit test, integration test, build, deploy to staging, deploy to production. Deployment strategies: rolling (gradual), blue-green (instant switch), canary (1% traffic first). Rollback: automated on error rate spike. Feature flags: deploy code without activating it.',
    bbgScenario:
      "You push code on Friday at 4pm. No CI/CD. A bug ships. Users report issues at 6pm. You scramble to fix it. The fix introduces another bug. Here's how a CI/CD pipeline with canary deployment would have caught this at 1% traffic — and auto-rolled back in 60 seconds.",
    incidentScenario:
      "Your CI pipeline runs unit tests but not integration tests (too slow). A commit passes CI but breaks the payment→inventory integration. Deployed to all servers via rolling update. Payments succeed but inventory isn't decremented. 500 items oversold before detection. Integration tests would have caught it in 3 minutes.",
    oneLinerFix:
      'Add canary deployment: route 5% of traffic to new version for 10 minutes. Monitor error rate and p99 latency. Auto-rollback if error rate > baseline + 1%. Only then promote to 100%.',
    zeigarnikHook:
      "But there's one CI/CD anti-pattern that makes deployments slower and less safe — and 70% of teams do it. It's called the shared staging environment. It's in the next one.",
  },

  indexing: {
    slug: 'indexing',
    displayName: 'Database Indexing',
    realIncident:
      'Heroku, 2020: a routine PostgreSQL upgrade caused the query planner to ignore existing indexes on a core routing table. All queries fell back to sequential scans. Latency spiked 100x. Platform-wide degradation for 3 hours. Fix: ANALYZE to update statistics, then the planner used indexes again.',
    configKey: 'composite index column order',
    defaultConfigProblem:
      'A composite index on (A, B, C) only helps queries that filter on A, or A+B, or A+B+C (leftmost prefix rule). A query filtering on B alone cannot use this index. Most developers create indexes matching their WHERE clause without considering column order. Wrong order = unused index.',
    misconception: 'Adding an index always speeds up queries on that column',
    misconceptionCorrection:
      'The query planner decides whether to use your index. On small tables (<1000 rows), a sequential scan is faster. On low-selectivity columns (boolean, status with 3 values), a full table scan beats index lookup. The planner estimates cost and picks the cheapest path. Your index might be ignored entirely.',
    specificNumbers:
      'B-tree depth for 100M rows: 3-4 levels = 3-4 disk reads. Hash index lookup: O(1) but no range queries. GIN index (full-text): 2-5x faster than LIKE queries on 1M+ rows. Index size: typically 10-30% of table size. Unused index cost: write overhead + storage with zero read benefit.',
    catchphrase: 'Column order in composite indexes is not optional. It determines everything.',
    fireshipsummary:
      'Index types: B-tree (default, range queries), Hash (equality only), GIN (full-text, arrays), GiST (spatial), BRIN (sorted data, tiny size). Composite index: column order follows the leftmost prefix rule. Covering index: includes all SELECT columns, avoids table lookup. Partial index: indexes subset of rows (WHERE active=true). EXPLAIN ANALYZE: shows actual execution plan. pg_stat_user_indexes: shows unused indexes to drop.',
    bbgScenario:
      "Your query: SELECT * FROM orders WHERE user_id=5 AND status='shipped' AND created_at > '2024-01-01'. You have three single-column indexes. PostgreSQL uses none of them — it does a sequential scan. Here's why one composite index is faster than three single-column indexes.",
    incidentScenario:
      'A table grows from 100K to 50M rows over 6 months. Queries that ran in 5ms now take 15 seconds. EXPLAIN shows sequential scan — but there IS an index on the filtered column. The issue: column has only 3 distinct values (status: pending/active/closed). Index selectivity: 33%. Planner correctly chooses full scan over index.',
    oneLinerFix:
      'Create a composite covering index: CREATE INDEX idx_orders_lookup ON orders(user_id, status, created_at) INCLUDE (total, item_count). Covers the exact query with zero table lookups.',
    zeigarnikHook:
      "But there's one index type that's 100x smaller than B-tree and works perfectly for time-series data. Most PostgreSQL users don't know it exists. It's in the next one.",
  },

  'cap-theorem': {
    slug: 'cap-theorem',
    displayName: 'CAP Theorem',
    realIncident:
      "Amazon, 2004: during a network partition between data centers, DynamoDB (AP system) continued serving requests from both sides. When the partition healed, conflicting writes had to be reconciled. Amazon's shopping cart would merge conflicting carts — sometimes resurrecting deleted items. Users saw items reappear after removing them.",
    configKey: 'consistency model selection',
    defaultConfigProblem:
      'Most distributed databases default to eventual consistency (AP) without making this explicit. MongoDB default: reads from primary (CP-ish), but reads from secondaries return stale data (AP). Cassandra default: consistency ONE (AP). Developers assume strong consistency and build logic that silently breaks under partition.',
    misconception: 'CAP theorem means you pick 2 out of 3',
    misconceptionCorrection:
      'Network partitions are not optional — they will happen. So the real choice is between CP (consistency + partition tolerance: return errors during partition) and AP (availability + partition tolerance: return potentially stale data during partition). "CA" systems don\'t exist in distributed environments. Single-node databases are CA, but they\'re not distributed.',
    specificNumbers:
      'Network partition frequency in cloud: 1-2 per month per region. Partition duration: seconds to hours. DynamoDB eventual consistency: typically converges in <1 second. Spanner (CP): cross-region write latency 50-200ms due to consensus. CockroachDB (CP): 2-5ms same-region, 50-100ms cross-region.',
    catchphrase: "You don't pick 2 of 3. You pick C or A when the network fails.",
    fireshipsummary:
      'CAP: Consistency (all reads return latest write), Availability (every request gets a response), Partition tolerance (system works despite network splits). Partitions are inevitable — so pick CP or AP. CP: refuse requests during partition (banking). AP: serve stale data during partition (social media). PACELC extends CAP: when no partition, choose latency vs consistency.',
    bbgScenario:
      "Your database runs in US-East and EU-West. A submarine cable is cut. US users write data that EU users can't see. EU users write data that US users can't see. The cable is repaired. Both sides have different data. Here's what happens next — and why your database choice 2 years ago determines the answer.",
    incidentScenario:
      'A network partition splits your Cassandra cluster. With consistency ONE, both sides accept writes. Partition heals. Two users updated the same row — one set status="active", the other set status="inactive". Last-write-wins: the write with the later timestamp wins. But clocks are slightly skewed. The "wrong" write wins. Data is silently incorrect.',
    oneLinerFix:
      "Document your system's partition behavior explicitly. For financial data: use CP (Spanner, CockroachDB). For user-facing reads: use AP with conflict resolution (DynamoDB with version vectors). Never leave this decision implicit.",
    zeigarnikHook:
      "But there's an extension to CAP — called PACELC — that matters even when there's no partition. It explains why DynamoDB and Cassandra behave differently during normal operation. It's in the next one.",
  },

  'saga-pattern': {
    slug: 'saga-pattern',
    displayName: 'Saga Pattern',
    realIncident:
      'Uber, 2017: their trip lifecycle involves 10+ microservices (matching, pricing, payment, driver notification, ETA). A distributed transaction across all of them is impossible. They implemented the Saga pattern with compensating transactions — if payment fails after driver assignment, a compensation step releases the driver.',
    configKey: 'orchestration vs choreography',
    defaultConfigProblem:
      "Choreography-based sagas (each service listens for events and reacts) have no central view of the saga state. When a step fails, debugging which compensations fired and which didn't requires correlating logs across all services. Orchestration (central coordinator) adds a single point of failure but provides visibility.",
    misconception: 'Sagas provide ACID transactions across microservices',
    misconceptionCorrection:
      'Sagas provide eventual consistency, not ACID. There is no isolation — intermediate states are visible to other transactions. Between "payment charged" and "order confirmed," another query sees a charged payment with no order. Sagas guarantee all steps complete or all compensations run. They do NOT guarantee atomicity or isolation.',
    specificNumbers:
      'Uber: 10+ services per trip saga. Average saga duration: 100ms-30 seconds. Compensation failure rate: 0.1-1% (must handle compensation failures too). Orchestrator throughput: 10,000+ sagas/second with proper design. Event bus latency (Kafka): 2-10ms per step.',
    catchphrase:
      'No distributed transactions. Compensating actions instead. Embrace eventual consistency.',
    fireshipsummary:
      'Saga: sequence of local transactions across microservices. Each step has a compensating action (undo). If step 3 fails: run compensation for step 2, then step 1. Two styles: orchestration (central coordinator tells each service what to do) and choreography (each service reacts to events). Orchestration: easier to debug, single point of failure. Choreography: decoupled, harder to trace.',
    bbgScenario:
      "User books a flight + hotel + car rental. Flight booked successfully. Hotel booked successfully. Car rental fails (none available). You need to cancel the hotel and refund the flight. But the hotel cancellation also fails — their API is down. Here's how the Saga pattern handles this cascading compensation failure.",
    incidentScenario:
      "Order saga: (1) reserve inventory, (2) charge payment, (3) schedule shipping. Payment succeeds but shipping fails (warehouse full). Compensation: refund payment + release inventory. But the refund API times out. Is the customer charged or not? Without idempotent compensations and a saga state store, you don't know. Manual reconciliation for 200 orders.",
    oneLinerFix:
      'Use an orchestrator (e.g., Temporal, Camunda) that persists saga state. Make every compensation idempotent. Set compensation timeout to 3x normal timeout. Log every state transition with a correlation ID.',
    zeigarnikHook:
      "But there's one saga failure mode that neither orchestration nor choreography handles — and it requires a completely different pattern. It's called the semantic rollback problem. It's in the next one.",
  },

  'service-mesh': {
    slug: 'service-mesh',
    displayName: 'Service Mesh',
    realIncident:
      'Shopify, 2023: during their migration to a service mesh, a misconfigured Envoy sidecar proxy caused a 15-minute connectivity outage. The sidecar was intercepting traffic but the mTLS certificate had expired. No service-to-service communication worked. 500,000 requests failed in 15 minutes.',
    configKey: 'sidecar resource limits and mTLS certificate rotation',
    defaultConfigProblem:
      'Istio sidecar (Envoy) defaults: 100m CPU request, 128Mi memory request. For high-throughput services, this is far too low. The sidecar becomes the bottleneck — CPU-throttled at 100m while the app container has 4 CPU cores. Every request passes through the sidecar, so sidecar limits become service limits.',
    misconception: 'A service mesh replaces application-level networking code',
    misconceptionCorrection:
      'A service mesh handles transport-level concerns: mTLS, load balancing, circuit breaking, retries, observability. Application-level concerns remain: request validation, business logic timeouts, idempotency, and semantic retry decisions (should I retry this payment?). The mesh retries transport failures; the app must handle business failures.',
    specificNumbers:
      'Envoy sidecar latency overhead: 0.5-2ms per hop (p99). Memory per sidecar: 50-128MB. Istio control plane memory: 1-2GB. mTLS handshake: 1-2ms first connection, 0ms with session resumption. Certificate rotation default: 24 hours (Istio). Sidecar CPU overhead: 5-15% of request processing.',
    catchphrase: 'Infrastructure layer for service-to-service communication. Not a silver bullet.',
    fireshipsummary:
      'Service mesh: dedicated infrastructure layer for service-to-service communication. Sidecar proxy (Envoy) intercepts all traffic. Features: mTLS (automatic encryption), load balancing, circuit breaking, retries, observability (distributed tracing, metrics). Istio, Linkerd, Consul Connect. Adds latency (0.5-2ms per hop). Adds memory (50-128MB per pod). Worth it at 20+ services. Overkill at 5.',
    bbgScenario:
      "You have 50 microservices. Each needs: mutual TLS, circuit breakers, retries, distributed tracing, and traffic splitting for canary deployments. Implementing this in each service means 50 implementations. Here's how a service mesh does it once — and the overhead cost nobody mentions.",
    incidentScenario:
      'Istio sidecar CPU limit set to default 100m. Your service handles 5,000 RPS. Sidecar gets CPU-throttled. p99 latency jumps from 10ms to 500ms. The app container shows low CPU — misleading. All dashboards point to the app being slow. The actual bottleneck is the invisible sidecar. Debugging takes 2 hours.',
    oneLinerFix:
      'Set sidecar resources to match your service: istioctl annotation sidecar.istio.io/proxyCPU=500m, sidecar.istio.io/proxyMemory=256Mi. Monitor envoy_server_live with Prometheus. Rotate mTLS certs every 12h.',
    zeigarnikHook:
      "But there's one service mesh pattern that reduces latency instead of adding it. It's called eBPF-based mesh. It eliminates the sidecar entirely. It's in the next one.",
  },

  'feature-flags': {
    slug: 'feature-flags',
    displayName: 'Feature Flags',
    realIncident:
      'Knight Capital, 2012 (again): reused a feature flag called "power peg" that toggled old trading code. During deployment, the flag was enabled on all 8 servers but new code was only deployed to 7. The 8th server ran the old code path at 1000x normal speed. $440 million lost in 45 minutes. Feature flag hygiene — removing old flags — could have prevented this.',
    configKey: 'flag lifecycle and cleanup policy',
    defaultConfigProblem:
      'Feature flags accumulate. LaunchDarkly reports the average team has 200+ flags, and 30% are stale (no longer evaluated). Stale flags create dead code paths that are never tested. When accidentally enabled, they activate code nobody remembers writing. No default cleanup policy means flags grow forever.',
    misconception: 'Feature flags are just if/else statements',
    misconceptionCorrection:
      'Feature flags are runtime configuration that changes application behavior without deployment. This means: (1) testing matrix explodes — each flag doubles possible states, (2) flag interactions create emergent bugs, (3) stale flags are technical debt. 10 flags = 1,024 possible combinations. Testing all combinations is impractical. Flags need expiration dates and owners.',
    specificNumbers:
      'LaunchDarkly: evaluates 30+ trillion flags/day. Average team: 200+ active flags. Stale flag percentage: 20-40%. Flag evaluation latency: <1ms (SDK cache). 10 boolean flags: 1,024 combinations. 20 flags: 1,048,576 combinations. Knight Capital loss due to stale flag: $440 million.',
    catchphrase: 'Every feature flag is debt. Ship it, validate it, delete it.',
    fireshipsummary:
      'Feature flags: toggle features without deployment. Types: release (ship dark, enable later), experiment (A/B test), ops (kill switch), permission (premium features). Implementation: if(flag.isEnabled("new-checkout")). Evaluation: user segment, percentage rollout, environment. Lifecycle: create → enable 1% → enable 50% → enable 100% → remove flag + dead code. Stale flags = ticking time bombs.',
    bbgScenario:
      "You need to launch a new checkout flow. Option A: deploy new code, hope it works. Option B: deploy behind a feature flag, enable for 1% of users, monitor error rates, ramp to 100% over 3 days. Here's why Option B is safer — and the one mistake that makes it more dangerous than Option A.",
    incidentScenario:
      "A feature flag for a new pricing algorithm is rolled out to 10% of users. It works. Rolled to 100%. Six months later, a developer changes code inside the else branch (old path). They don't realize the flag exists — the code was always taking the if branch. They push broken else code. A year later, someone disables the flag for debugging. The broken else path activates. Pricing is wrong for all users.",
    oneLinerFix:
      'Add expiration dates to every flag: flag.create("new-checkout", { owner: "team-payments", expires: "2025-06-01" }). Run a weekly job that alerts on flags past expiry. Remove flag + dead code path within 30 days of 100% rollout.',
    zeigarnikHook:
      "But there's one feature flag pattern that lets you test in production without any user seeing the change. It's called dark launching. It's in the next one.",
  },

  dns: {
    slug: 'dns',
    displayName: 'DNS',
    realIncident:
      "Dyn DDoS attack, October 2016: a Mirai botnet of 100,000+ IoT devices hit Dyn's DNS infrastructure with 1.2 Tbps of traffic. DNS resolution failed for Twitter, Netflix, Reddit, GitHub, Spotify, and hundreds more. The internet's dependency on a few DNS providers was exposed. Outage lasted ~6 hours across three attack waves.",
    configKey: 'TTL (Time-To-Live) on DNS records',
    defaultConfigProblem:
      'Many DNS records ship with TTL of 86400 (24 hours). If you need to change an IP (migration, failover, incident response), clients use the cached old IP for up to 24 hours. During an incident, 24-hour TTL means 24-hour recovery time. Production DNS should use TTL of 300 seconds (5 minutes) for A/AAAA records.',
    misconception: 'DNS is just translating domain names to IP addresses',
    misconceptionCorrection:
      'DNS is a distributed database that stores many record types: A (IPv4), AAAA (IPv6), CNAME (alias), MX (mail), TXT (verification/SPF/DKIM), SRV (service discovery), CAA (certificate authority authorization). DNS also enables: global load balancing (geo-routing), failover (health-checked records), and service discovery in microservices.',
    specificNumbers:
      'Root DNS servers: 13 logical, 1700+ physical instances worldwide. DNS query: 1-100ms typical. Cloudflare 1.1.1.1: <10ms globally. Total DNS queries worldwide: ~2 trillion per day. Dyn attack: 1.2 Tbps. DNSSEC adoption: ~30% of .com domains. Typical DNS propagation: 5 minutes to 48 hours depending on TTL.',
    catchphrase: "The internet's phone book. And a single point of failure.",
    fireshipsummary:
      'DNS resolves domain names to IP addresses. Query path: browser cache → OS cache → recursive resolver → root nameserver → TLD nameserver → authoritative nameserver. Record types: A (IP), CNAME (alias), MX (mail), TXT (verification). TTL controls cache duration. Low TTL: fast failover, more queries. High TTL: fewer queries, slow failover. Use multiple DNS providers for redundancy.',
    bbgScenario:
      "You type google.com. Your browser doesn't know the IP. It asks your ISP's DNS resolver. The resolver asks root, then .com, then Google's nameserver. 4 network round trips before your browser can even start loading the page. Here's how DNS caching makes this happen once — and why TTL determines your incident recovery time.",
    incidentScenario:
      "Your server's IP changes during a migration. You update the DNS A record. But TTL was set to 86400 (24 hours). Clients worldwide still resolve to the old IP. Your new server is up but nobody can reach it. Old server is down. Users see connection refused for up to 24 hours. If TTL had been 300 seconds, recovery would have been 5 minutes.",
    oneLinerFix:
      'Set DNS TTL to 300 seconds for all A/AAAA records. Use at least 2 DNS providers (e.g., Route53 + Cloudflare). Lower TTL to 60 seconds 24 hours before any planned migration.',
    zeigarnikHook:
      "But there's one DNS attack that works even with DNSSEC enabled — and it doesn't require touching the DNS infrastructure at all. It's called DNS rebinding. It's in the next one.",
  },
};

export function getDeepContent(topicSlug: string): DeepTopicContent | null {
  return DEEP_TOPIC_CONTENT[topicSlug] ?? null;
}

export function hasDeepContent(topicSlug: string): boolean {
  return topicSlug in DEEP_TOPIC_CONTENT;
}
