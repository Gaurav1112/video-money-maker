# Feature 004 — Instagram Reels auto-upload from `auto-shorts.yml`

**Feature Branch**: `004-auto-upload-instagram`
**Created**: 2026-05-21
**Status**: Draft

## User Scenarios & Testing

### User Story 1 — Every Short uploaded to YouTube also lands on Instagram Reels (Priority: P1)
After the existing YouTube upload step in `auto-shorts.yml` succeeds for an A/B
variant, the same MP4 + metadata is auto-published as an Instagram Reel via the
Graph API, with no operator action.

**Why P1**: This is the entire feature. Instagram reach is the goal.

**Independent Test**: Run `npx tsx scripts/upload-instagram-wrapper.ts <mp4>
<meta>` locally without `INSTAGRAM_*` env vars set → script exits 0 with a
clear "skipping" log, never throws.

**Acceptance Scenarios**:
1. **Given** a successful YouTube upload, **When** the new Instagram step runs
   with valid `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_BUSINESS_ID`, **Then** the
   Reel is published and the public URL appears in the workflow log.
2. **Given** the Instagram step fails (any reason), **When** the workflow
   continues, **Then** the YouTube pipeline is NOT marked as failed
   (per `continue-on-error: true`).

### User Story 2 — Missing secrets degrade gracefully (Priority: P1)
If `INSTAGRAM_ACCESS_TOKEN` or `INSTAGRAM_BUSINESS_ID` are not configured, the
step exits 0 with a clear skip message — does not fail the workflow.

**Why P1**: Lets the change merge without immediately requiring operator setup.

**Independent Test**: Run the wrapper with `INSTAGRAM_ACCESS_TOKEN` unset →
exit code 0, message contains `INSTAGRAM_ACCESS_TOKEN missing`.

**Acceptance Scenarios**:
1. **Given** missing secrets, **When** the step runs, **Then** the wrapper
   prints `[ig-wrapper] INSTAGRAM_ACCESS_TOKEN missing — skipping` and exits 0.

### Edge Cases
- The existing `publish-to-instagram.ts` requires a publicly hosted video URL
  (Instagram Graph API limitation). Without R2 secrets, it cannot publish even
  with valid IG tokens. The wrapper checks for R2 secrets too and skips with a
  message rather than failing.
- Multi-variant case: if both `-variantA` and `-variantB` MP4s exist, both
  upload to Instagram independently. One failing must not block the other.

## Requirements

### Functional Requirements
- **FR-001**: A new step in `.github/workflows/auto-shorts.yml` MUST iterate the
  rendered Short variants and invoke a wrapper for each.
- **FR-002**: The wrapper `scripts/upload-instagram-wrapper.ts` MUST exit 0
  when `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ID`, `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, or
  `R2_PUBLIC_URL` is missing.
- **FR-003**: When all required secrets are set, the wrapper MUST delegate to
  the existing `scripts/publish-to-instagram.ts` with the correct args.
- **FR-004**: The workflow step MUST use `continue-on-error: true` so an
  Instagram failure does not break the YouTube pipeline.
- **FR-005**: No changes to `scripts/publish-to-instagram.ts` (treat as a
  stable library function — wrap, don't modify).

### Key Entities
- **VariantMp4**: existing — `output/daily-short/<slug>-variant{A,B}.mp4`.
- **MetadataJson**: existing — `output/daily-short/<slug>-metadata.json`.

## Success Criteria

### Measurable Outcomes
- **SC-001**: On the day operator configures all 7 IG+R2 secrets, the next
  `auto-shorts.yml` run publishes the variants to Instagram with zero
  additional intervention.
- **SC-002**: With secrets unconfigured, the new step adds < 5 seconds to the
  workflow runtime.
- **SC-003**: Zero regressions: existing YouTube upload + variants + distribute
  steps continue to work unchanged.

## Assumptions
- Operator has completed `docs/instagram-setup.md` (FB App + IG Business
  account + long-lived token + R2 bucket).
- The existing `scripts/publish-to-instagram.ts` is functional as audited in
  `docs/distribution-audit.md`.
