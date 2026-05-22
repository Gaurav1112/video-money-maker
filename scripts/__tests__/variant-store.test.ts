import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  writeVariantRecord,
  readPairedComparisons,
  pickWinningFormula,
} from '../lib/variant-store';

describe('writeVariantRecord', () => {
  it('writes <videoId>.json with the expected shape', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrec-'));
    writeVariantRecord(tmp, {
      videoId: 'abc',
      quizIndex: 0,
      variant: 'A',
      hookFormula: 'specific_stat',
      uploadedAt: '2026-05-21T00:00:00Z',
      siblingVideoId: 'def',
    });
    const written = JSON.parse(fs.readFileSync(path.join(tmp, 'abc.json'), 'utf8'));
    expect(written.variant).toBe('A');
    expect(written.hookFormula).toBe('specific_stat');
    expect(written.videoId).toBe('abc');
    expect(written.siblingVideoId).toBe('def');
  });
});

describe('readPairedComparisons', () => {
  it('returns empty for empty dirs', () => {
    const t1 = fs.mkdtempSync(path.join(os.tmpdir(), 'v-'));
    const t2 = fs.mkdtempSync(path.join(os.tmpdir(), 'a-'));
    expect(readPairedComparisons(t1, t2)).toEqual([]);
  });

  it('joins variants with analytics by videoId, pairs by quizIndex', () => {
    const vDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v-'));
    const aDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a-'));
    fs.writeFileSync(
      path.join(vDir, 'a1.json'),
      JSON.stringify({
        videoId: 'a1',
        quizIndex: 0,
        variant: 'A',
        hookFormula: 'specific_stat',
        uploadedAt: '',
        siblingVideoId: 'b1',
      })
    );
    fs.writeFileSync(
      path.join(vDir, 'b1.json'),
      JSON.stringify({
        videoId: 'b1',
        quizIndex: 0,
        variant: 'B',
        hookFormula: 'wrong_answer_first',
        uploadedAt: '',
        siblingVideoId: 'a1',
      })
    );
    fs.writeFileSync(
      path.join(aDir, 'a1.json'),
      JSON.stringify({ videoId: 'a1', averageViewPercentage: 80 })
    );
    fs.writeFileSync(
      path.join(aDir, 'b1.json'),
      JSON.stringify({ videoId: 'b1', averageViewPercentage: 60 })
    );
    const pairs = readPairedComparisons(vDir, aDir);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].a.completion).toBe(80);
    expect(pairs[0].b.completion).toBe(60);
  });
});

describe('pickWinningFormula', () => {
  it('returns null for <5 pairs', () => {
    expect(pickWinningFormula([])).toBeNull();
  });

  it('requires >=3pp margin to declare a winner', () => {
    const pairs = Array.from({ length: 5 }, () => ({
      quizIndex: 0,
      a: { formula: 'specific_stat' as const, completion: 70 },
      b: { formula: 'wrong_answer_first' as const, completion: 68 },
    }));
    expect(pickWinningFormula(pairs)).toBeNull(); // margin only 2pp
  });

  it('picks formula with >=3pp lead', () => {
    const pairs = Array.from({ length: 5 }, () => ({
      quizIndex: 0,
      a: { formula: 'specific_stat' as const, completion: 75 },
      b: { formula: 'wrong_answer_first' as const, completion: 65 },
    }));
    expect(pickWinningFormula(pairs)).toBe('specific_stat');
  });
});
