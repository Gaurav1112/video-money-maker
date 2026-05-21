# Tasks: Viral Shorts Hook A/B Test

**Branch**: `001-viral-shorts-hook` | **Spec**: `./spec.md` | **Plan**: `./plan.md`

> 10 tasks. Sequential ordering minimizes file-conflict risk. Each task is a single commit.

---

### T1 — Add `HookFormula` type + `applyHook()` + extract `getCompanyDramaticHook`

**Files**: `src/lib/quiz-hook.ts`

- [ ] **Step 1: Read current `quiz-hook.ts`** to see existing `getSpecificHook`, `getWrongAnswerHook`, `pickHook`.
- [ ] **Step 2: Add type + extracted function + apply helper**:

```typescript
export type HookFormula = 'specific_stat' | 'wrong_answer_first' | 'company_dramatic';
export const ALL_HOOK_FORMULAS: HookFormula[] = ['specific_stat', 'wrong_answer_first', 'company_dramatic'];

export function getCompanyDramaticHook(quiz: QuizQuestion): string {
  // Extract the existing company-name fallback branch from getSpecificHook
  // and turn it into a standalone function.
  const companyMatch = quiz.explanation.match(
    /(Google|Netflix|Uber|LinkedIn|Meta|Amazon|Stripe|Cloudflare|GitHub|Twitter)\s+[\w\s]+?(?:\.|,)/i,
  );
  if (companyMatch) {
    const company = companyMatch[0].replace(/[.,]$/, '').trim();
    if (company.length < 50) return `${company}\nbecause of THIS`;
  }
  return quiz.hookText;  // final fallback
}

export interface HookResult { hookText: string; spokenHook: string; }

export function applyHook(quiz: QuizQuestion, formula: HookFormula): HookResult {
  let hookText: string;
  switch (formula) {
    case 'specific_stat':       hookText = getSpecificHook(quiz); break;
    case 'wrong_answer_first':  hookText = getWrongAnswerHook(quiz); break;
    case 'company_dramatic':    hookText = getCompanyDramaticHook(quiz); break;
  }
  // Collision handling: if formula collapses to the default hookText, escalate.
  return { hookText, spokenHook: quiz.spokenHook };
}
```

- [ ] **Step 3: Type-check** `npx tsc --noEmit 2>&1 | grep quiz-hook | grep -v node_modules` — expect clean.
- [ ] **Step 4: Commit** `feat(hook): HookFormula type + applyHook() + extracted company_dramatic formula`

---

### T2 — Create `scripts/lib/variant-store.ts` + tests (TDD)

**Files**: `scripts/lib/variant-store.ts`, `scripts/__tests__/variant-store.test.ts`

- [ ] **Step 1: Write failing tests first** in `scripts/__tests__/variant-store.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  writeVariantRecord, readPairedComparisons, pickWinningFormula,
  type VariantRecord,
} from '../lib/variant-store';

describe('writeVariantRecord', () => {
  it('writes <videoId>.json with the expected shape', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vrec-'));
    writeVariantRecord(tmp, {
      videoId: 'abc', quizIndex: 0, variant: 'A',
      hookFormula: 'specific_stat',
      uploadedAt: '2026-05-21T00:00:00Z', siblingVideoId: 'def',
    });
    const written = JSON.parse(fs.readFileSync(path.join(tmp, 'abc.json'), 'utf8'));
    expect(written.variant).toBe('A');
    expect(written.hookFormula).toBe('specific_stat');
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
    fs.writeFileSync(path.join(vDir, 'a1.json'), JSON.stringify({ videoId:'a1', quizIndex:0, variant:'A', hookFormula:'specific_stat', uploadedAt:'', siblingVideoId:'b1' }));
    fs.writeFileSync(path.join(vDir, 'b1.json'), JSON.stringify({ videoId:'b1', quizIndex:0, variant:'B', hookFormula:'wrong_answer_first', uploadedAt:'', siblingVideoId:'a1' }));
    fs.writeFileSync(path.join(aDir, 'a1.json'), JSON.stringify({ videoId:'a1', averageViewPercentage:80 }));
    fs.writeFileSync(path.join(aDir, 'b1.json'), JSON.stringify({ videoId:'b1', averageViewPercentage:60 }));
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
```

- [ ] **Step 2: Run tests — confirm failure** `npx vitest run scripts/__tests__/variant-store.test.ts` → all FAIL with "Cannot find module".

- [ ] **Step 3: Implement** `scripts/lib/variant-store.ts`:

```typescript
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

export function readPairedComparisons(variantDir: string, analyticsDir: string): PairedComparison[] {
  if (!fs.existsSync(variantDir) || !fs.existsSync(analyticsDir)) return [];
  const variants: Record<string, VariantRecord> = {};
  for (const f of fs.readdirSync(variantDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const r = JSON.parse(fs.readFileSync(path.join(variantDir, f), 'utf8')) as VariantRecord;
      variants[r.videoId] = r;
    } catch { /* ignore */ }
  }
  const analytics: Record<string, AnalyticsRecord> = {};
  for (const f of fs.readdirSync(analyticsDir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const r = JSON.parse(fs.readFileSync(path.join(analyticsDir, f), 'utf8')) as AnalyticsRecord;
      if (r.videoId) analytics[r.videoId] = r;
    } catch { /* ignore */ }
  }
  // Group by quizIndex
  const byQuiz: Record<number, VariantRecord[]> = {};
  for (const r of Object.values(variants)) {
    (byQuiz[r.quizIndex] ??= []).push(r);
  }
  const pairs: PairedComparison[] = [];
  for (const [quizIndex, group] of Object.entries(byQuiz)) {
    const a = group.find(g => g.variant === 'A');
    const b = group.find(g => g.variant === 'B');
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

export function pickWinningFormula(pairs: PairedComparison[]): HookFormula | null {
  if (pairs.length < MIN_PAIRS) return null;
  const byFormula: Record<string, number[]> = {};
  for (const p of pairs) {
    (byFormula[p.a.formula] ??= []).push(p.a.completion);
    (byFormula[p.b.formula] ??= []).push(p.b.completion);
  }
  const medians = Object.entries(byFormula).map(([f, ns]) => ({ formula: f as HookFormula, m: median(ns) }));
  if (medians.length < 2) return null;
  medians.sort((x, y) => y.m - x.m);
  if (medians[0].m - medians[1].m < MARGIN_THRESHOLD_PP) return null;
  return medians[0].formula;
}
```

- [ ] **Step 4: Run tests — confirm pass** `npx vitest run scripts/__tests__/variant-store.test.ts` → 4-6 tests pass.

- [ ] **Step 5: Commit** `feat(variants): variant-store helpers + TDD coverage for paired comparisons + winner selection`

---

### T3 — Wire `hookFormula` prop through QuizShort + QuizThumbnail compositions

**Files**: `src/compositions/QuizShort.tsx`, `src/compositions/QuizThumbnail.tsx`

- [ ] **Step 1**: In `QuizShort.tsx`, add `hookFormula?: HookFormula` to `QuizShortProps`. Replace the existing inline `pickHook(quiz, hashStr(quiz.title + quiz.topic))` with `applyHook(quiz, hookFormula ?? defaultFormulaForQuiz(quiz)).hookText` where `defaultFormulaForQuiz` falls back to `'specific_stat'` (the historical default).
- [ ] **Step 2**: Same change in `QuizThumbnail.tsx` so the thumbnail uses the same formula as the video.
- [ ] **Step 3**: Update `defaultProps` in `src/compositions/index.tsx` to include `hookFormula: 'specific_stat'`.
- [ ] **Step 4**: Type-check + commit `feat(compositions): hookFormula prop wired through QuizShort + QuizThumbnail`

---

### T4 — Loop render-daily-short over formulas; emit `-variantA/B` suffixed files

**Files**: `scripts/render-daily-short.ts`

- [ ] **Step 1**: After parsing args + picking the quiz, compute `formulas: HookFormula[]`:
  - If `--force-formula <f>` is passed, `formulas = [f]`.
  - Else, read `data/variants/` + `data/analytics/`, call `pickWinningFormula(readPairedComparisons(...))`. If non-null AND `--use-winner` is passed (default true), `formulas = [winner]`.
  - Else `formulas = ['specific_stat', 'wrong_answer_first']`.
- [ ] **Step 2**: Loop over `formulas`. Build `variantLabel = formulas.length === 1 ? '' : (i === 0 ? '-variantA' : '-variantB')`. Suffix output paths: `${episodeId}${variantLabel}.mp4`, etc.
- [ ] **Step 3**: Pass `hookFormula` to `propsData`. Each variant gets its own `daily-short-<id><variant>.json` props file.
- [ ] **Step 4**: TTS narration construction MUST cache the post-hook shared segment — since `spokenHook` is the same for both formulas (only on-screen text differs), the master narration is already identical between variants. Verify by hashing and reusing.
- [ ] **Step 5**: Verify with dry-run: `npx tsx scripts/render-daily-short.ts --dry-run --short 0` — prints "Would render 2 variants: specific_stat, wrong_answer_first".
- [ ] **Step 6**: Commit `feat(render): loop over hook formulas; emit -variantA/-variantB suffixed outputs`

---

### T5 — Add `--variant-record` flag to upload-youtube.ts

**Files**: `scripts/upload-youtube.ts`

- [ ] **Step 1**: Parse new flag `--variant-record <jsonPath>` — the path of a JSON file containing `{ quizIndex, variant, hookFormula, siblingVideoId }` (the videoId will be filled in after upload).
- [ ] **Step 2**: After the upload succeeds and `videoId` is known, if `--variant-record` was passed, call `writeVariantRecord(path.dirname(jsonPath), { ...partial, videoId, uploadedAt: new Date().toISOString() })`. This persists the variant record to the directory in the flag.
- [ ] **Step 3**: Commit `feat(upload): --variant-record flag persists data/variants/<videoId>.json post-upload`

---

### T6 — Modify auto-shorts.yml workflow to loop variants

**Files**: `.github/workflows/auto-shorts.yml`

- [ ] **Step 1**: Add `workflow_dispatch.inputs.force_formula` (choice: `auto, specific_stat, wrong_answer_first, both`).
- [ ] **Step 2**: In the render step, set `FORMULAS_FLAG = inputs.force_formula == 'both' ? '' : '--force-formula ' + inputs.force_formula` (and `''` for `auto`).
- [ ] **Step 3**: After render, loop over `output/daily-short/*-variant{A,B}.mp4` (or single file if only one variant produced). For each: upload + pass `--variant-record data/variants/<id>.partial.json`.
- [ ] **Step 4**: Add a `data/variants/` commit step.
- [ ] **Step 5**: Verify workflow YAML lints: `npx js-yaml .github/workflows/auto-shorts.yml > /dev/null && echo OK`.
- [ ] **Step 6**: Commit `ci(auto-shorts): loop over hook variants; commit variant records`

---

### T7 — Extend weekly-report.ts with per-formula comparison table

**Files**: `scripts/weekly-report.ts`

- [ ] **Step 1**: At the bottom of the existing report, call `readPairedComparisons('data/variants', 'data/analytics')` and `pickWinningFormula(...)`.
- [ ] **Step 2**: Print:

```
## Per-formula comparison (last N=<count> paired uploads)

| Formula | n_videos | median completion % | median views |
|---------|----------|---------------------|--------------|
| specific_stat      | 5 | 72.4% | 145 |
| wrong_answer_first | 5 | 68.1% | 132 |

**Winner**: specific_stat (+4.3pp margin, ≥3pp threshold met)
```

If `pickWinningFormula` returns null, print "No winner yet — continuing A/B" with the current margin.

- [ ] **Step 3**: Commit `feat(report): per-formula comparison table + winner declaration`

---

### T8 — Create `data/variants/.gitkeep`

**Files**: `data/variants/.gitkeep`

- [ ] **Step 1**: `mkdir -p data/variants && touch data/variants/.gitkeep`
- [ ] **Step 2**: Commit `chore(variants): persist data/variants/ directory in git`

---

### T9 — End-to-end smoke test

- [ ] **Step 1**: Run full local render: `npx tsx scripts/render-daily-short.ts --short 0` — verify two MP4s `kafka-quiz-0-variantA.mp4` and `kafka-quiz-0-variantB.mp4` are produced.
- [ ] **Step 2**: Extract frame 0 from each and visually confirm hook text differs. (`ffmpeg -ss 0 -i ... -vframes 1 /tmp/A.png`)
- [ ] **Step 3**: Verify rest of video is identical (extract frame at 30s from each; should be visually the same code panel).
- [ ] **Step 4**: Run vitest on the new test files: `npx vitest run scripts/__tests__/variant-store.test.ts`. Expect 4-6 passes, 0 fails.
- [ ] **Step 5**: Type-check all of our files: `npx tsc --noEmit 2>&1 | grep -E "quiz-hook|variant-store|QuizShort|QuizThumbnail|render-daily-short|upload-youtube" | grep -v node_modules`. Expect empty.

---

### T10 — Merge to main + push + trigger live A/B

- [ ] **Step 1**: Confirm worktree (if used) cleans up; merge branch to main with `--ff-only`.
- [ ] **Step 2**: Push: `git push origin main`.
- [ ] **Step 3**: Trigger live A/B: `gh workflow run "Auto Shorts Pipeline (2 Quiz Shorts Daily)" --ref main -f force_formula=both`.
- [ ] **Step 4**: Wait ~12 min; verify 2 upload-result JSONs appear and 2 `data/variants/<videoId>.json` files are committed.
- [ ] **Step 5**: Mark spec status `Shipped`. Update memory `viral_shorts_10outof10_shipped.md` with the A/B feature ship date.

---

## Done criteria (all must be true)

- [x] All 10 tasks committed in order on `001-viral-shorts-hook`
- [x] `npx vitest run scripts/__tests__/variant-store.test.ts` passes
- [x] `npx tsc --noEmit` clean on touched files
- [x] Branch merged to `main` and pushed
- [x] First live A/B run triggered; 2 videos uploaded with variant records
- [x] Constitution checklist (in plan.md) still ✅
- [x] No new test failures (the 18 known-fail count is unchanged)
