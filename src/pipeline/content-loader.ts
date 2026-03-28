import fs from 'fs';
import path from 'path';
import { SessionInput } from '../types';

const CONTENT_DIR = process.env.CONTENT_DIR || '../guru-sishya/public/content';

export function listAvailableTopics(): string[] {
  const dir = path.resolve(CONTENT_DIR);
  if (!fs.existsSync(dir)) {
    console.warn(`Content directory not found: ${dir}`);
    return [];
  }
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

export function loadTopicContent(filename: string): any {
  const filePath = path.resolve(CONTENT_DIR, `${filename}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Content file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function extractSession(topicData: any, sessionIndex: number): SessionInput | null {
  // Handle different JSON structures in guru-sishya content

  // Structure A: Array of topic objects (main guru-sishya format)
  // [ { topic: "SQL", sessions: { "2": "markdown...", "3": "markdown..." }, quizBank: [...] }, ... ]
  if (Array.isArray(topicData)) {
    // Check if this is a flat array of topic objects without sessions
    // e.g. [ { topic: "SQL", category: "...", cheatSheet: "...", lesson: "..." }, ... ]
    const firstItem = topicData[0];
    if (firstItem && !firstItem.sessions) {
      const item = topicData[sessionIndex];
      if (!item) return null;
      return {
        topic: item.topic || item.question || 'Unknown',
        sessionNumber: sessionIndex + 1,
        title: item.topic || (item.question ? item.question.slice(0, 80) : '') || `Session ${sessionIndex + 1}`,
        content: item.cheatSheet || item.lesson || item.answer || '',
        objectives: item.objectives || extractObjectives(item.cheatSheet || item.lesson || ''),
        reviewQuestions: item.reviewQuestions || [],
      };
    }

    // Nested format: iterate topics, then sessions within each topic
    let globalIndex = 0;
    for (const topicObj of topicData) {
      if (!topicObj.sessions || typeof topicObj.sessions !== 'object') continue;
      const sessionKeys = Object.keys(topicObj.sessions).sort((a, b) => Number(a) - Number(b));
      for (const key of sessionKeys) {
        if (globalIndex === sessionIndex) {
          const content = topicObj.sessions[key];
          // Extract title from first heading in markdown
          const headingMatch = typeof content === 'string' ? content.match(/^##\s+(.+)/m) : null;
          const title = headingMatch ? headingMatch[1] : `Session ${key}`;
          // Extract review questions from quizBank if available
          const reviewQuestions = (topicObj.quizBank || [])
            .slice(0, 3)
            .map((q: any) => q.question || q.q || '');
          return {
            topic: topicObj.topic || topicObj.title || topicObj.name || 'Unknown Topic',
            sessionNumber: Number(key),
            title,
            content: typeof content === 'string' ? content : JSON.stringify(content),
            objectives: extractObjectives(typeof content === 'string' ? content : ''),
            reviewQuestions,
          };
        }
        globalIndex++;
      }
    }
    return null;
  }

  // Structure B: Single topic object with sessions as object { "2": "...", "3": "..." }
  if (topicData.sessions && typeof topicData.sessions === 'object' && !Array.isArray(topicData.sessions)) {
    const sessionKeys = Object.keys(topicData.sessions).sort((a, b) => Number(a) - Number(b));
    const key = sessionKeys[sessionIndex];
    if (!key) return null;
    const content = topicData.sessions[key];
    const headingMatch = typeof content === 'string' ? content.match(/^##\s+(.+)/m) : null;
    const title = headingMatch ? headingMatch[1] : `Session ${key}`;
    const reviewQuestions = (topicData.quizBank || [])
      .slice(0, 3)
      .map((q: any) => q.question || q.q || '');
    return {
      topic: topicData.topic || topicData.title || topicData.name || 'Unknown Topic',
      sessionNumber: Number(key),
      title,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      objectives: extractObjectives(typeof content === 'string' ? content : ''),
      reviewQuestions,
    };
  }

  // Structure C: { sessions: [...] } (array of session objects)
  if (topicData.sessions && Array.isArray(topicData.sessions)) {
    const session = topicData.sessions[sessionIndex];
    if (!session) return null;
    return {
      topic: topicData.title || topicData.name || 'Unknown Topic',
      sessionNumber: sessionIndex + 1,
      title: session.title || `Session ${sessionIndex + 1}`,
      content: session.content || session.lesson || '',
      objectives: session.objectives || [],
      reviewQuestions: session.reviewQuestions || session.questions || [],
    };
  }

  // Structure D: { topics: [{ sessions: [...] }] }
  if (topicData.topics && Array.isArray(topicData.topics)) {
    for (const topic of topicData.topics) {
      if (topic.sessions && topic.sessions[sessionIndex]) {
        const session = topic.sessions[sessionIndex];
        return {
          topic: topic.title || topic.name || 'Unknown Topic',
          sessionNumber: sessionIndex + 1,
          title: session.title || `Session ${sessionIndex + 1}`,
          content: session.content || session.lesson || '',
          objectives: session.objectives || [],
          reviewQuestions: session.reviewQuestions || session.questions || [],
        };
      }
    }
  }

  // Structure E: { questions: [...] } (QA format)
  if (topicData.questions && Array.isArray(topicData.questions)) {
    const batchSize = 10;
    const start = sessionIndex * batchSize;
    const batch = topicData.questions.slice(start, start + batchSize);
    if (batch.length === 0) return null;
    return {
      topic: topicData.title || topicData.name || 'Unknown Topic',
      sessionNumber: sessionIndex + 1,
      title: `Questions ${start + 1}-${start + batch.length}`,
      content: batch.map((q: any) =>
        `### ${q.question || q.q}\n\n${q.answer || q.a || ''}`
      ).join('\n\n'),
      objectives: [`Master ${batch.length} key questions`],
      reviewQuestions: batch.slice(0, 3).map((q: any) => q.question || q.q || ''),
    };
  }

  return null;
}

/** Extract objectives from markdown content by finding bullet points under key headings */
function extractObjectives(markdown: string): string[] {
  const objectives: string[] = [];
  // Look for heading lines that look like section titles
  const headings = markdown.match(/^###?\s+.+/gm) || [];
  for (const heading of headings.slice(0, 4)) {
    objectives.push(heading.replace(/^#+\s*/, '').trim());
  }
  if (objectives.length === 0) {
    objectives.push('Understand the core concepts');
  }
  return objectives;
}

// ── Demo sessions for testing when content files aren't available ────────────

type DemoTopic = 'load-balancing' | 'system-design' | 'hash-map';

const DEMO_SESSIONS: Record<DemoTopic, SessionInput> = {
  'load-balancing': {
    topic: 'Load Balancing',
    sessionNumber: 1,
    title: 'Load Balancing — The Complete Interview Guide',
    content: `## What is Load Balancing?

Imagine a popular restaurant with one cashier. During lunch rush, the line stretches out the door and customers leave. Now imagine that restaurant opens five cashier lanes and a host directs each customer to the shortest line. That host is a load balancer. In software systems, a load balancer distributes incoming network traffic across a pool of backend servers so no single server is overwhelmed, every request gets a fast response, and the system keeps running even when individual servers fail.

### Why Load Balancing Matters at Scale

Netflix serves over 200 million subscribers streaming simultaneously. Amazon processes over 400 million product lookups per second during Prime Day. Uber matches 20 million rides per day across 10,000+ cities. None of this is possible with a single server. Load balancing is the foundational technique that makes internet-scale systems work. Without it, a single overloaded server means dropped connections, timeouts, and revenue loss. Amazon estimated that every 100 milliseconds of latency costs them 1% in sales, which translates to billions of dollars annually.

### Types of Load Balancers

**Hardware Load Balancers** are dedicated physical appliances. F5 BIG-IP and Citrix ADC are the dominant products. They can handle millions of connections per second with sub-millisecond latency. However, they cost $20,000 to $100,000+ per unit, require specialized expertise, and cannot scale elastically. They are becoming less common in cloud-native architectures.

**Software Load Balancers** run on commodity servers or virtual machines. Nginx handles over 50% of the world's busiest websites. HAProxy powers GitHub, Stack Overflow, and Reddit. AWS Application Load Balancer (ALB) and Google Cloud Load Balancer are fully managed cloud offerings. Software load balancers are flexible, cheap, and horizontally scalable.

| Feature | Hardware LB | Software LB |
|---------|------------|-------------|
| Cost | $20K-$100K+ per unit | Free (open-source) to usage-based |
| Throughput | Millions of conn/sec | Hundreds of thousands of conn/sec |
| Flexibility | Firmware-limited | Fully programmable |
| Scaling | Buy more hardware | Add more instances |
| Cloud-native | No | Yes |
| Examples | F5 BIG-IP, Citrix ADC | Nginx, HAProxy, AWS ALB, Envoy |

> **Interview Insight:** When an interviewer asks about load balancers, always start with "It depends on the scale and requirements." Mention that hardware LBs are legacy in most cloud environments, and software LBs like Nginx, HAProxy, or cloud-managed ALBs are the modern standard.

### Load Balancing Algorithms Deep Dive

### Round Robin

The simplest algorithm. Requests are distributed to servers in sequential order: server 1, server 2, server 3, then back to server 1. It assumes all servers have equal capacity and all requests have equal cost.

\`\`\`python
# Complete Round Robin Load Balancer in Python
import itertools
from typing import List, Optional

class RoundRobinLoadBalancer:
    """Distributes requests sequentially across servers."""

    def __init__(self, servers: List[str]):
        if not servers:
            raise ValueError("At least one server is required")
        self.servers = servers
        self._cycle = itertools.cycle(range(len(servers)))

    def get_next_server(self) -> str:
        """Return the next server in rotation."""
        index = next(self._cycle)
        return self.servers[index]

    def add_server(self, server: str) -> None:
        """Add a new server to the pool."""
        self.servers.append(server)
        self._cycle = itertools.cycle(range(len(self.servers)))

    def remove_server(self, server: str) -> None:
        """Remove a server from the pool."""
        self.servers.remove(server)
        if self.servers:
            self._cycle = itertools.cycle(range(len(self.servers)))

# Usage
lb = RoundRobinLoadBalancer(["api-1.prod", "api-2.prod", "api-3.prod"])
for i in range(6):
    print(f"Request {i+1} -> {lb.get_next_server()}")
# Output: api-1, api-2, api-3, api-1, api-2, api-3
\`\`\`

\`\`\`java
// Complete Round Robin Load Balancer in Java
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

public class RoundRobinLoadBalancer {
    private final List<String> servers;
    private final AtomicInteger counter = new AtomicInteger(0);

    public RoundRobinLoadBalancer(List<String> servers) {
        if (servers == null || servers.isEmpty()) {
            throw new IllegalArgumentException("At least one server required");
        }
        this.servers = new ArrayList<>(servers);
    }

    public String getNextServer() {
        int index = counter.getAndIncrement() % servers.size();
        // Handle integer overflow gracefully
        if (index < 0) {
            counter.set(0);
            index = 0;
        }
        return servers.get(index);
    }

    public synchronized void addServer(String server) {
        servers.add(server);
    }

    public synchronized void removeServer(String server) {
        servers.remove(server);
    }

    public static void main(String[] args) {
        var lb = new RoundRobinLoadBalancer(
            List.of("api-1.prod", "api-2.prod", "api-3.prod")
        );
        for (int i = 0; i < 6; i++) {
            System.out.printf("Request %d -> %s%n", i + 1, lb.getNextServer());
        }
    }
}
\`\`\`

### Weighted Round Robin

When servers have different capacities, you assign weights. A server with weight 3 gets 3x more traffic than a server with weight 1. This is critical in real deployments where you might have a mix of c5.large and c5.4xlarge EC2 instances.

\`\`\`python
# Weighted Round Robin Load Balancer
from typing import List, Tuple

class WeightedRoundRobinLB:
    """Routes more traffic to higher-capacity servers."""

    def __init__(self, servers_with_weights: List[Tuple[str, int]]):
        self.servers: List[str] = []
        # Expand the server list according to weights
        for server, weight in servers_with_weights:
            self.servers.extend([server] * weight)
        self._index = 0

    def get_next_server(self) -> str:
        server = self.servers[self._index]
        self._index = (self._index + 1) % len(self.servers)
        return server

# Large instance gets 5x the traffic of small instance
lb = WeightedRoundRobinLB([
    ("small-instance", 1),
    ("medium-instance", 3),
    ("large-instance", 5),
])
results = {}
for _ in range(9):
    s = lb.get_next_server()
    results[s] = results.get(s, 0) + 1
print(results)
# {'small-instance': 1, 'medium-instance': 3, 'large-instance': 5}
\`\`\`

\`\`\`java
// Weighted Round Robin in Java
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

public class WeightedRoundRobinLB {
    private final List<String> weightedServers = new ArrayList<>();
    private final AtomicInteger index = new AtomicInteger(0);

    public WeightedRoundRobinLB(Map<String, Integer> serverWeights) {
        for (var entry : serverWeights.entrySet()) {
            for (int i = 0; i < entry.getValue(); i++) {
                weightedServers.add(entry.getKey());
            }
        }
    }

    public String getNextServer() {
        int i = index.getAndIncrement() % weightedServers.size();
        return weightedServers.get(i);
    }

    public static void main(String[] args) {
        var lb = new WeightedRoundRobinLB(Map.of(
            "small-instance", 1,
            "medium-instance", 3,
            "large-instance", 5
        ));
        Map<String, Integer> counts = new HashMap<>();
        for (int i = 0; i < 9; i++) {
            counts.merge(lb.getNextServer(), 1, Integer::sum);
        }
        System.out.println(counts);
    }
}
\`\`\`

### Least Connections

Routes each new request to the server with the fewest active connections. This is ideal when requests have highly variable processing times, like a mix of simple API calls and complex database queries.

### IP Hash

Computes a hash of the client IP address to determine which server handles the request. The same client always reaches the same server, providing natural session persistence without cookies.

### Consistent Hashing

Used by distributed caches and databases. When a server is added or removed, only a small fraction of keys need to be remapped. This is how Cassandra, DynamoDB, and Memcached distribute data. The ring-based approach minimizes disruption during scaling events.

### Complete Algorithm Comparison

| Algorithm | Complexity | Session Sticky | Uneven Servers | Dynamic Load | Best Use Case |
|-----------|-----------|---------------|---------------|-------------|---------------|
| Round Robin | O(1) | No | Poor | Poor | Equal servers, stateless APIs |
| Weighted RR | O(1) | No | Good | Poor | Mixed server capacities |
| Least Connections | O(n) | No | Good | Excellent | Variable-duration requests |
| IP Hash | O(1) | Yes | Poor | Poor | Session persistence needed |
| Consistent Hashing | O(log n) | Yes | Good | Good | Distributed caches, databases |
| Least Response Time | O(n) | No | Good | Excellent | Latency-sensitive applications |
| Random | O(1) | No | Poor | Fair | Simple, stateless microservices |

### Health Checks and Failover

A load balancer is only as good as its health checking. If a server crashes and the LB keeps sending traffic there, users get errors. Health checks come in three types.

**Passive health checks** detect failures from real traffic. If a server returns 5 consecutive 5xx errors, it is marked unhealthy. This is reactive and has a detection delay.

**Active health checks** send periodic probe requests (like HTTP GET /health) to each server. If a server fails 3 consecutive checks, it is removed from the pool. When it passes again, it is added back. This is proactive.

**Deep health checks** verify not just that the server is running, but that its dependencies (database, cache, external APIs) are healthy too. This prevents routing to a server that is technically alive but cannot serve real requests.

\`\`\`python
# Health-Aware Load Balancer with Active Health Checks
import time
import threading
import requests
from typing import List, Dict

class HealthAwareLoadBalancer:
    """Load balancer that removes unhealthy servers automatically."""

    def __init__(self, servers: List[str], health_path: str = "/health",
                 check_interval: int = 10, failure_threshold: int = 3):
        self.all_servers = servers
        self.healthy_servers: List[str] = list(servers)
        self.health_path = health_path
        self.check_interval = check_interval
        self.failure_threshold = failure_threshold
        self._failure_counts: Dict[str, int] = {s: 0 for s in servers}
        self._index = 0
        self._lock = threading.Lock()

    def get_next_server(self) -> str:
        with self._lock:
            if not self.healthy_servers:
                raise RuntimeError("No healthy servers available!")
            server = self.healthy_servers[self._index % len(self.healthy_servers)]
            self._index += 1
            return server

    def _check_server(self, server: str) -> bool:
        try:
            resp = requests.get(f"http://{server}{self.health_path}", timeout=2)
            return resp.status_code == 200
        except Exception:
            return False

    def run_health_checks(self):
        """Run one round of health checks on all servers."""
        for server in self.all_servers:
            is_healthy = self._check_server(server)
            with self._lock:
                if is_healthy:
                    self._failure_counts[server] = 0
                    if server not in self.healthy_servers:
                        self.healthy_servers.append(server)
                        print(f"[RECOVERED] {server} is healthy again")
                else:
                    self._failure_counts[server] += 1
                    if self._failure_counts[server] >= self.failure_threshold:
                        if server in self.healthy_servers:
                            self.healthy_servers.remove(server)
                            print(f"[REMOVED] {server} failed {self.failure_threshold} checks")

# Usage
lb = HealthAwareLoadBalancer([
    "api-1.prod:8080",
    "api-2.prod:8080",
    "api-3.prod:8080",
])
\`\`\`

\`\`\`java
// Health-Aware Load Balancer in Java
import java.net.http.*;
import java.net.URI;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

public class HealthAwareLoadBalancer {
    private final List<String> allServers;
    private final List<String> healthyServers;
    private final Map<String, Integer> failureCounts;
    private final int failureThreshold;
    private int index = 0;

    public HealthAwareLoadBalancer(List<String> servers, int failureThreshold) {
        this.allServers = new ArrayList<>(servers);
        this.healthyServers = new CopyOnWriteArrayList<>(servers);
        this.failureCounts = new ConcurrentHashMap<>();
        this.failureThreshold = failureThreshold;
        servers.forEach(s -> failureCounts.put(s, 0));
    }

    public synchronized String getNextServer() {
        if (healthyServers.isEmpty()) {
            throw new RuntimeException("No healthy servers!");
        }
        String server = healthyServers.get(index % healthyServers.size());
        index++;
        return server;
    }

    public void runHealthChecks() {
        HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();
        for (String server : allServers) {
            try {
                var req = HttpRequest.newBuilder()
                    .uri(URI.create("http://" + server + "/health"))
                    .timeout(Duration.ofSeconds(2)).GET().build();
                var resp = client.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() == 200) {
                    failureCounts.put(server, 0);
                    if (!healthyServers.contains(server)) {
                        healthyServers.add(server);
                    }
                } else {
                    recordFailure(server);
                }
            } catch (Exception e) {
                recordFailure(server);
            }
        }
    }

    private void recordFailure(String server) {
        int count = failureCounts.merge(server, 1, Integer::sum);
        if (count >= failureThreshold) {
            healthyServers.remove(server);
        }
    }
}
\`\`\`

> **Interview Insight:** Always mention the three types of health checks: passive, active, and deep. Interviewers love candidates who understand that a server can be "alive" but functionally broken because its database connection pool is exhausted. Deep health checks catch this.

### Session Persistence and Sticky Sessions

Some applications store user state on the server (shopping carts, authentication tokens, WebSocket connections). If the load balancer routes the same user to different servers on each request, their session breaks. Sticky sessions solve this by ensuring a user always reaches the same backend server.

Common approaches: cookie-based routing where the LB injects a cookie with the server ID, IP hash routing where the client IP determines the server, and application-level session stores like Redis that decouple session state from any single server. The Redis approach is the modern best practice because it allows true stateless backends while preserving session data.

### Layer 4 vs Layer 7 Load Balancing

**Layer 4 (Transport Layer)** load balancers route based on IP address and TCP/UDP port. They are extremely fast because they do not inspect packet contents. AWS Network Load Balancer and HAProxy in TCP mode operate at Layer 4. Use Layer 4 for raw TCP traffic, gaming servers, IoT protocols, or any non-HTTP workload.

**Layer 7 (Application Layer)** load balancers inspect HTTP headers, URLs, cookies, and request bodies. They can route /api requests to backend servers and /static requests to a CDN. They can terminate SSL, compress responses, and cache content. Nginx, AWS ALB, and Envoy operate at Layer 7. Use Layer 7 for web applications, microservices, and API gateways.

| Feature | Layer 4 LB | Layer 7 LB |
|---------|-----------|-----------|
| Speed | Fastest (no inspection) | Fast (must parse HTTP) |
| Routing | IP + Port only | URL, headers, cookies, body |
| SSL Termination | No | Yes |
| Content Caching | No | Yes |
| WebSocket Support | Pass-through | Full inspection |
| Use Cases | TCP/UDP, gaming, IoT | Web apps, APIs, microservices |
| Products | AWS NLB, HAProxy TCP | Nginx, AWS ALB, Envoy |

> **Interview Insight:** A common senior-level interview question is "When would you choose Layer 4 over Layer 7?" The answer: Layer 4 when you need maximum throughput and minimal latency for non-HTTP protocols. Layer 7 when you need content-based routing, SSL termination, or request-level observability. Many production systems use BOTH: a Layer 4 LB in front distributing to multiple Layer 7 LBs behind it.

### Real Interview Question and Model Answer

**Question:** "Design a load balancing system for a service handling 100,000 requests per second with servers of varying capacities."

**Model Answer:** I would use a two-tier architecture. A Layer 4 load balancer at the edge distributes TCP connections across multiple Layer 7 load balancers. Each Layer 7 LB uses Weighted Least Connections algorithm, where weights reflect each server's CPU and memory capacity. Active health checks every 5 seconds with a 3-failure threshold automatically remove unhealthy servers. For session persistence, I would use Redis-backed session stores rather than sticky sessions, keeping backends stateless. I would add circuit breakers so that if a downstream service degrades, the LB can return cached responses or graceful errors instead of cascading failures. Metrics (requests per second, p99 latency, error rate per backend) feed into an auto-scaler that adjusts the server pool.

### Common Interview Mistakes

First, saying "just use Round Robin" without considering server heterogeneity. Real production servers have different specs. Second, forgetting health checks entirely. A load balancer without health checks is a liability. Third, not mentioning session persistence when the system has stateful components. Fourth, confusing Layer 4 and Layer 7 or not knowing when each is appropriate. Fifth, not discussing what happens during a rolling deployment, because the LB must drain connections from old instances before removing them.

### When to Use Which Algorithm

For stateless microservices with identical containers, use Round Robin, it is simple and predictable. For mixed server capacities in a heterogeneous fleet, use Weighted Round Robin. For long-lived connections like WebSockets or database connection pooling, use Least Connections. For session persistence without external session stores, use IP Hash. For distributed data stores and caches, use Consistent Hashing to minimize reshuffling. For latency-critical global services, use Least Response Time with geographically distributed servers.

### Architecture Overview

The typical production architecture has DNS resolving to multiple IP addresses via GeoDNS. Each IP points to a Layer 4 load balancer. Behind each Layer 4 LB sit several Layer 7 LBs. Each Layer 7 LB distributes to application server pools. Health checks run at every level. Auto-scaling adjusts the pool size based on load metrics. This is the architecture used by Netflix, Uber, Google, and Amazon.

### Summary and Cheatsheet

Load balancing is essential for any system serving more than one server's worth of traffic. Software LBs like Nginx and HAProxy dominate modern deployments. Choose your algorithm based on server homogeneity and statefulness requirements. Always implement health checks at multiple levels. Understand Layer 4 versus Layer 7 tradeoffs. In interviews, demonstrate you can design a complete system, not just name algorithms.

Key formulas: Throughput equals requests per second times average response time. Server utilization should stay below 70% for safe headroom. Health check interval should be at most one third of your SLA timeout.`,
    objectives: [
      'Understand what load balancing is and why it matters at Netflix/Amazon scale',
      'Compare hardware vs software load balancers with specific products',
      'Implement Round Robin, Weighted RR, and Health Check algorithms',
      'Master Layer 4 vs Layer 7 tradeoffs for interview answers',
      'Choose the right algorithm for any given scenario',
      'Answer the most common load balancing interview questions',
    ],
    reviewQuestions: [
      'What is the difference between hardware and software load balancers? Name specific products for each.',
      'When would you use Least Connections over Round Robin? Give a concrete scenario.',
      'Explain the three types of health checks and why deep health checks matter.',
      'What is the difference between Layer 4 and Layer 7 load balancing? When would you use each?',
      'How does consistent hashing minimize disruption when adding or removing servers?',
      'Design a load balancing solution for a service handling 100K requests per second with mixed server capacities.',
    ],
  },

  'system-design': {
    topic: 'System Design',
    sessionNumber: 1,
    title: 'System Design Fundamentals — The Complete Framework',
    content: `## What is System Design?

System design is the process of defining the architecture, components, modules, interfaces, and data flows of a system to satisfy specified requirements. In interviews, it is the most heavily weighted section for senior engineering roles at FAANG companies. Unlike coding interviews where there is one correct answer, system design is about demonstrating breadth of knowledge, structured thinking, and the ability to make justified tradeoffs.

### Why System Design Matters

Every application you use daily, from Instagram to Google Maps to Spotify, is a distributed system with dozens of interconnected services. Understanding how to design these systems is what separates junior developers from senior engineers. Companies pay $200K-$500K+ for engineers who can design systems that scale. A single poor architectural decision can cost millions in re-engineering.

### The RESHADED Framework

Use this structured approach for every system design interview. It ensures you cover all critical areas systematically.

| Step | Name | What You Do | Time |
|------|------|------------|------|
| R | Requirements | Clarify functional and non-functional requirements | 3 min |
| E | Estimation | Calculate scale: QPS, storage, bandwidth | 3 min |
| S | Storage | Choose databases: SQL vs NoSQL, schema design | 5 min |
| H | High-Level Design | Draw the main components and data flow | 5 min |
| A | API Design | Define endpoints, request/response formats | 3 min |
| D | Detailed Design | Deep dive into 2-3 critical components | 10 min |
| E | Evaluation | Discuss tradeoffs, bottlenecks, failure modes | 3 min |
| D | Deployment | Discuss scaling, monitoring, CI/CD | 3 min |

### Back-of-the-Envelope Estimation

Before designing anything, estimate the scale. These quick calculations demonstrate engineering maturity and prevent over- or under-engineering.

\`\`\`python
# Back-of-the-Envelope Calculator for System Design
class ScaleEstimator:
    """Quick estimation tool for system design interviews."""

    # Standard assumptions
    SECONDS_PER_DAY = 86_400
    SECONDS_PER_MONTH = 2_592_000  # 30 days

    @staticmethod
    def daily_active_users_to_qps(dau: int, requests_per_user: int = 10) -> dict:
        """Convert DAU to queries per second."""
        total_daily = dau * requests_per_user
        avg_qps = total_daily / ScaleEstimator.SECONDS_PER_DAY
        peak_qps = avg_qps * 3  # Peak is typically 2-5x average
        return {
            "daily_requests": total_daily,
            "avg_qps": round(avg_qps, 1),
            "peak_qps": round(peak_qps, 1),
        }

    @staticmethod
    def storage_estimate(records_per_day: int, record_size_bytes: int,
                         retention_years: int = 5) -> dict:
        """Estimate storage needs over time."""
        daily_gb = (records_per_day * record_size_bytes) / (1024**3)
        yearly_tb = (daily_gb * 365) / 1024
        total_tb = yearly_tb * retention_years
        return {
            "daily_gb": round(daily_gb, 2),
            "yearly_tb": round(yearly_tb, 2),
            "total_tb": round(total_tb, 2),
        }

    @staticmethod
    def bandwidth_estimate(qps: float, response_size_kb: int = 10) -> dict:
        """Estimate bandwidth in Mbps."""
        bytes_per_sec = qps * response_size_kb * 1024
        mbps = (bytes_per_sec * 8) / (1024**2)
        return {"mbps": round(mbps, 1), "gbps": round(mbps / 1024, 3)}

# Example: Design Twitter
est = ScaleEstimator()
traffic = est.daily_active_users_to_qps(dau=300_000_000, requests_per_user=20)
print(f"Twitter QPS: avg={traffic['avg_qps']}, peak={traffic['peak_qps']}")
# avg=69444.4, peak=208333.3

storage = est.storage_estimate(
    records_per_day=500_000_000,  # 500M tweets/day
    record_size_bytes=500,         # avg tweet ~500 bytes
    retention_years=5
)
print(f"Storage: {storage['total_tb']} TB over 5 years")
\`\`\`

\`\`\`java
// Back-of-the-Envelope Calculator in Java
public class ScaleEstimator {
    static final long SECONDS_PER_DAY = 86_400;

    public static Map<String, Double> dauToQps(long dau, int requestsPerUser) {
        long totalDaily = dau * requestsPerUser;
        double avgQps = (double) totalDaily / SECONDS_PER_DAY;
        double peakQps = avgQps * 3;
        return Map.of(
            "daily_requests", (double) totalDaily,
            "avg_qps", Math.round(avgQps * 10) / 10.0,
            "peak_qps", Math.round(peakQps * 10) / 10.0
        );
    }

    public static Map<String, Double> storageEstimate(
            long recordsPerDay, int recordSizeBytes, int retentionYears) {
        double dailyGb = (double)(recordsPerDay * recordSizeBytes) / Math.pow(1024, 3);
        double yearlyTb = (dailyGb * 365) / 1024;
        double totalTb = yearlyTb * retentionYears;
        return Map.of(
            "daily_gb", Math.round(dailyGb * 100) / 100.0,
            "yearly_tb", Math.round(yearlyTb * 100) / 100.0,
            "total_tb", Math.round(totalTb * 100) / 100.0
        );
    }

    public static void main(String[] args) {
        var traffic = dauToQps(300_000_000L, 20);
        System.out.printf("Twitter QPS: avg=%.1f, peak=%.1f%n",
            traffic.get("avg_qps"), traffic.get("peak_qps"));
    }
}
\`\`\`

### SQL vs NoSQL Decision Framework

This is the single most common sub-question in system design interviews. You must have a clear, justified framework.

| Criteria | Choose SQL | Choose NoSQL |
|----------|-----------|-------------|
| Data Model | Structured, relational | Flexible, denormalized |
| Consistency | Strong consistency required | Eventual consistency acceptable |
| Query Pattern | Complex JOINs, aggregations | Simple key-value or document lookups |
| Scale | Vertical (with read replicas) | Horizontal (sharding built-in) |
| Schema | Well-defined, stable | Evolving, schema-less |
| Transactions | Multi-row ACID transactions | Single-document atomicity |
| Examples | PostgreSQL, MySQL | MongoDB, Cassandra, DynamoDB, Redis |
| Use Cases | Banking, e-commerce orders | Social feeds, IoT data, caching |

> **Interview Insight:** Never say "I would use NoSQL because it scales better." Both SQL and NoSQL can scale to massive workloads. Instagram runs on PostgreSQL. Discord switched FROM Cassandra TO ScyllaDB (still NoSQL). The right answer is always about your specific access patterns, consistency requirements, and data relationships.

### The Core Building Blocks

Every large-scale system uses some combination of these components.

**CDN (Content Delivery Network):** Caches static assets at edge locations worldwide. Reduces latency from 200ms to 20ms for global users. CloudFront, Cloudflare, and Akamai are the major providers.

**Message Queues:** Decouple producers from consumers for asynchronous processing. Kafka handles trillions of messages per day at LinkedIn. SQS and RabbitMQ are simpler alternatives.

**Caches:** Store frequently accessed data in memory. Redis and Memcached reduce database load by 80-95%. Cache invalidation is famously one of the two hard problems in computer science.

**Database Sharding:** Splits a large database across multiple machines. Each shard holds a subset of the data. Essential when a single database machine cannot handle the load.

\`\`\`python
# Simple Consistent Hashing for Database Sharding
import hashlib
from typing import List, Optional

class ConsistentHash:
    """Distribute data across shards with minimal redistribution."""

    def __init__(self, nodes: List[str], virtual_nodes: int = 150):
        self.ring: dict = {}
        self.sorted_keys: List[int] = []
        self.nodes = set()
        for node in nodes:
            self.add_node(node, virtual_nodes)

    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode()).hexdigest(), 16)

    def add_node(self, node: str, virtual_nodes: int = 150):
        self.nodes.add(node)
        for i in range(virtual_nodes):
            vnode_key = f"{node}:vn{i}"
            h = self._hash(vnode_key)
            self.ring[h] = node
            self.sorted_keys.append(h)
        self.sorted_keys.sort()

    def get_node(self, key: str) -> str:
        if not self.ring:
            raise RuntimeError("No nodes in the ring")
        h = self._hash(key)
        for ring_key in self.sorted_keys:
            if h <= ring_key:
                return self.ring[ring_key]
        return self.ring[self.sorted_keys[0]]

# Example: 4 database shards
ch = ConsistentHash(["shard-1", "shard-2", "shard-3", "shard-4"])
for user_id in ["user_100", "user_200", "user_300"]:
    print(f"{user_id} -> {ch.get_node(user_id)}")
\`\`\`

\`\`\`java
// Consistent Hashing in Java
import java.security.MessageDigest;
import java.util.*;

public class ConsistentHash {
    private final TreeMap<Long, String> ring = new TreeMap<>();
    private final int virtualNodes;

    public ConsistentHash(List<String> nodes, int virtualNodes) {
        this.virtualNodes = virtualNodes;
        nodes.forEach(this::addNode);
    }

    private long hash(String key) {
        try {
            var md = MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(key.getBytes());
            return ((long)(digest[0] & 0xFF) << 24) |
                   ((long)(digest[1] & 0xFF) << 16) |
                   ((long)(digest[2] & 0xFF) << 8)  |
                   (digest[3] & 0xFF);
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    public void addNode(String node) {
        for (int i = 0; i < virtualNodes; i++) {
            ring.put(hash(node + ":vn" + i), node);
        }
    }

    public String getNode(String key) {
        if (ring.isEmpty()) throw new RuntimeException("Empty ring");
        long h = hash(key);
        var entry = ring.ceilingEntry(h);
        return (entry != null) ? entry.getValue() : ring.firstEntry().getValue();
    }

    public static void main(String[] args) {
        var ch = new ConsistentHash(
            List.of("shard-1", "shard-2", "shard-3", "shard-4"), 150);
        for (String userId : List.of("user_100", "user_200", "user_300")) {
            System.out.printf("%s -> %s%n", userId, ch.getNode(userId));
        }
    }
}
\`\`\`

> **Interview Insight:** When discussing caching, always mention your cache invalidation strategy. The three patterns are: write-through (write to cache and DB simultaneously), write-behind (write to cache, async write to DB), and cache-aside (application manages cache manually). Most systems use cache-aside with TTL-based expiration.

### Common System Design Mistakes

First, jumping into the solution without clarifying requirements. Always spend the first 3 minutes asking questions. Second, not estimating scale. The design for 1,000 users is completely different from 100 million users. Third, designing a monolith when microservices are needed, or vice versa. Fourth, ignoring failure modes. What happens when your primary database goes down? Fifth, over-engineering. Not every system needs Kafka, Redis, and 10 microservices. Start simple and scale as needed.

### Summary

System design interviews test your ability to think at scale, make justified tradeoffs, and communicate clearly. Use the RESHADED framework to structure your answer. Always start with requirements and estimation. Know your building blocks: databases, caches, queues, CDNs. Practice the top 20 system design problems and you will be prepared for any interview.`,
    objectives: [
      'Master the RESHADED framework for structuring system design interviews',
      'Perform back-of-the-envelope calculations for any system',
      'Choose between SQL and NoSQL with justified reasoning',
      'Implement consistent hashing for database sharding',
      'Understand core building blocks: CDN, queues, caches, sharding',
      'Avoid the top 5 system design interview mistakes',
    ],
    reviewQuestions: [
      'Walk through the RESHADED framework. What does each step cover and how long should you spend?',
      'When would you choose PostgreSQL over DynamoDB? Give two concrete scenarios for each.',
      'Calculate the QPS and storage needs for a system with 50 million DAU, 5 requests per user, and 1KB per request.',
      'Explain consistent hashing and why it is better than simple modulo-based sharding.',
      'What are the three cache invalidation strategies? When would you use each one?',
      'Design a URL shortener at scale. What are the key components and tradeoffs?',
    ],
  },

  'hash-map': {
    topic: 'Hash Maps',
    sessionNumber: 1,
    title: 'Hash Maps and Hash Tables — The Complete Deep Dive',
    content: `## What is a Hash Map?

A hash map (also called a hash table) is a data structure that stores key-value pairs and provides O(1) average-time lookup, insertion, and deletion. It is the single most important data structure in software engineering interviews. Over 30% of all LeetCode problems can be solved or optimized using a hash map. Every programming language provides one: Python has dict, Java has HashMap, JavaScript has Map and plain objects, and Go has map.

### How Hash Maps Work Internally

A hash map has three core components. First, a hash function that converts any key into an integer index. Second, an array of buckets where each bucket stores one or more key-value pairs. Third, a collision resolution strategy for when two different keys hash to the same bucket.

When you call map.put("name", "Alice"), the hash map computes hash("name") which might return 42. It then calculates 42 % array_length to get the bucket index, say 2. It stores the pair ("name", "Alice") in bucket 2. When you call map.get("name"), it repeats the hash computation, goes to bucket 2, and returns "Alice".

### Hash Functions

A good hash function has three properties. It is deterministic: the same key always produces the same hash. It is uniform: keys are spread evenly across all buckets. It is fast: computing the hash takes O(1) time.

\`\`\`python
# How Python's dict hashing works (simplified)
def simple_hash(key: str, table_size: int) -> int:
    """Simplified string hash function."""
    hash_value = 0
    for char in key:
        hash_value = (hash_value * 31 + ord(char)) % table_size
    return hash_value

# Real-world: Python uses SipHash for security against hash collision attacks
print(simple_hash("name", 16))   # 14
print(simple_hash("age", 16))    # 6
print(simple_hash("email", 16))  # 8
\`\`\`

\`\`\`java
// How Java's HashMap hashing works
public class HashDemo {
    // Java's actual hash spreading function (from HashMap source)
    static int hash(Object key) {
        int h;
        return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
    }

    // Bucket index calculation
    static int bucketIndex(Object key, int tableSize) {
        return hash(key) & (tableSize - 1);  // Bitwise AND (faster than modulo)
    }

    public static void main(String[] args) {
        System.out.println(bucketIndex("name", 16));  // Some index 0-15
        System.out.println(bucketIndex("age", 16));
    }
}
\`\`\`

### Collision Resolution: Chaining vs Open Addressing

When two keys hash to the same bucket, we have a collision. There are two main strategies.

**Separate Chaining** stores a linked list (or tree) at each bucket. When a collision occurs, the new pair is appended to the list. Java's HashMap uses chaining and upgrades the linked list to a red-black tree when a bucket has more than 8 entries (called treeification).

**Open Addressing** stores all entries directly in the array. When a collision occurs, it probes for the next empty slot using linear probing, quadratic probing, or double hashing. Python's dict uses open addressing with a custom probing sequence.

| Strategy | Memory | Cache Performance | Worst Case | Used By |
|----------|--------|------------------|------------|---------|
| Separate Chaining | Extra (linked list nodes) | Poor (pointer chasing) | O(n) per bucket | Java HashMap, Go map |
| Open Addressing | Compact (in-array) | Excellent (contiguous memory) | O(n) probing | Python dict, Rust HashMap |

\`\`\`python
# Complete Hash Map Implementation with Separate Chaining
class HashMap:
    """Hash map using separate chaining for collision resolution."""

    def __init__(self, initial_capacity: int = 16, load_factor: float = 0.75):
        self.capacity = initial_capacity
        self.load_factor = load_factor
        self.size = 0
        self.buckets: list = [[] for _ in range(self.capacity)]

    def _hash(self, key) -> int:
        return hash(key) % self.capacity

    def put(self, key, value) -> None:
        """Insert or update a key-value pair."""
        if self.size / self.capacity >= self.load_factor:
            self._resize()

        index = self._hash(key)
        bucket = self.buckets[index]

        # Update existing key
        for i, (k, v) in enumerate(bucket):
            if k == key:
                bucket[i] = (key, value)
                return

        # Insert new key
        bucket.append((key, value))
        self.size += 1

    def get(self, key, default=None):
        """Retrieve value by key."""
        index = self._hash(key)
        for k, v in self.buckets[index]:
            if k == key:
                return v
        return default

    def delete(self, key) -> bool:
        """Remove a key-value pair. Returns True if found."""
        index = self._hash(key)
        bucket = self.buckets[index]
        for i, (k, v) in enumerate(bucket):
            if k == key:
                bucket.pop(i)
                self.size -= 1
                return True
        return False

    def _resize(self) -> None:
        """Double the capacity and rehash all entries."""
        old_buckets = self.buckets
        self.capacity *= 2
        self.buckets = [[] for _ in range(self.capacity)]
        self.size = 0
        for bucket in old_buckets:
            for key, value in bucket:
                self.put(key, value)

    def __len__(self):
        return self.size

    def __contains__(self, key):
        return self.get(key) is not None

# Usage
hm = HashMap()
hm.put("name", "Alice")
hm.put("age", 30)
hm.put("city", "Seattle")
print(hm.get("name"))     # Alice
print(len(hm))            # 3
print("age" in hm)        # True
hm.delete("age")
print("age" in hm)        # False
\`\`\`

\`\`\`java
// Complete HashMap Implementation with Separate Chaining in Java
import java.util.*;

public class SimpleHashMap<K, V> {
    private static final int INITIAL_CAPACITY = 16;
    private static final float LOAD_FACTOR = 0.75f;

    private LinkedList<Entry<K, V>>[] buckets;
    private int size;

    static class Entry<K, V> {
        final K key;
        V value;
        Entry(K key, V value) { this.key = key; this.value = value; }
    }

    @SuppressWarnings("unchecked")
    public SimpleHashMap() {
        buckets = new LinkedList[INITIAL_CAPACITY];
        for (int i = 0; i < INITIAL_CAPACITY; i++) {
            buckets[i] = new LinkedList<>();
        }
    }

    private int getBucketIndex(K key) {
        return Math.abs(key.hashCode()) % buckets.length;
    }

    public void put(K key, V value) {
        if ((float) size / buckets.length >= LOAD_FACTOR) {
            resize();
        }
        int index = getBucketIndex(key);
        for (Entry<K, V> entry : buckets[index]) {
            if (entry.key.equals(key)) {
                entry.value = value;
                return;
            }
        }
        buckets[index].add(new Entry<>(key, value));
        size++;
    }

    public V get(K key) {
        int index = getBucketIndex(key);
        for (Entry<K, V> entry : buckets[index]) {
            if (entry.key.equals(key)) return entry.value;
        }
        return null;
    }

    public boolean delete(K key) {
        int index = getBucketIndex(key);
        var it = buckets[index].iterator();
        while (it.hasNext()) {
            if (it.next().key.equals(key)) {
                it.remove();
                size--;
                return true;
            }
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    private void resize() {
        var oldBuckets = buckets;
        buckets = new LinkedList[oldBuckets.length * 2];
        for (int i = 0; i < buckets.length; i++) {
            buckets[i] = new LinkedList<>();
        }
        size = 0;
        for (var bucket : oldBuckets) {
            for (var entry : bucket) {
                put(entry.key, entry.value);
            }
        }
    }

    public int size() { return size; }

    public static void main(String[] args) {
        var map = new SimpleHashMap<String, Integer>();
        map.put("apple", 1);
        map.put("banana", 2);
        map.put("cherry", 3);
        System.out.println(map.get("banana"));  // 2
        System.out.println(map.size());          // 3
        map.delete("banana");
        System.out.println(map.get("banana"));   // null
    }
}
\`\`\`

### Load Factor and Resizing

The load factor is the ratio of stored entries to total buckets. When it exceeds a threshold (0.75 in Java, about 0.66 in Python), the hash map doubles its capacity and rehashes all existing entries. This is called resizing or rehashing.

Resizing is O(n) but happens infrequently enough that the amortized cost of insertion remains O(1). Java's HashMap starts with 16 buckets and doubles: 16, 32, 64, 128, and so on. If you know the number of entries in advance, pre-sizing the map avoids expensive resizes.

> **Interview Insight:** A classic interview question is "What is the time complexity of HashMap operations?" The answer is O(1) average, O(n) worst case. The worst case happens when all keys hash to the same bucket. In Java 8+, the worst case improved to O(log n) because HashMap converts long chains to red-black trees. Always mention this optimization to impress interviewers.

### Hash Map vs Other Data Structures

| Operation | HashMap | Array | Linked List | BST | Sorted Array |
|-----------|---------|-------|-------------|-----|-------------|
| Search | O(1) avg | O(n) | O(n) | O(log n) | O(log n) |
| Insert | O(1) avg | O(1) end, O(n) mid | O(1) head | O(log n) | O(n) |
| Delete | O(1) avg | O(n) | O(n) | O(log n) | O(n) |
| Ordered? | No | No | No | Yes | Yes |
| Memory | High | Low | Medium | Medium | Low |

### Top Interview Patterns Using Hash Maps

**Pattern 1: Two Sum.** Use a hash map to store complement values. For each number, check if its complement exists in the map. Time O(n), Space O(n).

**Pattern 2: Frequency Counting.** Count occurrences of each element. Used in "Top K Frequent Elements", "Valid Anagram", "Group Anagrams".

**Pattern 3: Seen Before / Deduplication.** Track which elements you have already processed. Used in "Contains Duplicate", "First Unique Character", "Longest Substring Without Repeating Characters".

**Pattern 4: Index Mapping.** Store the index of each element for quick lookup. Used in "Two Sum" (return indices), "Subarray Sum Equals K".

\`\`\`python
# The 4 Essential Hash Map Patterns

# Pattern 1: Two Sum
def two_sum(nums: list, target: int) -> list:
    seen = {}  # value -> index
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
    return []

# Pattern 2: Frequency Count (Top K Frequent)
from collections import Counter
def top_k_frequent(nums: list, k: int) -> list:
    return [x for x, _ in Counter(nums).most_common(k)]

# Pattern 3: First Unique Character
def first_unique_char(s: str) -> int:
    freq = Counter(s)
    for i, ch in enumerate(s):
        if freq[ch] == 1:
            return i
    return -1

# Pattern 4: Subarray Sum Equals K
def subarray_sum(nums: list, k: int) -> int:
    prefix_counts = {0: 1}
    current_sum = 0
    result = 0
    for num in nums:
        current_sum += num
        result += prefix_counts.get(current_sum - k, 0)
        prefix_counts[current_sum] = prefix_counts.get(current_sum, 0) + 1
    return result

print(two_sum([2, 7, 11, 15], 9))          # [0, 1]
print(top_k_frequent([1,1,1,2,2,3], 2))    # [1, 2]
print(first_unique_char("leetcode"))         # 0
print(subarray_sum([1, 1, 1], 2))           # 2
\`\`\`

\`\`\`java
// The 4 Essential Hash Map Patterns in Java
import java.util.*;
import java.util.stream.*;

public class HashMapPatterns {
    // Pattern 1: Two Sum
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (seen.containsKey(complement)) {
                return new int[]{seen.get(complement), i};
            }
            seen.put(nums[i], i);
        }
        return new int[]{};
    }

    // Pattern 2: Top K Frequent
    public static List<Integer> topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> freq = new HashMap<>();
        for (int n : nums) freq.merge(n, 1, Integer::sum);
        return freq.entrySet().stream()
            .sorted(Map.Entry.<Integer, Integer>comparingByValue().reversed())
            .limit(k)
            .map(Map.Entry::getKey)
            .collect(Collectors.toList());
    }

    // Pattern 3: First Unique Character
    public static int firstUniqueChar(String s) {
        Map<Character, Integer> freq = new LinkedHashMap<>();
        for (char c : s.toCharArray()) {
            freq.merge(c, 1, Integer::sum);
        }
        for (int i = 0; i < s.length(); i++) {
            if (freq.get(s.charAt(i)) == 1) return i;
        }
        return -1;
    }

    // Pattern 4: Subarray Sum Equals K
    public static int subarraySum(int[] nums, int k) {
        Map<Integer, Integer> prefixCounts = new HashMap<>(Map.of(0, 1));
        int sum = 0, result = 0;
        for (int num : nums) {
            sum += num;
            result += prefixCounts.getOrDefault(sum - k, 0);
            prefixCounts.merge(sum, 1, Integer::sum);
        }
        return result;
    }

    public static void main(String[] args) {
        System.out.println(Arrays.toString(twoSum(new int[]{2,7,11,15}, 9)));
        System.out.println(topKFrequent(new int[]{1,1,1,2,2,3}, 2));
        System.out.println(firstUniqueChar("leetcode"));
        System.out.println(subarraySum(new int[]{1,1,1}, 2));
    }
}
\`\`\`

> **Interview Insight:** When an interviewer asks "Can you optimize this?" and your current solution is O(n squared) or uses nested loops, the answer is almost always "Use a hash map." Trading O(n) space for O(n) time is the most common optimization in coding interviews.

### Thread Safety and ConcurrentHashMap

In multi-threaded environments, standard HashMaps are not thread-safe. Java provides ConcurrentHashMap which uses lock striping: instead of one lock for the entire map, it divides the map into segments, each with its own lock. This allows multiple threads to read and write simultaneously to different segments. Python's dict is protected by the GIL in CPython, making it thread-safe for individual operations but not for compound operations like "check-then-act".

### Common Pitfalls

First, using mutable objects as keys. In Python, lists cannot be dict keys because they are mutable and their hash would change. Use tuples instead. In Java, if you modify an object after using it as a HashMap key, the map cannot find it anymore. Second, assuming O(1) is guaranteed. Hash collisions can degrade to O(n). Third, not pre-sizing when the entry count is known. Creating a HashMap with 16 buckets and inserting 10 million entries causes many expensive resizes. Fourth, ignoring the difference between HashMap and TreeMap. If you need sorted iteration, use TreeMap. HashMap has no ordering guarantees.

### Summary

Hash maps are the most versatile and frequently tested data structure in interviews. They provide O(1) average-time operations through hashing, collision resolution, and dynamic resizing. Master the four core patterns: Two Sum, Frequency Count, Seen Before, and Index Mapping. These patterns solve over 30% of all interview coding problems. Understand the internals: hash functions, load factors, chaining vs open addressing, and thread safety.`,
    objectives: [
      'Understand how hash maps work internally: hash functions, buckets, and collisions',
      'Implement a complete hash map from scratch in Python and Java',
      'Master separate chaining vs open addressing tradeoffs',
      'Apply the 4 essential hash map interview patterns',
      'Understand load factor, resizing, and performance implications',
      'Know thread-safety concerns: ConcurrentHashMap and GIL',
    ],
    reviewQuestions: [
      'What are the three properties of a good hash function?',
      'Compare separate chaining and open addressing. When would you prefer each?',
      'What happens when the load factor exceeds the threshold? Walk through the resizing process.',
      'Solve Two Sum using a hash map. What is the time and space complexity?',
      'Why does Java HashMap convert chains to red-black trees at 8 entries? What complexity improvement does this give?',
      'Why can you not use a Python list as a dictionary key? What would you use instead?',
    ],
  },
};

/**
 * Get a demo session for testing. Accepts an optional topic key.
 * Available topics: 'load-balancing', 'system-design', 'hash-map'.
 * Defaults to 'load-balancing' if no topic is specified.
 */
export function getDemoSession(topic?: DemoTopic | string): SessionInput {
  if (topic && topic in DEMO_SESSIONS) {
    return DEMO_SESSIONS[topic as DemoTopic];
  }
  // Default to load-balancing
  return DEMO_SESSIONS['load-balancing'];
}

/** List all available demo topics. */
export function listDemoTopics(): string[] {
  return Object.keys(DEMO_SESSIONS);
}
