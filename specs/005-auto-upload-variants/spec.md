# Feature 005 — TikTok Content Posting API auto-upload

**Feature Branch**: `005-auto-upload-variants`
**Created**: 2026-05-21
**Status**: Draft

## User Scenarios & Testing

### User Story 1 — Every Short uploaded to YouTube also lands on TikTok (Priority: P1)
After the existing YouTube upload step in `auto-shorts.yml` succeeds for an A/B
variant, the same MP4 is auto-published to TikTok via the Content Posting API
(direct-post mode), with no operator action beyond initial OAuth setup.

**Why P1**: The whole feature.

**Independent Test**: Run `npx tsx scripts/upload-tiktok.ts <mp4> <meta>`
without `TIKTOK_*` env vars set → exit 0 with clear skip log.

**Acceptance Scenarios**:
1. **Given** valid `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`,
   `TIKTOK_ACCESS_TOKEN` and `TIKTOK_OPEN_ID`, **When** the new TikTok step
   runs after upload, **Then** the video posts to TikTok and the publish ID
   appears in the workflow log.
2. **Given** any TikTok API failure, **When** the step finishes,
   **Then** the YouTube pipeline is NOT marked failed (`continue-on-error`).

### User Story 2 — Missing tokens degrade gracefully (Priority: P1)
If any TikTok env var is missing, the script exits 0 with a skip message.

**Why P1**: TikTok sandbox approval can take 3-7 days; the change must merge
before secrets exist.

**Acceptance Scenarios**:
1. **Given** missing `TIKTOK_ACCESS_TOKEN`, **When** the step runs,
   **Then** it logs `[tiktok] TIKTOK_ACCESS_TOKEN missing — skipping` and
   exits 0.

### Edge Cases
- TikTok Sandbox vs Production: in Sandbox, posts go only to the developer's
  own account and are PRIVATE. The script behaves identically either way;
  production approval is a TikTok-side toggle that doesn't change our code.
- The Content Posting API uses chunked binary upload (init → PUT → publish).
  We must handle the upload URL returned by `/v2/post/publish/inbox/video/init/`.
- File-size cap: 4 GB. Our Shorts are < 50 MB. No chunking needed
  (single PUT request).
- The access token expires every 24 hours. We require operator to use a
  long-lived refresh-token flow OR refresh the access token via cron. F005
  assumes operator provides a token valid for the run window.

## Requirements

### Functional Requirements
- **FR-001**: System MUST provide `scripts/lib/tiktok-client.ts` with a single
  `uploadToTikTok(videoPath, caption, env)` function that performs init →
  PUT upload → publish.
- **FR-002**: System MUST provide `scripts/upload-tiktok.ts` CLI wrapper:
  `upload-tiktok.ts <video.mp4> <metadata.json>`.
- **FR-003**: The wrapper MUST exit 0 if any of `TIKTOK_CLIENT_KEY`,
  `TIKTOK_CLIENT_SECRET`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_OPEN_ID` is missing.
- **FR-004**: A new step in `.github/workflows/auto-shorts.yml` MUST iterate
  variant MP4s and invoke the wrapper. `continue-on-error: true`.
- **FR-005**: Caption derived deterministically from metadata
  (`metadata.youtube.title` truncated to 2200 chars + 5 default hashtags).

### Key Entities
- **VariantMp4**: existing — `output/daily-short/*.mp4`.
- **TikTokPublishResult**: `{ publishId: string, status: 'PROCESSING' | 'PUBLISH_COMPLETE' }`.

## Success Criteria

### Measurable Outcomes
- **SC-001**: Once TikTok approves the app from Sandbox and operator sets the
  4 secrets, the next `auto-shorts.yml` run posts the variants to TikTok with
  zero further intervention.
- **SC-002**: Without secrets, the new step adds < 5s to workflow runtime.
- **SC-003**: Zero regressions to YouTube/Instagram/distribute steps.

## Assumptions
- Operator has completed `docs/tiktok-setup.md` (TikTok Developer Portal →
  Content Posting API → Sandbox approval, typically 3-7 days).
- The access token in `TIKTOK_ACCESS_TOKEN` is refreshed externally (manual
  weekly, or via a future refresh-token cron — out of scope for F005).
