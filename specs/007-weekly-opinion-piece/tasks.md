# Feature 007 — Task Breakdown

**Branch**: `007-weekly-opinion-piece`
**Spec**: [`spec.md`](./spec.md)
**Plan**: [`plan.md`](./plan.md)

---

## T1 — OpinionThumbnail composition

**Files**: `src/compositions/OpinionThumbnail.tsx` (new), `src/compositions/index.tsx` (modify).

**What**:
- New 1280×720, 30fps, 1-frame composition.
- Movie-poster layout: deep gradient background, brand bar at top, "OPINION" eyebrow label, big essay title (max 3 lines), small slug/date at bottom, brand watermark.
- Props: `{ title: string; slug: string }`.
- Register in `index.tsx` with sensible `defaultProps`.

**Acceptance**: `npx tsx -e "import {RemotionRoot} from './src/compositions/index.tsx'"` typechecks. Visual smoke via `npx remotion studio` optional.

---

## T2 — Render thumbnail + emit two metadata files

**Files**: `scripts/render-opinion-piece.ts` (modify).

**What**:
- Replace the single `metadata.json` write with two writes: `long-metadata.json` + `short-metadata.json`.
- Add a thumbnail render step: `npx remotion still src/compositions/index.tsx OpinionThumbnail <outDir>/long-thumbnail.jpg --props=<json> --frame=0 --image-format=jpeg`.
- Long-metadata: full description (hook + sections + chapters), 6-10 tags including `opinion`, `leadership`, slug-derived keywords, categoryId `28`.
- Short-metadata: terse description, 4-6 tags, title truncated for `#Shorts` suffix budget, categoryId `28`.
- Both metadata files match the shape of `MetadataFile` in `upload-youtube.ts`.

**Acceptance**: Re-run on Episode 001; verify `long-metadata.json`, `short-metadata.json`, `long-thumbnail.jpg` all exist. `npx tsc --noEmit` clean.

---

## T3 — Upload orchestrator script

**Files**: `scripts/upload-opinion-piece.ts` (new).

**What**:
- CLI: `npx tsx scripts/upload-opinion-piece.ts [--episode <slug>] [--dry-run] [--skip-render]`.
- `pickNextEpisode(contentDir, publishedDir): string | null`: list `*.md` in `content/opinions/`, sort ascending, return first whose slug has no `data/opinions-published/<slug>.json`. Return `null` if none.
- If `--episode <slug>` passed, validate the markdown file exists, fail fast otherwise.
- Run `npx tsx scripts/render-opinion-piece.ts <slug>` via `execSync`.
- Run `npx tsx scripts/upload-youtube.ts <out>/long.mp4 <out>/long-metadata.json --thumbnail <out>/long-thumbnail.jpg` (no `--shorts` flag).
- Run `npx tsx scripts/upload-youtube.ts <out>/short.mp4 <out>/short-metadata.json --shorts`.
- Parse the two `.upload-result.json` sidecars `upload-youtube.ts` writes; extract video IDs.
- Write `data/opinions-published/<slug>.json` with `{ slug, longVideoId, longUrl, shortVideoId, shortUrl, publishedAt }`.
- `--dry-run` short-circuits BEFORE any `upload-youtube.ts` calls; prints the plan and exits 0.
- If `pickNextEpisode` returns null AND no `--episode`, log "no unpublished episodes" and exit 0.

**Acceptance**: Local `--dry-run` against Episode 001 prints expected commands. `npx tsc --noEmit` clean.

---

## T4 — TDD: picker + dedupe writer

**Files**: `scripts/__tests__/upload-opinion-piece.test.ts` (new).

**What**: Vitest cases covering:
1. `pickNextEpisode` returns lowest-numbered slug with no dedupe record.
2. `pickNextEpisode` skips slugs that already have records.
3. `pickNextEpisode` returns `null` when all are published.
4. `writeDedupeRecord(slug, longResult, shortResult)` produces a JSON file with the expected shape.
5. `writeDedupeRecord` refuses to overwrite an existing dedupe record (throws).

Export `pickNextEpisode` and `writeDedupeRecord` from `upload-opinion-piece.ts` so tests can import them.

**Acceptance**: `npx vitest run scripts/__tests__/upload-opinion-piece.test.ts` → 5 pass.

---

## T5 — GitHub Actions workflow

**Files**: `.github/workflows/weekly-opinion.yml` (new).

**What**:
- `on: schedule: - cron: '0 12 * * 0'` (Sundays 12 UTC = 17:30 IST).
- `on: workflow_dispatch: inputs: episode (string, optional)`.
- `permissions: contents: write` so the dedupe-record commit step can push.
- `concurrency: group: weekly-opinion, cancel-in-progress: false`.
- `timeout-minutes: 50`.
- Steps mirror `auto-shorts.yml` install pattern: actions/checkout@v4, actions/setup-node@v4 (node 20), npm ci, install ffmpeg, install edge-tts, `npx remotion browser ensure`.
- Run `npx tsx scripts/upload-opinion-piece.ts --episode "${{ inputs.episode }}"` (empty input → orchestrator falls back to picker).
- Final step: `git add data/opinions-published/ && git commit && git push` guarded by `if ! git diff --cached --quiet`.

**Acceptance**: `gh workflow list | grep weekly-opinion` shows the workflow after push.

---

## T6 — Dedupe directory placeholder

**Files**: `data/opinions-published/.gitkeep` (new, empty).

**What**: Empty file so `data/opinions-published/` is tracked even when no episodes published.

**Acceptance**: `git ls-files data/opinions-published/` includes `.gitkeep`.

---

## T7 — Local smoke test (`--dry-run`)

**Files**: none (verification step).

**What**:
- `npx tsx scripts/upload-opinion-piece.ts --episode 001-microservices-vs-monolith --dry-run --skip-render`.
- Confirm the script prints: "Would upload long.mp4 with long-metadata.json", "Would upload short.mp4 with --shorts", "Would write data/opinions-published/001-...json", exits 0, makes NO real YouTube calls.
- `npx tsc --noEmit` final clean check.

**Acceptance**: Local smoke run succeeds; no real uploads triggered.

---

## T8 — Commit, merge, push

**Files**: git operations.

**What**:
- Commit each prior task as a discrete commit on branch `007-weekly-opinion-piece`.
- Fast-forward merge to `main`.
- Push `main` to origin.

**Acceptance**: `git log --oneline main -10` shows the F007 commits.

---

## Post-T8 — Live publish trigger (operator action)

After merge, manually trigger:

```bash
gh workflow run weekly-opinion.yml --ref main -f episode=001-microservices-vs-monolith
gh run watch <run-id>
```

Confirm two YouTube URLs appear in the run summary; verify the dedupe record commit lands on `main`.
