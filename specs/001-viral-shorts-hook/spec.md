# Feature Specification: Viral Shorts Hook A/B Test

**Feature Branch**: `001-viral-shorts-hook`

**Created**: 2026-05-21

**Status**: Draft

**Input**: User description: "viral shorts hook A/B test — render two hook variants per quiz, upload both, pick winner from 48h analytics"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Render and upload two hook variants per daily quiz (Priority: P1)

When the daily auto-shorts cron fires, the pipeline picks the day's quiz, renders **two** versions of the same Short that differ ONLY in their opening 3 seconds (the hook). Both videos are uploaded to YouTube. Title and description are tagged so we can later identify which is variant A and which is variant B.

**Why this priority**: Hooks are the #1 driver of completion rate. Today we ship one hook per quiz and never learn which formula lands better. A/B at the hook level is the smallest viable bet that produces a usable learning signal per day. Without it, every other "viral" lever is guessing.

**Independent Test**: Trigger the cron manually with a specific quiz index. Verify two MP4s land in `output/daily-short/` with suffixes `-variantA.mp4` and `-variantB.mp4`. Verify both upload-result JSONs exist and reference distinct YouTube video IDs. Watch both in the channel — they should be visually identical except for the hook block.

**Acceptance Scenarios**:

1. **Given** the daily cron fires at 1:15 PM IST, **When** quiz N is selected, **Then** two MP4s are rendered (variant A using the "specific stat" hook formula, variant B using the "wrong-answer-first" hook formula) AND both are uploaded to YouTube as public Shorts AND both upload-result JSONs are committed.
2. **Given** a quiz has a populated `codeSnippet` field, **When** both variants render, **Then** the code panel, explanation beats, worked example, and end CTA are byte-identical between the two videos — only the first 3 seconds differs.
3. **Given** the upload step finishes, **When** the daily auto-comment fires, **Then** both videos receive an auto-pinned first comment with the same `endQuestion` text.

---

### User Story 2 — Tag each uploaded variant so analytics can compare them (Priority: P1)

Every uploaded variant carries machine-readable metadata identifying its hook formula. The metadata lives in three places: (a) a custom hashtag in the description (e.g., `#hookA_specific_stat` / `#hookB_wrong_answer_first`), (b) a `data/variants/<videoId>.json` file committed alongside the upload, (c) the upload-result JSON's filename. Analytics ingestion reads variant tags and emits a comparison report.

**Why this priority**: A/B without identification is noise. The learning signal only exists if we can attribute completion rate, AVD, and comments to a specific hook formula.

**Independent Test**: After variants upload, the file `data/variants/<videoId>.json` exists with fields `{videoId, quizIndex, variant: "A" | "B", hookFormula: string, uploadedAt: string}`. The weekly report reads these files and prints per-formula medians.

**Acceptance Scenarios**:

1. **Given** variant A uploads successfully, **When** the upload-youtube step completes, **Then** `data/variants/<videoIdA>.json` is written with `variant: "A"` and `hookFormula: "specific_stat"`.
2. **Given** both variants are 48h old AND analytics has ingested them, **When** the weekly report runs, **Then** it prints a side-by-side comparison: hookFormula | n_videos | median completion % | median views.

---

### User Story 3 — Feed the winning formula back into the next render (Priority: P2)

After at least 5 paired uploads (10 videos total), the render script reads recent analytics and the next render uses the formula that has the higher median completion rate among the last 5 pairs. This closes the optimization loop.

**Why this priority**: Picking a winner is the whole point. But it can ship one iteration after P1+P2 — we can A/B-test for a week first to validate the measurement before letting it steer renders. P2 not P1.

**Independent Test**: Seed `data/variants/` with 5 paired JSONs and `data/analytics/` with corresponding metrics showing formula A wins. Run render-daily-short. Verify the next single-render uses formula A.

**Acceptance Scenarios**:

1. **Given** ≥5 paired comparisons exist AND formula A's median completion is ≥3 percentage points higher than formula B's, **When** the render starts, **Then** the rendered Short uses formula A's hook.
2. **Given** fewer than 5 pairs exist OR the medians are within ±3 points, **When** the render starts, **Then** the render continues to produce both variants (no premature lock-in).

---

### Edge Cases

- **Quota.** Two uploads per day instead of one increases the YouTube Data API quota cost. Each upload consumes ~1600 units of the 10k daily quota. Two uploads = 3200 units. Still well within budget, but the workflow must not panic if the second upload fails — the first should still be live.
- **TTS cost / time.** Both variants share most of the narration (everything after the hook). The TTS engine must reuse cached audio for the shared segment. Total render time per day grows from ~6 min to ~9 min (not 12) thanks to caching.
- **Quiz has no `wrongHook` derivable**. If the wrong-answer-first hook formula returns the same string as the specific-stat formula (rare but possible for short-explanation quizzes), the variant must fall back to a third formula ("company name + dramatic context") rather than uploading two identical videos.
- **Upload partial failure.** If variant A uploads but variant B fails, the pipeline logs the failure but does NOT retry indefinitely (no infinite retry storms). Next day the cron resumes.
- **Analytics API disabled**. P2 (the feedback loop) requires analytics ingestion. If the API is disabled, P2 falls back to "keep rendering both variants forever" (still produces useful uploads, just no winner-selection).
- **Manual override.** Operator must be able to force a specific formula via workflow_dispatch input (`force_formula=specific_stat | wrong_answer_first | rotate`).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The render pipeline MUST produce two distinct MP4s per daily quiz, identical except for the first 3 seconds.
- **FR-002**: Each variant's metadata MUST include a hookFormula identifier readable by analytics tooling.
- **FR-003**: Both variants MUST upload to YouTube as public Shorts with their custom thumbnails, captions, and auto-pinned first comments.
- **FR-004**: The pipeline MUST persist `data/variants/<videoId>.json` records pairing videoId → quizIndex → variant → hookFormula → uploadedAt.
- **FR-005**: The weekly report MUST include a per-formula comparison table.
- **FR-006**: After ≥5 paired comparisons, the next render MUST select the winning formula if its median completion is at least 3 percentage points above the alternative.
- **FR-007**: Operator MUST be able to force a specific formula or both via workflow_dispatch input.
- **FR-008**: A single variant upload failure MUST NOT cause the workflow to crash; the other variant remains live.

### Non-Functional Requirements

- **NFR-001 (Constitution I)**: Variant selection MUST be deterministic per quiz — same quiz + same day produces the same A and B every time. No `Math.random()`.
- **NFR-002 (Constitution III)**: Zero manual intervention. The full A/B flow runs on the existing daily cron.
- **NFR-003 (Constitution IV)**: This feature directly satisfies the measurement principle by producing comparable data per upload.
- **NFR-004 (Constitution VI)**: Both variants use `en-IN-PrabhatNeural` voice and `guru-avatar-crop.png` avatar.
- **NFR-005**: Total per-day render time MUST stay under 12 minutes on the CI runner (currently ~6 min for one Short).
- **NFR-006**: Total per-day YouTube API quota MUST stay under 4000 units (currently ~1600).

### Key Entities

- **HookFormula**: a named function that produces a `(hookText: string, spokenHook: string)` tuple from a `QuizQuestion`. Known formulas: `specific_stat` (current default, see `src/lib/quiz-hook.ts`'s `getSpecificHook`), `wrong_answer_first` (see `getWrongAnswerHook`), `company_dramatic` (fallback if the first two collide).

- **VariantRecord** (persisted to `data/variants/<videoId>.json`):
  - `videoId` (string)
  - `quizIndex` (number)
  - `variant` ('A' | 'B')
  - `hookFormula` ('specific_stat' | 'wrong_answer_first' | 'company_dramatic')
  - `uploadedAt` (ISO datetime)
  - `siblingVideoId` (string — the paired variant)

- **WinningFormula** (computed at render time):
  - Reads last N=5 paired comparisons via joined `data/variants/*.json` + `data/analytics/*.json`
  - Returns the hookFormula with the higher median `averageViewPercentage`, requiring a ≥3 percentage point margin
  - Returns `null` if insufficient data, signaling "keep A/B testing"

---

## Success Criteria *(mandatory)*

- **SC-001 (Coverage)**: Within 7 calendar days of merging this feature, at least 10 quiz Shorts have been uploaded (5 pairs), each tagged with a hookFormula.
- **SC-002 (Measurability)**: The weekly report shows a per-formula table with median completion % for each formula across at least 5 videos.
- **SC-003 (Decisiveness)**: Within 14 days, the system either selects a winning formula AND uses it on the next render OR explicitly reports "no winner yet — continuing A/B" with the margin between formulas.
- **SC-004 (No regression)**: The 18 currently-accepted-known-issue test failures (per constitution) do not increase.
- **SC-005 (Cost)**: Daily CI minutes stay under 25 min (currently ~13 min for one render+upload+distribute).

---

## Out of Scope *(explicit non-goals)*

- **Multivariate testing** (testing thumbnail × hook × BGM at once). One variable at a time. Hook now; thumbnail later if hook A/B yields a winner.
- **Per-topic formula winners**. Initially the winner applies channel-wide. Per-topic A/B requires far more data (5 pairs per topic = 60 pairs for all 12 topics — months at one pair/day).
- **Removing the losing formula from the codebase**. The losing formula stays as a backup and may be re-introduced if the winning formula's edge degrades.
- **Statistical significance testing**. We use a simple ≥3 percentage point threshold instead of a t-test. Channel volume is too low for proper stats; the threshold is a heuristic.
- **Hook generation by LLM** (forbidden by Constitution I). All hook formulas are deterministic transforms of quiz fields.

---

## Constitution Alignment Checklist

- [x] **I. Deterministic Everything** — All formula functions are pure transforms of quiz fields. No `Math.random()`.
- [x] **II. All-Local, Offline-First** — Only YouTube OAuth network calls; same as today.
- [x] **III. Automation Over Manual** — Operates inside the existing cron; no new manual steps.
- [x] **IV. Measure Before You Optimize** — This IS the measurement loop the principle demands.
- [x] **V. Subtraction Before Addition** — We don't add a new visual element; we vary an existing one (hook) and remove the assumption that one formula is best.
- [x] **VI. Indian Voice + AI Avatar** — Both variants use mandatory voice + avatar; only hook text differs.
- [x] **VII. Render-Preview-Before-Render-Full** — N/A (Shorts, not long-form).
- [x] **VIII. Single-Path Pipelines** — One pipeline produces both variants; not two pipelines.
- [x] **IX. Secret Hygiene** — No new secrets introduced.
- [x] **X. Branch-Per-Feature** — Implemented on branch `001-viral-shorts-hook`.

---

## Open Questions

None at spec time. Move to `/speckit-plan`.
