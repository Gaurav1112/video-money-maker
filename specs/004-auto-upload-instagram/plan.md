# F004 Plan — Instagram Reels in `auto-shorts.yml`

## Decision: wire-existing, do not rewrite

Per the Phase 1 audit (`docs/distribution-audit.md`), `publish-to-instagram.ts`
(531 LOC) is functional: it handles container creation, R2 upload, status
polling, and publish. Used by `daily-short.yml` + `daily-publish-hinglish.yml`.
**Not wired** into `auto-shorts.yml`. So F004 = one thin wrapper + one
workflow step.

## Why a wrapper instead of calling `publish-to-instagram.ts` directly

The existing script does `process.exit(1)` on missing token. Combined with
`continue-on-error: true`, that produces a yellow ✗ in the workflow UI every
run until the operator configures secrets — noisy.

`scripts/upload-instagram-wrapper.ts` is a 60-line guard: if any of the 7
required env vars (`INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ID`,
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
`R2_PUBLIC_URL`) is missing, exit 0. Else `spawnSync` into
`publish-to-instagram.ts` with the right CLI args and propagate its exit code.

## Workflow change

One new step inserted in `.github/workflows/auto-shorts.yml` AFTER the
"Commit variant records" step (line ~195), BEFORE "Generate distribution
packages". Iterates `output/daily-short/*.mp4`, deriving topic from the
filename and metadata path, calling the wrapper per file.

```yaml
- name: Upload variants to Instagram Reels (F004)
  if: inputs.dry_run != true
  continue-on-error: true
  env:
    INSTAGRAM_ACCESS_TOKEN: ${{ secrets.INSTAGRAM_ACCESS_TOKEN }}
    INSTAGRAM_BUSINESS_ID:  ${{ secrets.INSTAGRAM_BUSINESS_ID }}
    R2_ACCOUNT_ID:          ${{ secrets.R2_ACCOUNT_ID }}
    R2_ACCESS_KEY_ID:       ${{ secrets.R2_ACCESS_KEY_ID }}
    R2_SECRET_ACCESS_KEY:   ${{ secrets.R2_SECRET_ACCESS_KEY }}
    R2_BUCKET_NAME:         ${{ secrets.R2_BUCKET_NAME }}
    R2_PUBLIC_URL:          ${{ secrets.R2_PUBLIC_URL }}
  run: |
    for VIDEO in output/daily-short/*.mp4; do
      [ -f "$VIDEO" ] || continue
      META="${VIDEO%-variantA.mp4}"
      META="${META%-variantB.mp4}"
      META="${META}-metadata.json"
      [ -f "$META" ] || continue
      npx tsx scripts/upload-instagram-wrapper.ts "$VIDEO" "$META" || true
    done
```

## Operator setup → `docs/instagram-setup.md`

~15 min, one-time:
1. Create Facebook Page (if missing).
2. Convert Instagram account → Business + link to that Page.
3. Create FB Developer App + add Instagram Graph API product.
4. Exchange short-lived token → long-lived (60-day) via Graph API Explorer.
5. Set up Cloudflare R2 bucket (free tier) for temp video hosting.
6. `gh secret set` all 7 secrets.

## Tests

The wrapper is mostly env-checking + spawn. A vitest unit test verifies the
skip path: spawn the wrapper with missing env → exit 0, stderr contains
expected message. No mocking of FB Graph API (the existing
`publish-to-instagram.ts` is unchanged and out of scope for new tests).
