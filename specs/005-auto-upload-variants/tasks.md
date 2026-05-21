# F005 Tasks — TikTok Content Posting API

- **T1** (TDD): `scripts/__tests__/tiktok-caption.test.ts` — failing test on
  `buildTikTokCaption(metadata)`. Asserts ≤2200 chars, ends with the 5
  default hashtags, deterministic. Then implement
  `scripts/lib/tiktok-caption.ts`.
- **T2**: `scripts/lib/tiktok-client.ts` — init (direct-post) + PUT upload via
  node:https + node:fs streams. No SDK.
- **T3**: `scripts/upload-tiktok.ts` CLI wrapper — 4-env guard, derives caption
  via T1, delegates to T2.
- **T4** (TDD): `scripts/__tests__/upload-tiktok.test.ts` — spawn smoke,
  asserts skip path exits 0 + missing-args exits 1. Then verify implementation.
- **T5**: Add "Upload variants to TikTok (F005)" step in
  `.github/workflows/auto-shorts.yml`. `continue-on-error: true`.
- **T6**: `docs/tiktok-setup.md` — operator setup including Sandbox wait.
