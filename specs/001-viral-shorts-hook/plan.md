# Implementation Plan: Viral Shorts Hook A/B Test

**Branch**: `001-viral-shorts-hook` | **Date**: 2026-05-21 | **Spec**: `./spec.md`

## Tech Stack

- **Composition**: Existing `src/compositions/QuizShort.tsx` — accepts a new `hookFormula` prop.
- **Hook formulas**: Existing `src/lib/quiz-hook.ts` — already exports `getSpecificHook`, `getWrongAnswerHook`, and `pickHook`. We add `getCompanyDramaticHook` (the existing fallback in `getSpecificHook` extracted into a named function) and a typed `HookFormula` enum.
- **Render orchestrator**: Existing `scripts/render-daily-short.ts` — loop twice over `['specific_stat', 'wrong_answer_first']` (or 1× if locked-in winner), passing each formula as a prop. Output filenames suffixed `-variantA.mp4` / `-variantB.mp4`.
- **Variant metadata**: New `scripts/lib/variant-store.ts` — pure helpers `writeVariantRecord(videoId, record)`, `readPairedComparisons()`, `pickWinningFormula(comparisons)`.
- **Upload**: Existing `scripts/upload-youtube.ts` — already takes `--thumbnail`, `--captions`, `--first-comment` flags. Add `--variant-record <path>` flag that writes the variant JSON post-upload.
- **CI workflow**: Existing `.github/workflows/auto-shorts.yml` — modify the render+upload step to loop twice; add `force_formula` workflow_dispatch input.
- **Analytics**: Existing `scripts/weekly-report.ts` — read `data/variants/*.json` AND `data/analytics/*.json`, JOIN by videoId, produce per-formula comparison table.

No new runtime dependencies. No new external services. No new secrets.

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/lib/quiz-hook.ts` | Modify | Add `HookFormula` type. Extract `getCompanyDramaticHook`. Add `applyHook(quiz, formula)` returning `{ hookText, spokenHook }`. |
| `src/compositions/QuizShort.tsx` | Modify | Accept `hookFormula?: HookFormula` prop. Use `applyHook()` instead of inline `pickHook()` call. |
| `src/compositions/QuizThumbnail.tsx` | Modify | Same prop; thumbnail uses the same formula so the thumbnail matches the video. |
| `src/compositions/index.tsx` | Modify | Pass `hookFormula` through `calculateMetadata` chain. |
| `scripts/lib/variant-store.ts` | **Create** | Pure helpers + types for variant records, pair-joins, winner-pick logic. |
| `scripts/lib/__tests__/variant-store.test.ts` | **Create** | Vitest TDD: 4 tests (empty case, single pair, 5+ pairs with clear winner, 5+ pairs with tie). |
| `scripts/render-daily-short.ts` | Modify | Render twice (one per formula) unless a winner is locked. Pass `hookFormula` to props. |
| `scripts/upload-youtube.ts` | Modify | Add `--variant-record` flag that writes `data/variants/<videoId>.json` after upload succeeds. |
| `scripts/weekly-report.ts` | Modify | Add per-formula comparison table at the bottom of the Markdown output. |
| `.github/workflows/auto-shorts.yml` | Modify | Loop render+upload twice; pass variant suffix; commit `data/variants/` updates. Add `force_formula` workflow_dispatch input. |
| `data/variants/.gitkeep` | **Create** | Persist directory in git. |

## Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│  scripts/render-daily-short.ts                                        │
│                                                                       │
│  1. pick quiz (by day-of-year or --short N)                           │
│  2. lockedWinner = pickWinningFormula(variantStore, analytics)        │
│  3. formulas = lockedWinner ? [lockedWinner] : ['specific_stat',     │
│                                                  'wrong_answer_first']│
│  4. for each formula:                                                │
│      - applyHook(quiz, formula) → { hookText, spokenHook }           │
│      - render MP4 with hookFormula prop                              │
│      - render thumbnail                                              │
│      - emit SRT                                                       │
└──────────────────────────┬────────────────────────────────────────────┘
                           ▼
┌───────────────────────────────────────────────────────────────────────┐
│  scripts/upload-youtube.ts                                            │
│  per variant:                                                         │
│    - upload mp4 + thumbnail + captions + first comment                │
│    - writeVariantRecord(videoId, { quizIndex, variant, hookFormula }) │
└──────────────────────────┬────────────────────────────────────────────┘
                           ▼
                   data/variants/<videoId>.json
                           │
                           ▼
┌───────────────────────────────────────────────────────────────────────┐
│  .github/workflows/analytics.yml (daily)                              │
│  scripts/channel-inventory.ts → list all channel videos               │
│  scripts/ingest-analytics.ts → fetch completion%/AVD per video        │
│  scripts/weekly-report.ts → join variants + analytics, print          │
│     per-formula table                                                 │
└──────────────────────────┬────────────────────────────────────────────┘
                           ▼
                  data/analytics/<videoId>.json
                           │
                           ▼
              Next render reads both directories and either
              keeps A/B testing or picks a winner (≥3pp margin).
```

## Approach

### Why this approach

- **Reuses existing infrastructure**: every component already exists. The change is plumbing variant identity through them.
- **Constitution-clean**: deterministic, no LLM, no new secrets, single-path pipeline, branch-per-feature.
- **Reversible**: a `force_formula=specific_stat` workflow_dispatch input lets the operator pin to one formula immediately if the A/B causes problems.
- **Cost-bounded**: 9 min total render (TTS caching of shared narration), ~3200 quota units/day (under 4k limit), 2 uploads/day.

### Alternatives considered and rejected

- **Render once, post twice with different titles**: violates spec — only the hook differs between variants, so the visual + audio must differ. Same MP4 with different titles is not an A/B on hook formula.
- **Use YouTube's native experiments (Studio → Experiments tab)**: requires Premium subscriber count threshold the channel doesn't meet yet (need ~1k subscribers per Google docs).
- **Random selection** (`Math.random() < 0.5 ? A : B`): violates Constitution I. Must be deterministic.
- **A/B at thumbnail level instead of hook**: hook drives retention (the constitution's primary metric); thumbnail drives CTR. We test the higher-leverage variable first.

## Constitution Check (Pre-Implementation)

| Principle | Compliant? | Note |
|---|---|---|
| I. Deterministic Everything | ✅ | All hook formulas are pure transforms. No `Math.random`. |
| II. All-Local, Offline-First | ✅ | No new network egress. |
| III. Automation Over Manual | ✅ | Runs in existing cron. |
| IV. Measure Before You Optimize | ✅ | This IS the measurement loop. |
| V. Subtraction Before Addition | ⚠️ | Adds a render loop (more compute) but the goal is to subtract the LOSING formula once data exists. Net zero long-term. |
| VI. Indian Voice + AI Avatar | ✅ | Both variants identical except hook. |
| VII. Render-Preview-Before-Full | N/A | Shorts. |
| VIII. Single-Path Pipelines | ✅ | One render-daily-short orchestrator produces both variants. |
| IX. Secret Hygiene | ✅ | No new secrets. |
| X. Branch-Per-Feature | ✅ | `001-viral-shorts-hook`. |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Both formulas produce same hook text for some quizzes | Medium | Wasted upload (two identical videos) | `applyHook` detects collision and falls back to `company_dramatic` for variant B |
| Analytics API still disabled when winner-pick fires | High (operator action pending) | Winner-pick returns `null` → keep A/B | Already handled by spec (FR-006 returns null on insufficient data) |
| YouTube quota exhaustion (3200/10000 daily) | Low | Second upload fails | Workflow continues; first upload still live (FR-008) |
| Render time blows past 12 min | Low | CI timeout | TTS caches shared segment; if still slow, gate the second render behind a separate workflow step with own timeout |
| Operator pushes `force_formula=specific_stat` and forgets, locking in suboptimal formula | Medium | Lost data days | Workflow logs the override on every run; weekly report flags "FORCED" mode |

## Testing Strategy

- **Unit (TDD)**: `scripts/lib/__tests__/variant-store.test.ts` covers `writeVariantRecord`, `readPairedComparisons`, `pickWinningFormula` (4 tests minimum).
- **Integration**: dry-run `npx tsx scripts/render-daily-short.ts --short 0 --dry-run` prints both formula's hook text without rendering.
- **End-to-end**: trigger `auto-shorts.yml` via `workflow_dispatch`; expect 2 uploads + 2 variant JSONs committed within 12 minutes.
- **Constitution drift**: `tests/constitution.test.ts` (deferred — part of harness hardening) will eventually grep for `Math.random` in `src/**`. Not blocking this feature.

## Migration / Rollout

- This is additive. No data migration. Old single-variant uploads continue to work (their videos lack a variant record; weekly report skips them).
- The first A/B-tagged uploads start with the next cron run after merge.
- Rollback: revert the auto-shorts.yml workflow change (one-line revert of the loop). Render pipeline still produces a working Short with the default formula.

## Open Questions

None. Proceed to `/speckit-tasks`.
