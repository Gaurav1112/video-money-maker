import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export interface TopicBankEntry {
  slug: string;
  name: string;
  category?: string;
  shortTitle?: string;
  hookHinglish?: string;
  stake?: string;
  salaryBand?: string;
  siteTopicSlug?: string;
  siteSessionSlug?: string;
}

interface TopicBankFile {
  version?: number;
  topics?: TopicBankEntry[];
}

let cache: Map<string, TopicBankEntry> | null = null;

function bankPath(): string {
  // Resolve the JSON next to this loader so it works under tsx (src) and
  // compiled (dist) layouts identically. ESM-safe via import.meta.url.
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, 'topic-bank.json');
}

function loadBank(): Map<string, TopicBankEntry> {
  if (cache) return cache;
  const p = bankPath();
  const m = new Map<string, TopicBankEntry>();
  if (existsSync(p)) {
    try {
      const raw = JSON.parse(readFileSync(p, 'utf8')) as TopicBankFile;
      for (const t of raw.topics ?? []) {
        if (t && typeof t.slug === 'string') m.set(t.slug, t);
      }
    } catch {
      // Corrupt JSON: treat as empty bank, callers fall through to template path.
    }
  }
  cache = m;
  return m;
}

/** Returns the topic-bank entry for a slug or undefined. Pure read. */
export function findTopicBankEntry(slug: string): TopicBankEntry | undefined {
  return loadBank().get(slug);
}

/** Test-only: clear the in-memory cache between fixtures. */
export function _resetTopicBankCache(): void {
  cache = null;
}
