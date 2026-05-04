import { describe, it, expect } from 'vitest';
import {
  buildWhooshExpr,
  WHOOSH_F0_HZ,
  WHOOSH_F1_HZ,
  WHOOSH_DUR_S,
  WHOOSH_K,
} from '../src/stock/composer.js';

// Panel-15 Eng P1 (Hashimoto): pure-function golden-string regression
// gate for the whoosh chirp expression. ffmpeg-free, deterministic, runs
// in <5ms. Catches any future drift in the WHOOSH_* constants or the
// expression template (e.g. operator-order accidents, escape-comma
// regressions) without needing a full render. Pairs with the existing
// 2x cold-cache mp4-sha determinism check enforced manually each batch.
describe('buildWhooshExpr (Panel-15 Eng P1 — Hashimoto golden gate)', () => {
  it('returns empty string when no boundaries supplied', () => {
    expect(buildWhooshExpr([], 30)).toBe('');
  });

  it('chirp constant k is provably (f1 - f0) / (2 * D)', () => {
    const expected = (WHOOSH_F1_HZ - WHOOSH_F0_HZ) / (2 * WHOOSH_DUR_S);
    expect(WHOOSH_K).toBe(expected);
    expect(WHOOSH_K).toBeCloseTo(16666.6667, 3);
  });

  it('instantaneous freq at delta=D resolves to f1 by phase-derivative math', () => {
    // f(Δ) = f0 + 2 * k * Δ ; at Δ = D should equal f1.
    const fAtEnd = WHOOSH_F0_HZ + 2 * WHOOSH_K * WHOOSH_DUR_S;
    expect(fAtEnd).toBeCloseTo(WHOOSH_F1_HZ, 6);
  });

  it('emits one term per boundary, escaped commas inside ffmpeg expr operators', () => {
    const expr = buildWhooshExpr([5.123, 12.456], 30);
    // Two additive terms.
    const termCount = (expr.match(/gte\(t\\,/g) ?? []).length;
    expect(termCount).toBe(2);
    // Boundary timestamps appear with 3-decimal precision.
    expect(expr).toContain('5.123');
    expect(expr).toContain('12.456');
    // Total duration in container, 3-decimal precision.
    expect(expr).toMatch(/:d=30\.000$/);
    // aevalsrc wrapper present, sample rate locked at 44100.
    expect(expr).toMatch(/^aevalsrc='/);
    expect(expr).toContain(':s=44100:');
    // Chirp coefficient surfaces with WHOOSH_K's 3-decimal repr.
    expect(expr).toContain(WHOOSH_K.toFixed(3));
  });

  it('byte-exact golden string for fixed-input determinism gate', () => {
    // Locked to detect any silent change in WHOOSH_* constants, term
    // template, or escape rules. Update only when intentional.
    const golden =
      "aevalsrc='" +
      'gte(t\\,3.500)*lt(t-3.500\\,0.180)*0.30*exp(-7*(t-3.500))*sin(2*PI*(1200+16666.667*(t-3.500))*(t-3.500))' +
      '+' +
      'gte(t\\,8.250)*lt(t-8.250\\,0.180)*0.30*exp(-7*(t-8.250))*sin(2*PI*(1200+16666.667*(t-8.250))*(t-8.250))' +
      "':s=44100:d=15.000";
    expect(buildWhooshExpr([3.5, 8.25], 15)).toBe(golden);
  });
});
