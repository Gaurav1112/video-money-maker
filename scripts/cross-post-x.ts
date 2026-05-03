#!/usr/bin/env tsx
/**
 * Cross-posts a 3-tweet thread to X/Twitter.
 * Usage: npx tsx scripts/cross-post-x.ts --topic "..." --hook "..." --url "..."
 * Requires X_BEARER_TOKEN env var; skips silently if missing.
 */

const args = process.argv.slice(2);
function getArg(name: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? (args[idx + 1] ?? '') : '';
}

const topic = getArg('topic') || 'Tech Short';
const hook = getArg('hook') || `Learn about ${topic} in 60 seconds`;
const url = getArg('url') || '';

const token = process.env['X_BEARER_TOKEN'];
if (!token) {
  console.log('[cross-post-x] X_BEARER_TOKEN not set — skipping');
  process.exit(0);
}

// X API v2 POST /2/tweets requires user-context auth (OAuth 1.0a or
// OAuth 2.0 PKCE user token), NOT app-only Bearer. Posting with a Bearer
// token returns 403 "Authenticating with OAuth 2.0 Application-Only is
// forbidden for this endpoint." Skip until OAuth1.0a creds are supplied.
const hasOAuth1 =
  !!process.env['X_API_KEY'] &&
  !!process.env['X_API_SECRET'] &&
  !!process.env['X_ACCESS_TOKEN'] &&
  !!process.env['X_ACCESS_SECRET'];
if (!hasOAuth1) {
  console.log('[cross-post-x] OAuth 1.0a creds (X_API_KEY/X_API_SECRET/X_ACCESS_TOKEN/X_ACCESS_SECRET) missing — skipping (Bearer-only cannot POST tweets)');
  process.exit(0);
}

interface TweetResponse { data: { id: string; text: string } }
export {};

async function postTweet(text: string, replyToId?: string): Promise<string> {
  const body: Record<string, unknown> = { text };
  if (replyToId) {
    body['reply'] = { in_reply_to_tweet_id: replyToId };
  }
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twitter API error ${res.status}: ${err}`);
  }
  const data = (await res.json()) as TweetResponse;
  return data.data.id;
}

try {
  console.log(`[cross-post-x] Posting thread for "${topic}"...`);
  const tweet1Id = await postTweet(`🧵 ${hook}\n\nThread 👇`);
  const tweet2Id = await postTweet(`💡 Key insight: Understanding ${topic} is essential for building scalable systems.\n\nWatch the full 60-second explainer below 👇`, tweet1Id);
  await postTweet(`${url}\n\n#${topic.replace(/\s+/g, '')} #TechShorts #SystemDesign #LearnInPublic`, tweet2Id);
  console.log(`[cross-post-x] Thread posted successfully (tweet1=${tweet1Id})`);
} catch (err) {
  console.error(`[cross-post-x] Error: ${err}`);
  process.exit(1);
}
