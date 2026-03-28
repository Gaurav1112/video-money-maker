/**
 * Instagram Reels Upload Script (via Graph API)
 *
 * Usage:
 *   INSTAGRAM_ACCESS_TOKEN=xxx INSTAGRAM_BUSINESS_ID=yyy \
 *     npx tsx scripts/upload-instagram.ts output/video.mp4 output/metadata.json
 *
 * Prerequisites:
 *   1. Facebook App with Instagram Graph API access
 *   2. Instagram Business or Creator account connected to a Facebook Page
 *   3. Long-lived access token with:
 *      - instagram_basic
 *      - instagram_content_publish
 *      - pages_read_engagement
 *   4. Video must be publicly accessible via URL (hosted or use --url flag)
 *
 * Note: The Instagram Graph API requires videos to be hosted at a public URL.
 *       This script can either:
 *       a) Upload to a temp hosting service first (if you set up UPLOAD_HOST_URL)
 *       b) Accept a --url flag pointing to an already-hosted video
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetadataFile {
  youtube?: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    chapters: string;
  };
  instagramCaption?: string;
  thumbnailText?: string;
}

interface ContainerResponse {
  id: string;
}

interface StatusResponse {
  status_code: string;
  status?: string;
}

interface PublishResponse {
  id: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
const MAX_CAPTION_LENGTH = 2200;
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max wait

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

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
            reject(new Error(`Instagram API error: ${errMsg}`));
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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Local File Server ───────────────────────────────────────────────────────

function startLocalFileServer(filePath: string, port: number): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === '/video') {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size,
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    console.log(`Local file server started on port ${port}`);
  });

  return server;
}

// ─── Upload Flow ─────────────────────────────────────────────────────────────

async function uploadReel(
  videoUrl: string,
  caption: string,
  accessToken: string,
  businessId: string,
): Promise<string> {
  // Truncate caption if needed
  const trimmedCaption = caption.length > MAX_CAPTION_LENGTH
    ? caption.slice(0, MAX_CAPTION_LENGTH - 3) + '...'
    : caption;

  console.log('');
  console.log('=== Instagram Reels Upload ===');
  console.log(`Business ID: ${businessId}`);
  console.log(`Video URL:   ${videoUrl}`);
  console.log(`Caption:     ${trimmedCaption.slice(0, 80)}...`);
  console.log('');

  // Step 1: Create media container
  console.log('Step 1/3: Creating media container...');
  const container = await graphApiRequest<ContainerResponse>(
    `/${businessId}/media`,
    'POST',
    {
      media_type: 'REELS',
      video_url: videoUrl,
      caption: trimmedCaption,
      share_to_feed: 'true',
      access_token: accessToken,
    },
  );

  const containerId = container.id;
  console.log(`Container created: ${containerId}`);

  // Step 2: Poll for upload completion
  console.log('Step 2/3: Waiting for video processing...');
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const status = await graphApiRequest<StatusResponse>(
      `/${containerId}`,
      'GET',
      {
        fields: 'status_code',
        access_token: accessToken,
      },
    );

    console.log(`  Status: ${status.status_code} (attempt ${attempts + 1}/${MAX_POLL_ATTEMPTS})`);

    if (status.status_code === 'FINISHED') {
      break;
    }

    if (status.status_code === 'ERROR') {
      throw new Error('Video processing failed. Check video format (9:16, MP4, 3-90s).');
    }

    attempts++;
    await sleep(POLL_INTERVAL_MS);
  }

  if (attempts >= MAX_POLL_ATTEMPTS) {
    throw new Error('Timed out waiting for video processing.');
  }

  // Step 3: Publish the container
  console.log('Step 3/3: Publishing reel...');
  const published = await graphApiRequest<PublishResponse>(
    `/${businessId}/media_publish`,
    'POST',
    {
      creation_id: containerId,
      access_token: accessToken,
    },
  );

  console.log('');
  console.log('Reel published successfully!');
  console.log(`Media ID: ${published.id}`);

  return published.id;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const positional = args.filter((a) => !a.startsWith('--'));

  if (positional.length < 2) {
    console.error('Usage: npx tsx scripts/upload-instagram.ts <video.mp4> <metadata.json> [--url <public_url>]');
    console.error('');
    console.error('Arguments:');
    console.error('  video.mp4       Path to the video file (9:16 format, 3-90 seconds)');
    console.error('  metadata.json   Path to the metadata JSON (uses instagramCaption)');
    console.error('');
    console.error('Options:');
    console.error('  --url <url>     Public URL of the video (required by Instagram API)');
    console.error('');
    console.error('Environment variables:');
    console.error('  INSTAGRAM_ACCESS_TOKEN   Long-lived access token');
    console.error('  INSTAGRAM_BUSINESS_ID    Instagram Business/Creator account ID');
    console.error('  UPLOAD_HOST_URL          (optional) Base URL for local tunnel (e.g., ngrok)');
    process.exit(1);
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const businessId = process.env.INSTAGRAM_BUSINESS_ID;

  if (!accessToken) {
    console.error('Error: INSTAGRAM_ACCESS_TOKEN env var is required.');
    console.error('Get one from: https://developers.facebook.com/tools/explorer/');
    process.exit(1);
  }

  if (!businessId) {
    console.error('Error: INSTAGRAM_BUSINESS_ID env var is required.');
    console.error('Find yours via: GET /me/accounts → page_id → GET /{page_id}?fields=instagram_business_account');
    process.exit(1);
  }

  const [videoPath, metadataPath] = positional;

  // Validate video file
  const resolvedVideoPath = path.resolve(videoPath);
  if (!fs.existsSync(resolvedVideoPath)) {
    console.error(`Error: Video file not found: ${resolvedVideoPath}`);
    process.exit(1);
  }

  // Validate metadata
  const resolvedMetadataPath = path.resolve(metadataPath);
  if (!fs.existsSync(resolvedMetadataPath)) {
    console.error(`Error: Metadata file not found: ${resolvedMetadataPath}`);
    process.exit(1);
  }

  let metadata: MetadataFile;
  try {
    metadata = JSON.parse(fs.readFileSync(resolvedMetadataPath, 'utf-8'));
  } catch (err) {
    console.error(`Error: Failed to parse metadata JSON: ${(err as Error).message}`);
    process.exit(1);
  }

  const caption = metadata.instagramCaption || metadata.youtube?.description || 'Check out this video!';

  // Determine video URL
  const urlFlagIdx = flags.indexOf('--url');
  let videoUrl: string;
  let localServer: http.Server | undefined;

  if (urlFlagIdx !== -1 && args[args.indexOf('--url') + 1]) {
    videoUrl = args[args.indexOf('--url') + 1];
  } else if (process.env.UPLOAD_HOST_URL) {
    // Use tunnel URL (e.g., ngrok) + local file server
    const port = 9876;
    localServer = startLocalFileServer(resolvedVideoPath, port);
    videoUrl = `${process.env.UPLOAD_HOST_URL}/video`;
    console.log(`Using tunnel URL: ${videoUrl}`);
    console.log('Make sure your tunnel is forwarding to localhost:9876');
  } else {
    console.error('Error: Instagram API requires a publicly accessible video URL.');
    console.error('');
    console.error('Options:');
    console.error('  1. Pass --url <public_video_url>');
    console.error('  2. Set UPLOAD_HOST_URL to a tunnel URL (e.g., ngrok http 9876)');
    console.error('  3. Host the video somewhere and provide the URL');
    process.exit(1);
  }

  try {
    const mediaId = await uploadReel(videoUrl, caption, accessToken, businessId);

    // Write result
    const resultPath = resolvedVideoPath.replace(/\.[^.]+$/, '.instagram-result.json');
    fs.writeFileSync(resultPath, JSON.stringify({ mediaId, platform: 'instagram' }, null, 2));
    console.log(`\nResult saved to: ${resultPath}`);
  } catch (err) {
    console.error('');
    console.error('Upload failed:', (err as Error).message);
    process.exit(1);
  } finally {
    if (localServer) {
      localServer.close();
    }
  }
}

main();
