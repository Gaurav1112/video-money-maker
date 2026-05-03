/**
 * scripts/lib/playlist-mapping.ts — B3 playlist auto-assignment
 *
 * Why this exists
 * ───────────────
 * upload-youtube.ts already supports playlistTitle in metadata.youtube
 * (see "Auto-Playlist: find or create playlist" block). What was missing
 * was a deterministic mapping from a storyboard's topic → playlist
 * title, so every video reliably lands in the same playlist as its
 * peers, generating the "playlist session-time" signal that YouTube
 * uses for Shorts feed promotion.
 *
 * Strategy
 * ────────
 * 1. Try to find the topic in src/data/topic-bank.json by slug or name
 *    (case-insensitive substring match) and use its `category` to map
 *    to a human-readable playlist title.
 * 2. If not found in topic-bank, fall back to a slug-based heuristic
 *    (kafka/redis/database → System Design, two-pointer/dp → DSA, etc.).
 * 3. Returns null only if neither lookup matches — caller falls back to
 *    no playlist (existing behaviour pre-B3).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

type TopicBankEntry = {
  slug: string;
  name: string;
  category?: string;
};

type TopicBank = {
  topics: TopicBankEntry[];
};

const CATEGORY_TO_PLAYLIST: Record<string, string> = {
  'system-design': 'System Design Interview Prep — FAANG Shorts',
  dsa: 'DSA Interview Prep — Patterns You Must Know',
  behavioral: 'Behavioral Interview Prep — STAR Stories',
  'os-networking': 'OS & Networking — Interview Crash Course',
  'db-internals': 'Database Internals — Deep Dives',
};

const SLUG_HEURISTICS: { keywords: string[]; playlist: string }[] = [
  // Order matters: more specific categories first; DSA last because
  // its keywords (tree/array/sort) appear in DB/system-design topics too.
  {
    keywords: [
      'btree',
      'b-tree',
      'lsm',
      'wal',
      'mvcc',
      'isolation',
      'transaction',
      'sql-',
      'index',
      'postgres',
      'mysql',
      'mongo',
    ],
    playlist: CATEGORY_TO_PLAYLIST['db-internals'],
  },
  {
    keywords: [
      'tcp',
      'udp',
      'http',
      'dns',
      'tls',
      'os-',
      'process',
      'thread',
      'mutex',
      'semaphore',
      'paging',
      'kernel',
      'socket',
    ],
    playlist: CATEGORY_TO_PLAYLIST['os-networking'],
  },
  {
    keywords: [
      'kafka',
      'redis',
      'cache',
      'caching',
      'load-bal',
      'consistent-hash',
      'cdn',
      'queue',
      'rate-limit',
      'sharding',
      'replic',
      'system-design',
      'microservice',
    ],
    playlist: CATEGORY_TO_PLAYLIST['system-design'],
  },
  {
    keywords: [
      'star',
      'behaviour',
      'behavior',
      'leadership',
      'conflict',
      'feedback',
      'mentor',
    ],
    playlist: CATEGORY_TO_PLAYLIST.behavioral,
  },
  {
    keywords: [
      'two-pointer',
      'sliding-window',
      'binary-search',
      'dp',
      'dynamic-program',
      'recursion',
      'backtrack',
      'graph',
      'tree',
      'heap',
      'trie',
      'sort',
      'array',
      'string',
    ],
    playlist: CATEGORY_TO_PLAYLIST.dsa,
  },
];

let _topicBankCache: TopicBank | null = null;

function loadTopicBank(): TopicBank | null {
  if (_topicBankCache) return _topicBankCache;
  const candidates = [
    path.join('src', 'data', 'topic-bank.json'),
    path.join(process.cwd(), 'src', 'data', 'topic-bank.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        _topicBankCache = JSON.parse(fs.readFileSync(p, 'utf8')) as TopicBank;
        return _topicBankCache;
      } catch {
        // fall through
      }
    }
  }
  return null;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function slugify(s: string): string {
  return normalize(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolve the playlist title for a given topic name (or storyboard slug).
 * Returns null if no mapping is available.
 */
export function playlistFor(topic: string): string | null {
  const norm = normalize(topic);
  const slug = slugify(topic);
  const bank = loadTopicBank();

  if (bank?.topics?.length) {
    const direct = bank.topics.find(
      (t) => normalize(t.slug) === slug || normalize(t.name) === norm,
    );
    if (direct?.category && CATEGORY_TO_PLAYLIST[direct.category]) {
      return CATEGORY_TO_PLAYLIST[direct.category];
    }
    const fuzzy = bank.topics.find(
      (t) =>
        normalize(t.name).includes(norm) || norm.includes(normalize(t.name)),
    );
    if (fuzzy?.category && CATEGORY_TO_PLAYLIST[fuzzy.category]) {
      return CATEGORY_TO_PLAYLIST[fuzzy.category];
    }
  }

  for (const rule of SLUG_HEURISTICS) {
    if (rule.keywords.some((kw) => slug.includes(kw))) {
      return rule.playlist;
    }
  }

  return null;
}

export function _resetCacheForTests(): void {
  _topicBankCache = null;
}

export const _internal = { CATEGORY_TO_PLAYLIST, SLUG_HEURISTICS };
