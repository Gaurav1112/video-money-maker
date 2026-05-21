# Dev.to + Hashnode Setup (F003 weekly synthesis)

One-time, ~5 minutes total. After this, the Sunday `weekly-article.yml`
workflow runs autonomously.

## 1. Dev.to API key (~1 min)

1. Log in to https://dev.to.
2. Settings → **Extensions** → "DEV Community API Keys" section.
3. Description: `gurusishya-weekly`. Click **Generate API Key**. Copy.
4. Add to repo secrets:

   ```bash
   gh secret set DEVTO_API_KEY --body "<paste>"
   ```

## 2. Hashnode API key (~1 min)

1. Log in to https://hashnode.com.
2. Top-right avatar → **Account Settings** → **Developer** tab.
3. Click **Generate New Token**. Description: `gurusishya-weekly`. Copy.
4. Add to repo secrets:

   ```bash
   gh secret set HASHNODE_API_KEY --body "<paste>"
   ```

## 3. Hashnode publication ID (~2 min)

1. From the Hashnode dashboard, open your blog (publication).
2. **Settings** → **General** → scroll to the bottom — "Publication ID" is shown.
3. Add to repo secrets:

   ```bash
   gh secret set HASHNODE_PUBLICATION_ID --body "<paste>"
   ```

## 4. Verify

Trigger the workflow manually from the Actions tab with the **Dry run** input
set to `true`. The log should print the synthesized article without posting.

If all 3 secrets are missing, the script exits 0 with skip messages — safe
default for local testing.

## Notes

- The article body always sets `canonical_url` to the @GuruSishya-India
  YouTube channel so SEO juice flows back. Both platforms support this; no
  duplicate-content penalty.
- Re-running for the same ISO week is a no-op (dedup via
  `data/articles-posted/<iso-week>.json`).
- Dev.to allows 4 tags max — the script caps automatically. Hashnode allows
  up to 5; we send the same 4 for consistency.
