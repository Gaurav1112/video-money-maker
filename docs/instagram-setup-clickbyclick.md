# Instagram Auto-Post — Click-by-Click Setup

Goal: get 6 secrets into GitHub so the pipeline auto-posts Reels.
Total time ~25-30 min. Do it on a laptop, not a phone (except Part A1).

The 6 secrets you'll end with:
`IG_USER_ID`, `IG_ACCESS_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

---

## PART A — Account chain

### A1. Convert Instagram to a Business account (phone, ~2 min)
1. Open the **Instagram app** on your phone.
2. Tap your **profile picture** (bottom-right).
3. Tap the **☰ hamburger icon** (top-right).
4. Tap **Settings and privacy**.
5. Scroll to **For professionals** → tap **Account type and tools**.
6. Tap **Switch to professional account**.
7. Tap **Continue** through the intro screens.
8. On "Choose a category" — pick **Education** → **Done**.
9. On "Are you a business?" — tap **Business** (NOT Creator). → **Next**.
10. It asks for contact info — tap **Don't use my contact info** → skip.
11. If it shows "Connect to Facebook" — you can skip for now (we link properly in A3).

✅ Your IG is now a Business account.

### A2. Create a Facebook Page (laptop, ~3 min)
1. On your laptop go to **https://www.facebook.com/pages/create**
2. Left side, **Page name** field → type: `Guru Sishya`
3. **Category** field → type `Education` → pick **Education** from the dropdown.
4. Bio — leave blank or type one line.
5. Click the blue **Create Page** button (bottom-left).
6. It shows "add profile picture / cover" screens → click **Next** / **Skip** through all of them.
7. You land on the new Page. Leave this tab open.

✅ Facebook Page "Guru Sishya" exists.

### A3. Link Instagram ↔ the Facebook Page (laptop, ~3 min)
1. On the Facebook Page, look at the **left sidebar** → click **Settings** (gear icon; if you don't see it, click **More** → **Settings**).
2. In Settings, find **Linked accounts** in the left list → click it.
   - (On some accounts it's under **Settings → Instagram**.)
3. Click **Connect account**.
4. A popup opens → enter your **Instagram Business** username + password → **Log In**.
5. Approve the permission prompt.
6. It should now show your Instagram account as **Connected**.

✅ Page and Instagram are linked. This link is what makes the publishing API work.

---

## PART B — Create the Meta Developer App (laptop, ~7 min)

### B1. Register as a developer (one-time, skip if already done)
1. Go to **https://developers.facebook.com/**
2. Top-right → **Log In** with your Facebook account.
3. If prompted "Register as a Meta Developer" → **Continue** → accept terms → verify (phone/email).

### B2. Create the app
1. Go to **https://developers.facebook.com/apps/**
2. Click the green **Create app** button (top-right).
3. Screen "What do you want your app to do?" — these are *use cases*:
   - Select **Other** (at the bottom of the list) → click **Next**.
4. Screen "Select an app type":
   - Select **Business** → click **Next**.
5. Screen "Provide basic information":
   - **App name**: `guru-sishya-poster`
   - **App contact email**: your email
   - **Business portfolio**: leave as "No Business portfolio selected" (fine).
   - Click **Create app** → re-enter your Facebook password if asked.
6. You land on the **App Dashboard**.

### B3. Add the Instagram product
1. On the App Dashboard, look for **Add products to your app** (a grid of products).
2. Find the **Instagram** tile → click **Set up** on it.
   - In 2026 the tile is labeled **Instagram**. Inside it choose the option mentioning **Instagram API** / **content publishing** (NOT "Instagram Basic Display" — that one is being deprecated).
3. After setup it appears in the left sidebar under **Products**.

✅ App created with the Instagram product.

---

## PART C — Get IG_USER_ID and IG_ACCESS_TOKEN (laptop, ~8 min)

### C1. Open Graph API Explorer + generate a token
1. Go to **https://developers.facebook.com/tools/explorer/**
2. Top-right panel — **Meta App** dropdown → select **guru-sishya-poster**.
3. Just below it — **User or Page** dropdown → click it → choose **Get User Access Token**.
4. A permissions popup opens. Use the search box and tick these **5** permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`
5. Click **Generate Access Token** (blue button at the bottom of the popup).
6. A Facebook login/consent popup appears → **Continue as [you]** → on the "what this app can access" screen make sure the IG/Pages toggles stay **ON** → **Save** / **Continue**.
7. Back in the Explorer, a long string now sits in the **Access Token** box. This is a SHORT-lived token (~1 hour) — fine for the next steps.

### C2. Get your Facebook Page ID
1. In the Explorer, find the **request bar** (next to the blue **Submit** / **Send** button). It probably says `me`.
2. Clear it and type exactly: `me/accounts`
3. Click **Submit**.
4. The response box shows JSON. Find your "Guru Sishya" page and copy its **`id`** value (a long number). Call it `<PAGE_ID>`.

### C3. Get your Instagram User ID
1. In the request bar type exactly (replace `<PAGE_ID>` with the number from C2):
   ```
   <PAGE_ID>?fields=instagram_business_account
   ```
2. Click **Submit**.
3. The response looks like:
   ```json
   { "instagram_business_account": { "id": "17841400000000000" }, "id": "<PAGE_ID>" }
   ```
4. **Copy the `instagram_business_account.id`** — that 17841... number is your **`IG_USER_ID`**.
   - ❌ If it returns empty / no `instagram_business_account` → the A3 link didn't take. Redo Part A3, then retry C3.

### C4. Convert the short token to a 60-day long-lived token
The Explorer token dies in ~1 hour. Get the 60-day one.
1. You need 2 values from the App Dashboard:
   - Left sidebar → **App settings → Basic**
   - Copy **App ID** and **App secret** (click **Show** for the secret).
2. In your **laptop terminal**, run this — replace the 3 placeholders:
   ```bash
   curl -s "https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID_HERE&client_secret=APP_SECRET_HERE&fb_exchange_token=SHORT_TOKEN_HERE"
   ```
   - `APP_ID_HERE` → App ID from step 1
   - `APP_SECRET_HERE` → App secret from step 1
   - `SHORT_TOKEN_HERE` → the token from C1 step 7
3. The response:
   ```json
   {"access_token":"EAAxxxxxx...","token_type":"bearer","expires_in":5183944}
   ```
   The `access_token` value (starts `EAA`) is your **60-day `IG_ACCESS_TOKEN`**.

---

## PART D — Cloudflare R2 bucket (laptop, ~6 min)

Instagram's API cannot accept a file upload — it must fetch the video from a **public URL**. R2 hosts the MP4. Free up to 10 GB.

### D1. Create the bucket
1. Go to **https://dash.cloudflare.com/** → log in (make a free account if needed).
2. Left sidebar → **R2 Object Storage** (you may need to add a payment method even for the free tier — no charge under 10 GB).
3. Click **Create bucket**.
4. Bucket name: `guru-sishya-media` → **Create bucket**.

### D2. Make the bucket public
1. Open the `guru-sishya-media` bucket → **Settings** tab.
2. Find **Public access** / **R2.dev subdomain** → click **Allow Access** / **Enable**.
3. Confirm. Note the public URL it gives you (`https://pub-xxxx.r2.dev`).

### D3. Create an R2 API token
1. Back on the R2 overview page → click **Manage R2 API Tokens** (top-right area).
2. Click **Create API token**.
3. Permissions → **Object Read & Write**.
4. Specify bucket → **Apply to specific buckets** → `guru-sishya-media` (or "all buckets").
5. Click **Create API Token**.
6. The result page shows — copy ALL of these now (they're shown once):
   - **Access Key ID** → `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → `R2_SECRET_ACCESS_KEY`
7. Your **Account ID** (`R2_ACCOUNT_ID`) is in the R2 page URL and the right sidebar of the Cloudflare dashboard — a 32-char hex string.

---

## PART E — Set the 6 GitHub secrets (terminal, ~2 min)

From your **laptop terminal**, in the repo folder. Run each line — it prompts you, you paste the value privately. **Never paste these into a chat.**

```bash
gh secret set IG_USER_ID
gh secret set IG_ACCESS_TOKEN
gh secret set R2_ACCOUNT_ID
gh secret set R2_ACCESS_KEY_ID
gh secret set R2_SECRET_ACCESS_KEY
gh secret set R2_BUCKET_NAME
```
For `R2_BUCKET_NAME` paste: `guru-sishya-media`

Verify they're all set:
```bash
gh secret list | grep -E 'IG_|R2_'
```
You should see all 6 listed.

---

## Snag table — what breaks and the fix

| Symptom | Fix |
|---|---|
| C3 returns no `instagram_business_account` | The IG↔Page link failed — redo Part A3 |
| `instagram_content_publish` not in the C1 permission list | Instagram product not fully added — redo Part B3 |
| App says "In development mode" | Fine — posting to YOUR OWN linked account does NOT need App Review. Leave it in development mode. |
| C4 curl returns an error about the token | The short token already expired (1h) — regenerate it in C1, run C4 immediately |
| Cloudflare asks for a credit card | Required even for free tier; no charge under 10 GB/month |

When `gh secret list` shows all 6 — tell me. I'll trigger `auto-shorts.yml` and confirm a Reel posts end-to-end.
