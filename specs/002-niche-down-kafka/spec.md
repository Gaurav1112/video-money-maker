# Feature Specification: Niche-Down to Kafka + Auto LinkedIn Cross-Post

**Feature Branch**: `002-niche-down-kafka`

**Created**: 2026-05-21

**Status**: Draft

**Input**: User description: "Niche down the daily-shorts pipeline to Kafka only for the next 30 days and auto-publish a text-first LinkedIn post (link in first comment) for every YouTube upload."

---

## Context

The brutal-truth review on 2026-05-21 found `@GuruSishya-India` scoring 38/100 (failing). Root cause #1: the algorithm cannot categorize the channel because 49 public videos span 12 sub-niches, so no recommendation flywheel forms. Root cause #3: zero off-platform distribution. The chosen remedy: niche down to **one** topic (Kafka) for 30 days and cross-post every Short to LinkedIn (text-first, link-in-first-comment — the LinkedIn algorithm penalizes posts that send users off-platform when the URL is in the body).

This feature is binding on the daily-shorts pipeline (`auto-shorts.yml` and `daily-short.yml`). Long-form (`LongVideo.tsx`) is out of scope; it already publishes infrequently.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Niche-down quiz selection (Priority: P1)

The daily Shorts cron picks a quiz. Today it picks from all 12 topics. From now until **2026-06-20**, the picker MUST select only quizzes where `topic === 'kafka'` so the YouTube algorithm sees 30 days of consistent topical signal and starts forming a recommendation cluster. The lock auto-expires on 2026-06-20 unless extended via env var. An operator override is available for both axes (force a different lock topic, or unlock entirely) via env or CLI flag.

**Why this priority**: This is the root-cause fix. Without it, cross-posting amplifies a confused topical signal. Niche-down alone (no cross-post) still delivers value — the YouTube algorithm starts re-categorizing within ~10 uploads.

**Independent Test**: Run `npx tsx scripts/render-daily-short.ts` ten times across ten different simulated dates between today and 2026-06-20. Every selected quiz has `topic === 'kafka'`. Run again for a simulated date of 2026-06-21 — at least one non-Kafka quiz appears in the rotation.

**Acceptance Scenarios**:

1. **Given** today is 2026-05-25, **When** `getDailyQuiz()` runs without overrides, **Then** the returned quiz has `topic === 'kafka'`.
2. **Given** today is 2026-06-25 (after lock expiry), **When** `getDailyQuiz()` runs without overrides, **Then** the returned quiz is selected from the full bank (Kafka still possible, but not enforced).
3. **Given** `QUIZ_TOPIC_LOCK=redis` is set, **When** `getDailyQuiz()` runs, **Then** the returned quiz has `topic === 'redis'`.
4. **Given** `QUIZ_TOPIC_LOCK=off` is set, **When** `getDailyQuiz()` runs, **Then** behavior matches pre-feature (full rotation).
5. **Given** `--topic kafka` CLI flag is passed to `render-daily-short.ts`, **When** the script picks a quiz, **Then** the picker uses that topic filter regardless of env / lock date.

---

### User Story 2 — Auto LinkedIn cross-post (Priority: P1)

Each variant uploaded to YouTube triggers a follow-up step that publishes a text-first LinkedIn post on the operator's personal profile. The post body is a hook + curiosity gap (no URL). Immediately after the post lands, a comment is added to that post containing the YouTube URL with a 1-line CTA. This is the LinkedIn-algorithm-friendly pattern: posts without outbound links get materially more reach than posts with a URL in the body, and a self-comment with the link costs nothing in reach.

**Why this priority**: Distribution is the #2 root cause. A LinkedIn audience of 500 engineers reaches more eyeballs in week one than 12 YouTube subs do in a month. Without this, the niche-down alone takes 60-90 days to compound; with cross-post, week-one views compound much faster.

**Independent Test**: Manually run `npx tsx scripts/cross-post-linkedin.ts --video-id dQw4w9WgXcQ --title "test" --quote "test twist"`. Inspect the operator's LinkedIn profile: the post is live, the body contains no URL, the first comment contains the YouTube URL.

**Acceptance Scenarios**:

1. **Given** a YouTube upload has just completed with videoId `abc123`, **When** the cross-post step runs, **Then** a new LinkedIn post is created on the operator's profile via the LinkedIn `/ugcPosts` API.
2. **Given** the LinkedIn post is created successfully, **When** the cross-post step continues, **Then** a comment is posted on that LinkedIn post via `/socialActions/{ugcPostUrn}/comments` containing the YouTube URL.
3. **Given** the LinkedIn post body builder runs, **When** the body is generated, **Then** the body contains the quiz title, the twist, the CTA "link in first comment", and the hashtags — and contains NO `https://` substring.
4. **Given** LinkedIn API returns 5xx, **When** the cross-post step runs, **Then** the workflow logs the error but DOES NOT fail the overall pipeline (continue-on-error semantics).
5. **Given** required env vars (LINKEDIN_ACCESS_TOKEN, LINKEDIN_USER_URN) are missing, **When** the script starts, **Then** it exits with a clear "setup not complete" message and a non-zero exit code, without crashing.

---

### User Story 3 — Per-post deduplication (Priority: P2)

Re-runs of the workflow (manual workflow_dispatch, retries, etc.) MUST NOT double-post the same video to LinkedIn. The cross-poster tracks each posted videoId in `data/linkedin-posted/<videoId>.json` and skips already-posted videos with a friendly log line.

**Why this priority**: P2 because the workflow is mostly cron-driven and re-runs are rare. But a double-post on LinkedIn is publicly visible and embarrassing; the cost of dedup is one file write so it ships in v1.

**Independent Test**: Run `cross-post-linkedin.ts --video-id xyz999 --title t --quote q` twice in a row. First run: LinkedIn API called, dedup file created. Second run: no LinkedIn API call, log message "already cross-posted on …", exit code 0.

**Acceptance Scenarios**:

1. **Given** `data/linkedin-posted/abc123.json` does not exist, **When** cross-post runs for videoId `abc123`, **Then** the script posts to LinkedIn and writes the dedup record.
2. **Given** `data/linkedin-posted/abc123.json` already exists, **When** cross-post runs for videoId `abc123`, **Then** the script logs "already cross-posted" and exits 0 without calling LinkedIn.
3. **Given** the dedup record exists, **When** the operator passes `--force`, **Then** the script re-posts and overwrites the record.

---

### Edge Cases

- LinkedIn access token expires (default 60 days) — script must surface a clear `401 → re-auth required` error, exit non-zero, and the workflow's `continue-on-error: true` ensures the YouTube upload itself is not marked failed.
- LinkedIn rate limit hit (100 posts/day for `w_member_social`) — at 2 posts/day this is irrelevant; if exceeded, treat as transient (log + exit non-zero).
- Quiz bank exhausted for `topic === 'kafka'` (currently 12 quizzes, 30 days = 30 needed) — the index math wraps modulo the filtered pool; repeating quizzes across the lock window is acceptable for v1; flagged in operator-setup doc as a known limitation that will resolve when we add more Kafka quizzes.
- Operator override conflicts (`QUIZ_TOPIC_LOCK=redis` + `--topic kafka`) — CLI flag wins; env is the fallback.
- Lock-expiry date passes mid-render — date is captured once at script start; no half-state.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** `getDailyQuiz(date)` MUST accept an optional `topicFilter?: string` parameter that restricts the candidate pool to quizzes whose `topic` matches.
- **FR-002** `getDailyQuiz()` MUST consult environment variable `QUIZ_TOPIC_LOCK` and a built-in constant `LOCK_EXPIRES = "2026-06-20"`. If `QUIZ_TOPIC_LOCK === 'off'`, no filter applies. Otherwise: if today is on or before `LOCK_EXPIRES`, apply `QUIZ_TOPIC_LOCK ?? 'kafka'` as the filter; if today is after `LOCK_EXPIRES`, ignore the default lock unless `QUIZ_TOPIC_LOCK` is explicitly set to a non-empty topic.
- **FR-003** `render-daily-short.ts` MUST accept a `--topic <slug>` CLI flag that takes precedence over env and lock-date logic.
- **FR-004** A new script `scripts/cross-post-linkedin.ts` MUST accept `--video-id`, `--title`, `--quote`, `--upload-result-json` (path), and `--force` flags.
- **FR-005** `cross-post-linkedin.ts` MUST authenticate via env vars `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_USER_URN`. Missing creds → fail-fast with explicit message + exit 1.
- **FR-006** `cross-post-linkedin.ts` MUST publish a UGC post via LinkedIn API `POST /v2/ugcPosts` with `shareCommentary.text` built from the deterministic template (see Plan).
- **FR-007** `cross-post-linkedin.ts` MUST verify the post body contains NO `https://` substring before sending. If the check fails, exit non-zero without calling the API.
- **FR-008** After successful post, `cross-post-linkedin.ts` MUST publish a comment via `POST /v2/socialActions/{ugcPostUrn}/comments` with the YouTube URL formatted as `Full breakdown: https://youtu.be/<videoId> — what would you have answered?`.
- **FR-009** `cross-post-linkedin.ts` MUST write a dedup record at `data/linkedin-posted/<videoId>.json` containing `{ videoId, ugcPostUrn, commentUrn, postedAt }` after a successful run.
- **FR-010** Before any network call, `cross-post-linkedin.ts` MUST check for existing dedup record; if present and `--force` not passed, log + exit 0.
- **FR-011** The workflow `auto-shorts.yml` MUST add a "Cross-post variants to LinkedIn" step after each upload step, gated by `continue-on-error: true`, so a LinkedIn failure does not red the entire workflow.
- **FR-012** The workflow MUST commit any new `data/linkedin-posted/*.json` files alongside the existing variant-record commit step.

### Non-Functional Requirements

- **NFR-001** Determinism (Constitution I) — post body and comment text MUST be pure functions of `(title, twist, videoId)`. No `Math.random`, no timestamp in the body.
- **NFR-002** Offline-first (Constitution II) — only network call is to `api.linkedin.com`; no analytics SDKs, no LinkedIn JS sneaks.
- **NFR-003** Automation (Constitution III) — zero human-in-the-loop after operator one-time OAuth setup.
- **NFR-004** Secret hygiene (Constitution IX) — `data/linkedin-posted/*.json` MUST NOT contain access tokens. `.env`, `.linkedin-token.json` MUST be in `.gitignore` (already covered by `.env*` glob; verify).
- **NFR-005** Single-path pipeline (Constitution VIII) — only `auto-shorts.yml` gets the cross-post step in v1. `daily-short.yml` is the deprecation candidate; documented in plan.
- **NFR-006** No new pre-existing-test failures (Constitution governance).

### Key Entities

- **TopicLock**: `{ topic: string, expires: ISO date }` — implicit, encoded as constants in `quiz-content.ts`.
- **LinkedInPostRecord**: `{ videoId, ugcPostUrn, commentUrn, postedAt }` — one JSON file per YouTube video that has been cross-posted, stored at `data/linkedin-posted/<videoId>.json`.

---

## Success Criteria *(mandatory)*

- **SC-001** Within 14 days of merge, at least 95% of new Shorts published to YouTube also appear as LinkedIn posts on the operator profile, verified by counting `data/linkedin-posted/*.json` files committed in that window vs videoIds uploaded.
- **SC-002** Zero LinkedIn posts contain a `https://` URL in the post body (verified by grep on rendered post-body samples emitted in workflow logs).
- **SC-003** Zero duplicate LinkedIn posts in the 30-day window (verified by manual scroll of operator profile + dedup file count matches LinkedIn post count).
- **SC-004** Channel topical-consistency score on the next brutal-truth audit (planned 2026-06-25) improves from 38/100 toward 60/100, with the audit explicitly noting "channel is now categorizable as Kafka-focused".
- **SC-005** Operator setup (one-time LinkedIn OAuth) completes in 20 minutes or less following `docs/linkedin-setup.md`.

---

## Assumptions

- Operator has, or is willing to create, a LinkedIn Developer App with the `w_member_social` scope.
- Operator's personal LinkedIn URN can be retrieved once via `/v2/me` and cached as the `LINKEDIN_USER_URN` secret; URNs do not change.
- The `axios` HTTP client (already in `package.json`) is sufficient for LinkedIn API calls; no new dependencies.
- The Kafka quiz bank (currently 12 entries) is acceptable to repeat across the 30-day window; expansion to 30+ Kafka quizzes is out-of-scope for v1.
- Reddit / Twitter cross-post is **deferred** — Twitter has 280-char limits that conflict with the hook+twist template, and Reddit's anti-spam algorithms require karma we don't have. We will revisit after we have 14 days of LinkedIn engagement data.

---

## Out of Scope

- LinkedIn refresh-token rotation logic (operator re-auths every 60 days via documented quarterly checklist).
- Cross-posting to Reddit, Twitter/X, Mastodon, Threads, Bluesky.
- LinkedIn Company-Page posting (only operator's personal profile in v1).
- Posting analytics ingestion from LinkedIn (no `r_organization_social` scope requested).
- Long-form video cross-post (only Shorts).
- Migrating `daily-short.yml` to also cross-post; only `auto-shorts.yml` in v1.

---

## Constitution Alignment Checklist

- [x] **I. Deterministic Everything** — post body / comment are pure functions of quiz fields + videoId.
- [x] **II. All-Local, Offline-First** — only new network egress is `api.linkedin.com`, which is the documented exception class (publishing endpoint, mirrors YouTube upload).
- [x] **III. Automation Over Manual** — zero human interaction after one-time OAuth.
- [x] **IV. Measure Before You Optimize** — SC-004 ties this work to the next brutal-truth audit on 2026-06-25.
- [x] **V. Subtraction Before Addition** — we are *removing* 11 of 12 topics from the rotation; we add only one new script.
- [x] **VI. Indian Voice + AI Avatar** — not touched.
- [x] **VII. Render-Preview-Before-Render-Full** — N/A (this feature does not change rendering).
- [x] **VIII. Single-Path Pipelines** — `daily-short.yml` flagged as deprecation candidate in plan.
- [x] **IX. Secret Hygiene** — env-var-only credentials, dedup records contain no tokens, `.env*` already gitignored.
- [x] **X. Branch-Per-Feature + Fast-Forward Merges** — work happens on `002-niche-down-kafka`.
