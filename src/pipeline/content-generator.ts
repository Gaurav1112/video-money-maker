/**
 * content-generator.ts — Universal content generator
 *
 * Accepts ANY topic string or raw text/markdown and produces a SessionInput
 * suitable for the video pipeline. Works entirely offline with zero API calls.
 *
 * Three modes:
 *   1. Topic prompt  — "Explain Load Balancing" → generates full lesson from templates
 *   2. Raw content   — user pastes markdown/text → wraps it into SessionInput
 *   3. Guru-sishya   — loads existing JSON content (handled by content-loader.ts)
 */

import { SessionInput } from '../types';

// ─── Public API ──────────────────────────────────────────────────────────────

export interface GenerateOptions {
  /** Primary language for code examples */
  language?: 'python' | 'java' | 'typescript' | 'javascript';
  /** Second language for dual examples */
  secondaryLanguage?: 'python' | 'java' | 'typescript' | 'javascript';
  /** Target duration bracket */
  duration?: 'short' | 'medium' | 'long';
  /** Teaching style */
  style?: 'fireship' | 'khan' | 'tutorial';
  /** Session number (for series) */
  sessionNumber?: number;
}

/**
 * Generate a full lesson from a topic prompt like "Explain Binary Search Trees".
 * Returns a SessionInput with title, objectives, markdown content (including
 * code blocks, tables, interview insights, review questions), ready for the
 * script-generator pipeline.
 */
export function generateFromPrompt(prompt: string, options: GenerateOptions = {}): SessionInput {
  const {
    language = 'python',
    secondaryLanguage = 'java',
    duration = 'medium',
    style = 'fireship',
    sessionNumber = 1,
  } = options;

  const topic = extractTopicName(prompt);
  const slug = toSlug(topic);
  const conceptCount = duration === 'short' ? 3 : duration === 'long' ? 6 : 4;

  // Pick varied templates based on topic hash to avoid formulaic feel
  const seed = hashString(topic);
  const concepts = generateConcepts(topic, conceptCount, seed);
  const codeExamples = generateCodeExamples(topic, concepts, language, secondaryLanguage, seed);
  const table = generateComparisonTable(topic, concepts, seed);
  const interviewInsight = generateInterviewInsight(topic, concepts, seed);
  const reviewQuestions = generateReviewQuestions(topic, concepts, seed);
  const objectives = generateObjectives(topic, concepts, seed);
  const summary = generateSummary(topic, concepts, seed);

  // Assemble markdown content
  const sections: string[] = [];

  // Opening explanation
  sections.push(`## What is ${topic}?\n`);
  sections.push(generateOpening(topic, style, seed));
  sections.push('');

  // Core concepts (each gets its own section)
  for (let i = 0; i < concepts.length; i++) {
    sections.push(`### ${concepts[i].heading}\n`);
    sections.push(concepts[i].body);
    sections.push('');

    // Insert code example after the first or second concept
    if (i === 0 || i === 1) {
      const example = codeExamples[i];
      if (example) {
        sections.push(example);
        sections.push('');
      }
    }
  }

  // Insert remaining code examples
  for (let i = 2; i < codeExamples.length; i++) {
    sections.push(codeExamples[i]);
    sections.push('');
  }

  // Comparison table
  sections.push(`### ${table.heading}\n`);
  sections.push(table.markdown);
  sections.push('');

  // Interview insight
  sections.push(interviewInsight);
  sections.push('');

  // Summary
  sections.push(`### Key Takeaways\n`);
  sections.push(summary);

  return {
    topic,
    sessionNumber,
    title: generateTitle(topic, style, seed),
    content: sections.join('\n'),
    objectives,
    reviewQuestions,
  };
}

/**
 * Convert raw text or markdown into a SessionInput.
 * If the text has markdown headings, they are preserved. Otherwise the text
 * is wrapped with a generated title.
 */
export function generateFromContent(rawContent: string, options: GenerateOptions = {}): SessionInput {
  const { sessionNumber = 1 } = options;

  // Try to extract a title from the first heading
  const headingMatch = rawContent.match(/^#\s+(.+)/m) || rawContent.match(/^##\s+(.+)/m);
  const title = headingMatch ? headingMatch[1].trim() : rawContent.slice(0, 60).replace(/[#*_\n]/g, '').trim();

  // Extract topic from title
  const topic = title.replace(/^(Introduction to |Explain |Teach me |Understanding )/i, '').trim();

  // Extract objectives from subheadings
  const headings = rawContent.match(/^###?\s+.+/gm) || [];
  const objectives = headings.slice(0, 5).map(h => h.replace(/^#+\s*/, '').trim());
  if (objectives.length === 0) {
    objectives.push(`Understand the core concepts of ${topic}`);
  }

  // Extract potential review questions (lines ending with ?)
  const questions = rawContent.match(/^.+\?$/gm) || [];
  const reviewQuestions = questions
    .filter(q => q.length > 15 && q.length < 200)
    .slice(0, 5)
    .map(q => q.replace(/^[>#*-]\s*/, '').trim());

  if (reviewQuestions.length === 0) {
    reviewQuestions.push(
      `What are the key advantages of ${topic}?`,
      `How would you explain ${topic} in an interview?`,
      `What are common mistakes when working with ${topic}?`,
    );
  }

  return {
    topic,
    sessionNumber,
    title,
    content: rawContent,
    objectives,
    reviewQuestions,
  };
}

// ─── Internal: Topic Extraction ──────────────────────────────────────────────

function extractTopicName(prompt: string): string {
  // Strip common prefixes
  let topic = prompt
    .replace(/^(explain|teach me|teach|what is|how does|describe|introduction to|intro to|create a video about|make a video on|video about|generate)\s+/i, '')
    .replace(/\s+(in python|in java|in typescript|in javascript|in detail|step by step|for beginners|for interviews)$/i, '')
    .replace(/[?.!]$/g, '')
    .trim();

  // Capitalize properly
  const acronyms = ['API', 'REST', 'SQL', 'NoSQL', 'HTTP', 'HTTPS', 'DNS', 'TCP', 'UDP', 'IP',
    'OOP', 'SOLID', 'DRY', 'KISS', 'ACID', 'BASE', 'CAP', 'JWT', 'OAuth', 'GraphQL',
    'CI', 'CD', 'TDD', 'BDD', 'AWS', 'GCP', 'CSS', 'HTML', 'DOM', 'XSS', 'CSRF',
    'LRU', 'LFU', 'BFS', 'DFS', 'BST', 'AVL', 'CORS', 'CDN', 'SSL', 'TLS'];

  topic = topic.split(/\s+/).map(word => {
    const upper = word.toUpperCase();
    if (acronyms.includes(upper)) return upper;
    if (word.length <= 2) return word.toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');

  return topic;
}

function toSlug(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── Internal: Title Generation ──────────────────────────────────────────────

function generateTitle(topic: string, style: string, seed: number): string {
  const templates = [
    `${topic}: The Complete Guide`,
    `Understanding ${topic} from Scratch`,
    `${topic} Deep Dive`,
    `Mastering ${topic} for Interviews`,
    `${topic}: What Every Developer Should Know`,
    `${topic} Explained Simply`,
    `The Definitive Guide to ${topic}`,
    `${topic}: From Zero to Hero`,
  ];
  return templates[seed % templates.length];
}

// ─── Internal: Opening Paragraph ─────────────────────────────────────────────

function generateOpening(topic: string, style: string, seed: number): string {
  const openings = [
    `${topic} is one of those concepts that separates junior developers from senior ones. On the surface it seems straightforward, but the nuances matter enormously in production systems and technical interviews alike. Let's break it down properly.`,

    `If someone asked you to explain ${topic} right now, could you do it confidently? Most developers have a vague understanding, but when pressed on the details during an interview, they stumble. Today we fix that.`,

    `Every modern software system relies on ${topic} in some form. Whether you're building a startup MVP or designing systems at scale, understanding this concept will directly impact the quality of your engineering decisions.`,

    `Here's the thing about ${topic} that textbooks get wrong. They teach you the theory without showing you why it matters. In this lesson, we connect the dots between theory and real-world application, with code you can actually use.`,

    `${topic} comes up in almost every technical interview at top companies. But the interviewers aren't looking for a textbook definition. They want to see that you understand the trade-offs, can reason about edge cases, and know when NOT to use it.`,

    `Let's start with a simple question. Why does ${topic} exist? What problem does it solve? Once you understand the motivation, everything else clicks into place. That's exactly how we're going to approach it.`,
  ];
  return openings[seed % openings.length];
}

// ─── Internal: Concept Generation ────────────────────────────────────────────

interface Concept {
  heading: string;
  body: string;
}

function generateConcepts(topic: string, count: number, seed: number): Concept[] {
  // Generate contextually relevant concept headings
  const headingPatterns = [
    [
      `Why ${topic} Matters`,
      `Core Principles of ${topic}`,
      `How ${topic} Works Under the Hood`,
      `Common ${topic} Patterns`,
      `${topic} in Production`,
      `When NOT to Use ${topic}`,
    ],
    [
      `The Problem ${topic} Solves`,
      `Key Components of ${topic}`,
      `${topic} Implementation Strategies`,
      `Performance Considerations`,
      `Real-World ${topic} Examples`,
      `${topic} Best Practices`,
    ],
    [
      `${topic} Fundamentals`,
      `Types of ${topic}`,
      `Building ${topic} Step by Step`,
      `${topic} Trade-offs`,
      `Scaling with ${topic}`,
      `Advanced ${topic} Techniques`,
    ],
  ];

  const patternSet = headingPatterns[seed % headingPatterns.length];

  const bodyTemplates = [
    // Explanatory body paragraphs with varied structure
    (h: string) => `The concept behind ${h.toLowerCase()} is critical to understand before diving into implementation. In distributed systems, this becomes even more important because failures are inevitable and your design must account for them gracefully.`,

    (h: string) => `To understand ${h.toLowerCase()}, consider a real-world analogy. Think of it like a highway system. Traffic needs to flow efficiently, bottlenecks need to be identified early, and the system needs to handle unexpected surges without falling apart.`,

    (h: string) => `When we talk about ${h.toLowerCase()}, we're really talking about making intelligent trade-offs. There is no perfect solution. Every approach has strengths and weaknesses, and senior engineers know how to pick the right tool for the specific constraints they face.`,

    (h: string) => `Most tutorials oversimplify ${h.toLowerCase()}. They show you the happy path and ignore the edge cases. But in production, edge cases ARE the path. Let's look at what actually happens when things go wrong and how to design for resilience.`,

    (h: string) => `The key insight about ${h.toLowerCase()} is that it's not just a technical decision. It affects team productivity, operational costs, and how quickly you can ship features. Understanding these second-order effects is what makes a staff engineer.`,

    (h: string) => `There are several approaches to ${h.toLowerCase()}, each with distinct characteristics. The choice depends on your specific requirements: consistency vs. availability, latency vs. throughput, simplicity vs. flexibility. Let's examine each approach.`,
  ];

  const concepts: Concept[] = [];
  for (let i = 0; i < count; i++) {
    const heading = patternSet[i % patternSet.length];
    const bodyFn = bodyTemplates[(seed + i) % bodyTemplates.length];
    concepts.push({
      heading,
      body: bodyFn(heading),
    });
  }

  return concepts;
}

// ─── Internal: Code Example Generation ───────────────────────────────────────

function generateCodeExamples(
  topic: string,
  concepts: Concept[],
  primary: string,
  secondary: string,
  seed: number,
): string[] {
  const slug = toSlug(topic);
  const className = toPascalCase(topic);
  const varName = toCamelCase(topic);

  const examples: string[] = [];

  // Primary language example 1: Basic implementation
  examples.push(generatePrimaryExample(topic, className, varName, primary, seed));

  // Secondary language example 1: Same concept, different language
  examples.push(generateSecondaryExample(topic, className, varName, secondary, seed));

  // Primary language example 2: Advanced/optimized version
  if (concepts.length >= 3) {
    examples.push(generateAdvancedExample(topic, className, varName, primary, seed));
  }

  return examples;
}

function generatePrimaryExample(topic: string, className: string, varName: string, lang: string, seed: number): string {
  if (lang === 'python' || lang === 'javascript' || lang === 'typescript') {
    return generatePythonExample(topic, className, varName, seed);
  }
  return generateJavaExample(topic, className, varName, seed);
}

function generateSecondaryExample(topic: string, className: string, varName: string, lang: string, seed: number): string {
  if (lang === 'java') {
    return generateJavaExample(topic, className, varName, seed);
  }
  return generatePythonExample(topic, className, varName, seed);
}

function generatePythonExample(topic: string, className: string, varName: string, seed: number): string {
  const templates = [
    // Template 1: Class-based implementation
    `\`\`\`python
# ${topic} — Core Implementation
class ${className}:
    def __init__(self):
        self.data = {}
        self.size = 0

    def process(self, key: str, value: any) -> bool:
        """Process a single item through the ${topic} pipeline."""
        if key in self.data:
            self.data[key] = self._merge(self.data[key], value)
        else:
            self.data[key] = value
            self.size += 1
        return True

    def query(self, key: str) -> any:
        """Retrieve processed result for a given key."""
        return self.data.get(key, None)

    def _merge(self, existing, new_value):
        """Merge strategy — override in subclasses for custom behavior."""
        return new_value

    def stats(self) -> dict:
        return {"size": self.size, "keys": list(self.data.keys())}


# Usage
${varName} = ${className}()
${varName}.process("users", {"count": 1500, "active": True})
${varName}.process("orders", {"count": 340, "pending": 12})
print(${varName}.stats())  # {'size': 2, 'keys': ['users', 'orders']}
\`\`\``,

    // Template 2: Function-based with decorators
    `\`\`\`python
# ${topic} — Functional Approach
from typing import List, Optional, Callable
from functools import wraps
import time

def with_${varName}(timeout: float = 5.0):
    """Decorator that applies ${topic} logic to any function."""
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            result = func(*args, **kwargs)
            elapsed = time.time() - start
            if elapsed > timeout:
                print(f"Warning: {func.__name__} took {elapsed:.2f}s")
            return result
        return wrapper
    return decorator

@with_${varName}(timeout=2.0)
def fetch_data(source: str) -> List[dict]:
    """Fetch and process data using ${topic} principles."""
    # Simulated processing
    return [{"source": source, "status": "processed"}]

@with_${varName}(timeout=1.0)
def transform(data: List[dict]) -> List[dict]:
    """Apply transformation rules based on ${topic}."""
    return [
        {**item, "transformed": True, "score": len(item) * 10}
        for item in data
    ]

# Pipeline
raw = fetch_data("api_endpoint")
result = transform(raw)
print(result)  # [{'source': 'api_endpoint', 'status': 'processed', ...}]
\`\`\``,

    // Template 3: Data structure focused
    `\`\`\`python
# ${topic} — Data Structure Implementation
from collections import defaultdict, deque
from typing import Any, Optional

class ${className}Store:
    """Efficient storage implementing ${topic} semantics."""

    def __init__(self, capacity: int = 1000):
        self._store: dict[str, Any] = {}
        self._access_order: deque = deque()
        self._frequency: dict[str, int] = defaultdict(int)
        self._capacity = capacity

    def put(self, key: str, value: Any) -> None:
        if len(self._store) >= self._capacity and key not in self._store:
            self._evict()
        self._store[key] = value
        self._touch(key)

    def get(self, key: str) -> Optional[Any]:
        if key not in self._store:
            return None
        self._touch(key)
        return self._store[key]

    def _touch(self, key: str) -> None:
        self._frequency[key] += 1
        self._access_order.append(key)

    def _evict(self) -> None:
        while self._access_order:
            candidate = self._access_order.popleft()
            if candidate in self._store:
                del self._store[candidate]
                return

    @property
    def utilization(self) -> float:
        return len(self._store) / self._capacity


store = ${className}Store(capacity=100)
store.put("config", {"debug": False, "version": "2.1"})
print(store.get("config"))       # {'debug': False, 'version': '2.1'}
print(f"{store.utilization:.0%}") # 1%
\`\`\``,
  ];

  return templates[seed % templates.length];
}

function generateJavaExample(topic: string, className: string, varName: string, seed: number): string {
  const templates = [
    // Template 1: Class with generics
    `\`\`\`java
// ${topic} — Java Implementation
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class ${className}<K, V> {
    private final Map<K, V> store;
    private final int capacity;

    public ${className}(int capacity) {
        this.store = new ConcurrentHashMap<>(capacity);
        this.capacity = capacity;
    }

    public boolean process(K key, V value) {
        if (store.size() >= capacity && !store.containsKey(key)) {
            evict();
        }
        store.put(key, value);
        return true;
    }

    public Optional<V> query(K key) {
        return Optional.ofNullable(store.get(key));
    }

    private void evict() {
        // Remove oldest entry
        Iterator<K> it = store.keySet().iterator();
        if (it.hasNext()) {
            it.next();
            it.remove();
        }
    }

    public int size() { return store.size(); }

    public static void main(String[] args) {
        ${className}<String, Integer> instance = new ${className}<>(100);
        instance.process("users", 1500);
        instance.process("orders", 340);
        System.out.println("Size: " + instance.size());            // 2
        System.out.println("Users: " + instance.query("users"));   // Optional[1500]
    }
}
\`\`\``,

    // Template 2: Interface + Implementation pattern
    `\`\`\`java
// ${topic} — Interface-Driven Design
public interface ${className}Strategy<T> {
    T execute(T input);
    boolean isApplicable(T input);
    int priority();
}

public class Default${className}<T> implements ${className}Strategy<T> {
    @Override
    public T execute(T input) {
        // Apply ${topic} transformation
        System.out.println("Processing: " + input);
        return input;
    }

    @Override
    public boolean isApplicable(T input) {
        return input != null;
    }

    @Override
    public int priority() { return 0; }
}

public class ${className}Pipeline<T> {
    private final List<${className}Strategy<T>> strategies;

    public ${className}Pipeline() {
        this.strategies = new ArrayList<>();
    }

    public void addStrategy(${className}Strategy<T> strategy) {
        strategies.add(strategy);
        strategies.sort(Comparator.comparingInt(${className}Strategy::priority));
    }

    public T run(T input) {
        T result = input;
        for (var strategy : strategies) {
            if (strategy.isApplicable(result)) {
                result = strategy.execute(result);
            }
        }
        return result;
    }
}
\`\`\``,

    // Template 3: Builder pattern
    `\`\`\`java
// ${topic} — Builder Pattern Implementation
public class ${className}Config {
    private final String name;
    private final int maxRetries;
    private final long timeoutMs;
    private final boolean enableMetrics;

    private ${className}Config(Builder builder) {
        this.name = builder.name;
        this.maxRetries = builder.maxRetries;
        this.timeoutMs = builder.timeoutMs;
        this.enableMetrics = builder.enableMetrics;
    }

    public static class Builder {
        private String name = "default";
        private int maxRetries = 3;
        private long timeoutMs = 5000;
        private boolean enableMetrics = true;

        public Builder name(String name) { this.name = name; return this; }
        public Builder maxRetries(int n) { this.maxRetries = n; return this; }
        public Builder timeout(long ms) { this.timeoutMs = ms; return this; }
        public Builder metrics(boolean b) { this.enableMetrics = b; return this; }

        public ${className}Config build() {
            return new ${className}Config(this);
        }
    }

    @Override
    public String toString() {
        return name + " [retries=" + maxRetries + ", timeout=" + timeoutMs + "ms]";
    }

    public static void main(String[] args) {
        ${className}Config config = new ${className}Config.Builder()
            .name("production")
            .maxRetries(5)
            .timeout(10000)
            .metrics(true)
            .build();
        System.out.println(config); // production [retries=5, timeout=10000ms]
    }
}
\`\`\``,
  ];

  return templates[seed % templates.length];
}

function generateAdvancedExample(topic: string, className: string, varName: string, lang: string, seed: number): string {
  if (lang === 'python' || lang === 'javascript' || lang === 'typescript') {
    return `\`\`\`python
# ${topic} — Optimized / Production-Ready Version
from typing import Dict, List, Tuple
import threading

class Optimized${className}:
    """Thread-safe ${topic} implementation with monitoring."""

    def __init__(self, workers: int = 4):
        self._lock = threading.RLock()
        self._workers = workers
        self._metrics: Dict[str, int] = {
            "processed": 0, "errors": 0, "cache_hits": 0
        }
        self._cache: Dict[str, any] = {}

    def execute(self, items: List[dict]) -> List[dict]:
        results = []
        for item in items:
            cache_key = str(sorted(item.items()))
            if cache_key in self._cache:
                self._metrics["cache_hits"] += 1
                results.append(self._cache[cache_key])
                continue

            try:
                result = self._process_single(item)
                with self._lock:
                    self._cache[cache_key] = result
                    self._metrics["processed"] += 1
                results.append(result)
            except Exception as e:
                self._metrics["errors"] += 1
                results.append({"error": str(e), "input": item})

        return results

    def _process_single(self, item: dict) -> dict:
        return {**item, "status": "complete", "optimized": True}

    @property
    def hit_rate(self) -> float:
        total = self._metrics["processed"] + self._metrics["cache_hits"]
        if total == 0:
            return 0.0
        return self._metrics["cache_hits"] / total

    def report(self) -> str:
        return (f"Processed: {self._metrics['processed']}, "
                f"Cache hits: {self._metrics['cache_hits']} "
                f"({self.hit_rate:.0%}), "
                f"Errors: {self._metrics['errors']}")


engine = Optimized${className}(workers=8)
batch = [{"id": i, "data": f"item_{i}"} for i in range(5)]
results = engine.execute(batch)
print(engine.report())  # Processed: 5, Cache hits: 0 (0%), Errors: 0
\`\`\``;
  }

  return `\`\`\`java
// ${topic} — Production-Ready with Metrics
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

public class ${className}Engine {
    private final ExecutorService executor;
    private final ConcurrentHashMap<String, Object> cache;
    private final AtomicLong processed = new AtomicLong(0);
    private final AtomicLong cacheHits = new AtomicLong(0);

    public ${className}Engine(int threads) {
        this.executor = Executors.newFixedThreadPool(threads);
        this.cache = new ConcurrentHashMap<>();
    }

    public CompletableFuture<Object> submitAsync(String key, Object input) {
        return CompletableFuture.supplyAsync(() -> {
            if (cache.containsKey(key)) {
                cacheHits.incrementAndGet();
                return cache.get(key);
            }
            Object result = process(input);
            cache.put(key, result);
            processed.incrementAndGet();
            return result;
        }, executor);
    }

    private Object process(Object input) {
        // Actual ${topic} processing logic
        return input;
    }

    public String stats() {
        long total = processed.get() + cacheHits.get();
        double hitRate = total > 0 ? (double) cacheHits.get() / total : 0;
        return String.format("Processed: %d, Cache: %.0f%%", processed.get(), hitRate * 100);
    }

    public void shutdown() {
        executor.shutdown();
    }
}
\`\`\``;
}

// ─── Internal: Comparison Table ──────────────────────────────────────────────

function generateComparisonTable(topic: string, concepts: Concept[], seed: number): { heading: string; markdown: string } {
  const tableStyles = [
    {
      heading: `${topic} Approaches Compared`,
      headers: ['Approach', 'Pros', 'Cons', 'Best For'],
      rows: [
        ['Simple / Naive', 'Easy to implement, easy to debug', 'Does not scale, limited flexibility', 'Prototypes, small teams'],
        ['Optimized', 'Better performance, handles edge cases', 'More complex, harder to maintain', 'Mid-scale production'],
        ['Distributed', 'Horizontally scalable, fault-tolerant', 'Operational overhead, eventual consistency', 'Large-scale systems'],
        ['Hybrid', 'Balances simplicity and performance', 'Requires careful design', 'Most real-world applications'],
      ],
    },
    {
      heading: `When to Use ${topic}`,
      headers: ['Scenario', 'Recommended', 'Complexity', 'Trade-off'],
      rows: [
        ['Low traffic', 'Basic implementation', 'Low', 'Simplicity over performance'],
        ['High throughput', 'Async with queuing', 'Medium', 'Latency vs throughput'],
        ['High availability', 'Replicated with failover', 'High', 'Cost vs reliability'],
        ['Global scale', 'Multi-region with sharding', 'Very High', 'Consistency vs availability'],
      ],
    },
    {
      heading: `${topic}: Key Differences`,
      headers: ['Feature', 'Option A', 'Option B', 'Winner'],
      rows: [
        ['Setup Time', '5 minutes', '30 minutes', 'Option A'],
        ['Scalability', 'Vertical only', 'Horizontal', 'Option B'],
        ['Cost', 'Low (single node)', 'Higher (multiple nodes)', 'Option A'],
        ['Reliability', '99.9%', '99.99%', 'Option B'],
        ['Learning Curve', 'Beginner-friendly', 'Requires experience', 'Option A'],
      ],
    },
  ];

  const style = tableStyles[seed % tableStyles.length];
  const headerRow = `| ${style.headers.join(' | ')} |`;
  const separator = `| ${style.headers.map(() => '---').join(' | ')} |`;
  const dataRows = style.rows.map(row => `| ${row.join(' | ')} |`);

  return {
    heading: style.heading,
    markdown: [headerRow, separator, ...dataRows].join('\n'),
  };
}

// ─── Internal: Interview Insight ─────────────────────────────────────────────

function generateInterviewInsight(topic: string, concepts: Concept[], seed: number): string {
  const insights = [
    `> **Interview Insight:** When discussing ${topic} in interviews, never just recite the definition. Start with the problem it solves, explain the key trade-offs, then describe how you've used it in practice. Interviewers want to see that you can think critically about when to apply it and when to choose alternatives.`,

    `> **Interview Insight:** A common trap in ${topic} questions is over-engineering the solution. Start with the simplest approach that works, then discuss how you would evolve it as requirements grow. This shows maturity and practical thinking, which interviewers value far more than textbook answers.`,

    `> **Interview Insight:** The best way to stand out when asked about ${topic} is to mention failure modes. What happens when things go wrong? How do you detect it? How do you recover? Senior engineers think about the unhappy path first, and that's exactly what distinguishes a strong candidate.`,

    `> **Interview Insight:** When ${topic} comes up, always tie it back to real numbers. Instead of saying "it's faster," say "it reduces latency from 200ms to 15ms at the 99th percentile." Quantifying your answers demonstrates engineering rigor and makes your response memorable.`,

    `> **Interview Insight:** ${topic} questions often lead to follow-up discussions about scalability. Be prepared to discuss how your approach changes at 10x, 100x, and 1000x the current load. The ability to reason across different scales is a hallmark of strong system design skills.`,

    `> **Pro Tip:** Companies like Google and Amazon evaluate ${topic} understanding at three levels: can you explain the concept, can you implement it, and can you reason about its behavior under stress. Prepare examples for all three levels.`,
  ];

  return insights[seed % insights.length];
}

// ─── Internal: Review Questions ──────────────────────────────────────────────

function generateReviewQuestions(topic: string, concepts: Concept[], seed: number): string[] {
  const pools = [
    [
      `What problem does ${topic} solve, and what would happen without it?`,
      `Compare two different approaches to implementing ${topic}. When would you choose each?`,
      `What are the most common mistakes developers make with ${topic}?`,
      `How would you explain ${topic} to a non-technical stakeholder?`,
      `Describe a scenario where ${topic} would be the wrong choice.`,
    ],
    [
      `Walk through the time and space complexity of a typical ${topic} implementation.`,
      `How does ${topic} behave differently at small scale vs. large scale?`,
      `What monitoring would you set up for a production ${topic} system?`,
      `How would you test a ${topic} implementation for correctness and performance?`,
      `What are the security implications of ${topic}?`,
    ],
    [
      `If you had to redesign ${topic} from scratch today, what would you change?`,
      `How does ${topic} interact with other components in a typical system architecture?`,
      `Describe a real-world outage or incident that was caused by incorrect ${topic} usage.`,
      `What alternatives to ${topic} exist, and what are their trade-offs?`,
      `How would you migrate an existing system to use a different ${topic} approach?`,
    ],
  ];

  const pool = pools[seed % pools.length];
  return pool.slice(0, 4);
}

// ─── Internal: Objectives ────────────────────────────────────────────────────

function generateObjectives(topic: string, concepts: Concept[], seed: number): string[] {
  const objectives = [
    `Understand what ${topic} is and why it matters in modern systems`,
    `Identify the key components and how they interact`,
  ];

  // Add concept-derived objectives
  for (const concept of concepts.slice(0, 2)) {
    objectives.push(`Explain ${concept.heading.toLowerCase()}`);
  }

  objectives.push(`Implement ${topic} in code with proper error handling`);
  objectives.push(`Discuss ${topic} trade-offs confidently in interviews`);

  return objectives.slice(0, 5);
}

// ─── Internal: Summary ───────────────────────────────────────────────────────

function generateSummary(topic: string, concepts: Concept[], seed: number): string {
  const bullets = [
    `- ${topic} solves a fundamental problem in software engineering`,
    `- Always consider the trade-offs: there is no one-size-fits-all solution`,
    `- Start simple, measure performance, then optimize where it matters`,
    `- In interviews, demonstrate depth by discussing failure modes and edge cases`,
    `- Practice implementing ${topic} in code to build muscle memory`,
  ];

  return bullets.join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
