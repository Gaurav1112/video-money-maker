# Feature Specification: Cut Long-Form to 4-6 Minutes

**Feature Branch**: `012-cut-long-form`

**Created**: 2026-05-22

**Status**: Draft

**Input**: Retention data on @GuruSishya-India long-form videos shows viewers
watch only 2-4 minutes of 8-12 minute uploads (completion 10-42%). This is the
same overshoot already fixed for Shorts (F011 cut 120s -> 30s). Retarget
long-form to 4-6 minutes so the same absolute watch time produces a far stronger
completion signal.

## Data Justification

A 9-minute video watched for 2 minutes scores 22% completion — the YouTube
algorithm reads that as a weak video and buries it. A 4-minute video watched for
the same 2 minutes scores 50% completion — the algorithm reads that as strong
and promotes it. Absolute watch time is identical; only the *signal* changes.
F011 proved this for Shorts (120s -> 30s). Long-form is the same overshoot:
8-12 min uploads against a 2-4 min observed attention budget. Retargeting to
4-6 min (240-360 s) aligns the format with how it is actually consumed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Long-form retargeted to 4-6 minutes (Priority: P1)

Both long-form pipelines — the opinion-piece long video (`OpinionLong`, driven
by `render-opinion-piece.ts` + `opinion-piece-parser.ts`) and the topic/quiz
long-form (`LongVideo`, driven by `script-generator.ts`) — produce videos in the
240-360 s window instead of 8-12 minutes.

**Why this priority**: This is the feature. Without it, long-form keeps
overshooting the attention budget and the algorithm keeps burying it.

**Independent Test**: Render a fresh opinion long-form and `ffprobe` the
`long.mp4`; duration is 240-360 s. Inspect the `script-generator.ts` duration
budget; it now targets 4-6 min.

**Acceptance Scenarios**:

1. **Given** `content/opinions/001-microservices-vs-monolith.md`, **When**
   `render-opinion-piece.ts` runs, **Then** the rendered `long.mp4` duration is
   240-360 s.
2. **Given** a verbose source markdown, **When** the narration plan is built,
   **Then** total narration words are capped to the 600-900 word budget.
3. **Given** `generateScript` with default options, **When** a script is
   generated, **Then** the scene budget targets 4-6 min (not 8-12).

### User Story 2 - Analytics covers the full channel (Priority: P2)

`ingest-analytics.ts` pulls only the last 50 uploads. Most long-form videos are
older and fall outside that window, so the channel has no retention data on
them. Widen ingestion to the last 200 videos.

**Why this priority**: Constitution IV — measure before optimize. We cannot
confirm this feature's effect on older long-form videos without their data. P2
because P1 ships value on its own; this strengthens the feedback loop.

**Independent Test**: Inspect `ingest-analytics.ts`; `MAX_VIDEOS` is 200.

**Acceptance Scenarios**:

1. **Given** the analytics ingestion script, **When** it lists channel uploads,
   **Then** it requests up to 200 videos.

### Edge Cases

- Source markdown shorter than the budget (e.g. the microservices episode at
  ~566 words) — narration cap is a maximum, not a minimum; short input is left
  untouched and renders naturally short.
- `OpinionLong` `calculateMetadata` keeps a 60 s floor and a 900 s ceiling;
  neither is hit by a 240-360 s video. The 60 s floor must NOT be raised toward
  240 s (it would pad silent tail frames).
- A topic with fewer scenes than the new budget renders short — acceptable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `buildNarrationPlan` MUST cap total narration to a 600-900 word
  budget so a fully-rendered opinion long-form lands in 240-360 s at ~150 wpm.
- **FR-002**: The narration cap MUST be a deterministic pure function — same
  input, same output, no `Math.random`, no LLM (Constitution I).
- **FR-003**: `OpinionLong` duration MUST remain audio-driven; no hard-coded
  minimum above 60 s.
- **FR-004**: `generateScript` scene budget (`maxScenes` default) MUST be
  reduced so a generated `LongVideo` targets 4-6 min instead of 8-12.
- **FR-005**: The `script-generator.ts` change MUST be a surgical edit to the
  budget constant — the 2500-line file MUST NOT be rewritten.
- **FR-006**: `ingest-analytics.ts` `MAX_VIDEOS` MUST be 200.

### Key Entities

- **OpinionNarrationScene**: a typed `{ type, narration }` unit fed to TTS;
  total word count across all scenes is the OpinionLong duration budget.
- **maxScenes**: the `generateScript` option whose default sets the `LongVideo`
  duration budget.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A freshly rendered opinion long-form (`long.mp4`) is 240-360 s by
  `ffprobe`.
- **SC-002**: The `script-generator.ts` duration budget in code targets 4-6 min.
- **SC-003**: `ingest-analytics.ts` covers >= 150 videos (`MAX_VIDEOS = 200`).
- **SC-004**: `npx tsc --noEmit -p tsconfig.build.json` is clean for touched
  files; `npx vitest run` shows no new failures beyond the known ~27.

## Constitution Alignment

- **I Deterministic**: narration cap is a pure deterministic function.
- **IV Measure before optimize**: US2 widens the analytics window so the effect
  is measurable.
- **V Subtraction before addition**: this feature *removes* runtime — it cuts
  length rather than adding overlays.
- **VI Indian voice + avatar**: untouched — `en-IN-PrabhatNeural`, guru avatar.
- **VII Render-preview-before-full**: opinion render keeps its 30 s preview;
  the LongVideo path uses `--frames=` preview.

## Non-Goals

- NOT deleting long-form — it is retargeted, not removed.
- NOT touching QuizShort or the 30 s Shorts pipeline (F011 — leave it).
- NOT rewriting `script-generator.ts` — surgical budget change only.

## Assumptions

- ~150 wpm narration; 600-900 words -> 240-360 s.
- 30 scenes ~ 8-12 min, so ~14-16 scenes ~ 4-6 min.
- YouTube Analytics API quota comfortably covers 200 videos.
- Edge TTS may be unavailable locally; Kokoro fallback is acceptable for the
  duration check.
