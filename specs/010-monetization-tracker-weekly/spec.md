# Feature Specification: Monetization Tracker + Engagement Fix

**Feature Branch**: `010-monetization-tracker-weekly`

**Created**: 2026-05-22

**Status**: Draft

**Input**: User description: "Make YouTube Partner Program (YPP) monetization
distance measurable weekly, and attack the dead-comments problem that is
suppressing algorithmic distribution."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Weekly monetization distance is measurable (Priority: P1)

The channel @GuruSishya-India (12 subscribers, ~50 public videos) wants YPP
monetization. YPP requires 1,000 subscribers PLUS one of: 10,000,000 valid
Shorts views in 90 days, OR 4,000 watch hours in 12 months. Today nobody can
see how far the channel is from either threshold. The creator runs (or the
daily cron runs) a single script that prints a Markdown report stating: current
subscribers, 90-day Shorts views, 12-month watch hours, the percent-complete
and absolute gap for both YPP paths, and a blunt verdict naming the closer
path with an ETA at the current weekly rate.

**Why this priority**: Without a measured distance, every content decision is
a guess. Knowing the closer path (Shorts views vs watch hours) and the gap
tells the creator exactly what to optimize. This is the entire value of Part A.

**Independent Test**: Run `npx tsx scripts/monetization-report.ts`. With valid
YouTube credentials it writes `data/analytics/monetization.md` containing real
numbers and two YPP progress sections. With credentials unavailable it prints
`unavailable` for the API-derived metrics and still emits a well-formed report
(it never fabricates a number).

**Acceptance Scenarios**:

1. **Given** `data/channel-inventory.json` exists with `subscriberCount`,
   **When** the script runs, **Then** the report shows the subscriber count and
   `subs / 1000` progress for both YPP paths.
2. **Given** YouTube Analytics credentials are present, **When** the script
   runs, **Then** the report shows 90-day Shorts views (approx) and 12-month
   watch hours derived from `reports.query`.
3. **Given** credentials are absent or the API call fails, **When** the script
   runs, **Then** the API-derived metrics print `unavailable` and no fake
   number appears.
4. **Given** the report is generated, **Then** it contains a one-line verdict
   naming the closer path and an ETA (or "insufficient trend data").

---

### User Story 2 - The dead-comments problem is attacked (Priority: P1)

Comments are ~0 across all ~50 videos — an algorithmic distribution killer.
The viewer of every new Short sees an unmissable "👇 COMMENT YOUR ANSWER" line
above the end question with a pulsing arrow. The auto-posted first comment is a
short binary reply-baiting question ending with "A or B? 👇". The creator can
list which `endQuestion` entries in `QUIZ_BANK` are weak (not openable/binary)
so they can be hand-rewritten later.

**Why this priority**: Zero comments means zero engagement signal. The fixes
make the comment ask unmissable on-screen, seed a reply-baiting first comment,
and surface weak prompts — together the cheapest lever to revive distribution.

**Independent Test**: Render any QuizShort and confirm the EndCardCTA shows the
bold "👇 COMMENT YOUR ANSWER" line above the question. Run
`npx tsx scripts/audit-end-questions.ts` and confirm it prints a count and list
of weak `endQuestion` entries.

**Acceptance Scenarios**:

1. **Given** an `endQuestion`, **When** EndCardCTA renders (VS or flat layout),
   **Then** a bold "👇 COMMENT YOUR ANSWER" line appears above the question.
2. **Given** a quiz, **When** `buildFirstComment(quiz)` runs, **Then** it
   returns a short binary question ending with a "👇" prompt, deterministically.
3. **Given** `QUIZ_BANK`, **When** `audit-end-questions.ts` runs, **Then** it
   reports the count and list of weak `endQuestion` entries without rewriting
   them.

### Edge Cases

- No `data/channel-inventory.json`: the script prints `unavailable` for
  subscriber-derived metrics and exits 0 (cron must still commit a report).
- Trailing-90-day window with zero Shorts views: percent is `0.0%`, gap is the
  full threshold, no division-by-zero.
- A quiz `endQuestion` that already ends in a binary prompt:
  `buildFirstComment` must not double-append the prompt.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `scripts/monetization-report.ts` MUST read
  `data/channel-inventory.json` for `subscriberCount` and the video list.
- **FR-002**: It MUST query channel-level `views` and `estimatedMinutesWatched`
  via the YouTube Analytics API for the trailing 90 and 365 day windows.
- **FR-003**: 90-day Shorts views MUST be an explicit approximation (sum of
  views of videos with `durationISO` ≤ 3min, or channel-level views with a
  noted caveat) — the report MUST state the approximation.
- **FR-004**: It MUST export pure functions `yppProgress(current, threshold)`
  → `{pct, gap}` and a verdict-picker, and print a Markdown report to stdout
  AND to `data/analytics/monetization.md`.
- **FR-005**: Any unfetchable metric MUST print `unavailable` — never a
  fabricated number. The script MUST exit 0 even on partial failure.
- **FR-006**: `.github/workflows/channel-inventory.yml` MUST run the report as
  a `continue-on-error` step after the inventory step.
- **FR-007**: `EndCardCTA.tsx` MUST render a bold "👇 COMMENT YOUR ANSWER" line
  above the question (both VS and flat layouts) with a pulsing arrow.
- **FR-008**: `scripts/lib/engagement.ts` MUST export `buildFirstComment(quiz)`
  returning a deterministic short binary reply-baiting comment ending with a
  "👇" prompt.
- **FR-009**: `scripts/audit-end-questions.ts` MUST flag and list `QUIZ_BANK`
  `endQuestion` entries that are not binary/openable prompts — report only,
  no auto-rewrite.

### Non-Goals

- Do NOT buy, solicit off-platform, or otherwise fake engagement.
- Do NOT auto-rewrite quiz `endQuestion` content — only flag weak ones.
- Do NOT touch the QuizShort timeline (F011 set it to 30s — leave it).
- Do NOT change long-form compositions or TTS voice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `data/analytics/monetization.md` regenerates daily via the cron
  and contains only real numbers or the literal `unavailable` — no fabrication.
- **SC-002**: Every newly rendered Short's EndCardCTA shows the
  "👇 COMMENT YOUR ANSWER" line above the question.
- **SC-003**: The report names the closer YPP path and a percent-complete for
  both paths.
- **SC-004**: `npx tsc --noEmit` reports no new errors in the new files.
- **SC-005**: `audit-end-questions.ts` surfaces a count of weak `endQuestion`
  entries so content rewrites can be prioritized.

## Constitution Alignment

- **Deterministic**: `yppProgress`, the verdict-picker, and `buildFirstComment`
  are pure deterministic functions; the EndCardCTA pulse is frame-derived. No
  `Math.random`.
- **Indian voice / avatar**: Untouched — no TTS or avatar change.
- **All local / no LLM**: The report uses only the YouTube Analytics API
  (already used by the channel-inventory cron) and local JSON; no LLM call.

## Assumptions

- `data/channel-inventory.json` is refreshed by the existing daily cron before
  the monetization report step runs.
- Shorts-vs-long cannot be distinguished cleanly via the Analytics API, so a
  duration-threshold approximation is acceptable when clearly labelled.
- A first comment with a one-tap binary question maximizes early reply velocity.
