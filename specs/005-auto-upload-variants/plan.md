# F005 Plan — TikTok Content Posting API auto-upload

## Components

### `scripts/lib/tiktok-client.ts`
- One exported function:
  `uploadToTikTok(videoPath: string, caption: string, opts: { accessToken, openId }): Promise<{ publishId: string }>`.
- Steps:
  1. `POST https://open.tiktokapis.com/v2/post/publish/inbox/video/init/` with
     `{ source_info: { source: 'FILE_UPLOAD', video_size, chunk_size, total_chunk_count: 1 } }`.
     Header: `Authorization: Bearer <token>`. Returns `{ data: { publish_id, upload_url } }`.
  2. `PUT <upload_url>` with the binary video, `Content-Range: bytes 0-<size-1>/<size>`,
     `Content-Type: video/mp4`.
  3. (For inbox-style upload the publish completes implicitly after upload; for
     direct-post we'd call `/v2/post/publish/video/init/` with `post_info`. We
     use direct-post: `POST /v2/post/publish/video/init/` with `post_info: { title: caption, privacy_level: 'SELF_ONLY' (sandbox) or 'PUBLIC_TO_EVERYONE' (production) }` + the same `source_info`. Returns same shape, then PUT binary.)
- No SDK; node:https + node:fs streams. Caption truncated to 2200 chars (TikTok
  limit).

### `scripts/upload-tiktok.ts`
- CLI wrapper. Reads `metadata.youtube.title` for the caption base, appends
  5 default hashtags `#programming #coding #tech #devtok #learnontiktok`.
- Env guard: missing any of `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`,
  `TIKTOK_ACCESS_TOKEN`, `TIKTOK_OPEN_ID` → exit 0 with skip log.
- Privacy level: respects `TIKTOK_PRIVACY_LEVEL` env (defaults to
  `SELF_ONLY` to be safe during sandbox; operator sets to
  `PUBLIC_TO_EVERYONE` after production approval).

### `.github/workflows/auto-shorts.yml`
- New step "Upload variants to TikTok (F005)" inserted AFTER the F004
  Instagram step, BEFORE distribute. `continue-on-error: true`.

### `docs/tiktok-setup.md`
- Operator setup, ~3-7 days (includes Sandbox approval wait).

## Tests

- `scripts/__tests__/upload-tiktok.test.ts`: spawn-based smoke. Missing env
  → exit 0 with skip message. Missing positional args → exit 1.
- `scripts/__tests__/tiktok-caption.test.ts`: pure-function test on the caption
  builder (truncation + hashtag append).

## Failure modes
| Failure | Behavior |
|---|---|
| Token expired (401) | Log clear message; exit 1 (workflow `continue-on-error` catches) |
| Video too large (413) | Log; exit 1 |
| Network failure on PUT | One retry; if still failing, exit 1 |
| Sandbox rate limit | Log; exit 1 |

## Determinism
Caption builder is pure (no Math.random). Same metadata → same caption.
