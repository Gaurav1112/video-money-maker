# Feature Specification: Weekly Decision Digest

**Feature Branch**: `011-weekly-decision-digest`

**Created**: 2026-05-22

**Status**: Draft

**Input**: User description: "The channel pipeline and measurement loop are
complete. The operator will let it run and review weekly — but reviewing means
reading raw JSON in `data/analytics/`, which won't happen. Produce ONE
human-readable Sunday digest with a single recommended action so the weekly
review is real."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sunday digest with a recommended action (Priority: P1)

The operator of @GuruSishya-India has a daily inventory cron, a monetization
tracker, retention metrics, and A/B variant data — all landing as files in
`data/analytics/` and `data/variants/`. None of it gets read, because nobody
opens 50 JSON files on a Sunday. The operator wants a single Markdown digest,
generated every Sunday, that summarises the week and ends with exactly ONE
recommended action derived from a deterministic decision tree. The review then
takes two minutes: open one file, read the bottom line, act or not.

**Why this priority**: A measurement loop nobody reads is a loop that does not
exist. This feature is what turns "letting it run" into a real weekly review.
It is the last piece that closes the operate-and-improve cycle. Without it the
prior monetization and analytics work produces data, not decisions.

**Independent Test**: Run `npx tsx scripts/weekly-digest.ts`. It writes (to
stdout) a well-formed Markdown digest with five sections — monetization delta,
retention trend, top/bottom video, A/B hook status, and THE recommended action.
With no prior git history it prints "first run — no delta yet" for delta
sections and still emits every section and a recommendation. No section ever
fabricates a number; missing data prints "unavailable".

**Acceptance Scenarios**:

1. **Given** `data/analytics/monetization.md` exists and a version exists ~7
   days back in git history, **When** the script runs, **Then** Section 1 shows
   week-over-week deltas for subscribers, 90-day views, and watch hours.
2. **Given** no prior `monetization.md` exists in git history, **When** the
   script runs, **Then** Section 1 prints "first run — no delta yet" and does
   not crash.
3. **Given** `data/analytics/*.json` metric files exist, **When** the script
   runs, **Then** Section 2 reports the median `averageViewPercentage` and, if
   a prior digest exists, the week-over-week trend in percentage points.
4. **Given** `data/channel-inventory.json` exists, **When** the script runs,
   **Then** Section 3 names the highest- and lowest-view video published in the
   last 7 days with title, views, and completion if available.
5. **Given** `data/variants/*.json` exist, **When** the script runs, **Then**
   Section 4 reports the paired-comparison count and the winning formula or
   "insufficient data (need 5 pairs, have N)".
6. **Given** the digest is generated, **Then** Section 5 contains exactly ONE
   recommended action chosen by a deterministic decision tree.

### Edge Cases

- **No git history** (fresh clone / first run): delta sections print "first run
  — no delta yet"; the script still emits every section.
- **monetization.md format drift**: the markdown-table parser returns `null` →
  Section 1 prints "unavailable" rather than crashing.
- **Zero variant pairs**: Section 4 prints "insufficient data (need 5 pairs,
  have 0)".
- **Shallow CI clone**: `git show HEAD~7` fails — the workflow uses
  `fetch-depth: 0`; the script also degrades gracefully if history is absent.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide `scripts/weekly-digest.ts` that emits a
  Markdown digest to stdout and exits 0 even when data sources are missing.
- **FR-002**: Section 1 MUST read `data/analytics/monetization.md` for current
  subscribers / 90-day views / watch hours, read a ~7-day-old version via git
  history, and print week-over-week deltas plus the YPP gap and % for both paths.
- **FR-003**: Section 2 MUST read all `data/analytics/*.json` files, compute
  median `averageViewPercentage`, compare against a prior digest from git
  history, and flag whether videos published in the last 7 days have higher
  median completion than older videos.
- **FR-004**: Section 3 MUST read `data/channel-inventory.json` and name the top
  and bottom video by views among those published in the last 7 days.
- **FR-005**: Section 4 MUST use `scripts/lib/variant-store.ts`
  (`readPairedComparisons`, `pickWinningFormula`) to report the paired count and
  the current winner or an insufficient-data message.
- **FR-006**: Section 5 MUST run a pure deterministic decision tree producing
  one recommendation; the system MUST export `computeDelta(prev, curr)` and
  `recommendAction(signals)` as pure functions.
- **FR-007**: A GitHub Actions workflow MUST run Sundays 05:00 UTC and on
  `workflow_dispatch`, committing `data/analytics/weekly-digest.md`; checkout
  MUST use `fetch-depth: 0`.
- **FR-008**: System MUST use pure Node only (`node:fs`, `node:child_process`);
  no new dependencies.

### Key Entities

- **Digest**: a five-section Markdown report regenerated weekly.
- **Signals**: derived inputs to the decision tree — days since last change,
  completion delta (pp), subscriber delta per week, weeks flat.
- **Delta**: `{ prev, curr, delta }` for a single metric.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running `npx tsx scripts/weekly-digest.ts` locally prints a
  five-section digest with a recommendation in under 5 seconds.
- **SC-002**: `npx tsc --noEmit` stays clean.
- **SC-003**: `vitest run scripts/__tests__/weekly-digest.test.ts` passes with
  5+ tests covering each decision-tree branch.
- **SC-004**: No section ever prints a fabricated number; missing data degrades
  to "unavailable" or "first run".

## Constitution Alignment

- **I. Deterministic**: decision tree, deltas, medians are pure functions. No
  `Math.random`. No LLM — the recommendation is rule-based.
- **II. Honest**: missing data prints "unavailable"; never fabricated.
- **III. Local & cheap**: pure Node, no new dependencies, no network egress.

## Non-Goals

- No LLM or generative summarisation — the digest is mechanically assembled.
- No auto-acting on the recommendation — it is advisory; a human decides.
- No new analytics collection — this feature only reports existing data.
- No changes to render, composition, or quiz code.

## Assumptions

- The daily channel-inventory cron keeps `data/channel-inventory.json` and
  `data/analytics/monetization.md` reasonably fresh.
- `monetization.md` retains the F010 markdown-table format (subscriber / views /
  watch-hours rows). Format drift degrades gracefully to "unavailable".
- Git history of `data/analytics/` is available (CI uses `fetch-depth: 0`).
