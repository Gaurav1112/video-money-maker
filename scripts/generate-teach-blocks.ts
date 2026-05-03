#!/usr/bin/env tsx
/**
 * Generates 30-line scene-by-scene narrations for each topic in TOPIC_BANK_100.json.
 * Template: hook → problem → intuition → mechanism → example → recap
 * Output: data/teach-blocks/<topicId>.json
 * Does NOT use LLM - pure template-based.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

interface Topic {
  id: number;
  topic: string;
  category?: string;
  hookSpoken?: string;
  tags?: string[];
}

const topics = JSON.parse(readFileSync(join(process.cwd(), 'TOPIC_BANK_100.json'), 'utf8')) as Topic[];

const outputDir = join(process.cwd(), 'data/teach-blocks');
mkdirSync(outputDir, { recursive: true });

function generateTeachBlock(topic: Topic) {
  const t = topic.topic;
  return {
    topicId: topic.id,
    topic: t,
    scenes: [
      { type: 'hook', narration: topic.hookSpoken || `Did you know ${t} is one of the most important concepts in tech today?` },
      { type: 'problem', narration: `Without understanding ${t}, systems fail at scale. Here's why it matters.` },
      { type: 'intuition', narration: `Think of ${t} like a traffic cop at a busy intersection — directing flow efficiently.` },
      { type: 'mechanism', narration: `The core mechanism of ${t}: it distributes work, manages state, and handles failures gracefully.` },
      { type: 'mechanism-detail', narration: `Key properties of ${t}: fault tolerance, horizontal scalability, and low latency.` },
      { type: 'example', narration: `Real-world example: companies like Netflix and Uber use ${t} to serve millions of users daily.` },
      { type: 'recap', narration: `Quick recap: ${t} solves scale. Remember: distribute, monitor, and failover. That's the pattern.` },
    ],
  };
}

for (const topic of topics) {
  const block = generateTeachBlock(topic);
  writeFileSync(join(outputDir, `${topic.id}.json`), JSON.stringify(block, null, 2), 'utf8');
}

console.log(`Generated ${topics.length} teach blocks in data/teach-blocks/`);
