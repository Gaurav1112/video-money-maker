/**
 * scripts/post-linkedin.ts — B24 LinkedIn UGC post for Shorts
 *
 * Why this exists
 * ───────────────
 * Panel-15/16/17/18 have all flagged the LinkedIn arm as the largest
 * unaddressed distribution gap. The @GuruSishya-India ICP — Indian SDE
 * freshers grinding for ₹35-55 LPA FAANG roles — lives on LinkedIn as
 * their primary professional identity platform. Every competing
 * Hinglish-tech creator (Apna College, Striver, TakeUforward) has an
 * active LinkedIn cadence.
 *
 * The metadata pipeline already produces a `linkedin.body` field
 * (`render-stock-short.ts:583`) with the correct `utm_source=linkedin`
 * UTM rewrite. This script consumes it and posts via the LinkedIn UGC
 * Posts API (`/v2/ugcPosts`).
 *
 * Required env
 * ────────────
 *   LINKEDIN_ACCESS_TOKEN  - 3-legged OAuth token with `w_member_social`
 *                            scope (or `w_organization_social` if posting
 *                            as an org page)
 *   LINKEDIN_AUTHOR_URN    - either `urn:li:person:xxxxxxx` or
 *                            `urn:li:organization:nnnn`
 *
 * Usage:
 *   npx tsx scripts/post-linkedin.ts <videoId> --metadata <path>
 *
 * Failure mode
 * ────────────
 * If LINKEDIN_ACCESS_TOKEN is absent → exit 0 with a clear "skipped"
 * message (so the workflow step is non-blocking like the other social
 * arms). If the API call itself fails → exit 1 so CI surfaces it.
 */

import * as fs from 'node:fs';

interface ShortMetadataLinkedIn {
  slug?: string;
  topic?: string;
  linkedin?: { title?: string; body?: string };
  youtube?: { title?: string };
}

const LINKEDIN_API = 'https://api.linkedin.com/v2/ugcPosts';

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

export function buildLinkedInPostBody(args: {
  videoId: string;
  metadata: ShortMetadataLinkedIn | null;
  authorUrn: string;
}): Record<string, unknown> {
  const url = `https://youtube.com/shorts/${args.videoId}`;
  // Panel-22 Torvalds P0: there was zero runtime check that the
  // metadata.linkedin.body field was actually populated by the
  // upstream renderer. A direct invocation or a metadata.json
  // assembled by an older script silently posted with an empty body.
  // Now we hard-fail when the linkedin sub-object is missing OR has
  // an empty body — better to surface the contract violation in CI
  // than to ship empty LinkedIn posts and dilute the channel.
  const linkedinObj = args.metadata?.linkedin;
  if (!linkedinObj || typeof linkedinObj !== 'object') {
    throw new Error(
      '[post-linkedin] metadata.linkedin missing — was this metadata.json ' +
      'produced by render-stock-short.ts? The linkedin.{title,body} fields ' +
      'are required.',
    );
  }
  const baseBodyRaw = (linkedinObj.body || '').trim();
  if (!baseBodyRaw) {
    throw new Error(
      '[post-linkedin] metadata.linkedin.body is empty — refusing to post ' +
      'an empty LinkedIn body. Check the renderer\'s linkedin.body builder.',
    );
  }
  const title = (linkedinObj.title || args.metadata?.youtube?.title || args.metadata?.topic || 'New Tech Short')
    .trim();
  const baseBody = baseBodyRaw;
  // LinkedIn truncates at the "see more" fold around 200-300 chars on
  // mobile; lead with the title + watch link so the most important
  // signal sits above that fold.
  const text = [
    title,
    '',
    `▶ Watch (60 sec): ${url}`,
    '',
    baseBody,
  ]
    .join('\n')
    .slice(0, 3000);

  return {
    author: args.authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        // Panel-21 P1-1: 'ARTICLE' shareMediaCategory triggers
        // LinkedIn's link-card preview, which shrinks reach 40-60% vs
        // pure text/image posts (algo deprioritizes outbound links).
        // 'NONE' keeps the URL inline as plain text so the post is
        // treated as a standard update — the URL is already present
        // at the top of `text` ("▶ Watch (60 sec): ...") so users still
        // get the link, the algorithm just doesn't penalize us for it.
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };
}

async function main(): Promise<void> {
  const videoId = process.argv[2];
  if (!videoId) {
    console.error('[post-linkedin] usage: post-linkedin.ts <videoId> --metadata <path>');
    process.exit(1);
  }

  const token = process.env['LINKEDIN_ACCESS_TOKEN'];
  const authorUrn = process.env['LINKEDIN_AUTHOR_URN'];
  if (!token || !authorUrn) {
    console.log(
      '[post-linkedin] LINKEDIN_ACCESS_TOKEN / LINKEDIN_AUTHOR_URN missing — skipping (non-blocking)',
    );
    process.exit(0);
  }

  const metaPath = getArg('metadata');
  let metadata: ShortMetadataLinkedIn | null = null;
  if (metaPath && fs.existsSync(metaPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
      console.warn(`[post-linkedin] failed to parse ${metaPath}: ${(e as Error).message}`);
    }
  }

  const body = buildLinkedInPostBody({ videoId, metadata, authorUrn });

  const resp = await fetch(LINKEDIN_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });

  const respText = await resp.text();
  if (!resp.ok) {
    console.error(
      `[post-linkedin] ❌ HTTP ${resp.status} — ${respText.slice(0, 500)}`,
    );
    process.exit(1);
  }
  console.log(`[post-linkedin] ✓ posted (status ${resp.status}): ${respText.slice(0, 200)}`);
}

// Only execute when run as a script, not when imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err: unknown) => {
    console.error(`[post-linkedin] fatal: ${(err as Error).message}`);
    process.exit(1);
  });
}
