/**
 * TDD tests for shorts-generator.ts
 *
 * Covers:
 *  - generateShort() structure, id format, title length, narration word-count
 *  - All 10 format names for shortIndex 0-9
 *  - Determinism guarantee
 *  - scenes array type and content
 *  - visualCue exhaustive set
 *  - Viral-hook title checks per shortIndex
 *  - getShortForDate() range and variance
 */

import {
  generateShort,
  getShortForDate,
  resolveShortNumber,
  ALL_TOPICS,
  TOTAL_SHORTS,
  type ShortEpisode,
} from '../shorts-generator';

// ─── Helper ─────────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── generateShort() ─────────────────────────────────────────────────────────

describe('generateShort()', () => {
  const TOPIC = 'kafka';

  describe('returned ShortEpisode shape', () => {
    let episode: ShortEpisode;

    beforeEach(() => {
      episode = generateShort(TOPIC, 0);
    });

    it('has a non-empty id', () => {
      expect(episode.id).toBeTruthy();
    });

    it('has a non-empty title', () => {
      expect(episode.title).toBeTruthy();
    });

    it('has a non-empty narration', () => {
      expect(episode.narration).toBeTruthy();
    });

    it('has a non-empty scenes array', () => {
      expect(Array.isArray(episode.scenes)).toBe(true);
      expect(episode.scenes.length).toBeGreaterThan(0);
    });

    it('has a non-empty heading', () => {
      expect(episode.heading).toBeTruthy();
    });

    it('has a non-empty bullets array', () => {
      expect(Array.isArray(episode.bullets)).toBe(true);
      expect(episode.bullets.length).toBeGreaterThan(0);
    });

    it('has a valid visualCue', () => {
      const validCues: ShortEpisode['visualCue'][] = [
        'concept',
        'comparison',
        'list',
        'interview',
        'cheatsheet',
      ];
      expect(validCues).toContain(episode.visualCue);
    });
  });

  describe('id format', () => {
    it('matches {topicSlug}-short-{shortIndex}', () => {
      for (let i = 0; i <= 9; i++) {
        const ep = generateShort(TOPIC, i);
        expect(ep.id).toBe(`${TOPIC}-short-${i}`);
      }
    });

    it('embeds the topicSlug literally', () => {
      const ep = generateShort('caching', 3);
      expect(ep.id.startsWith('caching-short-')).toBe(true);
    });
  });

  describe('truncTitle — title max 55 chars', () => {
    it('every format index 0-9 produces a title ≤ 55 chars for a long topic name', () => {
      // 'blue-green-deployment' -> "Blue Green Deployment" (21 chars) plus template prefix
      const longTopic = 'blue-green-deployment';
      for (let i = 0; i <= 9; i++) {
        const ep = generateShort(longTopic, i);
        expect(ep.title.length).toBeLessThanOrEqual(55);
      }
    });

    it('short topic name produces a title ≤ 55 chars', () => {
      for (let i = 0; i <= 9; i++) {
        const ep = generateShort('dns', i);
        expect(ep.title.length).toBeLessThanOrEqual(55);
      }
    });
  });

  describe('clampedNarration — max 120 words', () => {
    it('narration is ≤ 120 words for index 0', () => {
      const ep = generateShort(TOPIC, 0);
      expect(wordCount(ep.narration)).toBeLessThanOrEqual(120);
    });

    it('narration is ≤ 120 words across all 10 format indices', () => {
      for (let i = 0; i <= 9; i++) {
        const ep = generateShort(TOPIC, i);
        expect(wordCount(ep.narration)).toBeLessThanOrEqual(120);
      }
    });

    it('narration is ≤ 120 words for multiple topics', () => {
      const topics = ['caching', 'kubernetes', 'dynamic-programming', 'consistent-hashing'];
      for (const topic of topics) {
        for (let i = 0; i <= 9; i++) {
          const ep = generateShort(topic, i);
          expect(wordCount(ep.narration)).toBeLessThanOrEqual(120);
        }
      }
    });
  });

  describe('all 10 format names (shortIndex 0-9)', () => {
    const expectedFormatNames = [
      'concept-explainer',
      'three-mistakes',
      'versus',
      'salary-bait',
      'interview-pov',
      'hot-take',
      'stat-hook',
      'eli5',
      'senior-vs-junior',
      'cheat-sheet',
    ];

    it.each(expectedFormatNames.map((name, i) => ({ i, name })))(
      'shortIndex $i → formatName "$name"',
      ({ i, name }) => {
        const ep = generateShort(TOPIC, i);
        expect(ep.formatName).toBe(name);
      }
    );
  });

  describe('determinism', () => {
    it('same topic + shortIndex always produces identical output', () => {
      const a = generateShort('kafka', 3);
      const b = generateShort('kafka', 3);
      expect(a).toEqual(b);
    });

    it('different topics produce different narrations', () => {
      const a = generateShort('kafka', 0);
      const b = generateShort('caching', 0);
      expect(a.narration).not.toBe(b.narration);
    });

    it('different shortIndex values produce different format names', () => {
      const formats = new Set(
        Array.from({ length: 10 }, (_, i) => generateShort(TOPIC, i).formatName)
      );
      expect(formats.size).toBe(10);
    });
  });

  describe('scenes array', () => {
    it('each scene has required fields: type, content, narration, duration, startFrame, endFrame', () => {
      const ep = generateShort(TOPIC, 0);
      for (const scene of ep.scenes) {
        expect(scene).toHaveProperty('type');
        expect(scene).toHaveProperty('content');
        expect(scene).toHaveProperty('narration');
        expect(scene).toHaveProperty('duration');
        expect(scene).toHaveProperty('startFrame');
        expect(scene).toHaveProperty('endFrame');
      }
    });

    it('scenes have non-negative startFrame and positive endFrame', () => {
      const ep = generateShort(TOPIC, 0);
      for (const scene of ep.scenes) {
        expect(scene.startFrame).toBeGreaterThanOrEqual(0);
        expect(scene.endFrame).toBeGreaterThan(0);
        expect(scene.endFrame).toBeGreaterThan(scene.startFrame);
      }
    });

    it('scenes are sequential (each startFrame = previous endFrame)', () => {
      const ep = generateShort(TOPIC, 1);
      for (let i = 1; i < ep.scenes.length; i++) {
        expect(ep.scenes[i].startFrame).toBe(ep.scenes[i - 1].endFrame);
      }
    });

    it('comparison visualCue → scene type is "table"', () => {
      // shortIndex 2 = versus → visualCue = 'comparison'
      const ep = generateShort(TOPIC, 2);
      expect(ep.visualCue).toBe('comparison');
      for (const scene of ep.scenes) {
        expect(scene.type).toBe('table');
      }
    });

    it('interview visualCue → scene type is "interview"', () => {
      // shortIndex 4 = interview-pov → visualCue = 'interview'
      const ep = generateShort(TOPIC, 4);
      expect(ep.visualCue).toBe('interview');
      for (const scene of ep.scenes) {
        expect(scene.type).toBe('interview');
      }
    });

    it('concept visualCue → scene type is "text"', () => {
      // shortIndex 0 = concept-explainer → visualCue = 'concept'
      const ep = generateShort(TOPIC, 0);
      expect(ep.visualCue).toBe('concept');
      for (const scene of ep.scenes) {
        expect(scene.type).toBe('text');
      }
    });

    it('first scene carries heading and bullets', () => {
      const ep = generateShort(TOPIC, 0);
      expect(ep.scenes[0].heading).toBe(ep.heading);
      expect(ep.scenes[0].bullets).toEqual(ep.bullets);
    });
  });

  describe('visualCue is always a valid member of the union', () => {
    const validCues = new Set<string>(['concept', 'comparison', 'list', 'interview', 'cheatsheet']);

    it('all 10 format indices produce a valid visualCue', () => {
      for (let i = 0; i <= 9; i++) {
        const ep = generateShort(TOPIC, i);
        expect(validCues.has(ep.visualCue)).toBe(true);
      }
    });
  });
});

// ─── Title formula / viral hook tests ────────────────────────────────────────

describe('Title viral-hook formulas', () => {
  const TOPIC = 'kafka';

  it('shortIndex=0 (concept-explainer) title contains "Using" or "Wrong"', () => {
    const ep = generateShort(TOPIC, 0);
    expect(ep.title).toMatch(/Using|Wrong/i);
  });

  it('shortIndex=1 (three-mistakes) title contains "Silently" or "Killing"', () => {
    const ep = generateShort(TOPIC, 1);
    expect(ep.title).toMatch(/Silently|Killing/i);
  });

  it('shortIndex=2 (versus) title contains "Nobody"', () => {
    const ep = generateShort(TOPIC, 2);
    expect(ep.title).toMatch(/Nobody/i);
  });

  it('shortIndex=3 (salary-bait) title contains "Question" or "Fails" or "Senior"', () => {
    const ep = generateShort(TOPIC, 3);
    expect(ep.title).toMatch(/Question|Fails|Senior/i);
  });

  it('shortIndex=4 (interview-pov) title contains "Interview" or "Explain"', () => {
    const ep = generateShort(TOPIC, 4);
    expect(ep.title).toMatch(/Interview|Explain/i);
  });

  it('shortIndex=5 (hot-take) title contains "Silent" or "Bug" or "Config"', () => {
    const ep = generateShort(TOPIC, 5);
    expect(ep.title).toMatch(/Silent|Bug|Config/i);
  });

  it('shortIndex=6 (stat-hook) title contains "90%" or "Wrong"', () => {
    const ep = generateShort(TOPIC, 6);
    expect(ep.title).toMatch(/90%|Wrong/i);
  });

  it('shortIndex=7 (eli5) title contains "Real Reason" or "Explained" or "Simply"', () => {
    const ep = generateShort(TOPIC, 7);
    expect(ep.title).toMatch(/Real Reason|Explained|Simply/i);
  });

  it('shortIndex=8 (senior-vs-junior) title contains "Senior"', () => {
    const ep = generateShort(TOPIC, 8);
    expect(ep.title).toMatch(/Senior/i);
  });

  it('shortIndex=9 (cheat-sheet) title contains "Cheat Sheet"', () => {
    const ep = generateShort(TOPIC, 9);
    expect(ep.title).toMatch(/Cheat Sheet/i);
  });
});

// ─── getShortForDate() ───────────────────────────────────────────────────────

describe('getShortForDate()', () => {
  it('returns a shortNumber in range [0, TOTAL_SHORTS-1]', () => {
    const date = new Date('2026-05-02');
    const { shortNumber } = getShortForDate(date);
    expect(shortNumber).toBeGreaterThanOrEqual(0);
    expect(shortNumber).toBeLessThan(TOTAL_SHORTS); // 660
  });

  it('returns a valid topicSlug', () => {
    const date = new Date('2026-05-02');
    const { topicSlug } = getShortForDate(date);
    expect(ALL_TOPICS).toContain(topicSlug);
  });

  it('returns a shortIndex in range [0, 13]', () => {
    const date = new Date('2026-05-02');
    const { shortIndex } = getShortForDate(date);
    expect(shortIndex).toBeGreaterThanOrEqual(0);
    expect(shortIndex).toBeLessThanOrEqual(13); // 14 formats (indices 0-13)
  });

  it('different dates return different short numbers', () => {
    const d1 = getShortForDate(new Date('2026-01-01'));
    const d2 = getShortForDate(new Date('2026-01-02'));
    const d3 = getShortForDate(new Date('2026-02-01'));
    const numbers = [d1.shortNumber, d2.shortNumber, d3.shortNumber];
    // Not all equal — daily rotation must advance
    const unique = new Set(numbers);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('same date always returns the same result (deterministic)', () => {
    const date = new Date('2026-06-15');
    const a = getShortForDate(date);
    const b = getShortForDate(date);
    expect(a.shortNumber).toBe(b.shortNumber);
    expect(a.topicSlug).toBe(b.topicSlug);
    expect(a.shortIndex).toBe(b.shortIndex);
  });
});

// ─── resolveShortNumber() ────────────────────────────────────────────────────

describe('resolveShortNumber()', () => {
  it('shortNumber 0 resolves to first topic, shortIndex 0', () => {
    const { topicSlug, shortIndex } = resolveShortNumber(0);
    expect(topicSlug).toBe(ALL_TOPICS[0]);
    expect(shortIndex).toBe(0);
  });

  it('shortNumber 14 resolves to second topic, shortIndex 0', () => {
    // With 14 formats, shortNumber 14 = topic index 1, shortIndex 0
    const { topicSlug, shortIndex } = resolveShortNumber(14);
    expect(topicSlug).toBe(ALL_TOPICS[1]);
    expect(shortIndex).toBe(0);
  });

  it('shortNumber 1 resolves to first topic, shortIndex 1', () => {
    const { topicSlug, shortIndex } = resolveShortNumber(1);
    expect(topicSlug).toBe(ALL_TOPICS[0]);
    expect(shortIndex).toBe(1);
  });

  it('wraps around at TOTAL_SHORTS (660)', () => {
    const a = resolveShortNumber(0);
    const b = resolveShortNumber(TOTAL_SHORTS);
    expect(a.topicSlug).toBe(b.topicSlug);
    expect(a.shortIndex).toBe(b.shortIndex);
  });

  it('negative values wrap correctly', () => {
    const result = resolveShortNumber(-1);
    expect(ALL_TOPICS).toContain(result.topicSlug);
    expect(result.shortIndex).toBeGreaterThanOrEqual(0);
    expect(result.shortIndex).toBeLessThanOrEqual(13); // 14 formats now (indices 0-13)
  });
});
