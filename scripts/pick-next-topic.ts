#!/usr/bin/env npx tsx
/**
 * Pick the next unrendered topic+session from the topic queue.
 *
 * Reads config/topic-queue.json and finds the first topic that has
 * sessions not yet rendered. Outputs TOPIC= and SESSION= lines
 * for consumption by GitHub Actions or shell scripts.
 *
 * Usage:
 *   npx tsx scripts/pick-next-topic.ts
 *   npx tsx scripts/pick-next-topic.ts --priority high
 *   npx tsx scripts/pick-next-topic.ts --category system-design
 *
 * Output (stdout):
 *   TOPIC=load-balancing
 *   SESSION=4
 */

import * as fs from 'fs';
import * as path from 'path';

interface TopicEntry {
  slug: string;
  name: string;
  sessions: number;
  category: string;
  priority: 'high' | 'medium' | 'low';
  rendered: number[];
  published: number[];
}

interface TopicQueue {
  version: number;
  lastUpdated: string;
  topics: TopicEntry[];
}

const QUEUE_PATH = path.resolve(__dirname, '../config/topic-queue.json');

function loadQueue(): TopicQueue {
  if (!fs.existsSync(QUEUE_PATH)) {
    console.error(`Queue file not found: ${QUEUE_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));
}

function getNextUnrendered(queue: TopicQueue, filters: {
  priority?: string;
  category?: string;
}): { slug: string; session: number } | null {
  // Priority order: high > medium > low
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const candidates = queue.topics
    .filter(t => {
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.category && t.category !== filters.category) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort by priority first, then by slug for deterministic order
      const pa = priorityOrder[a.priority] ?? 1;
      const pb = priorityOrder[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return a.slug.localeCompare(b.slug);
    });

  for (const topic of candidates) {
    // Find the first session number (1-based) that hasn't been rendered
    for (let s = 1; s <= topic.sessions; s++) {
      if (!topic.rendered.includes(s)) {
        return { slug: topic.slug, session: s };
      }
    }
  }

  return null;
}

function main() {
  const args = process.argv.slice(2);

  const priorityArg = args.find(a => a.startsWith('--priority='))?.split('=')[1]
    || (args.indexOf('--priority') >= 0 ? args[args.indexOf('--priority') + 1] : undefined);

  const categoryArg = args.find(a => a.startsWith('--category='))?.split('=')[1]
    || (args.indexOf('--category') >= 0 ? args[args.indexOf('--category') + 1] : undefined);

  const listMode = args.includes('--list');

  const queue = loadQueue();

  if (listMode) {
    // Show status summary
    let totalSessions = 0;
    let totalRendered = 0;
    let totalPublished = 0;

    for (const t of queue.topics) {
      totalSessions += t.sessions;
      totalRendered += t.rendered.length;
      totalPublished += t.published.length;
      const remaining = t.sessions - t.rendered.length;
      if (remaining > 0) {
        console.log(`  [${t.priority.toUpperCase().padEnd(6)}] ${t.slug}: ${t.rendered.length}/${t.sessions} rendered, ${remaining} remaining`);
      }
    }

    console.log(`\nTotal: ${totalRendered}/${totalSessions} sessions rendered, ${totalPublished} published`);
    console.log(`Remaining: ${totalSessions - totalRendered} sessions`);
    return;
  }

  const next = getNextUnrendered(queue, {
    priority: priorityArg,
    category: categoryArg,
  });

  if (!next) {
    console.log('All topics in the queue have been rendered.');
    process.exit(0);
  }

  // Output in a format easily parseable by shell/CI
  console.log(`TOPIC=${next.slug}`);
  console.log(`SESSION=${next.session}`);
}

main();
