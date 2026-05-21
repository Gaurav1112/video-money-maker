# F003 Plan — Weekly Synthesis to Dev.to + Hashnode

## Architecture

```
.github/workflows/weekly-article.yml      (Sun 10:00 IST cron)
  └─> npx tsx scripts/synthesize-weekly.ts
        ├─ reads data/variants/*.json    (last 5 in ISO week)
        ├─ reads data/analytics/*.json   (optional enrichment)
        ├─ reads data/articles-posted/<week>.json  (dedup)
        ├─ builds Markdown article (deterministic template)
        ├─ POST scripts/lib/devto-client.ts → dev.to API
        ├─ POST scripts/lib/hashnode-client.ts → gql.hashnode.com
        └─ writes data/articles-posted/<week>.json
```

## Components

### `scripts/lib/devto-client.ts`
- One exported function `publishToDevto(article, apiKey): Promise<{url, id}>`.
- POST `https://dev.to/api/articles` with header `api-key: <key>`.
- Body: `{ article: { title, body_markdown, canonical_url, tags, published: true } }`.
- Returns the article URL from the response.
- No SDK; uses `node:https` (matches `cross-post-x.ts` pattern).

### `scripts/lib/hashnode-client.ts`
- One exported function `publishToHashnode(article, apiKey, publicationId): Promise<{url, id}>`.
- POST `https://gql.hashnode.com` with header `Authorization: <key>`.
- Mutation `publishPost(input: { title, contentMarkdown, publicationId, originalArticleURL, tags })`.
- Returns the post URL.

### `scripts/synthesize-weekly.ts`
- CLI: `--dry-run` prints the article and exits without API calls.
- Resolves "previous ISO week" from current Date (or `--week 2026-W21` override).
- Reads `data/variants/*.json`, filters by `publishedAt` in that week, sorts
  ascending, takes first 5.
- Calls a pure `buildWeeklyArticle(shorts, isoWeek)` from a new
  `scripts/lib/weekly-template.ts` — this is the TDD seam.
- If `data/articles-posted/<isoWeek>.json` exists and both platforms succeeded,
  exits 0. Otherwise calls only the missing platforms.

### `scripts/lib/weekly-template.ts` (TDD seam)
- Pure function: `buildWeeklyArticle(shorts: Short[], isoWeek: string): { title, body, tags }`.
- Deterministic Markdown: heading, intro sentence, 5 numbered sections
  (one per Short with title + embedded YouTube link + 1-line topic gist),
  closing CTA linking back to the channel.
- Tags derived deterministically from the 5 topics (de-duplicated, lowercased,
  capped at 4 per Dev.to limit).

### `.github/workflows/weekly-article.yml`
- Cron: `30 4 * * 0` (Sunday 04:30 UTC = 10:00 IST).
- Single job, Node 20, runs `npx tsx scripts/synthesize-weekly.ts`.
- Secrets: `DEVTO_API_KEY`, `HASHNODE_API_KEY`, `HASHNODE_PUBLICATION_ID`.
- `continue-on-error` on the publish step so a single platform's failure
  doesn't fail the whole workflow.

### `data/articles-posted/.gitkeep`
- Empty file so the dedup directory exists.

## Operator Setup (~5 min total) → `docs/devto-hashnode-setup.md`
1. Dev.to: log in → Settings → Extensions → "Generate API Key" → copy →
   `gh secret set DEVTO_API_KEY`.
2. Hashnode: log in → Account Settings → Developer → "Generate New Token" →
   copy → `gh secret set HASHNODE_API_KEY`.
3. Hashnode publication ID: Settings → General → copy publication ID →
   `gh secret set HASHNODE_PUBLICATION_ID`.

## Determinism Strategy
- No `Math.random`. ISO week comes from a single Date computation.
- Tags from topic set with a stable sort.
- Snapshot test on `buildWeeklyArticle` ensures byte-identical output for a
  fixed 5-short input.

## Failure Modes
| Failure | Behavior |
|---|---|
| Missing `DEVTO_API_KEY` | Skip Dev.to with log line, still attempt Hashnode |
| Missing `HASHNODE_*` | Skip Hashnode with log line, still attempt Dev.to |
| Missing both | Exit 0 with message; workflow shows green (intentional) |
| Network 5xx | One retry with 5s backoff; if still failing, record partial success |
| Re-run same week | Read dedup file; skip platforms already in success list |
