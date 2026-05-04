/**
 * scripts/published-state.ts — published-state ledger (B4)
 *
 * Why this exists
 * ───────────────
 * The 944-view ceiling is partly self-inflicted: when the daily picker
 * picks a topic that was published <30 days ago, YouTube's recommender
 * sees overlap with the still-being-promoted prior video and treats the
 * new upload as a duplicate. Velocity collapses, ceiling = sub count.
 *
 * This module maintains data/published-state.json as a small append-only
 * ledger of (topic, video_id, slug, publishedAt) and provides two CLI
 * commands used by .github/workflows/daily-short.yml:
 *
 *   pick     → print the path of the next eligible storyboard (skipping
 *              any whose topic was published within cooldownDays). Falls
 *              back to the deterministic day-of-year pick if every topic
 *              is on cooldown (rather than failing the workflow).
 *
 *   record   → append { topic, slug, videoId, publishedAt } to the ledger
 *              after a successful upload.
 *
 * Pure stdlib — no extra deps. Safe to call locally for testing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

type LedgerEntry = {
  topic: string;
  /**
   * Optional 1-based session number. When set, cooldown is bucketed
   * by `topic|session` so different sessions of the same topic are
   * picked independently (Panel-23 user-request: each session of a
   * topic should be a separate video, not collapse onto one
   * 30-day-cooldown bucket).
   *
   * Legacy entries without `session` continue to bucket on `topic`
   * alone — preserves existing 30-day cooldown for single-video-per-
   * topic shorts.
   */
  session?: number;
  slug: string;
  videoId: string;
  publishedAt: string;
};

type Ledger = {
  version: number;
  cooldownDays: number;
  published: LedgerEntry[];
};

const DEFAULT_COOLDOWN_DAYS = 30;

function ledgerPath(): string {
  return process.env.PUBLISHED_STATE_PATH || path.join('data', 'published-state.json');
}

function contentDir(): string {
  return process.env.CONTENT_DIR || 'content';
}

function readLedger(): Ledger {
  const lp = ledgerPath();
  if (!fs.existsSync(lp)) {
    return { version: 1, cooldownDays: DEFAULT_COOLDOWN_DAYS, published: [] };
  }
  const raw = fs.readFileSync(lp, 'utf8');
  const parsed = JSON.parse(raw) as Partial<Ledger>;
  return {
    version: parsed.version ?? 1,
    cooldownDays: parsed.cooldownDays ?? DEFAULT_COOLDOWN_DAYS,
    published: Array.isArray(parsed.published) ? parsed.published : [],
  };
}

function writeLedger(ledger: Ledger): void {
  const lp = ledgerPath();
  fs.mkdirSync(path.dirname(lp), { recursive: true });
  fs.writeFileSync(lp, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.abs(b - a) / (1000 * 60 * 60 * 24);
}

function listStoryboards(): string[] {
  const cd = contentDir();
  if (!fs.existsSync(cd)) return [];
  return fs
    .readdirSync(cd)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(cd, f));
}

function topicOfStoryboard(filePath: string): string {
  try {
    const obj = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
      topic?: string;
    };
    return (obj.topic || path.basename(filePath, '.json')).trim();
  } catch {
    return path.basename(filePath, '.json');
  }
}

/**
 * Per-Panel-23 user-request: each session of a topic is a distinct
 * video. Read `session` (1-based) from the storyboard if present so
 * the cooldown picker buckets `topic|session` independently. Returns
 * undefined for legacy single-video-per-topic storyboards.
 */
function sessionOfStoryboard(filePath: string): number | undefined {
  try {
    const obj = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
      session?: number;
    };
    return typeof obj.session === 'number' ? obj.session : undefined;
  } catch {
    return undefined;
  }
}

function bucketKey(topic: string, session?: number): string {
  return session !== undefined ? `${topic}|s${session}` : topic;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function pickEligibleStoryboard(now: Date = new Date()): {
  path: string;
  topic: string;
  session?: number;
  reason: 'fresh' | 'all-on-cooldown-fallback';
} | null {
  const ledger = readLedger();
  const boards = listStoryboards();
  if (boards.length === 0) return null;

  const cooldown = ledger.cooldownDays || DEFAULT_COOLDOWN_DAYS;
  const cutoffDays = cooldown;
  const nowIso = now.toISOString();

  // Per-Panel-23 (user-request): cooldown bucketed by `topic|session`
  // when the storyboard carries a session number, falling back to
  // bare `topic` for legacy single-video-per-topic boards. Result:
  // load-balancing/s2 is not blocked by load-balancing/s1's recent
  // publish — each session is its own 30-day-cooldown video.
  const lastPublishedByBucket = new Map<string, string>();
  for (const e of ledger.published) {
    const k = bucketKey(e.topic, e.session);
    const prev = lastPublishedByBucket.get(k);
    if (!prev || prev < e.publishedAt) {
      lastPublishedByBucket.set(k, e.publishedAt);
    }
  }

  const eligible: { path: string; topic: string; session?: number }[] = [];
  for (const p of boards) {
    const topic = topicOfStoryboard(p);
    const session = sessionOfStoryboard(p);
    const last = lastPublishedByBucket.get(bucketKey(topic, session));
    if (!last || daysBetween(last, nowIso) >= cutoffDays) {
      eligible.push({ path: p, topic, session });
    }
  }

  if (eligible.length > 0) {
    // Deterministic daily pick from the eligible set
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) /
        86400000,
    );
    const idx = dayOfYear % eligible.length;
    return { ...eligible[idx], reason: 'fresh' };
  }

  // Every bucket on cooldown → fall back to oldest-published bucket
  let oldestPath = boards[0];
  let oldestTs = '9999-12-31T23:59:59Z';
  let oldestSession: number | undefined;
  for (const p of boards) {
    const topic = topicOfStoryboard(p);
    const session = sessionOfStoryboard(p);
    const last = lastPublishedByBucket.get(bucketKey(topic, session)) || '0000-01-01T00:00:00Z';
    if (last < oldestTs) {
      oldestTs = last;
      oldestPath = p;
      oldestSession = session;
    }
  }
  return {
    path: oldestPath,
    topic: topicOfStoryboard(oldestPath),
    session: oldestSession,
    reason: 'all-on-cooldown-fallback',
  };
}

export function recordPublish(args: {
  topic: string;
  session?: number;
  slug?: string;
  videoId: string;
  publishedAt?: string;
}): LedgerEntry {
  const ledger = readLedger();
  const entry: LedgerEntry = {
    topic: args.topic,
    ...(args.session !== undefined ? { session: args.session } : {}),
    slug: args.slug || slugify(args.topic),
    videoId: args.videoId,
    publishedAt: args.publishedAt || new Date().toISOString(),
  };
  ledger.published.push(entry);
  writeLedger(ledger);
  return entry;
}

function cliPick(): void {
  const result = pickEligibleStoryboard();
  if (!result) {
    process.stderr.write('FATAL: no storyboards in content/\n');
    process.exit(1);
  }
  process.stderr.write(
    `[published-state] picked ${result.path} (topic="${result.topic}", reason=${result.reason})\n`,
  );
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `path=${result.path}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `topic=${result.topic}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `reason=${result.reason}\n`);
    if (result.session !== undefined) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `session=${result.session}\n`);
    }
  } else {
    // Local-shell fallback only (e.g. `published-state.ts pick`); the
    // workflow consumes steps.pick.outputs.path, never stdout.
    process.stdout.write(result.path + '\n');
  }
}

function cliRecord(metaPathOrTopic: string, videoId: string): void {
  let topic = metaPathOrTopic;
  let slug: string | undefined;
  let session: number | undefined;

  if (fs.existsSync(metaPathOrTopic) && metaPathOrTopic.endsWith('.json')) {
    const meta = JSON.parse(fs.readFileSync(metaPathOrTopic, 'utf8')) as {
      topic?: string;
      slug?: string;
      session?: number;
    };
    topic = meta.topic || metaPathOrTopic;
    slug = meta.slug;
    if (typeof meta.session === 'number') session = meta.session;
  }

  const entry = recordPublish({ topic, session, slug, videoId });
  process.stderr.write(
    `[published-state] recorded ${entry.topic}${entry.session !== undefined ? `/s${entry.session}` : ''} → ${entry.videoId} @ ${entry.publishedAt}\n`,
  );
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('published-state.ts')
) {
  const cmd = process.argv[2];
  if (cmd === 'pick') {
    cliPick();
  } else if (cmd === 'record') {
    const meta = process.argv[3];
    const videoId = process.argv[4];
    if (!meta || !videoId) {
      process.stderr.write(
        'usage: published-state.ts record <metadata.json|topic> <videoId>\n',
      );
      process.exit(2);
    }
    cliRecord(meta, videoId);
  } else {
    process.stderr.write(
      'usage: published-state.ts <pick | record <meta> <videoId>>\n',
    );
    process.exit(2);
  }
}
