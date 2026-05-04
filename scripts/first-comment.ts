/**
 * scripts/first-comment.ts — B1 first-comment automation (channel-owner CTA)
 *
 * IMPORTANT — what this is and what it isn't
 * ─────────────────────────────────────────
 * The YouTube Data API v3 does NOT expose a programmatic "pin comment"
 * endpoint. Pinning is a manual UI action in YouTube Studio. This
 * script therefore does NOT pin — it auto-posts the FIRST comment as
 * the channel owner, immediately after upload. That still delivers
 * meaningful value:
 *
 *   1. The comment carries the "Creator" badge (visual prominence).
 *   2. It seeds early-comment velocity — a documented Shorts feed
 *      promotion signal — by being chronologically first.
 *   3. The funnel CTA to guru-sishya.in is visible to every viewer
 *      who opens comments.
 *   4. The reply prompt ("drop a 🔥 / what topic next?") triggers
 *      engagement signals YouTube's recommender weights.
 *
 * To get the FULL pinned-comment effect, a one-off manual step in
 * YouTube Studio is still required (tap the three-dot menu on this
 * comment → "Pin"). This script is the 80% automation; the manual
 * pin is the remaining 20%.
 *
 * What it does
 * ────────────
 * 1. Authenticates against YouTube Data API v3 with the same OAuth2
 *    refresh-token credentials as upload-youtube.ts (scope
 *    youtube.force-ssl is already granted).
 * 2. Calls commentThreads.insert with a topic-templated CTA.
 * 3. Returns commentId so the calling workflow can log/track it.
 *
 * CLI
 * ───
 *   npx tsx scripts/first-comment.ts <videoId> [--metadata <path>]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { google, youtube_v3 } from 'googleapis';

type ShortMetadata = {
  topic?: string;
  slug?: string;
  youtube?: { title?: string };
};

const SITE_URL = 'https://guru-sishya.in';
const TOKEN_PATH = path.resolve(__dirname, '..', '.youtube-token.json');

function getAuthClient(): InstanceType<typeof google.auth.OAuth2> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!clientId || !clientSecret) {
    console.error('Error: YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET required');
    process.exit(1);
  }
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  if (refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('Error: YOUTUBE_REFRESH_TOKEN or .youtube-token.json required');
    process.exit(1);
  }
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

export function buildFirstCommentText(meta: ShortMetadata | null): string {
  const topic = (meta?.topic || 'this concept').trim();
  const slug = (meta?.slug || '').trim();
  // Deep-link to the topic page (with UTM attribution to first-comment
  // surface) when slug is known; otherwise fall back to the homepage so
  // the comment is never broken (Dist4 P0 first-comment UTM blind fix).
  const utm = `utm_source=yt_first_comment&utm_medium=comment&utm_campaign=${encodeURIComponent(slug || 'unknown')}&utm_content=cta_first_comment`;
  const url = slug
    ? `${SITE_URL}/topics/${slug}?${utm}`
    : `${SITE_URL}/?${utm}`;
  return [
    `🎯 Aaj ka ${topic} ka FULL deep-dive (free, illustrated):`,
    ``,
    `👉 ${url}`,
    ``,
    `Drop a 🔥 if this clicked, or comment what topic you want next!`,
  ].join('\n');
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = (err as Error).message || String(err);
      console.error(`[first-comment] ${label} attempt ${i}/${attempts} failed: ${msg}`);
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 5000 * i));
      }
    }
  }
  throw lastErr;
}

export async function postFirstComment(args: {
  videoId: string;
  metadata?: ShortMetadata | null;
  youtube?: youtube_v3.Youtube;
}): Promise<{ commentId: string; threadId: string }> {
  const { videoId } = args;
  const youtube =
    args.youtube ?? google.youtube({ version: 'v3', auth: getAuthClient() });
  const text = buildFirstCommentText(args.metadata ?? null);

  console.log(`[first-comment] inserting comment on video ${videoId}`);
  const insertResp = await withRetry('commentThreads.insert', () =>
    youtube.commentThreads.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          videoId,
          topLevelComment: {
            snippet: { textOriginal: text },
          },
        },
      },
    }),
  );

  const threadId = insertResp.data.id;
  const commentId = insertResp.data.snippet?.topLevelComment?.id;
  if (!threadId || !commentId) {
    throw new Error(
      `comment insert returned no id (thread=${threadId} comment=${commentId})`,
    );
  }
  console.log(
    `[first-comment] inserted: thread=${threadId} comment=${commentId}`,
  );
  console.log(
    `[first-comment] NOTE: this is NOT pinned — pin manually via YT Studio for full effect`,
  );
  return { commentId, threadId };
}

async function cli(): Promise<void> {
  const args = process.argv.slice(2);
  let videoId = '';
  let metadataPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--metadata') {
      metadataPath = args[++i];
    } else if (!videoId && !args[i].startsWith('--')) {
      videoId = args[i];
    }
  }

  if (!videoId) {
    console.error(
      'usage: first-comment.ts <videoId> [--metadata <metadata.json>]',
    );
    process.exit(2);
  }

  let meta: ShortMetadata | null = null;
  if (metadataPath && fs.existsSync(metadataPath)) {
    meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as ShortMetadata;
  }

  try {
    const result = await postFirstComment({ videoId, metadata: meta });
    console.log(
      `[first-comment] done: commentId=${result.commentId}`,
    );
  } catch (err) {
    console.error(`[first-comment] FATAL: ${(err as Error).message}`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('first-comment.ts')) {
  cli();
}

