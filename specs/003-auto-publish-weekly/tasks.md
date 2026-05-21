# F003 Tasks — Weekly Synthesis to Dev.to + Hashnode

- **T1**: `scripts/lib/devto-client.ts` — `publishToDevto(article, apiKey)` via `node:https`. POST to `https://dev.to/api/articles`.
- **T2**: `scripts/lib/hashnode-client.ts` — `publishToHashnode(article, apiKey, publicationId)`. GraphQL mutation against `https://gql.hashnode.com`.
- **T3**: `scripts/lib/weekly-template.ts` + `scripts/synthesize-weekly.ts`. Deterministic Markdown template + CLI driver. Wires T1+T2.
- **T4** (TDD): `scripts/__tests__/weekly-template.test.ts` — failing test first asserting byte-stable Markdown for 5 fixture Shorts; then implement.
- **T5**: `.github/workflows/weekly-article.yml` — Sunday 04:30 UTC cron, secrets-or-skip, `continue-on-error` on publish step.
- **T6**: `data/articles-posted/.gitkeep` — dedup directory.
- **T7**: smoke: `npx tsx scripts/synthesize-weekly.ts --dry-run` produces valid Markdown; `npx tsc --noEmit` on new files passes; vitest green; commit.
- **T8**: `docs/devto-hashnode-setup.md` — operator setup (~5 min).
