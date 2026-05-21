# TikTok Content Posting API Setup (F005)

**Heads up: Sandbox → Production approval takes 3-7 business days.** Start
this BEFORE you need it.

## 1. Create a TikTok Developer App (~5 min)

1. Go to https://developers.tiktok.com → Manage Apps → **Connect an App**.
2. App name: `gurusishya-uploader`. Description: "Automated upload of educational
   tech Shorts to TikTok."
3. After creation, note **Client Key** and **Client Secret**.

## 2. Add Content Posting API product (~3 min)

1. App dashboard → **Add Products** → **Content Posting API**.
2. Required scopes:
   - `video.upload`
   - `video.publish`
   - `user.info.basic`
3. Add a Redirect URI (any — e.g. `http://localhost:3000/callback` for the
   token exchange). You won't host anything; this is just for OAuth.

## 3. Get OAuth tokens (~10 min, manual)

This is a one-time interactive step.

1. Visit:
   ```
   https://www.tiktok.com/v2/auth/authorize/?client_key=<KEY>&scope=video.upload,video.publish,user.info.basic&response_type=code&redirect_uri=http://localhost:3000/callback&state=x
   ```
2. Approve. You'll be redirected to `http://localhost:3000/callback?code=AUTH_CODE&...`.
   Copy `AUTH_CODE`.
3. Exchange for access + refresh tokens:
   ```bash
   curl -X POST 'https://open.tiktokapis.com/v2/oauth/token/' \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -d "client_key=<KEY>&client_secret=<SECRET>&code=<AUTH_CODE>&grant_type=authorization_code&redirect_uri=http://localhost:3000/callback"
   ```
4. Note `access_token` (24h life), `refresh_token` (1y life), `open_id`.

## 4. Submit for Production (~3-7 days wait)

By default the app is in Sandbox: posts go ONLY to your own account and are
PRIVATE. To post publicly:

1. App dashboard → **App Review** → submit Content Posting API for review.
2. Provide a 1-min screencast of the integration working in Sandbox.
3. Wait 3-7 business days.

While waiting, keep `TIKTOK_PRIVACY_LEVEL=SELF_ONLY` so the integration is
testable without leaking content.

## 5. GitHub Secrets

```bash
gh secret set TIKTOK_CLIENT_KEY     --body "<key>"
gh secret set TIKTOK_CLIENT_SECRET  --body "<secret>"
gh secret set TIKTOK_ACCESS_TOKEN   --body "<token>"
gh secret set TIKTOK_OPEN_ID        --body "<open_id>"
# After production approval:
gh secret set TIKTOK_PRIVACY_LEVEL  --body "PUBLIC_TO_EVERYONE"
```

## 6. Verify

Trigger `auto-shorts.yml`. The new "Upload variants to TikTok (F005)" step
prints either `publish_id=...` (success) or the skip / failure reason.

## Token refresh

`access_token` expires every 24 hours. Refresh:

```bash
curl -X POST 'https://open.tiktokapis.com/v2/oauth/token/' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "client_key=<KEY>&client_secret=<SECRET>&grant_type=refresh_token&refresh_token=<REFRESH_TOKEN>"
```

Re-set `TIKTOK_ACCESS_TOKEN`. A future cron can automate this; F005 assumes
manual rotation for now.
