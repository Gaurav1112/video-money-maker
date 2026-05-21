# Feature 003 — Weekly Synthesis to Dev.to + Hashnode

**Feature Branch**: `003-auto-publish-weekly`
**Created**: 2026-05-21
**Status**: Draft

## User Scenarios & Testing

### User Story 1 — Sunday weekly digest auto-publishes (Priority: P1)
Every Sunday at 10:00 AM IST, a recap article is auto-published covering the
week's 5 quiz Shorts so dev-community readers discover the channel without any
manual writing.

**Why P1**: This is the entire feature. Without auto-publish there is nothing.

**Independent Test**: Run `npx tsx scripts/synthesize-weekly.ts --dry-run` with
5 fixture Shorts → verify a valid Markdown article is printed to stdout.

**Acceptance Scenarios**:
1. **Given** 5 Shorts published Mon–Fri, **When** the Sunday cron fires,
   **Then** both Dev.to and Hashnode return 2xx and the article URLs are
   printed to the workflow log.
2. **Given** zero Shorts published in the week, **When** the cron fires,
   **Then** the script exits 0 with `[weekly-article] no Shorts in window, skipping`.

### User Story 2 — Both platforms post with canonical URL (Priority: P1)
Both Dev.to and Hashnode posts set `canonical_url` to the @GuruSishya-India
YouTube channel so SEO juice flows back and duplicate-content penalty is avoided.

**Why P1**: Without canonical_url, posting harms the channel's SEO.

**Independent Test**: Unit test the payload builders — assert payload contains
the canonical URL field with the expected value.

**Acceptance Scenarios**:
1. **Given** any synthesis run, **When** the Dev.to payload is built, **Then**
   `article.canonical_url == https://www.youtube.com/@GuruSishya-India`.
2. **Given** any synthesis run, **When** the Hashnode mutation is built,
   **Then** `originalArticleURL == https://www.youtube.com/@GuruSishya-India`.

### User Story 3 — Dedup: re-running doesn't double-post (Priority: P2)
A manual re-trigger of the workflow in the same ISO week is a no-op so
readers are never spammed.

**Why P2**: Operator quality-of-life; correctness already covered by P1.

**Independent Test**: Run the script twice in the same week → second run
exits 0 without calling the API clients.

**Acceptance Scenarios**:
1. **Given** `data/articles-posted/2026-W21.json` exists, **When** the
   workflow runs, **Then** the script logs `already posted for 2026-W21, skipping`
   and exits 0 before any network call.

### Edge Cases
- ISO week boundary: the cron runs Sunday 10:00 IST; we use the ISO week that
  contains the *previous* Saturday (the week we are summarizing).
- API rate limits: Dev.to is 10 articles/day; Hashnode has no published limit.
  We post 1 article/week, well below either limit.
- Missing analytics: if `data/analytics/<id>.json` is absent for a Short, we
  fall back to title + URL only (no view counts in the article).
- Partial failure: if Dev.to succeeds and Hashnode fails (or vice versa),
  the dedup file records *which* platforms posted so the next run can retry
  only the failed one.

## Requirements

### Functional Requirements
- **FR-001**: System MUST read the last 5 quiz Shorts from `data/variants/`
  whose published timestamp falls within the previous ISO week (Mon–Sun, IST).
- **FR-002**: System MUST render a deterministic Markdown article (same input
  → byte-identical output, no LLM, no `Math.random`).
- **FR-003**: System MUST POST the article to Dev.to via
  `POST https://dev.to/api/articles` with the `api-key` header.
- **FR-004**: System MUST POST the article to Hashnode via the GraphQL
  `publishPost` mutation against `https://gql.hashnode.com`.
- **FR-005**: Both payloads MUST set canonical URL to
  `https://www.youtube.com/@GuruSishya-India`.
- **FR-006**: System MUST record a JSON file at
  `data/articles-posted/<iso-week>.json` containing both response URLs and
  the platforms that succeeded.
- **FR-007**: Re-running for the same ISO week MUST be a no-op (read the
  dedup file; skip platforms already recorded as success).
- **FR-008**: Missing API tokens MUST cause an early exit 0 with a clear
  log message (so CI does not fail when secrets are unconfigured locally).

### Key Entities
- **Short**: `{ id, title, url, publishedAt, topic, analytics? }`. Source:
  `data/variants/*.json`.
- **WeeklyDigest**: `{ isoWeek, shorts[], canonicalUrl, title, markdownBody }`.
  Derived deterministically from 5 Shorts.
- **PostRecord**: `{ isoWeek, devto: { url, id } | null, hashnode: { url, id } | null }`.
  Persisted to `data/articles-posted/<iso-week>.json`.

## Success Criteria

### Measurable Outcomes
- **SC-001**: The Sunday cron runs unattended for 4 consecutive Sundays without
  manual intervention.
- **SC-002**: Each weekly run completes in < 30 seconds wall-clock.
- **SC-003**: Within 4 weeks of going live, the article series accrues ≥ 200
  cumulative Dev.to reactions + Hashnode views combined.
- **SC-004**: Re-triggering the workflow twice in the same week never produces
  duplicate posts (verified by inspecting Dev.to + Hashnode dashboards).

## Assumptions
- Operator has set GitHub Secrets `DEVTO_API_KEY` and `HASHNODE_API_KEY` and
  `HASHNODE_PUBLICATION_ID` per `docs/devto-hashnode-setup.md`.
- `data/variants/` exists and contains entries with at least `id`, `title`,
  `youtubeUrl`, `publishedAt`, `topic`.
- The repo's existing GitHub Actions runner can reach `dev.to` and
  `gql.hashnode.com` (no extra firewall rules needed).
- LinkedIn is intentionally NOT included (dropped per prior research; algo
  penalty + reputation risk).
