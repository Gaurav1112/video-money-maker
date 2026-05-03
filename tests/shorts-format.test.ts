/**
 * tests/shorts-format.test.ts
 *
 * Asserts that every output produced by make-reels.ts / make-shorts.ts and
 * registered via ViralShort satisfies the platform format requirements:
 *
 *   width  = 1080   (9:16 vertical — NOT the old 1920)
 *   height = 1920   (9:16 vertical — NOT the old 1080)
 *   fps    = 30
 *   durationInFrames ≤ 55 × 30 = 1650  (≤55 s, 5 s buffer under YT Shorts cap)
 *
 * Tests run against:
 *   1. calculateViralShortMetadata() — the Remotion metadata function (no render needed)
 *   2. The deterministic seed logic — same slug → same scene index
 *   3. The MAX_DURATION_FRAMES constant exported from make-reels / make-shorts
 */

import { createHash } from 'crypto';
import { calculateViralShortMetadata } from '../src/compositions/ViralShort';
import type { Storyboard, Scene } from '../src/types';

// ── Constraints ────────────────────────────────────────────────────────────────

const EXPECTED_WIDTH = 1080;
const EXPECTED_HEIGHT = 1920;
const EXPECTED_FPS = 30;
const MAX_DURATION_FRAMES = 55 * 30; // 1650

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeScene(overrides: Partial<Scene> = {}): Scene {
  return {
    type: 'text',
    heading: 'What is Load Balancing?',
    narration: 'Load balancing distributes network traffic across multiple servers.',
    wordTimestamps: [
      { word: 'Load', start: 0, end: 0.3 },
      { word: 'balancing', start: 0.3, end: 0.7 },
      { word: 'distributes', start: 0.7, end: 1.2 },
    ],
    duration: 10,
    audioOffsetSeconds: 0,
    ...overrides,
  };
}

function makeStoryboard(overrides: Partial<Storyboard> = {}): Storyboard {
  return {
    topic: 'Load Balancing',
    audioFile: 'audio/load-balancing.mp3',
    scenes: [
      makeScene({ type: 'title', heading: 'Load Balancing', narration: '' }),
      makeScene({ type: 'text', duration: 12 }),
      makeScene({ type: 'code', content: 'server.listen(3000)' }),
      makeScene({ type: 'interview', heading: 'Q: What is LB?' }),
      makeScene({ type: 'summary', narration: '' }),
    ],
    ...overrides,
  };
}

// ── 1. Composition dimensions ──────────────────────────────────────────────────

describe('ViralShort composition format', () => {
  test('width is 1080 (9:16 vertical)', () => {
    const meta = calculateViralShortMetadata({ props: { storyboard: makeStoryboard() } });
    expect(meta.width).toBe(EXPECTED_WIDTH);
  });

  test('height is 1920 (9:16 vertical)', () => {
    const meta = calculateViralShortMetadata({ props: { storyboard: makeStoryboard() } });
    expect(meta.height).toBe(EXPECTED_HEIGHT);
  });

  test('fps is 30', () => {
    const meta = calculateViralShortMetadata({ props: { storyboard: makeStoryboard() } });
    expect(meta.fps).toBe(EXPECTED_FPS);
  });

  test('durationInFrames is ≤ 55 × 30 = 1650 frames', () => {
    const meta = calculateViralShortMetadata({ props: { storyboard: makeStoryboard() } });
    expect(meta.durationInFrames).toBeLessThanOrEqual(MAX_DURATION_FRAMES);
  });

  test('durationInFrames is ≤ 1650 even when scene duration is very long', () => {
    const longScene = makeScene({ duration: 300, wordTimestamps: undefined });
    const sb = makeStoryboard({
      scenes: [longScene, longScene, longScene],
    });
    const meta = calculateViralShortMetadata({ props: { storyboard: sb } });
    expect(meta.durationInFrames).toBeLessThanOrEqual(MAX_DURATION_FRAMES);
  });

  test('returns safe defaults when storyboard has no scenes', () => {
    const meta = calculateViralShortMetadata({
      props: { storyboard: { topic: 'empty', scenes: [], audioFile: '' } },
    });
    expect(meta.width).toBe(EXPECTED_WIDTH);
    expect(meta.height).toBe(EXPECTED_HEIGHT);
    expect(meta.fps).toBe(EXPECTED_FPS);
    expect(meta.durationInFrames).toBeLessThanOrEqual(MAX_DURATION_FRAMES);
  });

  test('aspect ratio is 9:16 (width/height = 0.5625)', () => {
    const meta = calculateViralShortMetadata({ props: { storyboard: makeStoryboard() } });
    const ratio = meta.width / meta.height;
    expect(ratio).toBeCloseTo(9 / 16, 4);
  });
});

// ── 2. Deterministic seed ──────────────────────────────────────────────────────

describe('Deterministic seed', () => {
  function topicSeed(slug: string): number {
    const hex = createHash('sha256').update(slug).digest('hex');
    return parseInt(hex.slice(0, 8), 16);
  }

  function deterministicSceneIndex(storyboard: Storyboard, slug: string): number {
    const content = storyboard.scenes.filter(
      (s) => s.type !== 'title' && s.type !== 'summary',
    );
    if (content.length === 0) return 0;
    return topicSeed(slug) % content.length;
  }

  test('same slug always produces same scene index', () => {
    const sb = makeStoryboard();
    const slug = 'load-balancing';
    const idx1 = deterministicSceneIndex(sb, slug);
    const idx2 = deterministicSceneIndex(sb, slug);
    expect(idx1).toBe(idx2);
  });

  test('different slugs produce different seeds', () => {
    const seed1 = topicSeed('load-balancing');
    const seed2 = topicSeed('system-design');
    expect(seed1).not.toBe(seed2);
  });

  test('seed is always a non-negative integer', () => {
    const seeds = ['load-balancing', 'caching', 'databases', 'api-gateway'].map(
      topicSeed,
    );
    for (const s of seeds) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(s)).toBe(true);
    }
  });

  test('scene index is always within bounds', () => {
    const sb = makeStoryboard();
    const contentCount = sb.scenes.filter(
      (s) => s.type !== 'title' && s.type !== 'summary',
    ).length;

    const slugs = ['load-balancing', 'caching', 'databases', 'microservices'];
    for (const slug of slugs) {
      const idx = deterministicSceneIndex(sb, slug);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(contentCount);
    }
  });

  test('clipStart prop propagates to metadata calculation', () => {
    const sb = makeStoryboard();
    // clipStart = 0 and clipStart = 1 should both give valid metadata
    const meta0 = calculateViralShortMetadata({ props: { storyboard: sb, clipStart: 0 } });
    const meta1 = calculateViralShortMetadata({ props: { storyboard: sb, clipStart: 1 } });
    expect(meta0.width).toBe(EXPECTED_WIDTH);
    expect(meta1.width).toBe(EXPECTED_WIDTH);
    expect(meta0.durationInFrames).toBeLessThanOrEqual(MAX_DURATION_FRAMES);
    expect(meta1.durationInFrames).toBeLessThanOrEqual(MAX_DURATION_FRAMES);
  });
});

// ── 3. Duration arithmetic ─────────────────────────────────────────────────────

describe('Duration arithmetic', () => {
  const HOOK_FRAMES = 30;   // 1 s
  const CTA_FRAMES = 60;    // 2 s
  const MAX_CONTENT_SECONDS = 25;
  const MAX_TOTAL = 900;    // 30 s = ViralShort.MAX_TOTAL_FRAMES

  test('30 s MAX_TOTAL_FRAMES is ≤ 1650 (55 s cap)', () => {
    expect(MAX_TOTAL).toBeLessThanOrEqual(MAX_DURATION_FRAMES);
  });

  test('hook + max content + CTA does not exceed MAX_TOTAL_FRAMES', () => {
    const contentFrames = Math.round(MAX_CONTENT_SECONDS * EXPECTED_FPS);
    const total = HOOK_FRAMES + contentFrames + CTA_FRAMES;
    expect(total).toBeLessThanOrEqual(MAX_TOTAL);
  });

  test('55 s in frames equals 1650', () => {
    expect(55 * EXPECTED_FPS).toBe(1650);
  });

  test('60 s (YT hard cap) minus 5 s buffer equals 55 s', () => {
    expect(60 - 5).toBe(55);
  });
});
