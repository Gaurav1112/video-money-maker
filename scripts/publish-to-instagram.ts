#!/usr/bin/env npx tsx
/**
 * publish-to-instagram.ts — Upload vertical video as Instagram Reel
 *
 * Designed for CI (GitHub Actions). The Instagram Graph API requires videos
 * to be hosted at a public URL. This script:
 *   1. Uploads the video to a temporary R2/S3 bucket (or uses --url)
 *   2. Creates an Instagram media container
 *   3. Polls until processing is complete
 *   4. Publishes the reel
 *   5. Verifies the post is live
 *
 * For CI without a public URL, we upload the video to Cloudflare R2 first,
 * then provide that URL to Instagram. After publishing, we delete the temp file.
 *
 * Environment variables:
 *   INSTAGRAM_ACCESS_TOKEN   — Long-lived Graph API access token
 *   INSTAGRAM_BUSINESS_ID   — Instagram Business/Creator account ID
 *   R2_ACCOUNT_ID           — (optional) Cloudflare R2 account ID
 *   R2_ACCESS_KEY_ID        — (optional) R2 access key
 *   R2_SECRET_ACCESS_KEY    — (optional) R2 secret key
 *   R2_BUCKET_NAME          — (optional) R2 bucket name
 *   R2_PUBLIC_URL           — (optional) R2 public URL prefix
 *
 * Usage:
 *   npx tsx scripts/publish-to-instagram.ts \
 *     --video path/to/vertical.mp4 \
 *     --metadata path/to/metadata.json \
 *     --topic load-balancing \
 *     --session 1 \
 *     --part 1
 *
 *   # With pre-hosted URL
 *   npx tsx scripts/publish-to-instagram.ts \
 *     --url https://example.com/video.mp4 \
 *     --metadata path/to/metadata.json \
 *     --topic load-balancing \
 *     --session 1
 *
 *   # Multiple videos in one call
 *   npx tsx scripts/publish-to-instagram.ts \
 *     --video path/to/part2.mp4 \
 *     --additional path/to/part3.mp4 \
 *     --metadata path/to/metadata.json \
 *     --topic load-balancing \
 *     --session 1 \
 *     --part 2
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { execSync } from 'child_process';

// ─── Types ─────────────────────────────────────────────────────────────────

interface SessionMetadata {
  topic: string;
  sessionNumber: number;
  topicSlug: string;
  clips?: Array<{
    index: number;
    type: string;
    instagram: {
      caption: string;
      coverText?: string;
    };
  }>;
  instagramCaption?: string;
}

interface ContainerResponse {
  id: string;
}

interface StatusResponse {
  status_code: string;
}

interface PublishResponse {
  id: string;
}

interface MediaResponse {
  id: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
}

// ─── Config ────────────────────────────────────────────────────────────────

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
const MAX_CAPTION_LENGTH = 2200;
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;
const MAX_RETRIES = 3;
const VERIFICATION_DELAY_MS = 10000;

// ─── HTTP Helper ───────────────────────────────────────────────────────────

function graphApiRequest<T>(
  urlPath: string,
  method: 'GET' | 'POST',
  params?: Record<string, string>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(`${GRAPH_API_BASE}${urlPath}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        fullUrl.searchParams.set(key, value);
      }
    }

    const options = {
      method,
      hostname: fullUrl.hostname,
      path: `${fullUrl.pathname}${fullUrl.search}`,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            const errMsg = parsed.error.message || JSON.stringify(parsed.error);
            const errCode = parsed.error.code || 0;
            const err = new Error(`Instagram API error (${errCode}): ${errMsg}`) as Error & { code: number };
            err.code = errCode;
            reject(err);
          } else {
            resolve(parsed as T);
          }
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── R2 Upload (for making video publicly accessible) ──────────────────────

function uploadToR2(videoPath: string): string {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    throw new Error(
      'R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
      'R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL env vars, ' +
      'or use --url to provide a public video URL directly.',
    );
  }

  const filename = `temp-ig-${Date.now()}-${path.basename(videoPath)}`;

  // Use AWS CLI (available in GitHub Actions runners) with S3-compatible endpoint
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  console.log(`Uploading to R2: ${filename}...`);

  try {
    execSync(
      `aws s3 cp "${videoPath}" "s3://${bucketName}/${filename}" ` +
      `--endpoint-url "${endpoint}" ` +
      `--content-type "video/mp4"`,
      {
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: accessKeyId,
          AWS_SECRET_ACCESS_KEY: secretAccessKey,
          AWS_DEFAULT_REGION: 'auto',
        },
        stdio: 'pipe',
      },
    );
  } catch (err) {
    throw new Error(`R2 upload failed: ${(err as Error).message}`);
  }

  const url = `${publicUrl}/${filename}`;
  console.log(`Uploaded to R2: ${url}`);
  return url;
}

function deleteFromR2(url: string): void {
  const publicUrl = process.env.R2_PUBLIC_URL;
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!publicUrl || !accountId || !bucketName) return;

  const filename = url.replace(`${publicUrl}/`, '');
  if (!filename.startsWith('temp-ig-')) return;

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  try {
    execSync(
      `aws s3 rm "s3://${bucketName}/${filename}" --endpoint-url "${endpoint}"`,
      {
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
          AWS_DEFAULT_REGION: 'auto',
        },
        stdio: 'pipe',
      },
    );
    console.log(`Deleted temp R2 file: ${filename}`);
  } catch {
    console.warn(`Warning: Could not delete temp R2 file: ${filename}`);
  }
}

// ─── Caption Generation ───────────────────────────────────────────────────

function generateCaption(metadata: SessionMetadata, partNumber?: number): string {
  // Try clip-specific caption first
  if (partNumber && metadata.clips) {
    const clip = metadata.clips.find(c => c.index === partNumber);
    if (clip?.instagram?.caption) {
      return clip.instagram.caption.slice(0, MAX_CAPTION_LENGTH);
    }
  }

  // Fall back to session-level caption
  if (metadata.instagramCaption) {
    return metadata.instagramCaption.slice(0, MAX_CAPTION_LENGTH);
  }

  // Generate default
  const topicTag = `#${(metadata.topic || '').replace(/\s+/g, '').toLowerCase()}`;
  return `${metadata.topic} Session ${metadata.sessionNumber} Part ${partNumber || 1}

FREE interview prep at guru-sishya.in/${metadata.topicSlug}

${topicTag} #systemdesign #codinginterview #faang #interviewprep #programming #tech #developer`.slice(0, MAX_CAPTION_LENGTH);
}

// ─── Upload Reel with Retry ───────────────────────────────────────────────

async function uploadReel(
  videoUrl: string,
  caption: string,
  accessToken: string,
  businessId: string,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\nUpload attempt ${attempt}/${MAX_RETRIES}...`);

      // Step 1: Create media container
      console.log('Step 1/3: Creating media container...');
      const container = await graphApiRequest<ContainerResponse>(
        `/${businessId}/media`,
        'POST',
        {
          media_type: 'REELS',
          video_url: videoUrl,
          caption,
          share_to_feed: 'true',
          access_token: accessToken,
        },
      );

      const containerId = container.id;
      console.log(`Container created: ${containerId}`);

      // Step 2: Poll for upload completion
      console.log('Step 2/3: Waiting for video processing...');
      let pollAttempts = 0;

      while (pollAttempts < MAX_POLL_ATTEMPTS) {
        const status = await graphApiRequest<StatusResponse>(
          `/${containerId}`,
          'GET',
          {
            fields: 'status_code',
            access_token: accessToken,
          },
        );

        if (pollAttempts % 6 === 0) {
          console.log(`  Status: ${status.status_code} (${pollAttempts * 5}s elapsed)`);
        }

        if (status.status_code === 'FINISHED') break;

        if (status.status_code === 'ERROR') {
          throw new Error('Video processing failed. Check format: 9:16 MP4, 3-90s, H.264.');
        }

        pollAttempts++;
        await sleep(POLL_INTERVAL_MS);
      }

      if (pollAttempts >= MAX_POLL_ATTEMPTS) {
        throw new Error('Timed out waiting for video processing (5 minutes).');
      }

      // Step 3: Publish
      console.log('Step 3/3: Publishing reel...');
      const published = await graphApiRequest<PublishResponse>(
        `/${businessId}/media_publish`,
        'POST',
        {
          creation_id: containerId,
          access_token: accessToken,
        },
      );

      console.log(`Reel published: ${published.id}`);
      return published.id;

    } catch (err: unknown) {
      lastError = err as Error;
      const error = err as Error & { code?: number };

      // Don't retry on auth errors
      if (error.code === 190 || error.code === 10) {
        throw error;
      }

      if (attempt < MAX_RETRIES) {
        const delay = POLL_INTERVAL_MS * attempt * 2;
        console.warn(`Attempt ${attempt} failed: ${error.message}. Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('All upload attempts failed');
}

// ─── Verify Post ───────────────────────────────────────────────────────────

async function verifyPost(
  mediaId: string,
  accessToken: string,
): Promise<{ verified: boolean; permalink?: string }> {
  console.log(`Verifying post ${mediaId}...`);
  await sleep(VERIFICATION_DELAY_MS);

  try {
    const media = await graphApiRequest<MediaResponse>(
      `/${mediaId}`,
      'GET',
      {
        fields: 'id,media_url,permalink,timestamp',
        access_token: accessToken,
      },
    );

    if (media.id) {
      console.log(`Verified: ${media.permalink || media.id}`);
      return { verified: true, permalink: media.permalink };
    }
  } catch (err) {
    console.warn(`Verification warning: ${(err as Error).message}`);
  }

  return { verified: false };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  function getArg(name: string): string | undefined {
    const eqForm = args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
    if (eqForm) return eqForm;
    const idx = args.indexOf(`--${name}`);
    if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) {
      return args[idx + 1];
    }
    return undefined;
  }

  const videoPath = getArg('video');
  const directUrl = getArg('url');
  const metadataPath = getArg('metadata');
  const topic = getArg('topic') || '';
  const session = parseInt(getArg('session') || '1', 10);
  const part = getArg('part') ? parseInt(getArg('part')!, 10) : undefined;
  const additionalRaw = getArg('additional');
  const additionalVideos = additionalRaw ? additionalRaw.split(',') : [];

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const businessId = process.env.INSTAGRAM_BUSINESS_ID;

  if (!accessToken) {
    console.error('Error: INSTAGRAM_ACCESS_TOKEN env var required.');
    process.exit(1);
  }
  if (!businessId) {
    console.error('Error: INSTAGRAM_BUSINESS_ID env var required.');
    process.exit(1);
  }

  if (!metadataPath) {
    console.error('Usage: publish-to-instagram.ts --video <file> --metadata <file> [--url <public_url>]');
    console.error('  --topic <slug> --session <N> [--part <N>] [--additional <file1,file2>]');
    process.exit(1);
  }

  const resolvedMetadata = path.resolve(metadataPath);
  if (!fs.existsSync(resolvedMetadata)) {
    console.error(`Metadata file not found: ${resolvedMetadata}`);
    process.exit(1);
  }

  const metadata: SessionMetadata = JSON.parse(fs.readFileSync(resolvedMetadata, 'utf-8'));

  // Collect all videos to upload
  const videos: Array<{ path: string; partNumber: number }> = [];

  if (videoPath) {
    const resolved = path.resolve(videoPath);
    if (!fs.existsSync(resolved)) {
      console.error(`Video file not found: ${resolved}`);
      process.exit(1);
    }
    videos.push({ path: resolved, partNumber: part || 1 });
  }

  for (let i = 0; i < additionalVideos.length; i++) {
    const resolved = path.resolve(additionalVideos[i]);
    if (fs.existsSync(resolved)) {
      videos.push({ path: resolved, partNumber: (part || 1) + i + 1 });
    } else {
      console.warn(`Skipping missing additional video: ${resolved}`);
    }
  }

  const allResults: Array<{ mediaId: string; part: number; permalink?: string }> = [];
  const r2Urls: string[] = [];

  try {
    for (const video of videos) {
      console.log(`\n=== Instagram Reel: Part ${video.partNumber} ===`);
      console.log(`File: ${video.path}`);

      // Get public URL
      let videoUrl: string;
      if (directUrl && videos.length === 1) {
        videoUrl = directUrl;
      } else {
        // Upload to R2 to get a public URL
        videoUrl = uploadToR2(video.path);
        r2Urls.push(videoUrl);
      }

      const caption = generateCaption(metadata, video.partNumber);
      console.log(`Caption: ${caption.slice(0, 80)}...`);

      const mediaId = await uploadReel(videoUrl, caption, accessToken, businessId);

      // Verify
      const verification = await verifyPost(mediaId, accessToken);

      allResults.push({
        mediaId,
        part: video.partNumber,
        permalink: verification.permalink,
      });

      // Rate limit pause between multiple uploads
      if (videos.indexOf(video) < videos.length - 1) {
        console.log('Waiting 30s between uploads (rate limit)...');
        await sleep(30000);
      }
    }

    // Output for CI
    if (allResults.length > 0) {
      const primary = allResults[0];

      const outputFile = process.env.GITHUB_OUTPUT;
      if (outputFile) {
        const lines = [
          `instagram_media_id=${primary.mediaId}`,
          `instagram_permalink=${primary.permalink || ''}`,
        ];
        if (allResults.length > 1) {
          lines.push(`instagram_additional_ids=${allResults.slice(1).map(r => r.mediaId).join(',')}`);
        }
        fs.appendFileSync(outputFile, lines.join('\n') + '\n');
      }

      console.log(`\nINSTAGRAM_MEDIA_ID=${primary.mediaId}`);
      if (primary.permalink) {
        console.log(`INSTAGRAM_PERMALINK=${primary.permalink}`);
      }

      // Save result file
      const resultPath = (videoPath ? path.resolve(videoPath) : resolvedMetadata)
        .replace(/\.[^.]+$/, '.instagram-result.json');
      fs.writeFileSync(resultPath, JSON.stringify(allResults, null, 2));
      console.log(`Result saved to: ${resultPath}`);
    }

  } finally {
    // Cleanup R2 temp files
    for (const url of r2Urls) {
      deleteFromR2(url);
    }
  }
}

main().catch((err) => {
  console.error('Instagram upload failed:', (err as Error).message);
  process.exit(1);
});
