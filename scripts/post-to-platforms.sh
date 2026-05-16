#!/usr/bin/env bash
# post-to-platforms.sh — Post distributed Short content to social platforms
#
# Usage:
#   bash scripts/post-to-platforms.sh <platform> <content-path> [video-path]
#
# Platforms:
#   youtube   — Already handled by render-and-upload-short.ts
#   reddit    — Posts to 3 subreddits using PRAW (Python)
#   twitter   — Posts tweet using Twitter API v2 (curl)
#   linkedin  — Posts with video using LinkedIn API (curl)
#   instagram — Prints manual instructions (no free API)
#   tiktok    — Prints manual instructions (no free API)
#
# Environment variables required:
#   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
#   TWITTER_BEARER_TOKEN, TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
#   LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN
#
# Note: Set these in ~/.env-video-pipeline or export before running.

set -euo pipefail

PLATFORM="${1:-}"
CONTENT_PATH="${2:-}"
VIDEO_PATH="${3:-}"

if [[ -z "$PLATFORM" || -z "$CONTENT_PATH" ]]; then
  echo "Usage: bash scripts/post-to-platforms.sh <platform> <content-path> [video-path]"
  echo ""
  echo "Platforms: youtube, reddit, twitter, linkedin, instagram, tiktok"
  echo ""
  echo "Examples:"
  echo "  bash scripts/post-to-platforms.sh reddit output/distribute/caching-short-0/reddit/post-titles.json output/daily-short/caching-short-0.mp4"
  echo "  bash scripts/post-to-platforms.sh twitter output/distribute/caching-short-0/twitter/tweet.txt"
  echo "  bash scripts/post-to-platforms.sh linkedin output/distribute/caching-short-0/linkedin/post.txt output/daily-short/caching-short-0.mp4"
  exit 1
fi

# Load env file if it exists
ENV_FILE="$HOME/.env-video-pipeline"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# ─── Reddit ──────────────────────────────────────────────────────────────────

post_reddit() {
  local json_path="$1"
  local video_path="$2"

  if [[ -z "${REDDIT_CLIENT_ID:-}" || -z "${REDDIT_CLIENT_SECRET:-}" ]]; then
    echo "ERROR: Reddit credentials not set."
    echo "Required: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD"
    echo "Get them at: https://www.reddit.com/prefs/apps (create 'script' app)"
    exit 1
  fi

  echo "Posting to Reddit..."

  python3 << PYTHON
import json
import praw
import sys

with open("${json_path}") as f:
    posts = json.load(f)

reddit = praw.Reddit(
    client_id="${REDDIT_CLIENT_ID}",
    client_secret="${REDDIT_CLIENT_SECRET}",
    username="${REDDIT_USERNAME}",
    password="${REDDIT_PASSWORD}",
    user_agent="guru-sishya-shorts/1.0"
)

video_path = "${video_path}"

for key, post_data in posts.items():
    subreddit = post_data["subreddit"]
    title = post_data["title"]
    flair = post_data.get("flair", "")

    try:
        sub = reddit.subreddit(subreddit)

        # Reddit video upload via URL (link post pointing to video host)
        # For direct video upload, use reddit's media upload (requires hosted URL)
        # For now, post as a link to the YouTube Short
        submission = sub.submit(
            title=title,
            url="https://guru-sishya.in",  # Replace with actual YouTube Short URL
            flair_id=None,  # Would need to look up flair IDs per subreddit
        )
        print(f"  ✓ r/{subreddit}: {submission.url}")
    except Exception as e:
        print(f"  ✗ r/{subreddit}: {e}", file=sys.stderr)

PYTHON

  echo "Reddit posting complete."
}

# ─── Twitter/X ───────────────────────────────────────────────────────────────

post_twitter() {
  local tweet_path="$1"

  if [[ -z "${TWITTER_BEARER_TOKEN:-}" ]]; then
    echo "ERROR: Twitter credentials not set."
    echo "Required: TWITTER_BEARER_TOKEN (or full OAuth: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET)"
    echo "Get them at: https://developer.twitter.com/en/portal/dashboard"
    exit 1
  fi

  local tweet_text
  tweet_text=$(cat "$tweet_path")

  echo "Posting to Twitter/X..."
  echo "Tweet: $tweet_text"
  echo ""

  # Twitter API v2 — Create Tweet
  # Using OAuth 1.0a User Context (needed to post on behalf of user)
  if [[ -n "${TWITTER_ACCESS_TOKEN:-}" ]]; then
    # Full OAuth — use twurl if available, otherwise manual signing
    if command -v twurl &> /dev/null; then
      echo "$tweet_text" | twurl -X POST -d "$(jq -n --arg text "$tweet_text" '{text: $text}')" \
        /2/tweets -H "Content-Type: application/json"
    else
      # Manual curl with OAuth 2.0 Bearer Token (app-level, limited)
      curl -s -X POST "https://api.twitter.com/2/tweets" \
        -H "Authorization: Bearer ${TWITTER_BEARER_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$(jq -n --arg text "$tweet_text" '{text: $text}')"
    fi
  else
    # Bearer-only (won't work for posting, but shows the intent)
    echo "WARNING: Bearer token alone cannot post tweets. Need OAuth 1.0a tokens."
    echo "Set TWITTER_ACCESS_TOKEN and TWITTER_ACCESS_SECRET for posting."
    echo ""
    echo "Would post:"
    echo "$tweet_text"
  fi
}

# ─── LinkedIn ────────────────────────────────────────────────────────────────

post_linkedin() {
  local post_path="$1"
  local video_path="${2:-}"

  if [[ -z "${LINKEDIN_ACCESS_TOKEN:-}" || -z "${LINKEDIN_PERSON_URN:-}" ]]; then
    echo "ERROR: LinkedIn credentials not set."
    echo "Required: LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN"
    echo "Get token at: https://www.linkedin.com/developers/apps"
    echo "Person URN format: urn:li:person:XXXXXXX"
    exit 1
  fi

  local post_text
  post_text=$(cat "$post_path")

  echo "Posting to LinkedIn..."

  if [[ -n "$video_path" && -f "$video_path" ]]; then
    # Step 1: Register video upload
    echo "  Registering video upload..."
    local register_response
    register_response=$(curl -s -X POST "https://api.linkedin.com/v2/assets?action=registerUpload" \
      -H "Authorization: Bearer ${LINKEDIN_ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"registerUploadRequest\": {
          \"recipes\": [\"urn:li:digitalmediaRecipe:feedshare-video\"],
          \"owner\": \"${LINKEDIN_PERSON_URN}\",
          \"serviceRelationships\": [{
            \"relationshipType\": \"OWNER\",
            \"identifier\": \"urn:li:userGeneratedContent\"
          }]
        }
      }")

    local upload_url
    upload_url=$(echo "$register_response" | jq -r '.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl // empty')
    local asset_urn
    asset_urn=$(echo "$register_response" | jq -r '.value.asset // empty')

    if [[ -n "$upload_url" && -n "$asset_urn" ]]; then
      # Step 2: Upload video binary
      echo "  Uploading video..."
      curl -s -X PUT "$upload_url" \
        -H "Authorization: Bearer ${LINKEDIN_ACCESS_TOKEN}" \
        -H "Content-Type: application/octet-stream" \
        --data-binary "@${video_path}"

      # Step 3: Create post with video
      echo "  Creating post with video..."
      curl -s -X POST "https://api.linkedin.com/v2/ugcPosts" \
        -H "Authorization: Bearer ${LINKEDIN_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$(jq -n \
          --arg author "$LINKEDIN_PERSON_URN" \
          --arg text "$post_text" \
          --arg asset "$asset_urn" \
          '{
            author: $author,
            lifecycleState: "PUBLISHED",
            specificContent: {
              "com.linkedin.ugc.ShareContent": {
                shareCommentary: { text: $text },
                shareMediaCategory: "VIDEO",
                media: [{
                  status: "READY",
                  media: $asset,
                  title: { text: "Tech Short" }
                }]
              }
            },
            visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
          }')"

      echo "  ✓ LinkedIn post created with video."
    else
      echo "  WARNING: Video upload registration failed. Posting text only..."
      # Text-only fallback
      curl -s -X POST "https://api.linkedin.com/v2/ugcPosts" \
        -H "Authorization: Bearer ${LINKEDIN_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$(jq -n \
          --arg author "$LINKEDIN_PERSON_URN" \
          --arg text "$post_text" \
          '{
            author: $author,
            lifecycleState: "PUBLISHED",
            specificContent: {
              "com.linkedin.ugc.ShareContent": {
                shareCommentary: { text: $text },
                shareMediaCategory: "NONE"
              }
            },
            visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
          }')"
    fi
  else
    # Text-only post
    curl -s -X POST "https://api.linkedin.com/v2/ugcPosts" \
      -H "Authorization: Bearer ${LINKEDIN_ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$(jq -n \
        --arg author "$LINKEDIN_PERSON_URN" \
        --arg text "$post_text" \
        '{
          author: $author,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: $text },
              shareMediaCategory: "NONE"
            }
          },
          visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
        }')"
    echo "  ✓ LinkedIn text post created."
  fi
}

# ─── Instagram / TikTok ─────────────────────────────────────────────────────

post_instagram() {
  echo "Instagram Reels does not have a free posting API for video."
  echo ""
  echo "Options:"
  echo "  1. Manual upload via Instagram app (copy caption from content path)"
  echo "  2. Use Meta Business Suite (requires Business account)"
  echo "  3. Use a scheduling tool like Later.com or Buffer"
  echo ""
  echo "Caption file: $CONTENT_PATH"
  echo ""
  cat "$CONTENT_PATH"
}

post_tiktok() {
  echo "TikTok does not have a free public posting API for video."
  echo ""
  echo "Options:"
  echo "  1. Manual upload via TikTok app/desktop (copy caption from content path)"
  echo "  2. Use TikTok Creator Portal (business accounts)"
  echo "  3. Use a scheduling tool like Later.com or Hootsuite"
  echo ""
  echo "Caption file: $CONTENT_PATH"
  echo ""
  cat "$CONTENT_PATH"
}

# ─── Dispatch ────────────────────────────────────────────────────────────────

case "$PLATFORM" in
  youtube)
    echo "YouTube Shorts upload is handled by:"
    echo "  npx tsx scripts/render-and-upload-short.ts"
    echo ""
    echo "The Short should already be uploaded during the render step."
    ;;
  reddit)
    post_reddit "$CONTENT_PATH" "$VIDEO_PATH"
    ;;
  twitter|x)
    post_twitter "$CONTENT_PATH"
    ;;
  linkedin)
    post_linkedin "$CONTENT_PATH" "$VIDEO_PATH"
    ;;
  instagram|ig)
    post_instagram
    ;;
  tiktok)
    post_tiktok
    ;;
  all)
    echo "Posting to all platforms..."
    echo ""
    # Derive paths from content path (assuming distribute structure)
    DIST_DIR=$(dirname "$CONTENT_PATH")
    BASE_DIR=$(dirname "$DIST_DIR")

    if [[ -f "$BASE_DIR/twitter/tweet.txt" ]]; then
      echo "── Twitter ──"
      post_twitter "$BASE_DIR/twitter/tweet.txt"
      echo ""
    fi
    if [[ -f "$BASE_DIR/linkedin/post.txt" ]]; then
      echo "── LinkedIn ──"
      post_linkedin "$BASE_DIR/linkedin/post.txt" "$VIDEO_PATH"
      echo ""
    fi
    if [[ -f "$BASE_DIR/reddit/post-titles.json" ]]; then
      echo "── Reddit ──"
      post_reddit "$BASE_DIR/reddit/post-titles.json" "$VIDEO_PATH"
      echo ""
    fi
    echo "── Instagram & TikTok ──"
    echo "Manual upload required. Captions at:"
    echo "  $BASE_DIR/instagram/caption.txt"
    echo "  $BASE_DIR/tiktok/caption.txt"
    ;;
  *)
    echo "Unknown platform: $PLATFORM"
    echo "Supported: youtube, reddit, twitter, linkedin, instagram, tiktok, all"
    exit 1
    ;;
esac
