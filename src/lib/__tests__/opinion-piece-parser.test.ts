import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseOpinionPiece,
  OpinionParserError,
  buildNarrationPlan,
} from '../opinion-piece-parser';

const EPISODE_001_PATH = path.resolve(
  __dirname,
  '../../../content/opinions/001-microservices-vs-monolith.md'
);

function readEpisode001(): string {
  return fs.readFileSync(EPISODE_001_PATH, 'utf-8');
}

describe('opinion-piece-parser', () => {
  it('parses Episode 001 end-to-end with all seven sections populated', () => {
    const md = readEpisode001();
    const piece = parseOpinionPiece(md, '001-fallback');

    expect(piece.title).toBe('Are Microservices Killing Customer Experience?');
    expect(piece.slug).toBe('001-microservices-vs-monolith');
    expect(piece.publishDate).toBe('2026-05-21');
    expect(piece.durationSec).toBe(600);
    expect(piece.hook.length).toBeGreaterThan(20);
    expect(piece.thenNow.thenLines.length).toBeGreaterThanOrEqual(3);
    expect(piece.thenNow.nowLines.length).toBeGreaterThanOrEqual(3);
    expect(piece.pros.length).toBe(5);
    expect(piece.cons.length).toBeGreaterThanOrEqual(6);
    expect(piece.pivot.length).toBeGreaterThan(20);
    expect(piece.lesson.length).toBeGreaterThan(20);
    expect(piece.question).toBeDefined();
    expect(piece.question!.length).toBeGreaterThan(20);
  });

  it('throws OpinionParserError naming the missing section when ## Pivot is absent', () => {
    const md = readEpisode001().replace(/^## Pivot[\s\S]*?^## Lesson/m, '## Lesson');
    expect(() => parseOpinionPiece(md, 's')).toThrowError(/Pivot/);
    try {
      parseOpinionPiece(md, 's');
    } catch (e) {
      expect(e).toBeInstanceOf(OpinionParserError);
      expect((e as OpinionParserError).section).toBe('Pivot');
    }
  });

  it('returns undefined `question` when ## Question section is absent', () => {
    const md = readEpisode001().replace(/^## Question[\s\S]*$/m, '');
    const piece = parseOpinionPiece(md, 's');
    expect(piece.question).toBeUndefined();
  });

  it('uses fallbackSlug when frontmatter slug is missing', () => {
    const md = readEpisode001().replace(/^slug:.*$/m, '');
    const piece = parseOpinionPiece(md, 'fallback-slug-xyz');
    expect(piece.slug).toBe('fallback-slug-xyz');
  });

  it('routes Then-vs-Now lines into the correct bucket', () => {
    const md = readEpisode001();
    const piece = parseOpinionPiece(md, 's');
    expect(piece.thenNow.thenLines.some((l) => /simple flow/i.test(l))).toBe(true);
    expect(piece.thenNow.nowLines.some((l) => /apps are smarter/i.test(l))).toBe(true);
    // No leakage across buckets
    expect(piece.thenNow.thenLines.some((l) => /apps are smarter/i.test(l))).toBe(false);
  });

  it('extracts Pros bullets without the ✅ marker', () => {
    const md = readEpisode001();
    const piece = parseOpinionPiece(md, 's');
    expect(piece.pros).toContain('Independent scaling');
    expect(piece.pros).toContain('Team autonomy');
    // Markers must be stripped
    expect(piece.pros.some((p) => p.includes('✅'))).toBe(false);
  });

  it('builds a narration plan with one entry per major section (incl. question)', () => {
    const md = readEpisode001();
    const piece = parseOpinionPiece(md, 's');
    const plan = buildNarrationPlan(piece);
    expect(plan.length).toBe(7);
    expect(plan.map((p) => p.type)).toEqual([
      'hook',
      'then-now',
      'pros',
      'cons',
      'pivot',
      'lesson',
      'question',
    ]);
    // Narration should contain no emojis
    for (const scene of plan) {
      expect(scene.narration).not.toMatch(/[✅❌➡️⚡🎯😊💡🍕]/u);
    }
  });
});
