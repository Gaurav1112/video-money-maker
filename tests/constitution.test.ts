/**
 * tests/constitution.test.ts — Constitution drift suite (Feature 008)
 *
 * Makes `.specify/memory/constitution.md` machine-enforced. The suite
 * scans the source tree for forbidden patterns and fails CI if any new
 * one appears. Known, accepted violations live in a VISIBLE allowlist
 * below — each entry carries an explicit reason. Nothing is silently
 * passed: if a file is on the allowlist, it is named here in plain sight.
 *
 * Enforced principles:
 *   - Principle I  (Deterministic): no real `Math.random()` in src/**.
 *   - Principle VI (Indian Voice): no `en-US-` voice ids in src/** + scripts/**.
 *   - Principle VI (Avatar): no KumarGaurav.jpg / guru-avatar-large.jpg
 *                            references in src/compositions/**.
 *
 * Run: npx vitest run tests/constitution.test.ts
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

/** Recursively collect files under `dir` whose name matches `exts`. */
function collect(dir: string, exts: string[]): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...collect(rel, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(rel);
    }
  }
  return out;
}

/** True if the file is a test / fixture file (legitimately mentions forbidden strings). */
function isTestFile(rel: string): boolean {
  return (
    rel.includes('.test.') ||
    rel.includes('.spec.') ||
    rel.includes('__tests__') ||
    rel.includes('/tests/') ||
    rel.startsWith('tests/')
  );
}

/** Strip `//` line comments and block comments so only real code is matched. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

// ─────────────────────────────────────────────────────────────────────────
// VISIBLE ALLOWLIST — known, accepted constitution deviations.
// Every entry is a real finding from Feature 008's initial scan. Adding a
// file here is a deliberate, reviewed act; the `reason` must justify it.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Principle VI — `en-US-` voice identifiers.
 *
 * These files reference American-English Edge TTS voices. They are NOT in
 * the video render path that produces published Indian-voice content:
 *  - tts-engine.ts keeps en-US ids only as labelled non-default map entries;
 *    the default remains en-IN-PrabhatNeural (Principle VI compliant).
 *  - the debate / trend / challenge generators are experimental two-voice
 *    Shorts tooling not yet on the published pipeline.
 * Accepted as known deviations; tracked for follow-up. New `en-US-`
 * references in any OTHER file will fail this suite.
 */
const EN_US_ALLOWLIST: string[] = [
  'src/pipeline/tts-engine.ts', // constitution-allowlist: non-default labelled voice-map entries; default stays en-IN-PrabhatNeural
  'scripts/debate-generator.ts', // constitution-allowlist: experimental two-voice debate tool, not on published pipeline
  'scripts/trend-detector.ts', // constitution-allowlist: experimental trend Shorts tool, not on published pipeline
  'scripts/challenge-generator.ts', // constitution-allowlist: experimental challenge Shorts tool, not on published pipeline
];

/** Principle I — real `Math.random()` calls. No accepted violations. */
const MATH_RANDOM_ALLOWLIST: string[] = [];

/** Principle VI — raw-photo avatar refs in compositions. No accepted violations. */
const AVATAR_ALLOWLIST: string[] = [];

// ─────────────────────────────────────────────────────────────────────────

describe('Constitution drift — Principle I (Deterministic Everything)', () => {
  it('no real Math.random() call appears in src/**', () => {
    const files = collect('src', ['.ts', '.tsx']).filter((f) => !isTestFile(f));
    const violations: string[] = [];
    for (const rel of files) {
      const code = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      if (/Math\s*\.\s*random\s*\(/.test(code) && !MATH_RANDOM_ALLOWLIST.includes(rel)) {
        violations.push(rel);
      }
    }
    expect(violations, `Math.random() found in: ${violations.join(', ')}`).toEqual([]);
  });
});

describe('Constitution drift — Principle VI (Indian Voice)', () => {
  it('no en-US- voice identifier appears in src/** or scripts/**', () => {
    const files = [...collect('src', ['.ts', '.tsx']), ...collect('scripts', ['.ts'])].filter(
      (f) => !isTestFile(f)
    );
    const violations: string[] = [];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      if (src.includes('en-US-') && !EN_US_ALLOWLIST.includes(rel)) {
        violations.push(rel);
      }
    }
    expect(
      violations,
      `en-US- voice id found in non-allowlisted files: ${violations.join(', ')}`
    ).toEqual([]);
  });
});

describe('Constitution drift — Principle VI (AI Avatar)', () => {
  it('no raw-photo avatar reference appears in src/compositions/**', () => {
    const files = collect('src/compositions', ['.ts', '.tsx']).filter((f) => !isTestFile(f));
    const violations: string[] = [];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      if (
        (src.includes('KumarGaurav.jpg') || src.includes('guru-avatar-large.jpg')) &&
        !AVATAR_ALLOWLIST.includes(rel)
      ) {
        violations.push(rel);
      }
    }
    expect(
      violations,
      `raw-photo avatar reference found in: ${violations.join(', ')}`
    ).toEqual([]);
  });
});
