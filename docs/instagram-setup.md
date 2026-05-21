# Instagram Reels Setup (F004 auto-upload from `auto-shorts.yml`)

One-time, ~15 min. After this, every variant rendered + uploaded to YouTube by
`auto-shorts.yml` is also auto-published as an Instagram Reel.

## Why R2 is required

Instagram's Graph API does NOT accept direct file uploads for video. The video
MUST be reachable at a public HTTPS URL. We use Cloudflare R2 (free tier,
10 GB/month egress) as a temporary host: upload → publish → delete.

## 1. Facebook Page (~2 min)

1. Go to https://facebook.com/pages/create.
2. Create a Page (any name). You need a Page to link the IG Business account.

## 2. Convert Instagram to Business + link Page (~2 min)

1. Instagram app → Profile → Settings → Account → **Switch to Professional
   Account** → Business.
2. During setup, link the FB Page from step 1.

## 3. Facebook Developer App (~3 min)

1. Go to https://developers.facebook.com → My Apps → Create App.
2. Type: **Business**. Name: `gurusishya-uploader`.
3. Dashboard → Add Product → **Instagram Graph API**.
4. Note the **App ID** and **App Secret**.

## 4. Long-lived access token (~3 min)

1. Open https://developers.facebook.com/tools/explorer.
2. Select your app. Add permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
   - `pages_show_list`
3. Click **Generate Access Token** (short-lived, 1 hour).
4. Exchange for long-lived (60 days):

   ```bash
   curl "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=<APP_ID>&client_secret=<APP_SECRET>&fb_exchange_token=<SHORT_TOKEN>"
   ```

5. Fetch your IG Business account ID:

   ```bash
   curl "https://graph.facebook.com/v21.0/me/accounts?access_token=<LONG_TOKEN>"
   # → find your Page, then:
   curl "https://graph.facebook.com/v21.0/<PAGE_ID>?fields=instagram_business_account&access_token=<LONG_TOKEN>"
   # → instagram_business_account.id is your INSTAGRAM_BUSINESS_ID
   ```

## 5. Cloudflare R2 bucket (~3 min)

1. Sign up free at https://dash.cloudflare.com → R2 → Create bucket
   `gurusishya-reels-temp`.
2. R2 → **Manage R2 API Tokens** → Create API Token → Object Read & Write,
   scoped to the bucket → copy Access Key ID + Secret.
3. Bucket → **Settings** → enable public access → note the public URL
   (e.g. `https://pub-xxx.r2.dev`).

## 6. GitHub Secrets (~1 min)

```bash
gh secret set INSTAGRAM_ACCESS_TOKEN --body "<long-lived-token>"
gh secret set INSTAGRAM_BUSINESS_ID  --body "<ig-business-id>"
gh secret set R2_ACCOUNT_ID          --body "<cf-account-id>"
gh secret set R2_ACCESS_KEY_ID       --body "<r2-key>"
gh secret set R2_SECRET_ACCESS_KEY   --body "<r2-secret>"
gh secret set R2_BUCKET_NAME         --body "gurusishya-reels-temp"
gh secret set R2_PUBLIC_URL          --body "https://pub-xxx.r2.dev"
```

## 7. Verify

Trigger `auto-shorts.yml` from the Actions tab. The new "Upload variants to
Instagram Reels (F004)" step should publish each variant. Without secrets,
it logs `[ig-wrapper] INSTAGRAM_ACCESS_TOKEN missing — skipping` and exits 0
cleanly.

## Renewal

The long-lived token expires every 60 days. Rotate by re-running step 4.
Calendar reminder recommended.
