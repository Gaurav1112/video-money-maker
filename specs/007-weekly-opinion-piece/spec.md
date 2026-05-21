# Feature 007 — Weekly Opinion-Piece Auto-Publish

**Feature Branch**: `007-weekly-opinion-piece`

**Created**: 2026-05-21

**Status**: Draft

**Input**: Auto-render + upload the next unpublished opinion-piece (long + Short) to YouTube every Sunday, with manual workflow_dispatch override.

---

## User Scenarios & Testing

### User Story 1 — Weekly autonomous publish (Priority: P1)

Every Sunday at 12:00 UTC (17:30 IST), a GitHub Actions cron picks the lowest-numbered episode in `content/opinions/` that does NOT yet have a dedupe record in `data/opinions-published/<slug>.json`, runs the opinion-piece pipeline end-to-end (long-form 8-12 min + 60s Short), uploads both to YouTube with distinct metadata + thumbnails, and commits a fresh dedupe record back to `main`.

**Why this priority**: This is the entire point of the feature — a self-running weekly cadence so the operator does zero work on Sundays.

**Independent Test**: Drop a new markdown file under `content/opinions/`, wait for the next Sunday cron (or trigger manually), confirm two new YouTube videos appear on the channel and a fresh JSON file lands in `data/opinions-published/`.

**Acceptance Scenarios**:

1. **Given** episodes 001-005 exist and 001-003 have dedupe records, **When** the cron fires, **Then** the workflow renders + uploads episode 004 only.
2. **Given** all episodes already have dedupe records, **When** the cron fires, **Then** the workflow logs "no unpublished episodes" and exits cleanly (no error).
3. **Given** an upload fails partway (e.g. long uploads, Short fails), **Then** the dedupe record is NOT written, so the next run retries the whole episode.

---

### User Story 2 — Manual workflow_dispatch with specific episode (Priority: P1)

Operator opens GitHub Actions → "Weekly Opinion-Piece" → "Run workflow" → fills `episode=001-microservices-vs-monolith` → both long and Short render and upload immediately.

**Why this priority**: Required for today's launch of Episode 001 (cron is Sunday but we want it live now). Also the standard way to ship any future episode out-of-band.

**Independent Test**: Run `gh workflow run weekly-opinion.yml -f episode=001-microservices-vs-monolith` and confirm both videos appear on YouTube within ~30 minutes.

**Acceptance Scenarios**:

1. **Given** the workflow is dispatched with a valid episode slug, **When** the run completes, **Then** two YouTube IDs are printed in the run summary and a dedupe record exists for that slug.
2. **Given** the workflow is dispatched with `episode` blank, **Then** the workflow falls back to next-unpublished-picker (same as cron path).
3. **Given** the workflow is dispatched with `episode=000-does-not-exist`, **Then** the run fails fast with a clear error before any TTS or render.

---

### User Story 3 — Distinct YouTube metadata for long vs Short (Priority: P2)

Long-form upload gets the full essay title, a description containing the full essay text (up to 5000 chars) plus chapter timestamps derived from section headers; Short upload gets a `#Shorts`-suffixed title, a short description (≤500 chars), and tags from the topic keywords. Both use categoryId 28 (Science & Technology).

**Why this priority**: Metadata drives discovery; ad-hoc/identical metadata hurts both videos' chances.

**Independent Test**: Inspect the two `metadata.json` files emitted by the pipeline; confirm they differ in title-suffix, description length, and tags, but share categoryId 28.

**Acceptance Scenarios**:

1. **Given** Episode 001 markdown, **When** the orchestrator runs, **Then** `output/opinions/001-.../long-metadata.json` has `youtube.description` length > 1000 chars and `youtube.title` does NOT contain `#Shorts`.
2. **Given** the same episode, **Then** `output/opinions/001-.../short-metadata.json` has `youtube.title` ending in `#Shorts` and a description < 500 chars.
3. **Given** the markdown contains `## Hook`, `## Pros`, etc., **Then** the long-form description contains chapter timestamps `00:00 Hook`, `mm:ss Pros`, etc.

---

### User Story 4 — Custom thumbnails for long-form (Priority: P2)

Long-form gets a dedicated 1280×720 thumbnail rendered from a new `OpinionThumbnail` Remotion composition (movie-poster style: gradient brand bar, big essay title, "OPINION" label, brand watermark). Short reuses the existing frame-0-still pattern (no new composition needed).

**Why this priority**: A clickable thumbnail roughly doubles long-form CTR; we already do this for Quiz Shorts and topic long videos.

**Independent Test**: After a render, confirm `output/opinions/<slug>/long-thumbnail.jpg` exists at 1280×720 and contains the essay title text.

**Acceptance Scenarios**:

1. **Given** Episode 001, **When** render-opinion-piece runs, **Then** `long-thumbnail.jpg` is a 1280×720 JPEG with the title rendered on it.
2. **Given** the upload step, **Then** `upload-youtube.ts --thumbnail long-thumbnail.jpg` sets it as the YouTube thumbnail for the long-form video.

---

### Edge Cases

- All episodes already published → workflow logs and exits 0, no dedupe write.
- Markdown is malformed (missing required section) → parser throws OpinionParserError, workflow fails before upload.
- Long render succeeds, Short render fails → no dedupe record written; next run retries both.
- Long upload succeeds, Short upload fails → no dedupe record written; next run re-uploads both (results in YouTube duplicate of the long if the operator hasn't manually deleted — accepted risk, document in spec).
- Workflow timeout (50 min hit) → run fails, no dedupe record; next cron picks up the same episode.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST cron-trigger Sundays at 12:00 UTC via `.github/workflows/weekly-opinion.yml`.
- **FR-002**: System MUST also accept `workflow_dispatch` with an optional `episode: <slug>` input.
- **FR-003**: When `episode` input is empty, system MUST pick the lowest-numbered slug in `content/opinions/` that has no `data/opinions-published/<slug>.json` record.
- **FR-004**: When `episode` input is a slug that does not exist as a markdown file, system MUST fail fast with a non-zero exit before any render.
- **FR-005**: System MUST render BOTH `long.mp4` (8-12 min) and `short.mp4` (~60s) by invoking `scripts/render-opinion-piece.ts`.
- **FR-006**: System MUST render a 1280×720 `long-thumbnail.jpg` via a new `OpinionThumbnail` Remotion composition.
- **FR-007**: System MUST emit TWO distinct metadata files: `long-metadata.json` (full description + chapters) and `short-metadata.json` (Shorts-suffixed title, short description).
- **FR-008**: System MUST upload long-form to YouTube via `scripts/upload-youtube.ts` with the long thumbnail and long metadata, NO `--shorts` flag.
- **FR-009**: System MUST upload Short to YouTube via `scripts/upload-youtube.ts` with `--shorts` and the short metadata.
- **FR-010**: After BOTH uploads succeed, system MUST write `data/opinions-published/<slug>.json` containing both video IDs, both URLs, and a timestamp; if either upload fails, NO dedupe record is written.
- **FR-011**: System MUST commit any new files under `data/opinions-published/` back to `main` so the next cron sees the updated dedupe state.
- **FR-012**: Orchestrator script `scripts/upload-opinion-piece.ts` MUST support `--dry-run` that prints what would be uploaded without calling YouTube.
- **FR-013**: Workflow YAML MUST set `timeout-minutes: 50` and install ffmpeg + Edge TTS like `auto-shorts.yml`.
- **FR-014**: NO LinkedIn cross-posting in this feature (deferred to separate decision).
- **FR-015**: NO modifications to `OpinionLong.tsx` / `OpinionShort.tsx` compositions (Feature 006 lockdown).

### Key Entities

- **Episode**: A `content/opinions/<NNN-slug>.md` file parsed by the Feature 006 parser.
- **Dedupe Record**: `data/opinions-published/<slug>.json` with `{ slug, longVideoId, longUrl, shortVideoId, shortUrl, publishedAt }`.
- **Metadata Sidecar**: Two files per episode — `long-metadata.json` and `short-metadata.json` — each shaped like the `MetadataFile` interface in `upload-youtube.ts`.
- **OpinionThumbnail Composition**: A 1280×720 single-frame Remotion composition consuming `{ title: string; slug: string }`.

---

## Success Criteria

- **SC-001**: From `gh workflow run weekly-opinion.yml -f episode=001-microservices-vs-monolith` to both YouTube URLs being live, total wall-clock time < 30 minutes.
- **SC-002**: After T1-T8 land on `main`, the Episode 001 workflow run finishes with exit code 0 and the run summary shows TWO YouTube URLs.
- **SC-003**: Running the workflow twice in a row with the same `episode` input re-uploads on the first run only — second run is a no-op (dedupe).
- **SC-004**: `data/opinions-published/<slug>.json` records persist on `main` so a fresh clone sees the dedupe state without any external lookup.
- **SC-005**: No pre-existing test in the accepted-known-issues list regresses; no new tests fail.

---

## Constitution Alignment

- **I Deterministic**: No new randomness; "next unpublished" picker sorts by slug ascending; metadata derived purely from markdown.
- **III Automation**: Cron + workflow_dispatch — zero manual steps on a typical Sunday.
- **VI Indian voice + avatar**: Reuses Feature 006 pipeline → `en-IN-PrabhatNeural` + Indian voice. No avatar in OpinionLong (already lockdown'd).
- **VII Render-preview**: `scripts/render-opinion-piece.ts` already runs the 30s preview pass before the full render; we do NOT bypass it on CI.
- **IX Secret hygiene**: Reuses existing `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REFRESH_TOKEN` GitHub Secrets. No new secret material.

---

## Non-Goals

- **NOT** auto-posting to LinkedIn — separate F008 decision (operator wants editorial control on LinkedIn).
- **NOT** auto-generating new episode markdown — the operator authors essays manually; this feature only publishes what exists in `content/opinions/`.
- **NOT** modifying the `OpinionLong` / `OpinionShort` compositions — they were smoke-tested in F006 and are locked.
- **NOT** producing Instagram / TikTok / Twitter variants in this iteration — that's a future "cross-post opinion pieces" feature.

---

## Assumptions

- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` are already configured as GitHub Secrets (verified via existing `auto-shorts.yml`).
- Long-form opinion videos belong in categoryId 28 (Science & Technology), matching channel norms.
- A single GitHub Actions ubuntu-latest runner is enough to render an 8-12 min long-form + 60s Short within 50 minutes (validated by F006 local timings).
- The operator will not author more than one new episode per week; the picker walking lowest-numbered-unpublished is sufficient sequencing.
