/**
 * B4 — published-state ledger tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

let tmp: string;
let ledgerPath: string;
let contentDir: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'b4-'));
  ledgerPath = path.join(tmp, 'published-state.json');
  contentDir = path.join(tmp, 'content');
  fs.mkdirSync(contentDir);
  process.env.PUBLISHED_STATE_PATH = ledgerPath;
  process.env.CONTENT_DIR = contentDir;
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.PUBLISHED_STATE_PATH;
  delete process.env.CONTENT_DIR;
});

function writeBoard(name: string, topic: string): void {
  fs.writeFileSync(
    path.join(contentDir, `${name}.json`),
    JSON.stringify({ topic, scenes: [] }),
  );
}

async function freshImport(): Promise<typeof import('../scripts/published-state')> {
  // bust module cache so env vars are re-read at module top
  return await import(`../scripts/published-state?t=${Date.now()}`);
}

describe('published-state ledger', () => {
  it('picks the only available board when ledger is empty', async () => {
    writeBoard('a', 'Load Balancing');
    const mod = await freshImport();
    const result = mod.pickEligibleStoryboard();
    expect(result).not.toBeNull();
    expect(result!.topic).toBe('Load Balancing');
    expect(result!.reason).toBe('fresh');
  });

  it('skips topics published within cooldown window', async () => {
    writeBoard('a', 'Load Balancing');
    writeBoard('b', 'Caching');
    const recent = new Date();
    recent.setDate(recent.getDate() - 5);
    fs.writeFileSync(
      ledgerPath,
      JSON.stringify({
        version: 1,
        cooldownDays: 30,
        published: [
          {
            topic: 'Load Balancing',
            slug: 'load-balancing',
            videoId: 'abc',
            publishedAt: recent.toISOString(),
          },
        ],
      }),
    );
    const mod = await freshImport();
    const result = mod.pickEligibleStoryboard();
    expect(result!.topic).toBe('Caching');
    expect(result!.reason).toBe('fresh');
  });

  it('falls back to oldest when every topic on cooldown', async () => {
    writeBoard('a', 'Load Balancing');
    writeBoard('b', 'Caching');
    const r1 = new Date();
    r1.setDate(r1.getDate() - 1);
    const r2 = new Date();
    r2.setDate(r2.getDate() - 10);
    fs.writeFileSync(
      ledgerPath,
      JSON.stringify({
        version: 1,
        cooldownDays: 30,
        published: [
          { topic: 'Load Balancing', slug: 'a', videoId: 'v1', publishedAt: r1.toISOString() },
          { topic: 'Caching', slug: 'b', videoId: 'v2', publishedAt: r2.toISOString() },
        ],
      }),
    );
    const mod = await freshImport();
    const result = mod.pickEligibleStoryboard();
    expect(result!.reason).toBe('all-on-cooldown-fallback');
    // Caching published 10 days ago is older than Load Balancing 1 day ago
    expect(result!.topic).toBe('Caching');
  });

  it('records new publishes and re-applies cooldown', async () => {
    writeBoard('a', 'Topic Z');
    const mod = await freshImport();
    mod.recordPublish({ topic: 'Topic Z', videoId: 'xyz123' });
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    expect(ledger.published).toHaveLength(1);
    expect(ledger.published[0].topic).toBe('Topic Z');
    expect(ledger.published[0].videoId).toBe('xyz123');
    expect(ledger.published[0].slug).toBe('topic-z');

    const result = mod.pickEligibleStoryboard();
    // Only one board, all on cooldown → fallback to it
    expect(result!.reason).toBe('all-on-cooldown-fallback');
  });

  it('returns null when content dir is empty', async () => {
    const mod = await freshImport();
    const result = mod.pickEligibleStoryboard();
    expect(result).toBeNull();
  });

  // Panel-23 (user-request): each session of a topic must be a
  // distinct video. Cooldown is bucketed per (topic, session) so
  // load-balancing/s2 is pickable even when load-balancing/s1 was
  // just published.
  it('treats different sessions of the same topic as independent buckets', async () => {
    fs.writeFileSync(
      path.join(contentDir, 'lb-s1.json'),
      JSON.stringify({ topic: 'Load Balancing', session: 1, scenes: [] }),
    );
    fs.writeFileSync(
      path.join(contentDir, 'lb-s2.json'),
      JSON.stringify({ topic: 'Load Balancing', session: 2, scenes: [] }),
    );
    const recent = new Date();
    recent.setDate(recent.getDate() - 2);
    fs.writeFileSync(
      ledgerPath,
      JSON.stringify({
        version: 1,
        cooldownDays: 30,
        published: [
          {
            topic: 'Load Balancing',
            session: 1,
            slug: 'load-balancing-s1',
            videoId: 'v1',
            publishedAt: recent.toISOString(),
          },
        ],
      }),
    );
    const mod = await freshImport();
    const result = mod.pickEligibleStoryboard();
    expect(result).not.toBeNull();
    expect(result!.topic).toBe('Load Balancing');
    expect(result!.session).toBe(2);
    expect(result!.reason).toBe('fresh');
  });

  it('persists session in the ledger and respects per-session cooldown', async () => {
    fs.writeFileSync(
      path.join(contentDir, 'cache-s3.json'),
      JSON.stringify({ topic: 'Caching', session: 3, scenes: [] }),
    );
    const mod = await freshImport();
    mod.recordPublish({ topic: 'Caching', session: 3, videoId: 'cache3' });
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    expect(ledger.published[0].session).toBe(3);
    const result = mod.pickEligibleStoryboard();
    // Same (topic, session) bucket on cooldown → fallback path.
    expect(result!.reason).toBe('all-on-cooldown-fallback');
    expect(result!.session).toBe(3);
  });
});
