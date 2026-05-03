/**
 * script-generator-v2.test.ts
 *
 * Tests that the generator produces deterministic, valid output
 * for known topics in both English and Hinglish, long and short format.
 *
 * Run: npx vitest tests/script-generator-v2.test.ts
 *      OR: npx jest tests/script-generator-v2.test.ts
 */

import { describe, it, expect } from 'vitest';
import { generateScript, ScriptInput } from '../src/pipeline/script-generator-v2';
import { validate } from '../src/lib/script-validator';
import { measureDensity, MIN_DENSITY } from '../src/lib/script-density';

// ─── Determinism helpers ───────────────────────────────────────────────────────

function generateTwice(input: ScriptInput) {
  const a = generateScript(input);
  const b = generateScript(input);
  return { a, b };
}

// ─── Core determinism tests ────────────────────────────────────────────────────

describe('generateScript — determinism', () => {
  const inputs: ScriptInput[] = [
    { topic: 'kafka', durationSec: 360, format: 'long', language: 'en' },
    { topic: 'redis', durationSec: 360, format: 'long', language: 'hinglish' },
    { topic: 'system-design', durationSec: 50, format: 'short', language: 'en' },
    { topic: 'dsa', durationSec: 50, format: 'short', language: 'hinglish' },
  ];

  inputs.forEach((input) => {
    it(`produces identical output for the same input (${input.topic}/${input.format}/${input.language})`, () => {
      const { a, b } = generateTwice(input);
      expect(a.segments.length).toEqual(b.segments.length);
      a.segments.forEach((seg, i) => {
        expect(seg.text).toEqual(b.segments[i].text);
        expect(seg.type).toEqual(b.segments[i].type);
        expect(seg.frameStart).toEqual(b.segments[i].frameStart);
      });
    });
  });
});

// ─── Structural requirements ───────────────────────────────────────────────────

describe('generateScript — long-form structure', () => {
  it('produces 8+ segments for a long-form Kafka video', () => {
    const script = generateScript({ topic: 'kafka', durationSec: 360, format: 'long', language: 'en' });
    expect(script.segments.length).toBeGreaterThanOrEqual(8);
  });

  it('starts with a HOOK segment within the first 5 seconds', () => {
    const script = generateScript({ topic: 'redis', durationSec: 360, format: 'long', language: 'en' });
    const firstHook = script.segments.find((s) => s.type === 'HOOK');
    expect(firstHook).toBeDefined();
    expect(firstHook!.timeStartSec).toBeLessThanOrEqual(5);
  });

  it('ends with a CTA segment', () => {
    const script = generateScript({ topic: 'system-design', durationSec: 360, format: 'long', language: 'en' });
    const last = script.segments[script.segments.length - 1];
    expect(last.type).toBe('CTA');
  });

  it('contains all four segment types: HOOK, TENSION, TEACH, CTA', () => {
    const script = generateScript({ topic: 'microservices', durationSec: 360, format: 'long', language: 'en' });
    const types = new Set(script.segments.map((s) => s.type));
    expect(types.has('HOOK')).toBe(true);
    expect(types.has('TENSION')).toBe(true);
    expect(types.has('TEACH')).toBe(true);
    expect(types.has('CTA')).toBe(true);
  });

  it('mentions guru-sishya.in exactly twice', () => {
    const script = generateScript({ topic: 'docker', durationSec: 360, format: 'long', language: 'en' });
    const fullText = script.segments.map((s) => s.text).join(' ');
    const count = (fullText.match(/guru-sishya\.in/gi) ?? []).length;
    expect(count).toBe(2);
  });

  it('long-form word count is within 700–1150 words', () => {
    const script = generateScript({ topic: 'kafka', durationSec: 360, format: 'long', language: 'en' });
    expect(script.metadata.totalWords).toBeGreaterThanOrEqual(700);
    expect(script.metadata.totalWords).toBeLessThanOrEqual(1150);
  });
});

// ─── Short-form structure ──────────────────────────────────────────────────────

describe('generateScript — short-form structure', () => {
  it('produces exactly 5 segments for a short-form video', () => {
    const script = generateScript({ topic: 'redis', durationSec: 50, format: 'short', language: 'en' });
    expect(script.segments.length).toBe(5);
  });

  it('first segment is a HOOK starting at 0s', () => {
    const script = generateScript({ topic: 'kafka', durationSec: 50, format: 'short', language: 'en' });
    expect(script.segments[0].type).toBe('HOOK');
    expect(script.segments[0].timeStartSec).toBe(0);
  });

  it('last segment is a CTA ending at ~55s', () => {
    const script = generateScript({ topic: 'kafka', durationSec: 50, format: 'short', language: 'en' });
    const last = script.segments[script.segments.length - 1];
    expect(last.type).toBe('CTA');
    expect(last.timeEndSec).toBeLessThanOrEqual(60);
  });

  it('short-form word count is within 60–140 words', () => {
    const script = generateScript({ topic: 'java', durationSec: 50, format: 'short', language: 'en' });
    expect(script.metadata.totalWords).toBeGreaterThanOrEqual(60);
    expect(script.metadata.totalWords).toBeLessThanOrEqual(140);
  });
});

// ─── Hinglish support ─────────────────────────────────────────────────────────

describe('generateScript — Hinglish', () => {
  it('generates a valid Hinglish long-form script', () => {
    const script = generateScript({ topic: 'kafka', durationSec: 360, format: 'long', language: 'hinglish' });
    expect(script.segments.length).toBeGreaterThan(0);
    expect(script.metadata.language).toBe('hinglish');
  });

  it('Hinglish script contains Hindi words', () => {
    const script = generateScript({ topic: 'redis', durationSec: 360, format: 'long', language: 'hinglish' });
    const fullText = script.segments.map((s) => s.text).join(' ');
    // Check for common Hinglish markers
    const hasHindi = /\b(mein|hai|kya|toh|nahi|aur|bhi|se|pe|ke|ka|ki|tha|hain|karo|bhai|yaar)\b/i.test(fullText);
    expect(hasHindi).toBe(true);
  });

  it('Hinglish script still mentions guru-sishya.in twice', () => {
    const script = generateScript({ topic: 'system-design', durationSec: 360, format: 'long', language: 'hinglish' });
    const fullText = script.segments.map((s) => s.text).join(' ');
    const count = (fullText.match(/guru-sishya\.in/gi) ?? []).length;
    expect(count).toBe(2);
  });
});

// ─── Validation integration ────────────────────────────────────────────────────

describe('generateScript — validation integration', () => {
  const topics = ['kafka', 'redis', 'system-design', 'java', 'docker'];

  topics.forEach((topic) => {
    it(`generated ${topic} long-form passes validator`, () => {
      const script = generateScript({ topic, durationSec: 360, format: 'long', language: 'en' });
      const result = validate(script);
      // Log any errors for debugging
      if (!result.passed) {
        console.error(`Validation failures for ${topic}:`, result.errors);
      }
      expect(result.passed).toBe(true);
    });
  });

  it('generated kafka short-form passes validator', () => {
    const script = generateScript({ topic: 'kafka', durationSec: 50, format: 'short', language: 'en' });
    const result = validate(script);
    expect(result.passed).toBe(true);
  });
});

// ─── Density gate tests ────────────────────────────────────────────────────────

describe('generateScript — density gate', () => {
  it('kafka long-form meets minimum density threshold', () => {
    const script = generateScript({ topic: 'kafka', durationSec: 360, format: 'long', language: 'en' });
    const report = measureDensity(script);
    expect(report.overall).toBeGreaterThanOrEqual(MIN_DENSITY);
    expect(report.passesShipGate).toBe(true);
  });

  it('system-design long-form meets minimum density threshold', () => {
    const script = generateScript({ topic: 'system-design', durationSec: 360, format: 'long', language: 'en' });
    const report = measureDensity(script);
    expect(report.passesShipGate).toBe(true);
  });
});

// ─── No banned phrases ────────────────────────────────────────────────────────

describe('generateScript — no banned phrases', () => {
  const BANNED = [
    'welcome back',
    "in today's video",
    'without further ado',
    'like and subscribe',
    'thanks for watching',
  ];

  it('kafka long-form contains no banned phrases', () => {
    const script = generateScript({ topic: 'kafka', durationSec: 360, format: 'long', language: 'en' });
    const fullText = script.segments.map((s) => s.text).join(' ').toLowerCase();
    BANNED.forEach((phrase) => {
      expect(fullText).not.toContain(phrase);
    });
  });

  it('redis short-form contains no banned phrases', () => {
    const script = generateScript({ topic: 'redis', durationSec: 50, format: 'short', language: 'en' });
    const fullText = script.segments.map((s) => s.text).join(' ').toLowerCase();
    BANNED.forEach((phrase) => {
      expect(fullText).not.toContain(phrase);
    });
  });
});

// ─── Segment output shape ──────────────────────────────────────────────────────

describe('generateScript — segment output shape', () => {
  it('every segment has required fields with correct types', () => {
    const script = generateScript({ topic: 'kafka', durationSec: 360, format: 'long', language: 'en' });
    script.segments.forEach((seg) => {
      expect(typeof seg.frameStart).toBe('number');
      expect(typeof seg.frameEnd).toBe('number');
      expect(typeof seg.timeStartSec).toBe('number');
      expect(typeof seg.timeEndSec).toBe('number');
      expect(typeof seg.text).toBe('string');
      expect(['HOOK', 'TENSION', 'TEACH', 'CTA']).toContain(seg.type);
      expect(typeof seg.brollHint).toBe('string');
      expect(typeof seg.audioHint).toBe('string');
      expect(typeof seg.wordCount).toBe('number');
      expect(seg.wordCount).toBeGreaterThan(0);
      // frameStart/End must align with timeStart/End at 30fps
      expect(seg.frameStart).toBe(Math.round(seg.timeStartSec * 30));
    });
  });

  it('frameEnd > frameStart for every segment', () => {
    const script = generateScript({ topic: 'redis', durationSec: 360, format: 'long', language: 'en' });
    script.segments.forEach((seg) => {
      expect(seg.frameEnd).toBeGreaterThan(seg.frameStart);
    });
  });
});
