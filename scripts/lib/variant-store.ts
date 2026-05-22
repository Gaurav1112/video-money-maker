// Variant store: persists per-video metadata identifying which hook formula was
// used, and provides helpers to join variant records with analytics records to
// pick a winning hook formula.
//
// Constitution I: deterministic — sorts, medians, threshold are pure functions.
// No `Math.random`, no LLM calls, no network egress.

import * as fs from 'fs';
import * as path from 'path';
import type { HookFormula } from '../../src/lib/quiz-hook';

export interface VariantRecord {
  videoId: string;
  quizIndex: number;
  variant: 'A' | 'B';
  hookFormula: HookFormula;
  uploadedAt: string;
  siblingVideoId: string;
}

export interface AnalyticsRecord {
  videoId: string;
  averageViewPercentage?: number;
  views?: number;
}

export interface PairedComparison {
  quizIndex: number;
  a: { formula: HookFormula; completion: number };
  b: { formula: HookFormula; completion: number };
}

export function writeVariantRecord(dir: string, rec: VariantRecord): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${rec.videoId}.json`), JSON.stringify(rec, null, 2));
}

export function readPairedComparisons(
  variantDir: string,
  analyticsDir: string
): PairedComparison[] {
  if (!fs.existsSync(variantDir) || !fs.existsSync(analyticsDir)) return [];

  const variants: Record<string, VariantRecord> = {};
  for (const f of fs.readdirSync(variantDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const r = JSON.parse(fs.readFileSync(path.join(variantDir, f), 'utf8')) as VariantRecord;
      if (r.videoId) variants[r.videoId] = r;
    } catch {
      /* skip malformed */
    }
  }

  const analytics: Record<string, AnalyticsRecord> = {};
  for (const f of fs.readdirSync(analyticsDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const r = JSON.parse(fs.readFileSync(path.join(analyticsDir, f), 'utf8')) as AnalyticsRecord;
      if (r.videoId) analytics[r.videoId] = r;
    } catch {
      /* skip malformed */
    }
  }

  const byQuiz: Record<number, VariantRecord[]> = {};
  for (const r of Object.values(variants)) {
    (byQuiz[r.quizIndex] ??= []).push(r);
  }

  const pairs: PairedComparison[] = [];
  for (const [quizIndex, group] of Object.entries(byQuiz)) {
    const a = group.find((g) => g.variant === 'A');
    const b = group.find((g) => g.variant === 'B');
    if (!a || !b) continue;
    const aMetric = analytics[a.videoId]?.averageViewPercentage;
    const bMetric = analytics[b.videoId]?.averageViewPercentage;
    if (aMetric === undefined || bMetric === undefined) continue;
    pairs.push({
      quizIndex: Number(quizIndex),
      a: { formula: a.hookFormula, completion: aMetric },
      b: { formula: b.hookFormula, completion: bMetric },
    });
  }
  return pairs;
}

const MARGIN_THRESHOLD_PP = 3;
const MIN_PAIRS = 5;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface FormulaSummary {
  formula: HookFormula;
  nVideos: number;
  medianCompletion: number;
}

export function summarizeByFormula(pairs: PairedComparison[]): FormulaSummary[] {
  const byFormula: Record<string, number[]> = {};
  for (const p of pairs) {
    (byFormula[p.a.formula] ??= []).push(p.a.completion);
    (byFormula[p.b.formula] ??= []).push(p.b.completion);
  }
  return Object.entries(byFormula)
    .map(([f, ns]) => ({
      formula: f as HookFormula,
      nVideos: ns.length,
      medianCompletion: median(ns),
    }))
    .sort((x, y) => y.medianCompletion - x.medianCompletion);
}

export function pickWinningFormula(pairs: PairedComparison[]): HookFormula | null {
  if (pairs.length < MIN_PAIRS) return null;
  const medians = summarizeByFormula(pairs);
  if (medians.length < 2) return null;
  if (medians[0].medianCompletion - medians[1].medianCompletion < MARGIN_THRESHOLD_PP) {
    return null;
  }
  return medians[0].formula;
}

export const VARIANT_CONSTANTS = {
  MARGIN_THRESHOLD_PP,
  MIN_PAIRS,
};
