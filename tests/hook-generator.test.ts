/**
 * hook-generator.test.ts
 *
 * Tests for the RANK-12 shock-hook rewrite.
 *
 * Run:  npx vitest run tests/hook-generator.test.ts
 *
 * Key assertions:
 *   1. "Kafka producers" → title contains "90%" + "WRONG" (proven formula)
 *   2. Determinism: same inputs → same output across multiple calls
 *   3. textHook ≤ 8 words (YouTube Shorts overlay constraint)
 *   4. At least one SHOUTED word (WRONG|STOP|FAIL|NEVER|NOW)
 *   5. spokenHook contains CTA url "guru-sishya.in"
 *   6. Hinglish variant is generated for shortIndex=15+
 *   7. buildShortsTitle stays ≤ 100 chars total
 *   8. pickShockTitle covers all 10 formula patterns
 *   9. Different shortIndex values → different textHooks
 *  10. djb2Hash is pure and consistent
 */

import { describe, it, expect } from 'vitest';
import { generateShockHook, generateDualHook } from '../src/lib/hook-generator';
import {
  pickShockTitle,
  pickShockTitleByPattern,
  buildShortsTitle,
  djb2Hash,
  fillTemplate,
  TITLE_TEMPLATES,
  TitlePattern,
} from '../src/lib/title-templates';

// ─── Minimal Scene stub (mirrors actual Scene type) ───────────────────────────
const EMPTY_SCENES: import('../src/types').Scene[] = [];

// ─── 1. Core "Kafka producers" contract ──────────────────────────────────────

describe('generateShockHook — Kafka producers', () => {
  it('produces a textHook matching "90% Engineers Get Kafka Producers WRONG"', () => {
    const result = generateShockHook('Kafka producers', 0, EMPTY_SCENES);
    // The #1 formula (shortIndex 0) must hit formula-0: "90% Engineers Get {topic} WRONG"
    expect(result.textHook).toBe('90% Engineers Get Kafka producers WRONG');
  });

  it('textHook contains at least one SHOUTED keyword', () => {
    const result = generateShockHook('Kafka producers', 0, EMPTY_SCENES);
    const shouted = /WRONG|STOP|FAIL|NEVER|NOW/.test(result.textHook);
    expect(shouted).toBe(true);
  });

  it('textHook has ≤ 8 words', () => {
    const result = generateShockHook('Kafka producers', 0, EMPTY_SCENES);
    const wordCount = result.textHook.trim().split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(8);
  });

  it('spokenHook includes mid-video CTA "guru-sishya.in"', () => {
    const result = generateShockHook('Kafka producers', 0, EMPTY_SCENES);
    expect(result.spokenHook).toContain('guru-sishya.in');
  });
});

// ─── 2. Determinism ───────────────────────────────────────────────────────────

describe('generateShockHook — determinism', () => {
  it('same topic + shortIndex always returns the same textHook', () => {
    const a = generateShockHook('load balancing', 2, EMPTY_SCENES);
    const b = generateShockHook('load balancing', 2, EMPTY_SCENES);
    expect(a.textHook).toBe(b.textHook);
    expect(a.spokenHook).toBe(b.spokenHook);
  });

  it('different shortIndex produces different textHook for same topic', () => {
    const results = new Set(
      [0, 1, 2, 3, 4].map(
        (i) => generateShockHook('system design', i, EMPTY_SCENES).textHook,
      ),
    );
    // At least 3 distinct textHooks out of 5 indices
    expect(results.size).toBeGreaterThanOrEqual(3);
  });

  it('different topics produce different textHooks at same shortIndex', () => {
    const hooks = ['Kafka', 'Redis', 'Kubernetes', 'GraphQL', 'gRPC'].map(
      (t) => generateShockHook(t, 0, EMPTY_SCENES).textHook,
    );
    const unique = new Set(hooks);
    expect(unique.size).toBeGreaterThanOrEqual(3);
  });
});

// ─── 3. Backward-compat: generateDualHook ────────────────────────────────────

describe('generateDualHook — backward compatibility', () => {
  it('returns a HookResult with textHook and spokenHook', () => {
    const result = generateDualHook('API Gateway', 1, EMPTY_SCENES);
    expect(result).toHaveProperty('textHook');
    expect(result).toHaveProperty('spokenHook');
    expect(typeof result.textHook).toBe('string');
    expect(typeof result.spokenHook).toBe('string');
  });

  it('output still contains a SHOUTED keyword', () => {
    const result = generateDualHook('API Gateway', 3, EMPTY_SCENES);
    const shouted = /WRONG|STOP|FAIL|NEVER|NOW/.test(result.textHook);
    expect(shouted).toBe(true);
  });
});

// ─── 4. Hinglish variants ─────────────────────────────────────────────────────

describe('generateShockHook — Hinglish variants (indices 15–19)', () => {
  // Formula index = djb2('kafka producers') ^ (shortIndex * 0x9e3779b9) % 20
  // We drive shortIndex until we land in the Hinglish range (15–19)
  it('produces Hinglish spokenHook for at least one shortIndex in 0–50', () => {
    const hinglishWords = ['hain', 'hai', 'karo', 'mein', 'karta'];
    let foundHinglish = false;
    for (let i = 0; i < 50; i++) {
      const result = generateShockHook('Kafka producers', i, EMPTY_SCENES);
      if (hinglishWords.some((w) => result.spokenHook.includes(w))) {
        foundHinglish = true;
        break;
      }
    }
    expect(foundHinglish).toBe(true);
  });
});

// ─── 5. djb2Hash ─────────────────────────────────────────────────────────────

describe('djb2Hash', () => {
  it('returns same value for same string', () => {
    expect(djb2Hash('kafka producers')).toBe(djb2Hash('kafka producers'));
  });

  it('returns different values for different strings', () => {
    expect(djb2Hash('kafka')).not.toBe(djb2Hash('redis'));
  });

  it('returns a non-negative integer', () => {
    const h = djb2Hash('load balancing');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h)).toBe(true);
  });
});

// ─── 6. Title templates ───────────────────────────────────────────────────────

describe('TITLE_TEMPLATES registry', () => {
  it('contains ≥ 30 templates', () => {
    expect(TITLE_TEMPLATES.length).toBeGreaterThanOrEqual(30);
  });

  it('every template has a shoutWord', () => {
    for (const t of TITLE_TEMPLATES) {
      const valid = ['WRONG', 'STOP', 'FAIL', 'NEVER', 'NOW'].includes(
        t.shoutWord,
      );
      expect(valid, `Template ${t.id} missing valid shoutWord`).toBe(true);
    }
  });

  it('every template has ≤ 10 words in template string (excluding slots)', () => {
    for (const t of TITLE_TEMPLATES) {
      // Replace slots then count words
      const filled = t.template
        .replace(/\{topic\}/g, 'X')
        .replace(/\{persona\}/g, 'Y');
      const words = filled.trim().split(/\s+/).length;
      expect(
        words,
        `Template ${t.id} has ${words} words — exceeds 10`,
      ).toBeLessThanOrEqual(10);
    }
  });

  it('has both English and Hinglish templates', () => {
    const langs = new Set(TITLE_TEMPLATES.map((t) => t.lang));
    expect(langs.has('en')).toBe(true);
    expect(langs.has('hi')).toBe(true);
  });

  it('covers all 10 pattern types', () => {
    const patterns: TitlePattern[] = [
      'ninety-percent-wrong',
      'why-not-hired',
      'cost-rupee',
      'faang-filter',
      'recruiter-gate',
      'warning-dont',
      'stat-bomb',
      'call-out',
      'consequence',
      'specificity-shock',
    ];
    const covered = new Set(TITLE_TEMPLATES.map((t) => t.pattern));
    for (const p of patterns) {
      expect(covered.has(p), `Pattern "${p}" not found in registry`).toBe(true);
    }
  });
});

// ─── 7. pickShockTitle ────────────────────────────────────────────────────────

describe('pickShockTitle', () => {
  it('fills {topic} slot', () => {
    const title = pickShockTitle({ topic: 'Kafka producers' }, 0, 'en');
    expect(title).toContain('Kafka producers');
  });

  it('is deterministic', () => {
    const a = pickShockTitle({ topic: 'Redis cache' }, 1, 'en');
    const b = pickShockTitle({ topic: 'Redis cache' }, 1, 'en');
    expect(a).toBe(b);
  });

  it('rotates across shortIndex values', () => {
    const results = new Set(
      [0, 1, 2, 3, 4, 5].map(
        (i) => pickShockTitle({ topic: 'load balancing' }, i, 'en'),
      ),
    );
    expect(results.size).toBeGreaterThanOrEqual(3);
  });
});

// ─── 8. pickShockTitleByPattern ───────────────────────────────────────────────

describe('pickShockTitleByPattern', () => {
  it('returns a "ninety-percent-wrong" title containing WRONG or FAIL', () => {
    const title = pickShockTitleByPattern(
      { topic: 'Kafka producers' },
      'ninety-percent-wrong',
      0,
      'en',
    );
    expect(/WRONG|FAIL/.test(title)).toBe(true);
  });

  it('returns a cost-rupee title containing ₹', () => {
    const title = pickShockTitleByPattern(
      { topic: 'system design' },
      'cost-rupee',
      0,
      'en',
    );
    expect(title).toContain('₹');
  });

  it('falls back gracefully when pattern has no Hinglish variant for lang=hi', () => {
    // All patterns have at least one hi template, but if not — should not throw
    expect(() =>
      pickShockTitleByPattern({ topic: 'gRPC' }, 'faang-filter', 0, 'hi'),
    ).not.toThrow();
  });
});

// ─── 9. buildShortsTitle ─────────────────────────────────────────────────────

describe('buildShortsTitle', () => {
  it('total length ≤ 100 characters', () => {
    const title = buildShortsTitle(
      { topic: 'Kafka producers' },
      0,
      '#SystemDesign',
    );
    expect(title.length).toBeLessThanOrEqual(100);
  });

  it('contains #Shorts hashtag', () => {
    const title = buildShortsTitle(
      { topic: 'load balancing' },
      0,
      '#SystemDesign',
    );
    expect(title).toContain('#Shorts');
  });

  it('shortIndex=0 always uses ninety-percent-wrong pattern', () => {
    const title = buildShortsTitle(
      { topic: 'Kafka producers' },
      0,
      '#SystemDesign',
    );
    expect(/WRONG|FAIL/.test(title)).toBe(true);
  });

  it('does NOT produce descriptive fallback like "in 60 Seconds Flat"', () => {
    const titles = [0, 1, 2].map((i) =>
      buildShortsTitle({ topic: 'Caching' }, i, '#SystemDesign'),
    );
    for (const t of titles) {
      expect(t).not.toMatch(/in \d+ Seconds Flat/i);
    }
  });
});

// ─── 10. fillTemplate ────────────────────────────────────────────────────────

describe('fillTemplate', () => {
  it('replaces {topic}', () => {
    const out = fillTemplate('90% Engineers Get {topic} WRONG', {
      topic: 'Kafka producers',
    });
    expect(out).toBe('90% Engineers Get Kafka producers WRONG');
  });

  it('uses topic as persona fallback when persona not provided', () => {
    const out = fillTemplate('Why {persona} Engineers NEVER Get Hired', {
      topic: 'backend',
    });
    expect(out).toBe('Why backend Engineers NEVER Get Hired');
  });

  it('uses provided persona when given', () => {
    const out = fillTemplate('Why {persona} Engineers NEVER Get Hired', {
      topic: 'system design',
      persona: 'Java',
    });
    expect(out).toBe('Why Java Engineers NEVER Get Hired');
  });
});
