#!/usr/bin/env tsx
/**
 * Cross-posts a 3-tweet thread to X/Twitter.
 * Usage: npx tsx scripts/cross-post-x.ts --topic "..." --hook "..." --url "..."
 *
 * X API v2 POST /2/tweets requires *user-context* auth (OAuth 1.0a or
 * OAuth 2.0 PKCE user token); app-only Bearer returns 403. We sign each
 * request with OAuth 1.0a HMAC-SHA1 inline (no SDK dep) so this script
 * stays single-file and CI-friendly.
 *
 * Required secrets:
 *   X_API_KEY        — consumer key
 *   X_API_SECRET     — consumer secret
 *   X_ACCESS_TOKEN   — user access token
 *   X_ACCESS_SECRET  — user access token secret
 */

import { createHmac, randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
function getArg(name: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? (args[idx + 1] ?? '') : '';
}

const topic = getArg('topic') || 'Tech Short';
const hook = getArg('hook') || `Learn about ${topic} in 60 seconds`;
const explicitText = getArg('text');
const url = getArg('url') || '';

const consumerKey = process.env['X_API_KEY'];
const consumerSecret = process.env['X_API_SECRET'];
const accessToken = process.env['X_ACCESS_TOKEN'];
const accessSecret = process.env['X_ACCESS_SECRET'];

if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) {
  console.log(
    '[cross-post-x] OAuth 1.0a creds missing ' +
      '(X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET) — skipping',
  );
  process.exit(0);
}

interface TweetResponse { data: { id: string; text: string } }
export {};

/** RFC-3986 percent-encode (stricter than encodeURIComponent). */
function rfc3986(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * Build the OAuth 1.0a Authorization header for a JSON-body POST. Note:
 * for application/json bodies the body is NOT included in the signature
 * base string (only oauth_* params + URL query are signed) — this is
 * the documented behaviour for X's v2 endpoints.
 */
function buildOAuth1Header(method: string, requestUrl: string): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey!,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken!,
    oauth_version: '1.0',
  };

  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(oauthParams[k]!)}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    rfc3986(requestUrl),
    rfc3986(paramString),
  ].join('&');

  const signingKey = `${rfc3986(consumerSecret!)}&${rfc3986(accessSecret!)}`;
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauthParams['oauth_signature'] = signature;

  const header =
    'OAuth ' +
    Object.keys(oauthParams)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(oauthParams[k]!)}"`)
      .join(', ');
  return header;
}

async function postTweet(text: string, replyToId?: string): Promise<string> {
  const endpoint = 'https://api.twitter.com/2/tweets';
  const body: Record<string, unknown> = { text };
  if (replyToId) {
    body['reply'] = { in_reply_to_tweet_id: replyToId };
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildOAuth1Header('POST', endpoint),
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
  const tweet1Body = explicitText && explicitText.trim().length > 0
    ? explicitText.trim()
    : `🧵 ${hook}\n\nThread 👇`;
  const tweet1Id = await postTweet(tweet1Body);
  const tweet2Id = await postTweet(`💡 Key insight: Understanding ${topic} is essential for building scalable systems.\n\nWatch the full 60-second explainer below 👇`, tweet1Id);
  await postTweet(`${url}\n\n#${topic.replace(/\s+/g, '')} #TechShorts #SystemDesign #LearnInPublic`, tweet2Id);
  console.log(`[cross-post-x] Thread posted successfully (tweet1=${tweet1Id})`);
} catch (err) {
  console.error(`[cross-post-x] Error: ${err}`);
  process.exit(1);
}
