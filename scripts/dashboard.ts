#!/usr/bin/env npx tsx
/**
 * dashboard.ts — Expert 4: Deepa Krishnan — Monitoring & Status Dashboard
 *
 * Shows a comprehensive overview of the entire pipeline: rendering, uploading,
 * scheduling, and issues.
 *
 * Usage:
 *   npx tsx scripts/dashboard.ts            # Full dashboard
 *   npx tsx scripts/dashboard.ts --json     # Machine-readable JSON output
 *   npx tsx scripts/dashboard.ts --watch    # Refresh every 30s
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const HOME = process.env.HOME || '/tmp';
const STAGING_BASE = path.join(HOME, 'guru-sishya-uploads');
const ARCHIVE_BASE = path.join(HOME, 'guru-sishya-archive');
const MANIFEST_PATH = path.join(STAGING_BASE, 'manifest.json');
const BATCH_STATE_PATH = path.join(STAGING_BASE, 'batch-state.json');
const TOPIC_QUEUE_PATH = path.join(PROJECT_ROOT, 'config', 'topic-queue.json');
const PUBLISH_HISTORY_PATH = path.join(PROJECT_ROOT, 'config', 'publish-history.json');
const PUBLISH_CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'publish-config.json');
const GURU_SISHYA_BASE = path.join(HOME, 'Documents', 'guru-sishya');
const LOG_DIR = path.join(HOME, 'guru-sishya-logs');

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
  topics: TopicEntry[];
}

interface ManifestEntry {
  topic: string;
  session: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
  errors: string[];
  timings?: { total?: number };
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
  avgSessionMs: number;
  failures: Array<{ topic: string; session: number; error: string; timestamp: string }>;
}

interface PublishHistoryEntry {
  timestamp: string;
  topic: string;
  topicName: string;
  session: number;
  status: string;
}

interface PublishHistory {
  totalPublished: number;
  entries: PublishHistoryEntry[];
}

interface PublishConfig {
  schedule: { days: string[]; timeIST: string };
}

// ─── Loaders ────────────────────────────────────────────────────────────────

function loadJson<T>(p: string, fallback: T): T {
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); }
  catch { return fallback; }
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getDirSize(dir: string): string {
  if (!fs.existsSync(dir)) return '0';
  try {
    const { execSync } = require('child_process');
    return execSync(`du -sh "${dir}" 2>/dev/null`, { encoding: 'utf-8' }).split('\t')[0].trim();
  } catch { return '?'; }
}

// ─── Schedule Calculator ────────────────────────────────────────────────────

function getNextPublishDates(config: PublishConfig, count: number): Date[] {
  const dayMap: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };

  const publishDays = config.schedule.days.map(d => dayMap[d]).filter(d => d !== undefined);
  const [hours, mins] = config.schedule.timeIST.split(':').map(Number);

  // IST offset: UTC+5:30
  const istOffsetMs = 5.5 * 60 * 60 * 1000;

  const dates: Date[] = [];
  const now = new Date();
  let d = new Date(now);

  while (dates.length < count) {
    if (publishDays.includes(d.getDay())) {
      // Create date in IST then convert to local
      const candidate = new Date(d);
      // Set to IST time
      candidate.setHours(hours, mins, 0, 0);
      // Adjust: we want IST, so subtract IST offset and add local offset
      const localOffset = candidate.getTimezoneOffset() * 60 * 1000;
      const adjusted = new Date(candidate.getTime() - istOffsetMs + localOffset + istOffsetMs);

      if (adjusted > now) {
        dates.push(adjusted);
      }
    }
    d.setDate(d.getDate() + 1);
  }

  return dates;
}

// ─── Dashboard Renderer ─────────────────────────────────────────────────────

function renderDashboard(): void {
  const queue = loadJson<TopicQueue>(TOPIC_QUEUE_PATH, { version: 1, topics: [] });
  const manifest = loadJson<Manifest>(MANIFEST_PATH, { version: 1, lastUpdated: '', entries: {} });
  const batchState = loadJson<BatchState>(BATCH_STATE_PATH, {
    lastRun: '', lastTopic: '', lastSession: 0,
    completedCount: 0, failedCount: 0, avgSessionMs: 25 * 60 * 1000, failures: [],
  });
  const publishHistory = loadJson<PublishHistory>(PUBLISH_HISTORY_PATH, {
    totalPublished: 0, entries: [],
  });
  const publishConfig = loadJson<PublishConfig>(PUBLISH_CONFIG_PATH, {
    schedule: { days: ['Tuesday', 'Thursday', 'Saturday'], timeIST: '19:15' },
  });

  // ── Compute stats ──────────────────────────────────────────────────────

  const totalTopics = queue.topics.length;
  const totalSessions = queue.topics.reduce((sum, t) => sum + t.sessions, 0);

  let renderedCount = 0;
  let stagedCount = 0;
  let uploadedCount = 0;
  let failedCount = 0;

  for (const [, entry] of Object.entries(manifest.entries)) {
    if (entry.status === 'staged') { renderedCount++; stagedCount++; }
    if (entry.status === 'uploaded') { renderedCount++; uploadedCount++; }
    if (entry.status === 'failed') failedCount++;
  }

  // Also count from publish history
  const publishedFromHistory = publishHistory.totalPublished || publishHistory.entries?.length || 0;
  const effectiveUploaded = Math.max(uploadedCount, publishedFromHistory);

  // Estimation
  const avgMs = batchState.avgSessionMs || 25 * 60 * 1000;
  const remaining = totalSessions - renderedCount;
  const sessionsPerDay = 3;
  const daysToRender = Math.ceil(remaining / sessionsPerDay);
  const daysToUpload = Math.ceil((renderedCount - effectiveUploaded + remaining) / (publishConfig.schedule.days.length || 3));
  const completionDate = new Date(Date.now() + Math.max(daysToRender, daysToUpload) * 24 * 3600 * 1000);

  // ── Render ─────────────────────────────────────────────────────────────

  console.log('');
  console.log('=================================================================');
  console.log('              Guru Sishya Pipeline Dashboard');
  console.log(`              ${new Date().toLocaleString()}`);
  console.log('=================================================================');
  console.log('');

  // ── Overall Progress ───────────────────────────────────────────────────

  console.log('  Overall Progress:');
  console.log(`    Topics:     ${totalTopics}`);
  console.log(`    Sessions:   ${totalSessions}`);

  const renderedPct = totalSessions > 0 ? ((renderedCount / totalSessions) * 100).toFixed(1) : '0';
  const uploadedPct = totalSessions > 0 ? ((effectiveUploaded / totalSessions) * 100).toFixed(1) : '0';

  const renderBar = makeProgressBar(renderedCount, totalSessions, 30);
  const uploadBar = makeProgressBar(effectiveUploaded, totalSessions, 30);

  console.log(`    Rendered:   ${renderBar} ${renderedCount}/${totalSessions} (${renderedPct}%)`);
  console.log(`    Uploaded:   ${uploadBar} ${effectiveUploaded}/${totalSessions} (${uploadedPct}%)`);
  console.log(`    Staged:     ${stagedCount} (ready for upload)`);
  console.log(`    Failed:     ${failedCount}`);
  console.log('');
  console.log(`    Avg render time:       ${formatDuration(avgMs)} per session`);
  console.log(`    Estimated completion:  ${formatDate(completionDate)} (at ${sessionsPerDay} sessions/day)`);
  console.log('');

  // ── Storage ────────────────────────────────────────────────────────────

  console.log('  Storage:');
  console.log(`    Staging:  ${getDirSize(STAGING_BASE).padEnd(8)} ${STAGING_BASE}`);
  console.log(`    Archive:  ${getDirSize(ARCHIVE_BASE).padEnd(8)} ${ARCHIVE_BASE}`);
  console.log(`    Videos:   ${getDirSize(GURU_SISHYA_BASE).padEnd(8)} ${GURU_SISHYA_BASE}`);
  console.log('');

  // ── Category Breakdown ─────────────────────────────────────────────────

  console.log('  By Category:');
  const categories = new Map<string, { total: number; rendered: number; uploaded: number }>();
  for (const t of queue.topics) {
    const cat = categories.get(t.category) || { total: 0, rendered: 0, uploaded: 0 };
    cat.total += t.sessions;
    for (let s = 1; s <= t.sessions; s++) {
      const key = `${t.slug}:${s}`;
      const entry = manifest.entries[key];
      if (entry?.status === 'staged' || entry?.status === 'uploaded') cat.rendered++;
      if (entry?.status === 'uploaded') cat.uploaded++;
    }
    categories.set(t.category, cat);
  }

  categories.forEach((data, cat) => {
    const bar = makeProgressBar(data.rendered, data.total, 15);
    console.log(`    ${cat.padEnd(25)} ${bar} ${data.rendered}/${data.total}`);
  });
  console.log('');

  // ── Recent Activity ────────────────────────────────────────────────────

  console.log('  Recent Activity:');

  // Combine manifest entries and publish history
  type Activity = { key: string; status: string; date: string; source: string };
  const activities: Activity[] = [];

  for (const [key, entry] of Object.entries(manifest.entries)) {
    if (entry.completedAt) {
      const statusIcon = entry.status === 'staged' ? '[STAGED]' :
        entry.status === 'uploaded' ? '[UPLOADED]' :
        entry.status === 'failed' ? '[FAILED]' : `[${entry.status.toUpperCase()}]`;
      activities.push({
        key: `${entry.topic} S${entry.session}`,
        status: statusIcon,
        date: entry.completedAt,
        source: 'render',
      });
    }
  }

  for (const entry of (publishHistory.entries || []).slice(-10)) {
    activities.push({
      key: `${entry.topic} S${entry.session}`,
      status: entry.status === 'success' ? '[PUBLISHED]' : `[${entry.status.toUpperCase()}]`,
      date: entry.timestamp,
      source: 'publish',
    });
  }

  // Sort by date, most recent first
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (activities.length === 0) {
    console.log('    No activity yet.');
  } else {
    for (const a of activities.slice(0, 10)) {
      const dateStr = formatDate(new Date(a.date));
      console.log(`    ${a.status.padEnd(12)} ${a.key.padEnd(30)} (${dateStr})`);
    }
  }
  console.log('');

  // ── Next Scheduled ─────────────────────────────────────────────────────

  console.log('  Next Scheduled Uploads:');
  const nextDates = getNextPublishDates(publishConfig, 5);

  // Find next sessions to upload (staged ones)
  const stagedSessions = Object.entries(manifest.entries)
    .filter(([, e]) => e.status === 'staged')
    .sort((a, b) => (a[1].completedAt || '').localeCompare(b[1].completedAt || ''))
    .map(([, e]) => `${e.topic} S${e.session}`);

  for (let i = 0; i < nextDates.length; i++) {
    const session = stagedSessions[i] || '(no video staged)';
    const label = i === 0 ? 'Long-form' :
      i === 1 ? 'Part 1 Short' :
      i === 2 ? 'Parts 2+3 Shorts' :
      `Upload ${i + 1}`;
    console.log(`    ${formatDateTime(nextDates[i]).padEnd(30)} ${session} (${label})`);
  }
  console.log('');

  // ── Issues ─────────────────────────────────────────────────────────────

  console.log('  Issues:');
  const issues: string[] = [];

  if (failedCount > 0) {
    issues.push(`${failedCount} failed render(s)`);
  }

  if (batchState.failures && batchState.failures.length > 0) {
    const recentFails = batchState.failures.slice(-3);
    for (const f of recentFails) {
      issues.push(`${f.topic} S${f.session}: ${f.error.slice(0, 60)}`);
    }
  }

  // Check disk space
  try {
    const { execSync } = require('child_process');
    const dfOutput = execSync('df -h / | tail -1', { encoding: 'utf-8' });
    const parts = dfOutput.trim().split(/\s+/);
    const availIdx = parts.length >= 4 ? 3 : parts.length - 1;
    const avail = parts[availIdx];
    const pctUsed = parseInt(parts[parts.length - 2] || '0');
    if (pctUsed > 90) {
      issues.push(`Disk space critically low: ${avail} available (${pctUsed}% used)`);
    } else if (pctUsed > 80) {
      issues.push(`Disk space getting low: ${avail} available (${pctUsed}% used)`);
    }
  } catch { /* ignore */ }

  // Check log errors from last 24h
  const renderLog = path.join(LOG_DIR, 'render-and-stage.log');
  if (fs.existsSync(renderLog)) {
    try {
      const logContent = fs.readFileSync(renderLog, 'utf-8');
      const lines = logContent.split('\n');
      const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const recentErrors = lines.filter(l =>
        l.includes(' X ') && l.slice(1, 25) > oneDayAgo
      );
      if (recentErrors.length > 0) {
        issues.push(`${recentErrors.length} error(s) in render log (last 24h)`);
      }
    } catch { /* ignore */ }
  }

  if (issues.length === 0) {
    console.log('    None');
  } else {
    for (const issue of issues) {
      console.log(`    [!] ${issue}`);
    }
  }
  console.log('');

  // ── Batch State ────────────────────────────────────────────────────────

  if (batchState.lastRun) {
    console.log('  Last Batch Run:');
    console.log(`    Date:      ${formatDate(new Date(batchState.lastRun))}`);
    console.log(`    Last:      ${batchState.lastTopic} S${batchState.lastSession}`);
    console.log(`    Completed: ${batchState.completedCount} total`);
    console.log(`    Failed:    ${batchState.failedCount} total`);
    console.log('');
  }

  console.log('=================================================================');
  console.log('');
}

function makeProgressBar(current: number, total: number, width: number): string {
  if (total === 0) return '[' + '.'.repeat(width) + ']';
  const filled = Math.round((current / total) * width);
  return '[' + '#'.repeat(filled) + '.'.repeat(width - filled) + ']';
}

// ─── JSON Output ────────────────────────────────────────────────────────────

function renderJson(): void {
  const queue = loadJson<TopicQueue>(TOPIC_QUEUE_PATH, { version: 1, topics: [] });
  const manifest = loadJson<Manifest>(MANIFEST_PATH, { version: 1, lastUpdated: '', entries: {} });
  const batchState = loadJson<BatchState>(BATCH_STATE_PATH, {
    lastRun: '', lastTopic: '', lastSession: 0,
    completedCount: 0, failedCount: 0, avgSessionMs: 0, failures: [],
  });

  const totalSessions = queue.topics.reduce((sum, t) => sum + t.sessions, 0);
  let rendered = 0;
  let uploaded = 0;
  let failed = 0;

  for (const [, entry] of Object.entries(manifest.entries)) {
    if (entry.status === 'staged' || entry.status === 'uploaded') rendered++;
    if (entry.status === 'uploaded') uploaded++;
    if (entry.status === 'failed') failed++;
  }

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    topics: queue.topics.length,
    totalSessions,
    rendered,
    uploaded,
    failed,
    remaining: totalSessions - rendered,
    batchState,
  }, null, 2));
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--json')) {
    renderJson();
    return;
  }

  if (args.includes('--watch')) {
    const interval = 30000;
    while (true) {
      // Clear screen
      process.stdout.write('\x1Bc');
      renderDashboard();
      console.log(`  (Refreshing every ${interval / 1000}s. Press Ctrl+C to stop.)`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  renderDashboard();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
