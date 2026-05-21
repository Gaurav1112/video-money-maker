import { describe, it, expect } from 'vitest';
import { buildWeeklyArticle, type Short } from '../lib/weekly-template';

const FIXTURE_SHORTS: Short[] = [
  {
    id: 'aaa111',
    title: 'Kafka consumer groups explained',
    youtubeUrl: 'https://youtube.com/shorts/aaa111',
    publishedAt: '2026-05-18T04:30:00Z',
    topic: 'kafka',
  },
  {
    id: 'bbb222',
    title: 'Redis vs Memcached',
    youtubeUrl: 'https://youtube.com/shorts/bbb222',
    publishedAt: '2026-05-19T04:30:00Z',
    topic: 'redis',
  },
  {
    id: 'ccc333',
    title: 'PostgreSQL VACUUM secrets',
    youtubeUrl: 'https://youtube.com/shorts/ccc333',
    publishedAt: '2026-05-20T04:30:00Z',
    topic: 'postgres',
  },
  {
    id: 'ddd444',
    title: 'Kubernetes Pod lifecycle',
    youtubeUrl: 'https://youtube.com/shorts/ddd444',
    publishedAt: '2026-05-21T04:30:00Z',
    topic: 'kubernetes',
  },
  {
    id: 'eee555',
    title: 'Load balancer algorithms',
    youtubeUrl: 'https://youtube.com/shorts/eee555',
    publishedAt: '2026-05-22T04:30:00Z',
    topic: 'load-balancing',
  },
];

describe('buildWeeklyArticle', () => {
  it('produces deterministic byte-stable output', () => {
    const a = buildWeeklyArticle(FIXTURE_SHORTS, '2026-W21');
    const b = buildWeeklyArticle(FIXTURE_SHORTS, '2026-W21');
    expect(a.body).toBe(b.body);
    expect(a.title).toBe(b.title);
    expect(a.tags).toEqual(b.tags);
  });

  it('embeds the canonical YouTube channel CTA', () => {
    const a = buildWeeklyArticle(FIXTURE_SHORTS, '2026-W21');
    expect(a.body).toContain('https://www.youtube.com/@GuruSishya-India');
  });

  it('includes the title of every Short', () => {
    const a = buildWeeklyArticle(FIXTURE_SHORTS, '2026-W21');
    for (const s of FIXTURE_SHORTS) {
      expect(a.body).toContain(s.title);
      expect(a.body).toContain(s.youtubeUrl);
    }
  });

  it('caps tags at 4 (Dev.to limit) and lowercases them', () => {
    const a = buildWeeklyArticle(FIXTURE_SHORTS, '2026-W21');
    expect(a.tags.length).toBeLessThanOrEqual(4);
    for (const t of a.tags) {
      expect(t).toBe(t.toLowerCase());
    }
  });

  it('mentions the ISO week in the title', () => {
    const a = buildWeeklyArticle(FIXTURE_SHORTS, '2026-W21');
    expect(a.title).toContain('2026-W21');
  });

  it('handles an empty list with a defined output (no crash)', () => {
    const a = buildWeeklyArticle([], '2026-W21');
    expect(a.body.length).toBeGreaterThan(0);
    expect(a.tags.length).toBeGreaterThan(0);
  });
});
