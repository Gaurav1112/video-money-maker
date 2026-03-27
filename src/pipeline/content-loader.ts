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
  // Structure 1: { sessions: [...] }
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

  // Structure 2: { topics: [{ sessions: [...] }] }
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

  // Structure 3: { questions: [...] } (QA format)
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

// Demo session for testing when content files aren't available
export function getDemoSession(): SessionInput {
  return {
    topic: 'Load Balancing',
    sessionNumber: 1,
    title: 'Introduction to Load Balancing',
    content: `## What is Load Balancing?

Load balancing distributes incoming network traffic across multiple servers to ensure no single server bears too much demand. This improves application availability, scalability, and reliability.

### Why Load Balancing Matters

In modern distributed systems, a single server cannot handle millions of requests. Load balancers act as traffic cops, routing client requests across servers that can fulfill them efficiently.

### Types of Load Balancers

**Hardware Load Balancers** are physical devices (like F5 or Citrix ADC) placed in data centers. They are expensive but extremely fast.

**Software Load Balancers** run on commodity hardware. Examples include Nginx, HAProxy, and AWS ALB. They are flexible and cost-effective.

\`\`\`python
# Round Robin Load Balancer
class RoundRobinLB:
    def __init__(self, servers):
        self.servers = servers
        self.index = 0

    def get_next_server(self):
        server = self.servers[self.index]
        self.index = (self.index + 1) % len(self.servers)
        return server

lb = RoundRobinLB(["server1", "server2", "server3"])
print(lb.get_next_server())  # server1
print(lb.get_next_server())  # server2
\`\`\`

\`\`\`java
// Round Robin Load Balancer in Java
public class RoundRobinLB {
    private List<String> servers;
    private AtomicInteger index = new AtomicInteger(0);

    public RoundRobinLB(List<String> servers) {
        this.servers = servers;
    }

    public String getNextServer() {
        int i = index.getAndIncrement() % servers.size();
        return servers.get(i);
    }
}
\`\`\`

### Load Balancing Algorithms

| Algorithm | How It Works | Best For |
|-----------|-------------|----------|
| Round Robin | Rotates sequentially | Equal server capacity |
| Weighted Round Robin | Assigns weights | Different server specs |
| Least Connections | Picks least busy | Variable request duration |
| IP Hash | Routes by client IP | Session persistence |

> **Interview Insight:** When discussing load balancing in interviews, always mention health checks. A good load balancer removes unhealthy servers from the rotation automatically.

### Key Takeaways

- Load balancing distributes traffic for high availability
- Software LBs (Nginx, HAProxy) are the standard choice
- Round Robin is simple but Least Connections handles variable loads better
- Always implement health checks to detect failed servers`,
    objectives: [
      'Understand what load balancing is and why it matters',
      'Compare hardware vs software load balancers',
      'Implement Round Robin algorithm in Python and Java',
      'Choose the right algorithm for your use case',
    ],
    reviewQuestions: [
      'What is the difference between hardware and software load balancers?',
      'When would you use Least Connections over Round Robin?',
      'How do health checks improve load balancer reliability?',
    ],
  };
}
