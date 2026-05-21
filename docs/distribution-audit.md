# Distribution Scripts Audit (pre-F003/004/005)

Date: 2026-05-21. Scope: inventory the existing cross-platform scripts to decide
extend-vs-rewrite for upcoming features F003 (Dev.to + Hashnode), F004 (Instagram
Reels in `auto-shorts.yml`), F005 (TikTok Content Posting API).

## Scripts

### `scripts/cross-post-x.ts` (130 LOC)
- Status: **functional**. Single-file OAuth 1.0a HMAC-SHA1, no SDK.
- Setup: 4 secrets (`X_API_*`, `X_ACCESS_*`). Exits 0 if missing.
- Wired: `daily-short.yml`, `daily-publish-hinglish.yml`. **Not in `auto-shorts.yml`.**
- Pattern to mirror for F003/004/005: ✅ secrets-or-skip, single file, no SDK.

### `scripts/distribute-short.ts` (445 LOC)
- Status: **functional asset generator**, not an uploader. Emits
  `output/distribute/<id>/{youtube,instagram,tiktok,linkedin,twitter,reddit}/`.
- Setup: none.
- Wired: `auto-shorts.yml` line 201 (`|| true`).
- Useful for F004/F005 — both can consume the `instagram/caption.txt` and
  `tiktok/caption.txt` it already writes.

### `scripts/post-community.ts` (297 LOC)
- Status: **Playwright-driven** (YouTube Studio cookies). Brittle, not used by
  current daily workflows. Out of scope for F003-005.

### `scripts/post-to-platforms.sh` (354 LOC)
- Status: **legacy local-only** dispatcher. Sources `~/.env-video-pipeline`,
  Reddit via PRAW, Twitter via curl, TikTok = "manual instructions" print.
- Not wired into any workflow. Will not be extended; superseded by per-platform
  TS scripts.

### `scripts/publish-to-instagram.ts` (531 LOC)
- Status: **functional**. Graph API v21.0 + optional R2 upload. Polls container,
  publishes Reel, supports multi-clip.
- Setup: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ID`, optional R2.
- Wired: `daily-short.yml` line 511, `daily-publish-hinglish.yml` line 237.
- **Not in `auto-shorts.yml`** → F004 = add one step after the YouTube upload
  in `auto-shorts.yml`. No rewrite needed.

### `scripts/upload-instagram.ts` (328 LOC)
- Status: **near-duplicate** of `publish-to-instagram.ts`, single-clip only.
  Wired only in `render-and-publish.yml`. Principle VIII candidate for
  deprecation; not in F004 scope.

## Decisions Going Into F003-005

| Feature | Pattern | Reuse | New code |
|---|---|---|---|
| F003 Dev.to+Hashnode | mirror `cross-post-x.ts` (secrets-or-skip, no SDK) | none | `lib/devto-client.ts`, `lib/hashnode-client.ts`, `synthesize-weekly.ts`, `weekly-article.yml` |
| F004 Instagram Reels | reuse `publish-to-instagram.ts` as-is | full | one new step in `auto-shorts.yml`, `docs/instagram-setup.md` |
| F005 TikTok | mirror `cross-post-x.ts` (Content Posting API needs OAuth2 access token only at runtime) | none | `lib/tiktok-client.ts`, `upload-tiktok.ts`, `docs/tiktok-setup.md`, step in `auto-shorts.yml` |

All three additions use `continue-on-error: true` in the workflow per the task
constraints; platform failures must not break the YouTube pipeline.

## Out of Scope

- LinkedIn (dropped per Principle IV — algo external-link penalty + reputation risk).
- `post-community.ts` Playwright path.
- Deduplicating `upload-instagram.ts` vs `publish-to-instagram.ts` (Principle VIII
  follow-up, tracked separately).
