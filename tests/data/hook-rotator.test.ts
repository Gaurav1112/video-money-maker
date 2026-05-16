import { describe, it, expect } from 'vitest';
import { rotateBankHook } from '../../src/data/hook-rotator.js';
import type { TopicBankEntry } from '../../src/data/topic-bank-loader.js';

const sd = (slug: string, name: string): TopicBankEntry => ({
  slug, name, category: 'system-design',
});
const dsa = (slug: string, name: string): TopicBankEntry => ({
  slug, name, category: 'dsa',
});

describe('rotateBankHook', () => {
  it('is deterministic for the same slug', () => {
    const a = rotateBankHook(sd('kafka-consumer-groups', 'Kafka Consumer Groups'));
    const b = rotateBankHook(sd('kafka-consumer-groups', 'Kafka Consumer Groups'));
    expect(a).toEqual(b);
  });

  it('produces variety across slugs in the same category', () => {
    const slugs = [
      'kafka-consumer-groups',
      'rate-limiting-token-bucket-vs-leaky-bucket',
      'health-checks-circuit-breakers',
      'cdn-cache-strategy',
      'database-sharding-strategies',
      'message-queue-vs-event-stream',
      'service-mesh-pros-cons',
      'eventual-consistency-tradeoffs',
    ].map((s) => rotateBankHook(sd(s, s.replace(/-/g, ' '))));
    const titles = new Set(slugs.map((r) => r.shortTitle));
    const hooks = new Set(slugs.map((r) => r.hookHinglish));
    expect(titles.size).toBeGreaterThanOrEqual(3);
    expect(hooks.size).toBeGreaterThanOrEqual(3);
  });

  it('strips trailing "Tricks" before interpolation (DSA double-token bug)', () => {
    const r = rotateBankHook(dsa('bit-manipulation-tricks', 'Bit Manipulation Tricks'));
    expect(r.hookHinglish).not.toMatch(/Tricks\s+(pattern|trick)/i);
    expect(r.hookHinglish).toContain('Bit Manipulation');
  });

  it('avoids "WRONG 😳" suffix on names ending with "Explained"', () => {
    const r = rotateBankHook({
      slug: 'big-o-notation-explained',
      name: 'Big-O Notation Explained',
      category: 'system-design',
    });
    expect(r.shortTitle).not.toMatch(/Explained\s+WRONG/i);
  });

  it('rotates company across DSA hooks', () => {
    const slugs = ['two-pointers', 'sliding-window', 'binary-search', 'dp-on-strings'];
    const companies = new Set<string>();
    for (const s of slugs) {
      const r = rotateBankHook(dsa(s, s.replace(/-/g, ' ')));
      const m = r.hookHinglish.match(/Amazon|Google|Microsoft|Netflix|Atlassian|Razorpay|Flipkart|Swiggy/);
      if (m) companies.add(m[0]);
    }
    expect(companies.size).toBeGreaterThanOrEqual(2);
  });

  it('handles unknown category by falling back to system-design pool', () => {
    const r = rotateBankHook({ slug: 'foo', name: 'Foo Bar', category: 'unknown-cat' });
    expect(r.hookHinglish).toBeTruthy();
    expect(r.shortTitle).toBeTruthy();
  });
});
