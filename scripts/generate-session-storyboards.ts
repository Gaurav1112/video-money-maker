#!/usr/bin/env npx tsx
/**
 * generate-session-storyboards.ts — B-32 per-session storyboard generator
 *
 * Creates content/{topic-slug}-s{N}.json for all 10 sessions × 4 topics.
 * Running this script twice produces byte-identical output (deterministic).
 *
 * Slug-normalisation rule (≤30 chars):
 *   1. Lowercase the title
 *   2. Replace & / — / ( / ) with a space
 *   3. Strip all non-alphanumeric, non-space characters
 *   4. Split on whitespace; keep only the FIRST occurrence of each word (dedup)
 *   5. Join with hyphens
 *   6. If length > 30, drop words from the right until ≤ 30
 *
 * Example: "Round Robin & Weighted Round Robin"
 *   → lowercase → "round robin & weighted round robin"
 *   → clean     → "round robin  weighted round robin"
 *   → dedup     → [round, robin, weighted]
 *   → join      → "round-robin-weighted"  (20 chars ✓)
 *
 * Scene layout (durationInFrames = 1500 @ 30 fps = 50 s):
 *   Scene 0 · hook      · 150 frames (5 s)
 *   Scene 1 · body      · 450 frames (15 s)  — core mechanism
 *   Scene 2 · body      · 450 frames (15 s)  — interview gotcha / trap
 *   Scene 3 · outro     · 450 frames (15 s)  — takeaway + CTA
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SessionConfig {
  n: number;
  title: string;
  focus: string;
}

interface TopicConfig {
  slug: string;
  name: string;
  sessions: SessionConfig[];
}

interface SceneNarrations {
  hook: string;
  body: string;
  gotcha: string;
  closing: string;
}

// ─── CORE_TOPICS — source of truth ──────────────────────────────────────────

const CORE_TOPICS: TopicConfig[] = [
  {
    slug: 'load-balancing',
    name: 'Load Balancing',
    sessions: [
      { n: 1, title: 'What is Load Balancing & Why It Matters', focus: 'fundamentals, types, hardware vs software' },
      { n: 2, title: 'Round Robin & Weighted Round Robin', focus: 'basic algorithms, implementation, when to use' },
      { n: 3, title: 'Least Connections & IP Hash', focus: 'advanced algorithms, session persistence' },
      { n: 4, title: 'Consistent Hashing for Load Balancers', focus: 'ring-based hashing, virtual nodes, minimal disruption' },
      { n: 5, title: 'Health Checks & Failover Strategies', focus: 'passive, active, deep health checks, circuit breakers' },
      { n: 6, title: 'Layer 4 vs Layer 7 Load Balancing', focus: 'transport vs application layer, tradeoffs, when to use each' },
      { n: 7, title: 'SSL Termination & TLS Offloading', focus: 'encryption at scale, certificate management, performance' },
      { n: 8, title: 'Global Server Load Balancing (GSLB)', focus: 'GeoDNS, multi-region, latency-based routing' },
      { n: 9, title: 'Load Balancing at Netflix, Uber & Google', focus: 'real-world architectures, case studies, lessons' },
      { n: 10, title: 'Complete Interview Masterclass', focus: 'model answers, common mistakes, cheat sheet' },
    ],
  },
  {
    slug: 'caching',
    name: 'Caching',
    sessions: [
      { n: 1, title: 'What is Caching & Why Every System Needs It', focus: 'fundamentals, latency reduction, cache hit/miss' },
      { n: 2, title: 'Cache Eviction Policies (LRU, LFU, FIFO)', focus: 'algorithms, implementation, tradeoffs' },
      { n: 3, title: 'Write-Through, Write-Behind & Cache-Aside', focus: 'write strategies, consistency patterns' },
      { n: 4, title: 'Redis Deep Dive — Architecture & Data Types', focus: 'Redis internals, strings, hashes, sorted sets' },
      { n: 5, title: 'Memcached vs Redis — The Real Difference', focus: 'comparison, when to use which, benchmarks' },
      { n: 6, title: 'Cache Invalidation — The Hardest Problem', focus: 'TTL, event-driven, versioning, stampede prevention' },
      { n: 7, title: 'CDN Caching & Edge Computing', focus: 'CloudFront, Cloudflare, edge caching strategies' },
      { n: 8, title: 'Distributed Caching at Scale', focus: 'consistent hashing, replication, partition tolerance' },
      { n: 9, title: 'Caching at Instagram, Twitter & Discord', focus: 'real-world case studies, architecture decisions' },
      { n: 10, title: 'Complete Interview Masterclass', focus: 'model answers, cache design problems, cheat sheet' },
    ],
  },
  {
    slug: 'database-design',
    name: 'Database Design',
    sessions: [
      { n: 1, title: 'SQL vs NoSQL — The Decision Framework', focus: 'when to use each, ACID vs BASE, CAP theorem' },
      { n: 2, title: 'Database Indexing Deep Dive', focus: 'B-tree, hash index, composite indexes, query optimization' },
      { n: 3, title: 'Database Sharding Strategies', focus: 'horizontal partitioning, shard keys, range vs hash' },
      { n: 4, title: 'Database Replication & High Availability', focus: 'master-slave, multi-master, consensus protocols' },
      { n: 5, title: 'Schema Design for Scale', focus: 'normalization vs denormalization, embedding vs referencing' },
      { n: 6, title: 'Transactions & Isolation Levels', focus: 'ACID deep dive, read phenomena, MVCC' },
      { n: 7, title: 'NoSQL Deep Dive — MongoDB, Cassandra, DynamoDB', focus: 'document, wide-column, key-value stores' },
      { n: 8, title: 'Database Connection Pooling & Performance', focus: 'connection management, query optimization, N+1' },
      { n: 9, title: 'Database at Uber, Airbnb & Stripe', focus: 'real-world migrations, lessons learned' },
      { n: 10, title: 'Complete Interview Masterclass', focus: 'model answers, design problems, cheat sheet' },
    ],
  },
  {
    slug: 'api-gateway',
    name: 'API Gateway',
    sessions: [
      { n: 1, title: 'What is an API Gateway & Why You Need One', focus: 'fundamentals, single entry point, microservices routing' },
      { n: 2, title: 'Rate Limiting & Throttling', focus: 'token bucket, sliding window, distributed rate limiting' },
      { n: 3, title: 'Authentication & Authorization at the Gateway', focus: 'JWT, OAuth2, API keys, zero-trust' },
      { n: 4, title: 'Request Routing & Load Distribution', focus: 'path-based, header-based, canary deployments' },
      { n: 5, title: 'API Versioning Strategies', focus: 'URL vs header versioning, backward compatibility' },
      { n: 6, title: 'Circuit Breaker & Retry Patterns', focus: 'resilience patterns, fallbacks, bulkhead isolation' },
      { n: 7, title: 'API Gateway Products — Kong, Nginx, AWS', focus: 'comparison, open-source vs managed, migration' },
      { n: 8, title: 'GraphQL Gateway & BFF Pattern', focus: 'GraphQL federation, backend-for-frontend, aggregation' },
      { n: 9, title: 'API Gateway at Netflix, Amazon & Spotify', focus: 'Zuul, API Gateway, real-world patterns' },
      { n: 10, title: 'Complete Interview Masterclass', focus: 'model answers, design problems, cheat sheet' },
    ],
  },
];

// ─── Slug normalisation ──────────────────────────────────────────────────────

/**
 * Converts a session title to a URL-safe kebab-case slug of ≤ 30 characters.
 * Rule: lowercase → strip non-alphanumeric → split → dedup words → join with
 * hyphens → truncate at word boundary to ≤ 30 chars.
 */
function toSessionSlug(title: string): string {
  const clean = title
    .toLowerCase()
    .replace(/[&—(),.]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();

  const words = clean.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      deduped.push(w);
    }
  }

  let slug = deduped.join('-');
  while (slug.length > 30) {
    deduped.pop();
    slug = deduped.join('-');
  }
  return slug;
}

// ─── Narrations lookup ───────────────────────────────────────────────────────
// Each entry: [hook, body, gotcha, closing]
// All Hinglish, FAANG-prep framing, teaching the session FOCUS specifically.

const NARRATIONS: Record<string, Record<number, SceneNarrations>> = {
  'load-balancing': {
    1: {
      hook: 'Ek server pe poora traffic daal diya — interview mein yeh basic miss hai. Load balancing fundamentals jaante ho?',
      body: 'Load balancer ek reverse proxy hai jo incoming requests ko multiple servers pe distribute karta hai. Hardware load balancers — jaise F5 — bahut fast hain, lekin expensive aur rigid hain. Software load balancers — jaise Nginx, HAProxy — flexible aur container-friendly hain. Cloud pe AWS ALB ya GCP Cloud Load Balancing use hota hai. Types: L4 TCP/UDP level routing karta hai, L7 HTTP headers aur URLs dekh ke smart routing karta hai. FAANG pe mostly L7 prefer hota hai application-aware decisions ke liye.',
      gotcha: 'Hardware vs software ka interview trap: hardware 10M RPS handle karta hai lekin config rigid hai, software easily scale hota hai containers mein but CPU-bound hai. Dono ka hidden catch: single load balancer khud SPOF hai — active-passive pair ya DNS round-robin pe multiple LBs zaroori hain. 90% candidates yeh mention karna bhool jaate hain.',
      closing: 'Load balancer sirf traffic distribute nahi karta — yeh availability aur scalability ka foundation hai. Yeh session 1 of 10 hai. Guru-sishya.in pe practice karo — FAANG-level questions ready hain.',
    },
    2: {
      hook: 'Round robin diya — lekin ek server 8 core hai, doosra 2 core. P99 latency kyun spike kar raha hai? Yeh FAANG ka classic trap hai.',
      body: 'Round robin: requests ko cycle mein distribute karo — 1, 2, 3, 1, 2, 3. Simple, stateless, O(1). Lekin problem: sab servers equal nahi hote. Weighted round robin solve karta hai — Server A weight 3, Server B weight 1 → 3 requests A pe, 1 B pe. Nginx config: upstream block mein server address weight=3. Implementation mein GCD-based scheduler use hota hai — virtual rotation cycle minimize karta hai memory. Stateless workloads ke liye ideal hai jahan request cost uniform ho.',
      gotcha: 'Round robin ka hidden trap: long-running requests. S1 pe 10 heavy requests, S2 pe 10 light requests — round robin 50-50 deta rahega even though S1 already overloaded hai. Weighted round robin bhi nahi bachata — woh static weights pe based hai, runtime load nahi dekhta. Yahan Least Connections zyada better hai. Interviewer exactly yahi puchta hai: "When would round robin FAIL?" — agar yeh answer nahi diya toh loop hai.',
      closing: 'Round robin simple lagta hai lekin workload asymmetry iska weakness hai. Stateless, uniform-cost services ke liye use karo — warna Least Connections better choice hai. Guru-sishya.in pe abhi practice karo.',
    },
    3: {
      hook: 'Session persistence bina IP hash ke kya hoga? User ka cart clear ho jaayega. Yeh L4 design question mein aksar FAANG poochha jaata hai.',
      body: 'Least Connections: nayi request us server ko bhejo jiske paas abhi sabse kam active connections hain. Min-heap se O(log N) track karo. Best for long-lived connections — WebSockets, database connections, file uploads. IP Hash: client IP ka hash leke consistent server pe route karo — same client always same server. Sticky sessions ka simplest implementation. Nginx mein: ip_hash directive. Drawback: agar ek corporate NAT se 10,000 users aayein, unka IP same dikhega — ek hi server pe saara load.',
      gotcha: 'IP Hash ka NAT hotspot problem: large enterprise networks mein thousands of users ek IP se aate hain. Solution: IP hash ki jagah consistent hashing with user_id cookie use karo. FAANG interview mein yeh distinction critical hai: IP hash simple hai but unfair distribution ka risk hai, consistent hashing more uniform. Dono "hash-based" hain but fundamentally different problems solve karte hain.',
      closing: 'Least connections dynamic load ke liye, IP hash session persistence ke liye, consistent hashing distributed scale ke liye. Yeh session 3 — algorithms build hote jaate hain. Guru-sishya.in pe code examples dekho.',
    },
    4: {
      hook: '10 servers hain, ek server down hua — aur 9/10 requests reroute hogaye. Consistent hashing nahi use kiya toh system design mein fail ho jaoge.',
      body: 'Consistent hashing: 0 se 2^32 ka circular ring banao. Har server ko ring pe multiple points pe place karo — yeh virtual nodes hain. Request ke key ka hash leke ring pe clockwise nearest server dhundho. Jab ek server hata do: sirf us server ki keys adjacent server pe jaati hain, baaki sab undisturbed rehti hain — O(K/N) keys move hoti hain, not O(K). Virtual nodes hotspot problem solve karte hain — zyada virtual nodes, zyada uniform distribution. DynamoDB, Cassandra, Redis Cluster — sab yahi use karte hain.',
      gotcha: 'Interview trap: "Server add karne pe cache invalidation kaise hoti hai?" Sirf ek subset of keys neighboring server se naye server pe move hoti hain — minimal disruption. Lekin warmup period hota hai — naye server pe cold cache, hit rate temporarily drop hoti hai. Thundering herd prevention ke liye: gradual traffic shift ya pre-warming strategy use karo. Yeh 90% candidates miss karte hain.',
      closing: 'Consistent hashing distributed systems ka core primitive hai — load balancer se le ke sharding tak. Virtual nodes = uniform distribution. Guru-sishya.in pe full ring implementation dekhna mat bhoolna.',
    },
    5: {
      hook: 'Server down hai lekin load balancer traffic bhej raha hai — 5xx errors barsaat ki tarah aa rahe hain. Health check configure nahi kiya? Interview mein bhi yahi trap hai.',
      body: 'Passive health check: actual traffic failures se detect karta hai — slow aur reactive. Active health check: load balancer khud /health endpoint pe ping karta hai — proactive. Deep health check: sirf HTTP 200 nahi, downstream dependencies bhi check karo — DB connection pool, cache, third-party APIs. Active-active failover: dono servers traffic handle karte hain. Active-passive: secondary sirf standby mein rehta hai, primary fail pe takeover karta hai. Circuit breaker: failure rate threshold par open state mein jaata hai — 30 seconds ke liye traffic block karta hai.',
      gotcha: 'Deep health check ka thundering herd trap: agar /health endpoint database query karta hai, toh har load balancer instance simultaneously sab servers ko hit karega. Ek hi time pe 10 LBs × 100 backends = 1000 DB queries per health-check interval. Solution: health check lightweight rakho, sirf connection pool status check karo, ya synthetic transaction use karo jo DB pe direct hit na kare.',
      closing: 'Health checks + circuit breakers = resilient system. Bina inke, ek server failure poore cluster ko drain kar sakta hai. Active deep checks lagao lekin lightweight rakho. Guru-sishya.in pe design patterns practice karo.',
    },
    6: {
      hook: 'L4 ya L7 — interviewer ne poochha aur candidate blankly dekh raha tha. OSI model yaad karna sirf theory nahi, yeh practical tradeoff hai.',
      body: 'L4 load balancer: TCP/UDP level pe kaam karta hai — IP aur port dekh ke forward karta hai. Ultra-fast, no content inspection, nanosecond-level decisions. AWS Network Load Balancer is L4. L7 load balancer: HTTP headers, URLs, cookies, request body dekh ke route karta hai. Path-based routing: /api → backend cluster, /static → CDN, /ws → WebSocket servers. AWS ALB is L7. Performance difference: L4 microseconds latency, L7 milliseconds — SSL termination aur header parsing ki additional cost.',
      gotcha: 'WebSocket routing trap: L4 ka WebSocket ke saath problem hai — HTTP → WebSocket upgrade header ko decode nahi kar sakta, toh correct backend pe route nahi hoga. L7 zaruri hai WebSocket ke liye. Lekin L7 HTTP/1.1 keep-alive mein back-to-back requests same backend pe jaati hain — effective load distribution lose hoti hai. Solution: connection draining + HTTP/2 multiplexing ya proper timeout configuration.',
      closing: 'L4 for speed, L7 for intelligence. FAANG systems dono layers simultaneously use karte hain — L4 at edge for raw throughput, L7 internally for microservices routing. Guru-sishya.in pe architecture diagrams dekho.',
    },
    7: {
      hook: '10,000 HTTPS connections per second — agar har backend server TLS handle kare, CPU 90% chali jaaye. SSL termination miss karna FAANG mein rookie mistake hai.',
      body: 'SSL/TLS termination: load balancer pe TLS decrypt karo, backends ko plain HTTP mein forward karo — CPU-intensive asymmetric encryption ek jagah pe. Hardware-accelerated: AWS CloudFront dedicated crypto chips use karta hai. Certificate management simplified: ek jagah rotate karo, har backend server ko individually update karne ki zaroorat nahi. mTLS (mutual TLS): client bhi certificate present kare — zero-trust architecture ke liye. TLS 1.3 improvement: ek round-trip kam, 100ms faster on mobile connections.',
      gotcha: 'Security compliance trap: SSL termination ke baad internal network pe traffic unencrypted hai — yeh PCI-DSS, HIPAA, SOC2 compliance mein violation hai. Solution: SSL re-encryption — LB decrypt karta hai, inspect karta hai, phir re-encrypt karke backend ko bhejta hai. Downside: certificate management 2X ho jaati hai aur latency thodi badhti hai. FAANG interview mein: performance vs security compliance tradeoff clearly explain karo.',
      closing: 'SSL termination for performance, mTLS for zero-trust security, re-encryption for compliance. Tradeoff clearly articulate karna FAANG-level answer hai. Guru-sishya.in pe practice karo.',
    },
    8: {
      hook: 'Indian users ko US server pe route kar rahe ho — 300ms extra latency. GSLB nahi implement kiya? System design mein yeh basic miss hai.',
      body: 'GSLB kaam kaise karta hai: DNS response mein nearest region ka IP return karo. GeoDNS: user IP dekh ke closest datacenter ka IP return. Latency-based routing: AWS Route 53 actual latency measurements use karta hai — sirf geography nahi, real RTT. Anycast: same IP address multiple regions mein BGP se advertise karo, routing automatically closest PE. Health propagation: region down hua, DNS TTL expire pe traffic next region pe shift. TTL tuning critical: 60s vs 300s tradeoff between failover speed aur DNS amplification risk.',
      gotcha: 'DNS TTL ka failover trap: TTL 300 seconds aur datacenter suddenly down — 5 minutes tak users 5xx dekhenge. Lekin TTL 30 seconds karo — DNS resolver overload, costs shoot up, amplification attack surface badh jaata hai. Production solution: AWS Route 53 health-check integration ke saath TTL dynamically reduce karo — healthy state mein 300s, health-check fail pe 30s. Yeh latency vs availability tradeoff FAANG mein explicitly poochha jaata hai.',
      closing: 'GSLB multi-region architecture ka glue hai. GeoDNS + health-aware TTL adjustment = resilient global system. Single-region se multi-region evolution ka answer isi pe hota hai. Guru-sishya.in pe architecture practice karo.',
    },
    9: {
      hook: 'Netflix pe 247 million users — load balancer kaise design kiya? Yeh case study FAANG interview mein direct score karta hai.',
      body: 'Netflix: Zuul L7 gateway at edge + Ribbon client-side load balancer for internal services. Eureka service registry se server list lete hain, Ribbon client pe hi load balance karta hai — no central bottleneck. Uber: Frontier gateway, Ringpop consistent hashing, per-trip affinity routing. Google: Maglev software load balancer — commodity hardware pe 1 million RPS per machine, ECMP routing. Modern trend: service mesh (Envoy/Istio) — direct pod-to-pod communication via sidecar proxy, central LB ki zaroorat nahi for east-west traffic.',
      gotcha: 'Service mesh vs load balancer confusion: "Netflix service mesh use karta hai — toh LB ki zaroorat nahi?" Wrong. Edge load balancer (Zuul) external internet traffic handle karta hai, service mesh internal microservice communication. Two separate layers — dono zaroori hain. Client-side load balancing fail tab hota hai jab stale Eureka cache hoti hai — Netflix solution: short TTL + heartbeat aur fallback to last-known-good list.',
      closing: 'Real FAANG systems hybrid approach: edge LB + internal service mesh + client-side load balancing. Koi ek magic solution nahi hai. Case studies sikhte waqt yeh layering samajhna zaroori hai. Guru-sishya.in pe complete diagrams hain.',
    },
    10: {
      hook: 'Load balancing interview mein 90% candidates ek common mistake karte hain. Kya tum woh galti jaante ho? Final masterclass mein sab clear ho jaayega.',
      body: 'Model answer framework — Clarify, Component, Tradeoff, Scale: Step 1 clarify karo — "Traffic kya hai? Stateful ya stateless? Single region ya multi?" Step 2 L4 vs L7 choose karo with justification. Step 3 algorithm — round robin stateless ke liye, least connections long-lived ke liye, consistent hashing distributed ke liye. Step 4 health checks, circuit breakers, GSLB mention karo. Cheat sheet: RR → stateless uniform load. LC → variable-duration connections. CH → distributed cache/sharding. L4 → raw speed. L7 → content routing. GSLB → multi-region.',
      gotcha: 'Most common interview mistake: implementation pe directly jump karna bina requirements clear kiye. Interviewer underspecified question deta hai: "Design a load balancer." Candidates immediately round robin explain karne lagte hain. Senior engineers pehle clarify karte hain — expected RPS, stateful ya stateless, compliance requirements, SLA targets. Yeh clarifications tumhe mid-level se senior-level dikhate hain — hiring bar clear karta hai.',
      closing: 'Load balancing cheat sheet committed karo: RR, LC, CH, L4, L7, GSLB — each with one-line use case. FAANG mein concept depth + tradeoff clarity = hire decision. Guru-sishya.in pe mock interviews aur all 10 sessions complete karo.',
    },
  },

  'caching': {
    1: {
      hook: 'Database pe har request ja rahi hai — 200ms per call, 10,000 users. Caching basics miss karna FAANG mein instant reject hai.',
      body: 'Caching kya hai: frequently accessed data ko fast storage mein store karo — memory mein — taaki slow storage (DB, network) pe baar baar jaane ki zaroorat na pade. Cache hit: data cache mein mila — microseconds. Cache miss: cache mein nahi mila — DB pe jaao, cache mein store karo, return karo — milliseconds. Hit rate = hits / (hits + misses). Target: 80%+ hit rate. Cache types: in-process (JVM heap), distributed (Redis, Memcached), CDN (static assets). Latency reduction: DB 10ms, Redis 0.1ms — 100x faster.',
      gotcha: 'Cache aur database consistency ka fundamental trap: cache mein stale data hai, DB mein fresh data. User ne profile update kiya — DB updated but cache nahi. Read-your-own-write consistency fail. Solution strategy: TTL-based expiry (simple but stale window), write-through (update cache aur DB simultaneously), cache invalidation on write (complex but consistent). FAANG mein yeh tradeoff clearly articulate karna zaroori hai.',
      closing: 'Caching sirf performance hack nahi — yeh system design ka core building block hai. Cache hit rate, eviction policy, consistency model — teeno ka balance samajhna zaroori hai. Guru-sishya.in pe session 1 ke practice questions karo.',
    },
    2: {
      hook: 'LRU cache implement kiya — phir bhi OOM hua. Eviction policy galat choose karna FAANG mein sabse bada trap hai.',
      body: 'LRU (Least Recently Used): sabse kam recently access hua item evict karo. HashMap + Doubly Linked List se O(1) implementation. Best for temporal locality — recently accessed data likely reused hoga. LFU (Least Frequently Used): sabse kam baar access hua item evict karo. More complex — min-heap ya frequency bucket list. Best for Zipf distribution — popular items permanently cached. FIFO (First In First Out): simple queue, oldest item evict karo. Simple but ignores access pattern. Variants: LRU-K, 2Q, ARC (Adaptive Replacement Cache).',
      gotcha: 'LRU ka scan resistance problem: sequential scan — ek baar database table scan kiya toh saare hot items cache se evict ho jaate hain because scan items "recently used" ban jaate hain. Solution: 2Q algorithm — new items sirf probation queue mein jaate hain, repeated access hone par main cache mein promote hote hain. MySQL InnoDB ka buffer pool exactly yahi use karta hai. LFU iske against better hai but frequency counter overflow problem hai.',
      closing: 'Eviction policy choose karo use case ke basis pe: LRU for general web cache, LFU for popularity-skewed data, FIFO for time-ordered queues. Wrong policy = low hit rate = performance regression. Guru-sishya.in pe implementation code dekho.',
    },
    3: {
      hook: 'Cache mein write kiya, DB mein nahi — data loss ho gaya. Write strategy galat chose karna production disaster hai aur FAANG trap bhi.',
      body: 'Write-Through: cache aur DB ko simultaneously update karo — consistency guaranteed but write latency doubles. Good for read-heavy, write-important data. Write-Behind (Write-Back): cache mein write karo immediately, DB ko asynchronously update karo — fast writes, lekin data loss risk if cache crashes before flush. Good for high write throughput. Cache-Aside (Lazy Loading): application khud DB se read karta hai cache miss pe, cache mein store karta hai. Most flexible, most common. Pattern: get from cache → miss → get from DB → write to cache → return.',
      gotcha: 'Cache-Aside ka race condition: do requests simultaneously miss karte hain, dono DB se read karte hain, dono cache mein write karte hain — potential stale overwrite. Solution: distributed lock ya probabilistic early expiration. Write-behind ka durability trap: cache node crash kiya aur unflushed writes lost. Solution: write-behind queue Redis Streams pe persist karo. FAANG interviews mein consistency vs performance tradeoff yahan central question hai.',
      closing: 'Write-Through for consistency, Write-Behind for throughput, Cache-Aside for flexibility. Hybrid: Cache-Aside read + Write-Through write = balance. Real systems usually cache-aside pattern use karte hain. Guru-sishya.in pe patterns practice karo.',
    },
    4: {
      hook: 'Redis sirf key-value store nahi hai — sorted sets se leaderboards, streams se event queues. Yeh internals FAANG mein advanced question hai.',
      body: 'Redis single-threaded event loop architecture — IO multiplexing se concurrency handle karta hai, no mutex overhead. Data types: Strings (get/set/incr/expire), Hashes (HSET/HGETALL — user profiles), Lists (LPUSH/RPOP — queues), Sets (SADD/SMEMBERS — unique visitors), Sorted Sets (ZADD/ZRANGE — leaderboards, rate limiting), Streams (XADD/XREAD — event sourcing). Persistence: RDB snapshots (point-in-time), AOF (append-only log, durability). Redis 7.0: multi-threading for IO but command processing still single-threaded.',
      gotcha: 'Redis single-thread bottleneck: KEYS * command production pe mat use karna — O(N) hai aur poora Redis block karta hai. Alternative: SCAN command iterates in chunks — non-blocking. Big key problem: ek Redis key mein 10MB data — serialization aur network transfer slow hoga. Solution: key ko smaller chunks mein split karo. LRANGE kisi bhi size list pe — O(S+N) hai, large lists pe slow. Yeh operational gotchas FAANG SRE interviews mein aksar poochhe jaate hain.',
      closing: 'Redis sirf cache nahi — session store, queue, leaderboard, pub-sub, distributed lock sab kuch hai. Right data structure choose karna performance 10x impact karta hai. Guru-sishya.in pe Redis data types ke practice problems karo.',
    },
    5: {
      hook: 'Memcached ya Redis — interview mein galat choose kiya toh follow-up questions mein expose ho jaoge. Yeh comparison FAANG ka classic hai.',
      body: 'Memcached: pure in-memory key-value store. Simple, fast, multi-threaded (true parallelism). No persistence, no data structures beyond strings, no replication built-in. Best for: simple distributed caching where you need raw speed aur horizontal scale. Redis: single-threaded core, rich data structures, optional persistence (RDB/AOF), built-in replication, Lua scripting, pub-sub, cluster mode. More features but more complexity. Benchmarks: Memcached slightly faster for simple get/set, Redis comparable. Facebook aur Twitter dono historically Memcached use karte the — ab Redis prefer karte hain.',
      gotcha: 'Memcached multi-threading advantage ka hidden cost: cache stampede mein multiple threads simultaneously same key ko DB se fetch karte hain. Redis single-threaded model mein yeh problem kam hai kyunki ek hi thread processes sequentially. Memcached mein explicit application-level locking zaroori hai stampede prevent karne ke liye. Interview mein: "Kyun Twitter ne Memcached se Redis migrate kiya?" — answer: rich data structures (sorted sets for timeline ranking) aur atomic operations.',
      closing: 'Simple distributed cache = Memcached. Rich features, persistence, advanced data structures = Redis. New projects almost always Redis choose karte hain. Guru-sishya.in pe benchmark data aur decision framework dekho.',
    },
    6: {
      hook: '"There are only two hard things in CS — cache invalidation and naming things." Phil Karlton ka yeh quote FAANG interviews mein real hai.',
      body: 'Cache invalidation strategies: TTL-based — data automatically expire hota hai. Simple but stale window. Event-driven invalidation — DB write pe cache entry invalidate karo. Consistent but complex. Version key — cache key mein version number include karo: "user:123:v5". Stale-while-revalidate — stale data serve karo jab TTL expire ho, background mein refresh karo. Thundering herd prevention: mutex lock, probabilistic early expiration, request coalescing. Cache stampede: TTL same time pe expire hoti hai multiple keys ki — DB overload. Solution: random jitter add karo TTL mein.',
      gotcha: 'Distributed cache invalidation race condition: user ne profile update kiya → DB updated → cache invalidation event publish hua → meanwhile another request ne stale data cache mein load kar liya (cache miss pe DB se) → invalidation event process hua lekin cache already refreshed with old data? No — event ordering ensures: invalidate first, then the next cache miss will fetch fresh. Lekin event queue delay mein stale data serve ho sakta hai. Solution: strong consistency ke liye write-through + versioned keys.',
      closing: 'Cache invalidation hard hai kyunki distributed systems mein no global clock aur no atomic operations across DB + cache. TTL + event-driven hybrid approach production mein best practice hai. Guru-sishya.in pe stampede patterns practice karo.',
    },
    7: {
      hook: 'Static assets har baar origin server se serve ho rahe hain — CDN miss. 500ms latency jab 50ms ho sakti thi. Yeh FAANG design review mein red flag hai.',
      body: 'CDN caching: origin server se content pull karke globally distributed edge servers pe cache karo. Push vs Pull CDN: push — content explicitly upload karo, pull — first request pe origin se fetch aur edge pe cache. Cache-Control headers: max-age, s-maxage (CDN-specific), no-store, no-cache, must-revalidate. CloudFront: AWS ka CDN, 450+ PoPs. Cloudflare: 300+ PoPs, DDoS protection built-in. Edge computing: Cloudflare Workers, AWS Lambda@Edge — code run karo at edge, not just static cache.',
      gotcha: 'CDN cache poisoning attack: attacker manipulate karta hai cached response — ek malicious response cache mein store ho jaati hai, all users ko serve hoti hai. Prevention: strict Cache-Control headers, vary headers correctly set karo, cache key include karo Host header. Dynamic content caching trap: personalized content (user-specific) CDN pe cache nahi karni chahiye — vary: Cookie header use karo to exclude personalized responses from CDN cache.',
      closing: 'CDN sirf static assets ke liye nahi — API responses bhi cache karo (public, non-user-specific). Edge computing CDN ko compute platform bana deta hai. Cache-Control headers master karo. Guru-sishya.in pe CDN configuration examples dekho.',
    },
    8: {
      hook: 'Single Redis node — ek point of failure, memory limit, no true scale. Distributed caching fail karna FAANG se direct reject hai.',
      body: 'Distributed caching patterns: consistent hashing — keys ko ring pe distribute karo across nodes. Redis Cluster: 16384 hash slots, minimum 3 primary + 3 replica nodes. Replication: primary-replica setup — primary writes, replicas serve reads. Asynchronous replication — eventual consistency. Partition tolerance: network partition mein split-brain possible. Redis Sentinel: automatic failover, no cluster. Twemproxy (Twitter): lightweight proxy for sharding Memcached/Redis. Key patterns: read replicas for read-heavy, pipeline writes for throughput.',
      gotcha: 'Redis Cluster ka cross-slot transaction limitation: MULTI/EXEC transactions sirf single slot ke keys pe work karti hain — multi-key operations fail hoti hain agar keys alag slots pe hain. Solution: hash tags — {user}.session aur {user}.profile same slot pe jaate hain because hash tag {user} same hash. Yeh Redis Cluster mein advanced pattern hai jo most candidates miss karte hain. FAANG mein distributed transaction mein yahi trap aata hai.',
      closing: 'Distributed caching = consistent hashing + replication + partition handling. Redis Cluster production ke liye, Sentinel simpler failover ke liye. Hash tags for co-located keys. Guru-sishya.in pe Redis Cluster architecture explore karo.',
    },
    9: {
      hook: 'Instagram 1 billion users ka feed — Redis pe kaise chalta hai? Yeh case study FAANG system design mein direct score karta hai.',
      body: 'Instagram: Redis sorted sets for timeline ranking — post timestamp as score, user_id:post_id as member. ZREVRANGE se paginated feed. Follow graph: Redis sets mein followers store. Media metadata: Cassandra. Cache eviction: custom LRU with popularity score. Twitter: Flock (Memcached based) + Redis for real-time timelines. Fan-out on write for timeline — write time pe followers ke caches update. Fan-out on read for celebrities (millions of followers) — too expensive to fan-out on write. Discord: Redis pub-sub for real-time presence, per-guild member lists as Redis sets.',
      gotcha: 'Fan-out on write vs read trade-off: celebrity problem. Priyanka Chopra ke 80 million followers — ek tweet pe 80M cache writes, toh fan-out on write infeasible. Solution: hybrid — normal users fan-out on write, celebrities (>threshold followers) fan-out on read + pre-computed partial timelines. FAANG interview mein yeh "hot key" problem explicitly poochha jaata hai — ek user ki activity disproportionate load kaisi handle karoge?',
      closing: 'Real caching at scale = multiple strategies simultaneously. Fan-out on write, fan-out on read, hot key isolation — sab ka combination. Guru-sishya.in pe all three case studies detailed mein hain.',
    },
    10: {
      hook: 'Caching interview mein ek question poochha jaata hai jo 80% candidates galat answer dete hain. Final masterclass mein yeh clear ho jaayega.',
      body: 'Model answer framework for cache design: 1. Data characterize karo — read vs write ratio, data size, staleness tolerance. 2. Cache topology — in-process vs distributed, single node vs cluster. 3. Eviction policy — LRU for recency, LFU for frequency, FIFO for queue. 4. Write strategy — write-through for consistency, write-behind for throughput, cache-aside for flexibility. 5. Invalidation — TTL + event-driven hybrid. 6. Failure modes — cache miss storm, stampede, poisoning. Cheat sheet: Redis for rich data, Memcached for simple distributed, CDN for static, in-process for ultra-low latency.',
      gotcha: 'Most common mistake: designing cache without defining "what is success." Cache hit rate target, acceptable staleness window, consistency requirement, memory budget — inhe clarify kiye bina architecture present karna junior behavior hai. Example: "Cache hit rate 95% target, 1-second staleness acceptable for feed, strict consistency for payment status" — yeh clarity design decisions drive karti hai. Senior answer always starts with requirements.',
      closing: 'Caching cheat sheet: identify hot data → choose topology → set eviction → handle writes → manage invalidation → monitor hit rate. Guru-sishya.in pe mock interviews karo, sab 10 sessions complete karo — interview ready ho jaoge.',
    },
  },

  'database-design': {
    1: {
      hook: 'SQL choose kiya jab NoSQL chahiye tha — ya ulta kiya. Yeh decision framework miss karna FAANG system design mein costly mistake hai.',
      body: 'SQL (Relational): ACID transactions, strong consistency, structured schema, complex joins. Best for: financial systems, inventory, anything needing joins aur transactions. PostgreSQL, MySQL, Aurora. NoSQL types: Document (MongoDB) — flexible schema, nested objects; Key-Value (DynamoDB, Redis) — ultra-fast lookup; Wide-Column (Cassandra) — time-series, write-heavy; Graph (Neo4j) — relationship-heavy data. CAP theorem: Consistency, Availability, Partition Tolerance — choose any two. SQL databases CP, Cassandra AP, DynamoDB configurable. BASE vs ACID — eventual consistency tradeoff.',
      gotcha: 'ACID vs BASE confusion trap: "NoSQL matlab no transactions" — galat. MongoDB 4.0+ multi-document ACID transactions support karta hai. DynamoDB bhi transactions support karta hai. Interview trap: "When would you choose MongoDB over PostgreSQL?" Wrong answer: "MongoDB is faster." Correct: "MongoDB for flexible schema aur document-oriented access patterns, PostgreSQL for complex queries, joins, aur strict consistency requirements." Schema-less myth: MongoDB collections eventually develop implicit schemas.',
      closing: 'Decision framework: data structure (relational vs document), access patterns (joins vs key lookup), consistency needs (ACID vs BASE), scale (vertical vs horizontal). Yeh framework har system design interview mein use karo. Guru-sishya.in pe practice questions hain.',
    },
    2: {
      hook: 'Full table scan — query 30 seconds le rahi hai. Index nahi lagaya? Database indexing miss karna FAANG mein instant performance red flag hai.',
      body: 'B-Tree index: balanced tree structure — O(log N) reads aur writes. PostgreSQL/MySQL ka default index type. Range queries support karta hai. Hash index: exact equality O(1) lookup lekin no range queries. Memory-optimized tables mein useful. Composite index: multiple columns pe — (last_name, first_name) — column order matters! Leading column rule: composite index (A, B) query A ke liye use ho sakta hai, B ke liye nahi. Covering index: query ke saare columns index mein hain — table rows access nahi karne padte. Index selectivity: high selectivity = few duplicate values = better index. Gender column pe index? Useless.',
      gotcha: 'N+1 query problem: ORM se 100 users fetch karo, phir har user ke liye separate query for orders — 101 queries instead of 1 JOIN. Solution: eager loading (JOIN), batch fetching, or dataloader pattern. Write amplification: har INSERT/UPDATE/DELETE ke liye every index update hota hai. Rule: indexing improves read, hurts write. Index too many columns → write performance degrades. EXPLAIN ANALYZE in PostgreSQL — always check query plan before adding index.',
      closing: 'Indexing rule: add index where query selectivity is high aur access frequency justifies write overhead. B-tree for range queries, covering index for read performance, composite index with right column order. Guru-sishya.in pe query optimization labs hain.',
    },
    3: {
      hook: 'Single database — 500GB data, 100K writes per second. Vertical scaling limit aa gaya. Sharding nahi jaante? FAANG interview mein yeh central question hai.',
      body: 'Database sharding: data ko multiple databases (shards) mein horizontally partition karo. Shard key selection critical hai. Range-based sharding: user_id 1-1M → Shard 1, 1M-2M → Shard 2. Simple but hotspot risk — new users sab last shard pe. Hash-based sharding: shard = hash(user_id) % N. Uniform distribution lekin range queries inefficient. Directory-based sharding: separate lookup service mein mapping store karo. Flexible but extra hop. Resharding: nodes add karne pe data move karna costly. Consistent hashing minimizes data movement.',
      gotcha: 'Cross-shard query trap: ORDER BY, GROUP BY, JOIN across shards — distributed query, expensive. Solution: shard key design karo taki 90% queries single-shard ho. Twitter example: tweet sharding by tweet_id efficient hai for individual tweet lookup, but user timeline query multiple shards hit karta hai. Hotspot shard: viral content ke saath ek shard overwhelmed. Solution: content delivery network + read replicas for hot shards, or sub-sharding.',
      closing: 'Sharding key selection = most important design decision. Wrong key → hotspots → resharding nightmare. Hash sharding for uniform distribution, range for time-series data, directory for flexibility. Guru-sishya.in pe sharding design labs karo.',
    },
    4: {
      hook: 'Primary database down — 5 minutes downtime, data loss possible. Replication aur high availability properly design nahi kiya? FAANG mein yeh critical topic hai.',
      body: 'Master-Slave (Primary-Replica) replication: primary writes karta hai, replicas reads serve karte hain. Asynchronous replication: primary commit karta hai, replica ko asynchronously update karta hai — fast but replication lag. Synchronous replication: primary waits for replica acknowledgment — consistent but slower writes. Semi-synchronous: at least one replica acknowledge kare. Multi-master: multiple nodes accept writes — conflict resolution complex. Consensus protocols: Raft (etcd, CockroachDB) aur Paxos — leader election, log replication, quorum-based commits.',
      gotcha: 'Replication lag trap: read-your-own-write consistency. User ne post kiya → primary pe write → immediately apna profile read kiya → replica se serve hua with replication lag → "Post not found" error. Solution: read from primary for the user who just wrote, others from replica. Session consistency: sticky reads — same user consistently reads from same replica or primary. FAANG mein: "How do you ensure read-your-own-write consistency with async replication?" — yeh answer directly differentiate karta hai.',
      closing: 'Replication for availability aur read scaling, consensus protocols for strong consistency aur leader election. Asynchronous fast hai, synchronous consistent hai — choose based on data criticality. Guru-sishya.in pe HA patterns practice karo.',
    },
    5: {
      hook: 'Schema design galat hua — normalization over-kiya aur 10 JOINs pe query chali. Ya under-kiya aur data inconsistency. FAANG mein yeh judgment question hai.',
      body: 'Normalization: data redundancy eliminate karo, update anomalies prevent karo. 1NF: atomic values, 2NF: no partial dependency, 3NF: no transitive dependency. Denormalization: intentionally redundancy add karo for query performance — materialized views, pre-computed aggregates. Embedding vs Referencing (NoSQL): embed related data in same document (single read, write amplification risk) vs reference separate collection (join required, independent update). Rule of thumb: embed data that is always fetched together, reference data that changes independently.',
      gotcha: 'Denormalization trap: user ka city data 50 tables mein embed kiya — user ek city change karta hai, 50 rows update karni padengi. Solution: reference karo, embed mat karo frequently-changing data. But: user address at time of order — this SHOULD be embedded/snapshotted because it must not change retroactively. FAANG interview: "Design an e-commerce order schema" — order mein shipping address embed karo (snapshot at order time), but product reference karo (catalog link).',
      closing: 'Schema design = access pattern first, normalization second. Embed for co-located reads, reference for independent updates, snapshot for historical accuracy. Real FAANG systems use both strategies contextually. Guru-sishya.in pe schema design problems hain.',
    },
    6: {
      hook: 'Dirty read, phantom read, lost update — ACID transaction isolation levels ka ek bhi mistake FAANG system design mein disqualify karta hai.',
      body: 'ACID: Atomicity (all or nothing), Consistency (valid state), Isolation (concurrent transactions don\'t interfere), Durability (committed data persists). Read phenomena: Dirty Read (read uncommitted data), Non-Repeatable Read (same row, different value in same transaction), Phantom Read (new rows appear in same query). Isolation levels: READ UNCOMMITTED (all problems), READ COMMITTED (no dirty reads — PostgreSQL default), REPEATABLE READ (no dirty, no non-repeatable — MySQL default), SERIALIZABLE (all phenomena prevented, slowest). MVCC (Multi-Version Concurrency Control): readers don\'t block writers — PostgreSQL, Oracle implementation.',
      gotcha: 'MVCC snapshot isolation vs serializable trap: snapshot isolation prevents most read phenomena but NOT write skew. Write skew: two concurrent transactions read same data, make decisions based on it, write conflicting updates. Example: doctor on-call system — two doctors simultaneously check "is anyone else on call?" both see yes, both mark themselves "off-call" — nobody on call. Solution: SELECT FOR UPDATE (pessimistic locking) or SERIALIZABLE isolation. PostgreSQL SSI (Serializable Snapshot Isolation) detects write skew without full locking.',
      closing: 'Isolation level choose karo based on correctness requirements: READ COMMITTED for most web apps, SERIALIZABLE for financial transactions. MVCC for read concurrency, explicit locks for write skew prevention. Guru-sishya.in pe transaction design problems practice karo.',
    },
    7: {
      hook: 'MongoDB ya Cassandra ya DynamoDB — galat choose kiya aur production mein performance disaster. NoSQL choice framework jaante ho?',
      body: 'MongoDB (Document): flexible schema, BSON documents, rich query language, secondary indexes, ACID transactions (4.0+). Best for: content management, product catalogs, user profiles with variable schema. Cassandra (Wide-Column): masterless distributed architecture, tunable consistency, excellent write throughput, time-series data. Best for: IoT sensor data, activity feeds, time-ordered data. Linear scaling. DynamoDB (Key-Value + Document): AWS managed, single-digit millisecond latency, auto-scaling, on-demand pricing. Best for: serverless applications, gaming leaderboards, session stores. Global Tables for multi-region.',
      gotcha: 'Cassandra anti-pattern: using it like a relational database with complex queries. Cassandra is optimized for known access patterns — table design around queries, not entities. Query-first design: "What questions will I ask?" determines table structure. Anti-pattern: SELECT * with multiple filters without partition key — full table scan. DynamoDB anti-pattern: hot partitions — same partition key for all writes (e.g., using current date as partition key). All writes go to same partition, throughput limited to 1000 WCU per partition.',
      closing: 'MongoDB for flexibility + queries, Cassandra for write-heavy time-series, DynamoDB for AWS-native serverless. Wrong choice = schema migration nightmare. Query-first design for NoSQL. Guru-sishya.in pe NoSQL data modeling workshop hai.',
    },
    8: {
      hook: 'Connection pool exhausted — database pe 10,000 connections. Application hang ho gayi. Connection pooling aur N+1 FAANG SRE mein critical topic hai.',
      body: 'Database connections expensive hain — TCP handshake, authentication, session state. Connection pool: pre-created connections reuse karo. PgBouncer (PostgreSQL): transaction-mode pooling — connection sirf transaction duration ke liye hold karo. Hikari CP (Java): high-performance pool, 20-50ms overhead only. Pool sizing formula: connections = (core_count * 2) + effective_spindle_count. Too few: requests queue up. Too many: database overwhelmed. N+1 problem: ORM fetch 100 users, then per-user query for posts — 101 queries. Solution: JOIN, eager loading, batch fetching, or DataLoader pattern (GraphQL).',
      gotcha: 'Connection pool timeout cascade: pool exhausted → new requests timeout → error rate spikes → alerts fire → engineers investigate → meanwhile pool stays exhausted because connections held by slow queries. Solution: statement timeout at DB level (kill slow queries), connection timeout at pool level (fail fast), circuit breaker to stop sending requests when DB struggling. FAANG SRE interview: "Your DB connection pool is exhausted during traffic spike — what do you do?" Step-by-step answer kaafi important hai.',
      closing: 'Right pool size + statement timeouts + N+1 elimination = healthy database performance. PgBouncer for PostgreSQL, connection limits on application side. Monitor pool wait time, not just pool size. Guru-sishya.in pe performance debugging labs hain.',
    },
    9: {
      hook: 'Uber ne MySQL se Schemaless migrate kiya. Airbnb ne Monorail se microservices. Stripe ne Postgres scale ki. Yeh real stories FAANG mein direct use hoti hain.',
      body: 'Uber migration: MySQL master-slave → custom Schemaless (built on MySQL) → per-service databases with Kafka CDC. Lesson: generic ORM nahi chalti at scale — domain-specific storage. Airbnb: PostgreSQL monolith → Apache Cassandra for timeline/activity → Druid for analytics. Lesson: different access patterns need different databases — polyglot persistence. Stripe: PostgreSQL sharding — custom Vitess-like solution. Database-per-service with Saga pattern for distributed transactions. Lesson: schema migration at scale needs tooling, not just ALTER TABLE.',
      gotcha: 'Database migration trap: zero-downtime migration. ALTER TABLE on 100GB table — hours of lock, zero writes. Solution: pt-online-schema-change (Percona) ya gh-ost (GitHub) — shadow table banaao, gradually copy, atomic swap. Expand-contract pattern: add column → backfill → use new column → remove old column — never in single deployment. FAANG: "How do you add a NOT NULL column to a 1-billion-row production table without downtime?" — yeh answer clearly know karna chahiye.',
      closing: 'Real-world database evolution = incremental migration, expand-contract pattern, CDC for live migration, polyglot persistence. No big-bang rewrites in production. Guru-sishya.in pe all three case studies detailed walkthrough ke saath hain.',
    },
    10: {
      hook: 'Database design interview mein interviewer ek trap set karta hai — 80% candidates isme fall karte hain. Masterclass mein woh trap aur uska perfect answer.',
      body: 'Model answer framework for database design: 1. Clarify — data volume, access patterns, consistency requirements. 2. Choose SQL vs NoSQL with justification. 3. Schema design — entity relationships, normalization level. 4. Indexing strategy — identify hot queries, index accordingly. 5. Scaling — replication for reads, sharding for writes. 6. Reliability — transactions, failover, backup strategy. Cheat sheet: PostgreSQL for OLTP, Cassandra for write-heavy time-series, DynamoDB for key-value at scale, Elasticsearch for full-text search, Redis for cache + session.',
      gotcha: 'Common interview mistake: choosing a database before understanding access patterns. "I\'ll use MongoDB" without knowing query patterns — this is premature optimization. Interviewer sees this as junior behavior. Senior answer: "Let me understand what questions we need to answer. If we need flexible schema with complex queries → MongoDB. If write throughput is the constraint → Cassandra. If we need ACID transactions → PostgreSQL." Requirements first, technology second.',
      closing: 'Database design cheat sheet committed karo: SQL vs NoSQL decision matrix, indexing rules, sharding strategies, replication patterns. FAANG mein yeh sab explain karna with tradeoffs = senior-level signal. Guru-sishya.in pe all 10 sessions complete karo.',
    },
  },

  'api-gateway': {
    1: {
      hook: 'Har microservice directly expose karne pe 50 endpoints — clients confused, security gaps, auth duplicated. API Gateway miss karna FAANG red flag hai.',
      body: 'API Gateway: single entry point for all clients to all backend microservices. Responsibilities: routing (path /users → user-service, /orders → order-service), authentication (JWT validate karo centrally), rate limiting (per client, per endpoint), SSL termination, request/response transformation. Without gateway: clients directly talk to services — N services × M clients = N×M coupling. With gateway: M clients → 1 gateway → N services. Benefits: centralized cross-cutting concerns, service discovery abstraction, protocol translation (REST to gRPC). AWS API Gateway, Kong, Nginx, Apigee — popular choices.',
      gotcha: 'API Gateway SPOF trap: single gateway → single point of failure → entire system down. Solution: horizontal scaling of gateway, multiple availability zones, health checks. Another trap: putting business logic in gateway — gateway should be infrastructure, not application. Transformation logic, validation rules belong in services. Gateway fat = deployment coupling. FAANG interview: "What should NOT go in an API Gateway?" — business logic, complex orchestration, heavy computation.',
      closing: 'API Gateway is infrastructure, not business logic layer. Cross-cutting concerns — auth, rate limiting, routing, logging — yes. Business rules — no. Design for horizontal scaling. Guru-sishya.in pe gateway architecture session hai.',
    },
    2: {
      hook: 'Free API banayi — 10 minutes mein DDoS se database down. Rate limiting nahi implement kiya? FAANG security design mein yeh basic hai.',
      body: 'Token Bucket: bucket mein tokens hain, har request ek token consume karta hai, tokens time ke saath refill hote hain at fixed rate. Burst allowed (bucket full hai toh). Leaky Bucket: fixed rate se requests process karo — no burst, smooth output. Sliding Window Counter: last N seconds ke requests count karo. More accurate than fixed window. Sliding Window Log: exact timestamps store karo — most accurate, most memory. Fixed Window: per minute/hour count — simple but boundary burst attack possible. Distributed rate limiting: Redis pe counter store karo — atomic INCR + EXPIRE.',
      gotcha: 'Fixed window boundary attack: rate limit 100 req/minute. Attacker sends 100 requests at 0:59 aur 100 at 1:01 — 200 requests in 2 seconds but both windows show exactly 100. Solution: sliding window algorithm. Distributed rate limiting race condition: two gateway instances simultaneously check counter, both see 99, both allow request — 101st request sneaks through. Solution: Redis Lua script for atomic check-and-increment, or Redis INCR return value use karo (if return > limit, reject). FAANG: "How do you implement distributed rate limiting without race conditions?"',
      closing: 'Token bucket for burst-allowed APIs, sliding window for precise rate control, distributed Redis counter for multi-instance gateways. Rate limiting logic must be atomic. Guru-sishya.in pe rate limiting implementation labs hain.',
    },
    3: {
      hook: 'JWT secret leaked — attacker har user ka token forge kar sakta hai. Auth gateway mein galat implement karna FAANG security interview mein fail hai.',
      body: 'JWT (JSON Web Token): header.payload.signature — stateless, self-contained. Gateway pe verify karo signature without calling auth service. RS256 (asymmetric): auth service private key se sign karta hai, gateway public key se verify — secret distribute nahi karna. HS256 (symmetric): same secret — all services need the secret. OAuth2: authorization framework — access token, refresh token, authorization code flow. API Keys: simple but no expiry by default, rotatable, good for server-to-server. Zero-trust architecture: verify every request, no implicit trust even internal. mTLS for service-to-service authentication.',
      gotcha: 'JWT expiry trap: long-lived JWT tokens — user account disabled kiya but token still valid for 24 hours. Solution: short expiry (15 min) + refresh tokens, or maintain token blacklist (but then stateful). Better: token introspection — gateway calls auth service to validate token — adds latency but real-time revocation. FAANG: "How do you implement immediate JWT revocation?" — token blacklist in Redis (check per request), short expiry + refresh token rotation, or opaque tokens with token store.',
      closing: 'JWT for stateless auth, OAuth2 for delegated authorization, mTLS for service mesh. Token revocation is the hard problem — short expiry + refresh tokens is production best practice. Guru-sishya.in pe auth flow diagrams hain.',
    },
    4: {
      hook: 'Canary deployment failed — wrong traffic split gaya. Request routing misconfigure karna FAANG deployment design mein disaster hai.',
      body: 'Path-based routing: /api/v1/* → v1-service, /api/v2/* → v2-service. Header-based routing: X-API-Version: 2 → route to v2. Host-based routing: api.example.com → API gateway, admin.example.com → admin backend. Weighted routing: canary deployment — 5% traffic → new-service, 95% → stable-service. Gradual rollout: 1% → 5% → 20% → 100%. A/B testing: User-ID based split — consistent routing for same user. Blue-green deployment: full traffic switch from blue to green. Feature flags + routing: gateway reads feature flag, routes accordingly.',
      gotcha: 'Canary routing consistency trap: user hits new version (5% canary), makes a change, next request goes to old version (95% stable) — inconsistency. Solution: sticky sessions for canary — once user hits canary, always route to canary. Cookie ya header mein canary flag store karo. FAANG: "How do you ensure a user consistently hits the same deployment during canary rollout?" Sticky routing by user_id hash — same user, same version. This is the nuance most candidates miss.',
      closing: 'Request routing = path + header + host + weight based. Canary requires sticky routing for consistency. Feature-flag-driven routing decouples deploy from release. Guru-sishya.in pe routing configuration lab hai.',
    },
    5: {
      hook: 'V2 API launch kiya — V1 clients sab break ho gaye. API versioning strategy nahi socha? FAANG mein backward compatibility critical hai.',
      body: 'URL versioning: /api/v1/users, /api/v2/users — explicit, cacheable, easy to understand. Header versioning: Accept: application/vnd.company.v2+json — clean URLs but harder to test in browser. Query parameter versioning: /api/users?version=2 — easy but messy. Semantic versioning principles: major version = breaking changes, minor = backward-compatible features, patch = bug fixes. API version lifecycle: current, deprecated (with sunset date), retired. Backward compatibility rules: add fields OK, remove/rename fields = breaking change. Additive-only changes prevent version proliferation.',
      gotcha: 'Sunset header trap: deprecated API pe `Sunset: Sat, 31 Dec 2025 23:59:59 GMT` header return karo — clients should read this and migrate. Reality: clients ignore headers. Solution: aggressive communication — email, docs, status page, error messages in response body warning about deprecation. Also: traffic monitoring — agar koi v1 use kar raha hai 1 day before sunset, proactively contact them. FAANG: "How do you safely retire an API version?" — sunset header + monitoring + client communication plan.',
      closing: 'URL versioning for external APIs (explicit), header versioning for internal APIs. Additive-only changes to minimize version count. Sunset + monitor + communicate for safe deprecation. Guru-sishya.in pe API lifecycle management dekho.',
    },
    6: {
      hook: 'Downstream service slow — gateway thread pool exhausted — gateway itself down. Circuit breaker nahi lagaya? Cascading failure FAANG resilience interview ka core hai.',
      body: 'Circuit Breaker pattern: closed state (normal operations), open state (requests immediately fail, no downstream calls), half-open state (test requests to check if service recovered). Hystrix (Netflix), Resilience4j (Java), Polly (.NET). Retry pattern: transient failures pe retry karo — but with exponential backoff to avoid thundering herd. Fallback: circuit open hai toh fallback response return karo — cached data, default value, graceful degradation. Bulkhead isolation: separate thread pools for different downstream services — ek service slow hoti hai toh sirf uska thread pool exhausted hota hai, dusre services unaffected.',
      gotcha: 'Retry amplification trap: 3 service instances, each retries 3 times on failure — 9 requests to already-struggling service. Exponential backoff with jitter: wait 1s, 2s, 4s + random jitter. Retry-After header respect karo. Idempotency requirement: retry safe hai sirf agar request idempotent ho — GET always safe, POST needs idempotency key. FAANG: "How do you prevent retry storms?" — circuit breaker + exponential backoff + jitter + bulkhead isolation — all four together.',
      closing: 'Circuit breaker + retry with backoff + fallback + bulkhead = resilient gateway. Each pattern solves different failure mode. Netflix Hystrix pioneered all of this — study their patterns. Guru-sishya.in pe resilience patterns workshop hai.',
    },
    7: {
      hook: 'Kong ya Nginx ya AWS API Gateway — wrong choice kiya toh vendor lock-in trap. Products comparison FAANG architecture decision mein important hai.',
      body: 'Kong: open-source, Nginx-based, plugin ecosystem (rate limiting, auth, logging, tracing), DB-backed (Postgres) or DB-less config. Kubernetes native: Kong Ingress Controller. Nginx: high-performance, configuration-as-code, OpenResty for Lua scripting. Highly customizable but more manual. AWS API Gateway: fully managed, Lambda integration, usage plans, no server management. Cost model: per API call. Apigee (Google): enterprise features, analytics, developer portal. Cloud-native vs self-hosted tradeoff: managed = less ops overhead, self-hosted = more control aur no per-call pricing.',
      gotcha: 'Vendor lock-in migration trap: AWS API Gateway pe heavily built kiya — Lambda integrations, custom authorizers, usage plans. Migration to Kong: 6-month project. Solution: abstract gateway behind interface — OpenAPI spec driven development, gateway-agnostic. FAANG: "How would you migrate from AWS API Gateway to Kong without downtime?" Answer: gradual migration — one endpoint at a time, traffic shifting, canary deployment, feature parity verification. Phir big bang nahi, incremental migration.',
      closing: 'Kong for open-source flexibility, AWS API Gateway for serverless AWS-native, Nginx for ultra-high performance custom. Lock-in risk mitigate karo with OpenAPI spec + gateway abstraction. Guru-sishya.in pe migration playbook hai.',
    },
    8: {
      hook: 'Multiple REST APIs ka BFF layer nahi hai — mobile client 20 requests per screen. GraphQL Gateway yeh problem solve karta hai. FAANG mein yeh modern pattern hai.',
      body: 'GraphQL Gateway: single endpoint, client specifies exactly what data it needs — no over-fetching, no under-fetching. Schema stitching: multiple GraphQL schemas combine karo. Federation (Apollo): each microservice owns its graph schema, gateway combines — distributed ownership. BFF (Backend for Frontend): mobile BFF, web BFF, third-party BFF — each optimized for its client. Mobile BFF: bandwidth-efficient responses, fewer requests. REST aggregation at BFF: multiple downstream REST calls, single response to client. DataLoader: N+1 prevention in GraphQL resolvers — batch requests to database.',
      gotcha: 'GraphQL N+1 problem: query users list, each user resolves their posts — N database calls. Solution: DataLoader batches all user IDs into one query. But DataLoader trap: caching within a request is good, but cross-request caching can serve stale data. Create new DataLoader instance per request. FAANG: "GraphQL vs REST for a mobile API?" REST for simple CRUD, GraphQL for complex hierarchical data with variable client needs. GraphQL operation cost limit implement karo — deep nested queries can be expensive.',
      closing: 'GraphQL for flexible client-driven queries, BFF for client-specific optimization, DataLoader for N+1 prevention. Federation for distributed schema ownership in microservices. Guru-sishya.in pe GraphQL gateway implementation hai.',
    },
    9: {
      hook: 'Netflix Zuul — 2 billion requests per day. Amazon API Gateway — trillions of API calls. Yeh real architectures FAANG interview mein direct answer deti hain.',
      body: 'Netflix Zuul (open-source): edge service, filters (pre, route, post, error), async Zuul 2 for non-blocking IO. Spring Cloud Gateway ne mostly replace kiya for newer services. Amazon API Gateway: 800+ AWS services exposed as APIs, regional + edge-optimized endpoints, WebSocket API support, HTTP API (lower latency, lower cost than REST API). Spotify: Backstage developer portal + internal API gateway for 300+ microservices. Key lessons: gateway must be stateless for horizontal scaling, async processing for high throughput, feature flags for gradual rollouts, comprehensive observability (distributed tracing per request).',
      gotcha: 'Zuul thread pool exhaustion (Zuul 1): synchronous blocking IO — each connection holds a thread. 10,000 connections = 10,000 threads — memory exhaustion. Netflix solution: Zuul 2 async non-blocking architecture using Netty. FAANG lesson: gateway must use async IO at high traffic. Spring WebFlux / Vert.x / Netty for reactive gateways. Thread-per-connection model dies at 10K+ concurrent connections. FAANG: "How does Netflix handle 2 billion daily requests through Zuul?" — async IO, horizontal scaling, circuit breakers, canary deployments.',
      closing: 'Real gateway patterns: async IO, stateless horizontal scaling, observability at every layer, gradual rollouts. Netflix, Amazon, Spotify sab yahi patterns use karte hain. Guru-sishya.in pe case study deep-dives hain.',
    },
    10: {
      hook: 'API Gateway design interview mein interviewer ek specific follow-up poochha — candidate stuck ho gaya. Final masterclass mein woh exact question aur answer.',
      body: 'Model answer framework for API Gateway design: 1. Clarify — expected RPS, client types (mobile/web/third-party), existing service architecture. 2. Core functions — routing, auth, rate limiting, SSL termination. 3. Non-functional — latency SLA, availability (99.99%?), security requirements. 4. Technology choice — Kong for open-source control, AWS API Gateway for serverless, Nginx for raw performance. 5. Resilience — circuit breakers, retries, fallbacks, bulkhead. 6. Observability — distributed tracing (Jaeger/Zipkin), metrics (Prometheus), logging. Cheat sheet: rate limit in gateway, auth in gateway, business logic in services.',
      gotcha: 'Most common mistake: designing gateway as monolith with all features in one place. Performance-sensitive path (routing, auth) should be ultra-lean — milliseconds matter. Heavy features (complex transformation, analytics) should be async or in separate service. Interviewer tests: "Your API Gateway is slow — where do you look first?" Answer: auth validation latency (JWT vs introspection), rate limiter backend (Redis latency), downstream service timeouts, connection pool exhaustion. Systematic debugging approach impresses FAANG interviewers.',
      closing: 'API Gateway design cheat sheet: route + authenticate + rate-limit at gateway, delegate business logic to services. Async IO + horizontal scaling = high throughput. Resilience patterns always. Guru-sishya.in pe all 10 sessions complete karo — interview ready ho jaoge.',
    },
  },
};

// ─── Template ID map ─────────────────────────────────────────────────────────

const TEMPLATE_IDS: Record<string, string> = {
  'load-balancing':  'LoadBalancingArch',
  'caching':         'CachingArch',
  'database-design': 'DatabaseDesignArch',
  'api-gateway':     'ApiGatewayArch',
};

// ─── Storyboard builder ──────────────────────────────────────────────────────

interface StoryboardScene {
  sceneIndex: number;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  type: string;
  narration: string;
  templateId: string;
}

interface Storyboard {
  version: number;
  fps: number;
  width: number;
  height: number;
  topic: string;
  session: number;
  totalSessions: number;
  siteTopicSlug: string;
  siteSessionSlug: string;
  siteSessionTitle: string;
  siteSessionFocus: string;
  durationInFrames: number;
  audioFile: string;
  scenes: StoryboardScene[];
}

const SCENE_DURATIONS = [150, 450, 450, 450] as const; // frames at 30 fps
const SCENE_TYPES     = ['hook', 'body', 'body', 'outro'] as const;

function buildStoryboard(topic: TopicConfig, session: SessionConfig): Storyboard {
  const slug         = toSessionSlug(session.title);
  const templateId   = TEMPLATE_IDS[topic.slug] ?? 'GenericArch';
  const narrations   = NARRATIONS[topic.slug]?.[session.n];

  if (!narrations) {
    throw new Error(`Missing narrations for ${topic.slug} session ${session.n}`);
  }

  const narrationList = [
    narrations.hook,
    narrations.body,
    narrations.gotcha,
    narrations.closing,
  ];

  let frameOffset = 0;
  const scenes: StoryboardScene[] = SCENE_DURATIONS.map((dur, i) => {
    const scene: StoryboardScene = {
      sceneIndex:     i,
      startFrame:     frameOffset,
      endFrame:       frameOffset + dur,
      durationFrames: dur,
      type:           SCENE_TYPES[i],
      narration:      narrationList[i],
      templateId,
    };
    frameOffset += dur;
    return scene;
  });

  const totalFrames = SCENE_DURATIONS.reduce((a, b) => a + b, 0);

  return {
    version:          1,
    fps:              30,
    width:            1080,
    height:           1920,
    topic:            topic.name,
    session:          session.n,
    totalSessions:    topic.sessions.length,
    siteTopicSlug:    topic.slug,
    siteSessionSlug:  slug,
    siteSessionTitle: session.title,
    siteSessionFocus: session.focus,
    durationInFrames: totalFrames,
    audioFile:        `assets/voice/${topic.slug}-s${session.n}.mp3`,
    scenes,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const contentDir = path.join(process.cwd(), 'content');
  fs.mkdirSync(contentDir, { recursive: true });

  let written = 0;
  let skipped = 0;

  for (const topic of CORE_TOPICS) {
    for (const session of topic.sessions) {
      const filename = `${topic.slug}-s${session.n}.json`;
      const filepath = path.join(contentDir, filename);

      if (fs.existsSync(filepath)) {
        console.log(`[skip] ${filename} already exists`);
        skipped++;
        continue;
      }

      const storyboard = buildStoryboard(topic, session);
      // Deterministic: explicit field order, 2-space indent, trailing newline
      fs.writeFileSync(filepath, JSON.stringify(storyboard, null, 2) + '\n', 'utf8');
      console.log(`[write] ${filename}`);
      written++;
    }
  }

  console.log(`\nDone. Written: ${written}, Skipped: ${skipped}`);
}

main();
