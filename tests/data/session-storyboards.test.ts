/**
 * tests/data/session-storyboards.test.ts — B-32 session storyboard validation
 *
 * Verifies that all per-session storyboard JSON files in content/:
 *   1. Parse as valid JSON
 *   2. Conform to the StockStoryboard schema (required fields, value ranges)
 *   3. Have the correct (siteTopicSlug, session, siteSessionSlug) tuple
 *   4. Have ≥ 4 scenes with valid types and sequential frame offsets
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import type { StockStoryboard } from '../../src/stock/types.js';

// ─── Expected tuples ─────────────────────────────────────────────────────────
// Source of truth: CORE_TOPICS in scripts/generate-session-storyboards.ts

interface ExpectedSession {
  siteTopicSlug: string;
  session: number;
  siteSessionSlug: string;
  siteSessionTitle: string;
}

const EXPECTED_SESSIONS: ExpectedSession[] = [
  // load-balancing
  { siteTopicSlug: 'load-balancing', session: 1,  siteSessionSlug: 'what-is-load-balancing-why-it', siteSessionTitle: 'What is Load Balancing & Why It Matters' },
  { siteTopicSlug: 'load-balancing', session: 2,  siteSessionSlug: 'round-robin-weighted',           siteSessionTitle: 'Round Robin & Weighted Round Robin' },
  { siteTopicSlug: 'load-balancing', session: 3,  siteSessionSlug: 'least-connections-ip-hash',      siteSessionTitle: 'Least Connections & IP Hash' },
  { siteTopicSlug: 'load-balancing', session: 4,  siteSessionSlug: 'consistent-hashing-for-load',    siteSessionTitle: 'Consistent Hashing for Load Balancers' },
  { siteTopicSlug: 'load-balancing', session: 5,  siteSessionSlug: 'health-checks-failover',         siteSessionTitle: 'Health Checks & Failover Strategies' },
  { siteTopicSlug: 'load-balancing', session: 6,  siteSessionSlug: 'layer-4-vs-7-load-balancing',    siteSessionTitle: 'Layer 4 vs Layer 7 Load Balancing' },
  { siteTopicSlug: 'load-balancing', session: 7,  siteSessionSlug: 'ssl-termination-tls-offloading', siteSessionTitle: 'SSL Termination & TLS Offloading' },
  { siteTopicSlug: 'load-balancing', session: 8,  siteSessionSlug: 'global-server-load-balancing',   siteSessionTitle: 'Global Server Load Balancing (GSLB)' },
  { siteTopicSlug: 'load-balancing', session: 9,  siteSessionSlug: 'load-balancing-at-netflix-uber', siteSessionTitle: 'Load Balancing at Netflix, Uber & Google' },
  { siteTopicSlug: 'load-balancing', session: 10, siteSessionSlug: 'complete-interview-masterclass', siteSessionTitle: 'Complete Interview Masterclass' },

  // caching
  { siteTopicSlug: 'caching', session: 1,  siteSessionSlug: 'what-is-caching-why-every',           siteSessionTitle: 'What is Caching & Why Every System Needs It' },
  { siteTopicSlug: 'caching', session: 2,  siteSessionSlug: 'cache-eviction-policies-lru',         siteSessionTitle: 'Cache Eviction Policies (LRU, LFU, FIFO)' },
  { siteTopicSlug: 'caching', session: 3,  siteSessionSlug: 'writethrough-writebehind',            siteSessionTitle: 'Write-Through, Write-Behind & Cache-Aside' },
  { siteTopicSlug: 'caching', session: 4,  siteSessionSlug: 'redis-deep-dive-architecture',        siteSessionTitle: 'Redis Deep Dive — Architecture & Data Types' },
  { siteTopicSlug: 'caching', session: 5,  siteSessionSlug: 'memcached-vs-redis-the-real',         siteSessionTitle: 'Memcached vs Redis — The Real Difference' },
  { siteTopicSlug: 'caching', session: 6,  siteSessionSlug: 'cache-invalidation-the-hardest',      siteSessionTitle: 'Cache Invalidation — The Hardest Problem' },
  { siteTopicSlug: 'caching', session: 7,  siteSessionSlug: 'cdn-caching-edge-computing',          siteSessionTitle: 'CDN Caching & Edge Computing' },
  { siteTopicSlug: 'caching', session: 8,  siteSessionSlug: 'distributed-caching-at-scale',        siteSessionTitle: 'Distributed Caching at Scale' },
  { siteTopicSlug: 'caching', session: 9,  siteSessionSlug: 'caching-at-instagram-twitter',        siteSessionTitle: 'Caching at Instagram, Twitter & Discord' },
  { siteTopicSlug: 'caching', session: 10, siteSessionSlug: 'complete-interview-masterclass',      siteSessionTitle: 'Complete Interview Masterclass' },

  // database-design
  { siteTopicSlug: 'database-design', session: 1,  siteSessionSlug: 'sql-vs-nosql-the-decision',       siteSessionTitle: 'SQL vs NoSQL — The Decision Framework' },
  { siteTopicSlug: 'database-design', session: 2,  siteSessionSlug: 'database-indexing-deep-dive',     siteSessionTitle: 'Database Indexing Deep Dive' },
  { siteTopicSlug: 'database-design', session: 3,  siteSessionSlug: 'database-sharding-strategies',    siteSessionTitle: 'Database Sharding Strategies' },
  { siteTopicSlug: 'database-design', session: 4,  siteSessionSlug: 'database-replication-high',       siteSessionTitle: 'Database Replication & High Availability' },
  { siteTopicSlug: 'database-design', session: 5,  siteSessionSlug: 'schema-design-for-scale',         siteSessionTitle: 'Schema Design for Scale' },
  { siteTopicSlug: 'database-design', session: 6,  siteSessionSlug: 'transactions-isolation-levels',   siteSessionTitle: 'Transactions & Isolation Levels' },
  { siteTopicSlug: 'database-design', session: 7,  siteSessionSlug: 'nosql-deep-dive-mongodb',         siteSessionTitle: 'NoSQL Deep Dive — MongoDB, Cassandra, DynamoDB' },
  { siteTopicSlug: 'database-design', session: 8,  siteSessionSlug: 'database-connection-pooling',     siteSessionTitle: 'Database Connection Pooling & Performance' },
  { siteTopicSlug: 'database-design', session: 9,  siteSessionSlug: 'database-at-uber-airbnb-stripe',  siteSessionTitle: 'Database at Uber, Airbnb & Stripe' },
  { siteTopicSlug: 'database-design', session: 10, siteSessionSlug: 'complete-interview-masterclass',  siteSessionTitle: 'Complete Interview Masterclass' },

  // api-gateway
  { siteTopicSlug: 'api-gateway', session: 1,  siteSessionSlug: 'what-is-an-api-gateway-why-you',    siteSessionTitle: 'What is an API Gateway & Why You Need One' },
  { siteTopicSlug: 'api-gateway', session: 2,  siteSessionSlug: 'rate-limiting-throttling',           siteSessionTitle: 'Rate Limiting & Throttling' },
  { siteTopicSlug: 'api-gateway', session: 3,  siteSessionSlug: 'authentication-authorization',       siteSessionTitle: 'Authentication & Authorization at the Gateway' },
  { siteTopicSlug: 'api-gateway', session: 4,  siteSessionSlug: 'request-routing-load',               siteSessionTitle: 'Request Routing & Load Distribution' },
  { siteTopicSlug: 'api-gateway', session: 5,  siteSessionSlug: 'api-versioning-strategies',          siteSessionTitle: 'API Versioning Strategies' },
  { siteTopicSlug: 'api-gateway', session: 6,  siteSessionSlug: 'circuit-breaker-retry-patterns',     siteSessionTitle: 'Circuit Breaker & Retry Patterns' },
  { siteTopicSlug: 'api-gateway', session: 7,  siteSessionSlug: 'api-gateway-products-kong',          siteSessionTitle: 'API Gateway Products — Kong, Nginx, AWS' },
  { siteTopicSlug: 'api-gateway', session: 8,  siteSessionSlug: 'graphql-gateway-bff-pattern',        siteSessionTitle: 'GraphQL Gateway & BFF Pattern' },
  { siteTopicSlug: 'api-gateway', session: 9,  siteSessionSlug: 'api-gateway-at-netflix-amazon',      siteSessionTitle: 'API Gateway at Netflix, Amazon & Spotify' },
  { siteTopicSlug: 'api-gateway', session: 10, siteSessionSlug: 'complete-interview-masterclass',     siteSessionTitle: 'Complete Interview Masterclass' },
];

const VALID_SCENE_TYPES = new Set(['hook', 'body', 'outro']);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function contentDir(): string {
  return path.resolve(process.cwd(), 'content');
}

function loadStoryboard(filePath: string): StockStoryboard {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as StockStoryboard;
}

function sessionFiles(): string[] {
  const cd = contentDir();
  if (!fs.existsSync(cd)) return [];
  return fs
    .readdirSync(cd)
    .filter((f) => /^[a-z].*-s\d+\.json$/.test(f))
    .sort()
    .map((f) => path.join(cd, f));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('session storyboard files', () => {
  it('content/ directory exists and has ≥ 40 session JSON files', () => {
    const files = sessionFiles();
    expect(files.length).toBeGreaterThanOrEqual(40);
  });

  it('every expected (topic, session, slug) tuple has a corresponding file', () => {
    const cd = contentDir();
    for (const expected of EXPECTED_SESSIONS) {
      const filename = `${expected.siteTopicSlug}-s${expected.session}.json`;
      const filepath = path.join(cd, filename);
      expect(fs.existsSync(filepath), `Missing file: ${filename}`).toBe(true);
    }
  });

  describe('each session file', () => {
    const files = sessionFiles();

    for (const filepath of files) {
      const filename = path.basename(filepath);

      it(`${filename} — parses as valid JSON`, () => {
        expect(() => loadStoryboard(filepath)).not.toThrow();
      });

      it(`${filename} — required StockStoryboard fields present`, () => {
        const sb = loadStoryboard(filepath);
        expect(typeof sb.fps).toBe('number');
        expect(sb.fps).toBe(30);
        expect(typeof sb.width).toBe('number');
        expect(typeof sb.height).toBe('number');
        expect(sb.width).toBe(1080);
        expect(sb.height).toBe(1920);
        expect(typeof sb.topic).toBe('string');
        expect(sb.topic.length).toBeGreaterThan(0);
        expect(typeof sb.durationInFrames).toBe('number');
        expect(sb.durationInFrames).toBeGreaterThanOrEqual(1440);
        expect(sb.durationInFrames).toBeLessThanOrEqual(1800);
        expect(Array.isArray(sb.scenes)).toBe(true);
        expect(sb.scenes.length).toBeGreaterThanOrEqual(4);
      });

      it(`${filename} — per-session optional fields present`, () => {
        const sb = loadStoryboard(filepath);
        expect(typeof sb.session).toBe('number');
        expect(sb.session).toBeGreaterThanOrEqual(1);
        expect(sb.session).toBeLessThanOrEqual(10);
        expect(typeof sb.totalSessions).toBe('number');
        expect(sb.totalSessions).toBe(10);
        expect(typeof sb.siteTopicSlug).toBe('string');
        expect(typeof sb.siteSessionSlug).toBe('string');
        expect(typeof sb.siteSessionTitle).toBe('string');
        expect(typeof sb.siteSessionFocus).toBe('string');
      });

      it(`${filename} — siteSessionSlug is kebab-case ≤ 30 chars`, () => {
        const sb = loadStoryboard(filepath);
        const slug = sb.siteSessionSlug!;
        expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
        expect(slug.length).toBeLessThanOrEqual(30);
      });

      it(`${filename} — scenes have valid types and sequential frames`, () => {
        const sb = loadStoryboard(filepath);
        let expectedFrame = 0;
        for (const scene of sb.scenes) {
          expect(scene.sceneIndex).toBeGreaterThanOrEqual(0);
          expect(VALID_SCENE_TYPES.has(scene.type), `Invalid type "${scene.type}"`).toBe(true);
          expect(scene.startFrame).toBe(expectedFrame);
          expect(scene.endFrame).toBe(scene.startFrame + scene.durationFrames);
          expect(typeof scene.narration).toBe('string');
          expect(scene.narration.length).toBeGreaterThan(20);
          expectedFrame = scene.endFrame;
        }
        expect(expectedFrame).toBe(sb.durationInFrames);
      });
    }
  });

  describe('tuple correctness', () => {
    for (const expected of EXPECTED_SESSIONS) {
      const filename = `${expected.siteTopicSlug}-s${expected.session}.json`;

      it(`${filename} — correct (siteTopicSlug, session, siteSessionSlug)`, () => {
        const filepath = path.join(contentDir(), filename);
        if (!fs.existsSync(filepath)) return; // covered by existence test above
        const sb = loadStoryboard(filepath);
        expect(sb.siteTopicSlug).toBe(expected.siteTopicSlug);
        expect(sb.session).toBe(expected.session);
        expect(sb.siteSessionSlug).toBe(expected.siteSessionSlug);
        expect(sb.siteSessionTitle).toBe(expected.siteSessionTitle);
      });
    }
  });
});
