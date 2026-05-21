import { describe, it, expect } from 'vitest';
import { buildTikTokCaption, DEFAULT_HASHTAGS } from '../lib/tiktok-caption';

describe('buildTikTokCaption', () => {
  it('appends the 5 default hashtags', () => {
    const c = buildTikTokCaption({ youtube: { title: 'Kafka in 60s' } });
    for (const tag of DEFAULT_HASHTAGS) {
      expect(c).toContain(tag);
    }
  });

  it('starts with the YouTube title', () => {
    const c = buildTikTokCaption({ youtube: { title: 'Redis vs Memcached' } });
    expect(c.startsWith('Redis vs Memcached')).toBe(true);
  });

  it('caps total length at 2200 chars (TikTok limit)', () => {
    const longTitle = 'A'.repeat(5000);
    const c = buildTikTokCaption({ youtube: { title: longTitle } });
    expect(c.length).toBeLessThanOrEqual(2200);
    // Even after truncation, hashtags must still be present.
    for (const tag of DEFAULT_HASHTAGS) {
      expect(c).toContain(tag);
    }
  });

  it('is deterministic — same input → same output', () => {
    const meta = { youtube: { title: 'Postgres VACUUM secrets' } };
    expect(buildTikTokCaption(meta)).toBe(buildTikTokCaption(meta));
  });

  it('uses a safe fallback when title is missing', () => {
    const c = buildTikTokCaption({});
    expect(c.length).toBeGreaterThan(0);
    for (const tag of DEFAULT_HASHTAGS) {
      expect(c).toContain(tag);
    }
  });
});
