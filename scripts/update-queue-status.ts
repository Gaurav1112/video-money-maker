#!/usr/bin/env npx tsx
/**
 * Update the topic queue status after rendering or publishing.
 *
 * Usage:
 *   npx tsx scripts/update-queue-status.ts --topic load-balancing --session 3 --status rendered
 *   npx tsx scripts/update-queue-status.ts --topic load-balancing --session 3 --status published
 *
 * Statuses:
 *   rendered  - adds session to the topic's rendered[] array
 *   published - adds session to both rendered[] and published[] arrays
 */

import * as fs from 'fs';
import * as path from 'path';

interface TopicEntry {
  slug: string;
  name: string;
  sessions: number;
  category: string;
  priority: string;
  rendered: number[];
  published: number[];
}

interface TopicQueue {
  version: number;
  lastUpdated: string;
  topics: TopicEntry[];
}

const QUEUE_PATH = path.resolve(__dirname, '../config/topic-queue.json');

function main() {
  const args = process.argv.slice(2);

  const topicArg = args.find(a => a.startsWith('--topic='))?.split('=')[1]
    || (args.indexOf('--topic') >= 0 ? args[args.indexOf('--topic') + 1] : undefined);

  const sessionArg = args.find(a => a.startsWith('--session='))?.split('=')[1]
    || (args.indexOf('--session') >= 0 ? args[args.indexOf('--session') + 1] : undefined);

  const statusArg = args.find(a => a.startsWith('--status='))?.split('=')[1]
    || (args.indexOf('--status') >= 0 ? args[args.indexOf('--status') + 1] : undefined);

  if (!topicArg || !sessionArg || !statusArg) {
    console.error('Usage: update-queue-status.ts --topic <slug> --session <number> --status <rendered|published>');
    process.exit(1);
  }

  const sessionNum = parseInt(sessionArg, 10);
  if (isNaN(sessionNum) || sessionNum < 1) {
    console.error('Session must be a positive integer.');
    process.exit(1);
  }

  if (!['rendered', 'published'].includes(statusArg)) {
    console.error('Status must be "rendered" or "published".');
    process.exit(1);
  }

  if (!fs.existsSync(QUEUE_PATH)) {
    console.error(`Queue file not found: ${QUEUE_PATH}`);
    process.exit(1);
  }

  const queue: TopicQueue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
  const topic = queue.topics.find(t => t.slug === topicArg);

  if (!topic) {
    console.error(`Topic "${topicArg}" not found in queue.`);
    process.exit(1);
  }

  if (sessionNum > topic.sessions) {
    console.error(`Session ${sessionNum} exceeds total sessions (${topic.sessions}) for "${topicArg}".`);
    process.exit(1);
  }

  // Update rendered
  if (!topic.rendered.includes(sessionNum)) {
    topic.rendered.push(sessionNum);
    topic.rendered.sort((a, b) => a - b);
    console.log(`Marked ${topicArg} session ${sessionNum} as rendered.`);
  }

  // Update published
  if (statusArg === 'published' && !topic.published.includes(sessionNum)) {
    topic.published.push(sessionNum);
    topic.published.sort((a, b) => a - b);
    console.log(`Marked ${topicArg} session ${sessionNum} as published.`);
  }

  queue.lastUpdated = new Date().toISOString().split('T')[0];

  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
  console.log(`Queue updated: ${QUEUE_PATH}`);

  // Summary
  const totalSessions = queue.topics.reduce((sum, t) => sum + t.sessions, 0);
  const totalRendered = queue.topics.reduce((sum, t) => sum + t.rendered.length, 0);
  const totalPublished = queue.topics.reduce((sum, t) => sum + t.published.length, 0);
  console.log(`Progress: ${totalRendered}/${totalSessions} rendered, ${totalPublished}/${totalSessions} published`);
}

main();
