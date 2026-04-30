#!/usr/bin/env npx tsx
/**
 * batch-render-all.ts — Expert 2: Meera Patel — Batch Render All Sessions
 *
 * Renders all sessions across all topics, tracking progress and handling failures.
 * Designed to be run overnight — sequential renders to avoid OOM.
 *
 * Usage:
 *   npx tsx scripts/batch-render-all.ts                     # Render all unrendered
 *   npx tsx scripts/batch-render-all.ts --status             # Show progress
 *   npx tsx scripts/batch-render-all.ts --topic kafka        # Render only kafka
 *   npx tsx scripts/batch-render-all.ts --category dsa       # Render only DSA category
 *   npx tsx scripts/batch-render-all.ts --priority high      # Only high priority topics
 *   npx tsx scripts/batch-render-all.ts --limit 5            # Render at most 5 sessions
 *   npx tsx scripts/batch-render-all.ts --resume             # Resume from last failure
 *   npx tsx scripts/batch-render-all.ts --estimate           # Show time estimate only
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const HOME = process.env.HOME || '/tmp';
const STAGING_BASE = path.join(HOME, 'guru-sishya-uploads');
const MANIFEST_PATH = path.join(STAGING_BASE, 'manifest.json');
const TOPIC_QUEUE_PATH = path.join(PROJECT_ROOT, 'config', 'topic-queue.json');
const BATCH_LOG_PATH = path.join(HOME, 'guru-sishya-logs', 'batch-render.log');
const BATCH_STATE_PATH = path.join(STAGING_BASE, 'batch-state.json');

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface ManifestEntry {
  topic: string;
  session: number;
  status: string;
  errors: string[];
}

interface Manifest {
  version: number;
  lastUpdated: string;
  entries: Record<string, ManifestEntry>;
}

interface BatchState {
  lastRun: string;
  lastTopic: string;
  lastSession: number;
  completedCount: number;
  failedCount: number;
  totalElapsedMs: number;
  avgSessionMs: number;
  failures: Array<{ topic: string; session: number; error: string; timestamp: string }>;
}

interface RenderJob {
  topic: TopicEntry;
  session: number;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function log(msg: string): void {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  ensureDir(path.dirname(BATCH_LOG_PATH));
  fs.appendFileSync(BATCH_LOG_PATH, line + '\n');
}

function loadQueue(): TopicQueue {
  if (!fs.existsSync(TOPIC_QUEUE_PATH)) {
    console.error(`Topic queue not found: ${TOPIC_QUEUE_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(TOPIC_QUEUE_PATH, 'utf-8'));
}

function loadManifest(): Manifest {
  if (fs.existsSync(MANIFEST_PATH)) {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  }
  return { version: 1, lastUpdated: '', entries: {} };
}

function loadBatchState(): BatchState {
  if (fs.existsSync(BATCH_STATE_PATH)) {
    return JSON.parse(fs.readFileSync(BATCH_STATE_PATH, 'utf-8'));
  }
  return {
    lastRun: '',
    lastTopic: '',
    lastSession: 0,
    completedCount: 0,
    failedCount: 0,
    totalElapsedMs: 0,
    avgSessionMs: 25 * 60 * 1000, // default 25 min estimate
    failures: [],
  };
}

function saveBatchState(state: BatchState): void {
  ensureDir(path.dirname(BATCH_STATE_PATH));
  fs.writeFileSync(BATCH_STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(ms: number): string {
  const d = new Date(Date.now() + ms);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isRendered(manifest: Manifest, topic: string, session: number): boolean {
  const key = `${topic}:${session}`;
  const entry = manifest.entries[key];
  return entry?.status === 'staged' || entry?.status === 'uploaded';
}

// ─── Build Render Queue ─────────────────────────────────────────────────────

function buildRenderQueue(
  queue: TopicQueue,
  manifest: Manifest,
  opts: {
    topic?: string;
    category?: string;
    priority?: string;
    resumeFrom?: { topic: string; session: number } | null;
  },
): RenderJob[] {
  const jobs: RenderJob[] = [];

  // Priority order: high first, then medium, then low
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  const sortedTopics = [...queue.topics].sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 2;
    const pb = priorityOrder[b.priority] ?? 2;
    return pa - pb;
  });

  for (const t of sortedTopics) {
    // Apply filters
    if (opts.topic && t.slug !== opts.topic) continue;
    if (opts.category && t.category !== opts.category) continue;
    if (opts.priority && t.priority !== opts.priority) continue;

    for (let s = 1; s <= t.sessions; s++) {
      if (!isRendered(manifest, t.slug, s)) {
        jobs.push({ topic: t, session: s });
      }
    }
  }

  // If resuming, skip jobs before the resume point
  if (opts.resumeFrom) {
    const idx = jobs.findIndex(
      j => j.topic.slug === opts.resumeFrom!.topic && j.session === opts.resumeFrom!.session,
    );
    if (idx > 0) {
      return jobs.slice(idx);
    }
  }

  return jobs;
}

// ─── Status Report ──────────────────────────────────────────────────────────

function showStatus(): void {
  const queue = loadQueue();
  const manifest = loadManifest();
  const state = loadBatchState();

  const totalSessions = queue.topics.reduce((sum, t) => sum + t.sessions, 0);
  let rendered = 0;
  let uploaded = 0;
  let failed = 0;

  for (const [, entry] of Object.entries(manifest.entries)) {
    if (entry.status === 'staged' || entry.status === 'uploaded') rendered++;
    if (entry.status === 'uploaded') uploaded++;
    if (entry.status === 'failed') failed++;
  }

  const remaining = totalSessions - rendered;
  const avgMs = state.avgSessionMs || 25 * 60 * 1000;
  const estimatedMs = remaining * avgMs;

  console.log('');
  console.log('=== Batch Render Status ===');
  console.log('');
  console.log(`  Topics:     ${queue.topics.length}`);
  console.log(`  Sessions:   ${totalSessions}`);
  console.log(`  Rendered:   ${rendered}/${totalSessions} (${((rendered / totalSessions) * 100).toFixed(1)}%)`);
  console.log(`  Uploaded:   ${uploaded}/${totalSessions} (${((uploaded / totalSessions) * 100).toFixed(1)}%)`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Remaining:  ${remaining}`);
  console.log('');
  console.log(`  Avg render time: ${formatDuration(avgMs)} per session`);
  console.log(`  Estimated remaining: ${formatDuration(estimatedMs)}`);
  console.log(`  Estimated completion: ${formatDate(estimatedMs)}`);
  console.log('');

  // Per-category breakdown
  const categories = new Map<string, { total: number; rendered: number }>();
  for (const t of queue.topics) {
    const cat = categories.get(t.category) || { total: 0, rendered: 0 };
    cat.total += t.sessions;
    for (let s = 1; s <= t.sessions; s++) {
      if (isRendered(manifest, t.slug, s)) cat.rendered++;
    }
    categories.set(t.category, cat);
  }

  console.log('  By category:');
  categories.forEach((data, cat) => {
    const pct = ((data.rendered / data.total) * 100).toFixed(0);
    const bar = '#'.repeat(Math.round(data.rendered / data.total * 20)).padEnd(20, '.');
    console.log(`    ${cat.padEnd(25)} [${bar}] ${data.rendered}/${data.total} (${pct}%)`);
  });

  // Recent failures
  if (state.failures.length > 0) {
    console.log('');
    console.log('  Recent failures:');
    for (const f of state.failures.slice(-5)) {
      console.log(`    ${f.topic} S${f.session}: ${f.error} (${f.timestamp})`);
    }
  }

  console.log('');
}

// ─── Time Estimate ──────────────────────────────────────────────────────────

function showEstimate(jobs: RenderJob[], state: BatchState): void {
  const avgMs = state.avgSessionMs || 25 * 60 * 1000;
  const totalMs = jobs.length * avgMs;
  const sessionsPerDay = 3;
  const daysNeeded = Math.ceil(jobs.length / sessionsPerDay);

  console.log('');
  console.log('=== Render Estimate ===');
  console.log('');
  console.log(`  Sessions to render: ${jobs.length}`);
  console.log(`  Avg time per session: ${formatDuration(avgMs)}`);
  console.log(`  Total continuous time: ${formatDuration(totalMs)}`);
  console.log(`  At ${sessionsPerDay} sessions/day: ${daysNeeded} days`);
  console.log(`  Estimated completion: ${formatDate(daysNeeded * 24 * 3600 * 1000)}`);
  console.log('');

  // Show first 10 jobs
  console.log('  First 10 in queue:');
  for (const job of jobs.slice(0, 10)) {
    console.log(`    ${job.topic.slug} S${job.session} [${job.topic.priority}]`);
  }
  if (jobs.length > 10) {
    console.log(`    ... and ${jobs.length - 10} more`);
  }
  console.log('');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const showStatusFlag = args.includes('--status');
  const estimateOnly = args.includes('--estimate');
  const resumeFlag = args.includes('--resume');
  const topicFilter = args.find((_, i) => args[i - 1] === '--topic');
  const categoryFilter = args.find((_, i) => args[i - 1] === '--category');
  const priorityFilter = args.find((_, i) => args[i - 1] === '--priority');
  const limitStr = args.find((_, i) => args[i - 1] === '--limit');
  const limit = limitStr ? parseInt(limitStr, 10) : Infinity;

  if (showStatusFlag) {
    showStatus();
    return;
  }

  const queue = loadQueue();
  const manifest = loadManifest();
  const state = loadBatchState();

  // Build render queue
  const resumeFrom = resumeFlag && state.lastTopic
    ? { topic: state.lastTopic, session: state.lastSession }
    : null;

  let jobs = buildRenderQueue(queue, manifest, {
    topic: topicFilter,
    category: categoryFilter,
    priority: priorityFilter,
    resumeFrom,
  });

  if (jobs.length === 0) {
    console.log('');
    console.log('All sessions are already rendered. Nothing to do.');
    console.log('Run with --status to see current progress.');
    console.log('');
    return;
  }

  // Apply limit
  if (limit < Infinity) {
    jobs = jobs.slice(0, limit);
  }

  if (estimateOnly) {
    showEstimate(jobs, state);
    return;
  }

  const totalJobs = jobs.length;
  const batchStart = Date.now();

  console.log('');
  console.log('================================================================');
  console.log('  BATCH RENDER');
  console.log(`  Sessions: ${totalJobs} to render`);
  if (topicFilter) console.log(`  Filter: topic=${topicFilter}`);
  if (categoryFilter) console.log(`  Filter: category=${categoryFilter}`);
  if (priorityFilter) console.log(`  Filter: priority=${priorityFilter}`);
  if (limit < Infinity) console.log(`  Limit: ${limit} sessions`);
  console.log('================================================================');
  console.log('');

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const progress = `[${i + 1}/${totalJobs} sessions`;
    const elapsed = Date.now() - batchStart;
    const avgPerJob = completed > 0 ? elapsed / completed : state.avgSessionMs;
    const remaining = (totalJobs - i) * avgPerJob;

    log(`Rendering ${job.topic.slug} S${job.session}... ${progress}, ~${formatDuration(remaining)} remaining]`);

    const sessionStart = Date.now();

    try {
      execSync(
        `npx tsx scripts/render-and-stage.ts ${job.topic.slug} ${job.session}`,
        {
          stdio: 'inherit',
          cwd: PROJECT_ROOT,
          timeout: 60 * 60 * 1000, // 1 hour max per session
        },
      );

      const sessionElapsed = Date.now() - sessionStart;
      completed++;

      // Update running average
      state.avgSessionMs = Math.round(
        (state.avgSessionMs * state.completedCount + sessionElapsed) /
        (state.completedCount + 1),
      );
      state.completedCount++;
      state.lastTopic = job.topic.slug;
      state.lastSession = job.session;
      state.lastRun = new Date().toISOString();
      state.totalElapsedMs += sessionElapsed;
      saveBatchState(state);

      // Update topic queue rendered array
      const topicEntry = queue.topics.find(t => t.slug === job.topic.slug);
      if (topicEntry && !topicEntry.rendered.includes(job.session)) {
        topicEntry.rendered.push(job.session);
        topicEntry.rendered.sort((a, b) => a - b);
        queue.lastUpdated = new Date().toISOString().split('T')[0];
        fs.writeFileSync(TOPIC_QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
      }

      log(`Completed ${job.topic.slug} S${job.session} in ${formatDuration(sessionElapsed)}`);

    } catch (err) {
      failed++;
      state.failedCount++;
      state.lastTopic = job.topic.slug;
      state.lastSession = job.session;
      state.failures.push({
        topic: job.topic.slug,
        session: job.session,
        error: (err as Error).message.slice(0, 200),
        timestamp: new Date().toISOString(),
      });
      // Keep only last 50 failures
      if (state.failures.length > 50) {
        state.failures = state.failures.slice(-50);
      }
      saveBatchState(state);

      log(`FAILED: ${job.topic.slug} S${job.session} — ${(err as Error).message.slice(0, 100)}`);
      // Continue to next session — don't abort the batch
    }
  }

  const totalElapsed = Date.now() - batchStart;

  console.log('');
  console.log('================================================================');
  console.log('  BATCH COMPLETE');
  console.log('================================================================');
  console.log('');
  console.log(`  Completed:  ${completed}/${totalJobs}`);
  console.log(`  Failed:     ${failed}/${totalJobs}`);
  console.log(`  Total time: ${formatDuration(totalElapsed)}`);
  console.log(`  Avg/session: ${formatDuration(completed > 0 ? totalElapsed / completed : 0)}`);
  console.log('');

  if (failed > 0) {
    console.log('  Failed sessions:');
    for (const f of state.failures.slice(-failed)) {
      console.log(`    ${f.topic} S${f.session}: ${f.error.slice(0, 80)}`);
    }
    console.log('');
    console.log('  To retry: npx tsx scripts/batch-render-all.ts --resume');
    console.log('');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
