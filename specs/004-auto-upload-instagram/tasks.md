# F004 Tasks — Instagram Reels in `auto-shorts.yml`

Audit-driven: `publish-to-instagram.ts` is functional, so this is a wrap-only
feature.

- **T1** (TDD): `scripts/__tests__/upload-instagram-wrapper.test.ts` — failing
  test that spawns the wrapper with no env vars and asserts exit 0 + skip
  message. Then implement.
- **T2**: `scripts/upload-instagram-wrapper.ts` — 7 env-var guard; if all
  present, delegate to `publish-to-instagram.ts` via `spawnSync`.
- **T3**: Add "Upload variants to Instagram Reels (F004)" step in
  `.github/workflows/auto-shorts.yml` after "Commit variant records" and
  before "Generate distribution packages". `continue-on-error: true`.
- **T4**: `docs/instagram-setup.md` — full operator setup (~15 min).
- **T5**: smoke: wrapper with no env exits 0; type-check passes; vitest green;
  commit.
