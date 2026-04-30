#!/usr/bin/env npx tsx
/**
 * publish-to-youtube.ts — Upload video to YouTube with full metadata
 *
 * Designed for CI (GitHub Actions). Uses environment variables for auth,
 * reads metadata from the session's metadata.json, and supports:
 *   - Long-form video upload with thumbnail
 *   - YouTube Shorts upload (vertical parts)
 *   - Playlist management (auto-create/add)
 *   - Post-upload verification
 *   - Token refresh via refresh_token (no interactive auth)
 *
 * Environment variables:
 *   YOUTUBE_CLIENT_ID       — Google OAuth2 client ID
 *   YOUTUBE_CLIENT_SECRET   — Google OAuth2 client secret
 *   YOUTUBE_REFRESH_TOKEN   — Long-lived refresh token (from auth-youtube.ts)
 *
 * Usage:
 *   npx tsx scripts/publish-to-youtube.ts \
 *     --video path/to/video.mp4 \
 *     --metadata path/to/metadata.json \
 *     --type long \
 *     --topic load-balancing \
 *     --session 1
 *
 *   npx tsx scripts/publish-to-youtube.ts \
 *     --video path/to/part1.mp4 \
 *     --metadata path/to/metadata.json \
 *     --type short \
 *     --topic load-balancing \
 *     --session 1 \
 *     --part 1
 *
 *   # Additional videos (vertical parts 2+3 in one call)
 *   npx tsx scripts/publish-to-youtube.ts \
 *     --video path/to/part2.mp4 \
 *     --additional path/to/part3.mp4 \
 *     --metadata path/to/metadata.json \
 *     --type short \
 *     --topic load-balancing \
 *     --session 1 \
 *     --part 2
 */

import { google, youtube_v3 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ─────────────────────────────────────────────────────────────────

interface SessionMetadata {
  topic: string;
  sessionNumber: number;
  topicSlug: string;
  clips?: Array<{
    index: number;
    type: string;
    youtube: {
      title: string;
      description: string;
    };
    instagram: {
      caption: string;
    };
  }>;
  youtube?: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    chapters: string;
  };
  instagramCaption?: string;
}

interface UploadResult {
  videoId: string;
  url: string;
  title: string;
  status: string;
  playlistId?: string;
}

// ─── Config ────────────────────────────────────────────────────────────────

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_TAGS_TOTAL_CHARS = 500;
const PLAYLIST_PREFIX = 'Guru Sishya -- ';
const CATEGORY_EDUCATION = '27';
const MAX_UPLOAD_RETRIES = 3;
const RETRY_DELAY_MS = 10000;
const VERIFICATION_DELAY_MS = 15000;

// ─── Auth (CI-compatible, no file-based tokens) ────────────────────────────

function getAuthClient(): InstanceType<typeof google.auth.OAuth2> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    console.error('Error: YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars required.');
    process.exit(1);
  }

  if (!refreshToken) {
    // Fall back to file-based token for local usage
    const tokenPath = path.resolve(__dirname, '..', '.youtube-token.json');
    if (fs.existsSync(tokenPath)) {
      const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials(tokens);
      return oauth2Client;
    }
    console.error('Error: YOUTUBE_REFRESH_TOKEN env var required (or .youtube-token.json for local).');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return oauth2Client;
}

// ─── Metadata Helpers ──────────────────────────────────────────────────────

function generateLongTitle(metadata: SessionMetadata): string {
  if (metadata.youtube?.title) return metadata.youtube.title;
  return `${metadata.topic} Session ${metadata.sessionNumber}`;
}

function generateLongDescription(metadata: SessionMetadata): string {
  if (metadata.youtube?.description) return metadata.youtube.description;
  return `${metadata.topic} - Session ${metadata.sessionNumber}

FREE practice: https://guru-sishya.in/${metadata.topicSlug}

#SystemDesign #CodingInterview #GuruSishya`;
}

function generateShortTitle(metadata: SessionMetadata, partNumber: number): string {
  const clip = metadata.clips?.find(c => c.index === partNumber);
  if (clip?.youtube?.title) {
    let title = clip.youtube.title;
    if (!title.includes('#Shorts')) title += ' #Shorts';
    return title.slice(0, MAX_TITLE_LENGTH);
  }
  return `${metadata.topic} Part ${partNumber} #Shorts`.slice(0, MAX_TITLE_LENGTH);
}

function generateShortDescription(metadata: SessionMetadata, partNumber: number): string {
  const clip = metadata.clips?.find(c => c.index === partNumber);
  if (clip?.youtube?.description) return clip.youtube.description;
  return `${metadata.topic} explained in 60 seconds.

FREE practice: https://guru-sishya.in/${metadata.topicSlug}

#Shorts #${metadata.topic.replace(/\s+/g, '')} #CodingInterview #SystemDesign`;
}

function generateTags(metadata: SessionMetadata): string[] {
  if (metadata.youtube?.tags) return metadata.youtube.tags;
  const t = metadata.topic.toLowerCase();
  return [
    t, `${t} explained`, `${t} interview`, 'system design',
    'coding interview', 'guru sishya', 'FAANG', 'tech interview',
  ];
}

function truncateTitle(title: string): string {
  if (title.length <= MAX_TITLE_LENGTH) return title;
  return title.slice(0, MAX_TITLE_LENGTH - 1).trimEnd() + '\u2026';
}

function truncateDescription(desc: string): string {
  if (desc.length <= MAX_DESCRIPTION_LENGTH) return desc;
  return desc.slice(0, MAX_DESCRIPTION_LENGTH - 3) + '...';
}

function truncateTags(tags: string[]): string[] {
  const result: string[] = [];
  let totalChars = 0;
  for (const tag of tags) {
    const t = tag.trim();
    if (!t) continue;
    if (totalChars + t.length + (result.length > 0 ? 1 : 0) > MAX_TAGS_TOTAL_CHARS) break;
    result.push(t);
    totalChars += t.length + (result.length > 1 ? 1 : 0);
  }
  return result;
}

// ─── Playlist Management ───────────────────────────────────────────────────

async function findOrCreatePlaylist(
  youtube: youtube_v3.Youtube,
  topicName: string,
): Promise<string> {
  const playlistTitle = `${PLAYLIST_PREFIX}${topicName}`;

  // Search existing playlists
  try {
    const listResponse = await youtube.playlists.list({
      part: ['snippet'],
      mine: true,
      maxResults: 50,
    });

    const existing = listResponse.data.items?.find(
      p => p.snippet?.title === playlistTitle,
    );

    if (existing?.id) {
      console.log(`Found existing playlist: ${playlistTitle} (${existing.id})`);
      return existing.id;
    }
  } catch (err) {
    console.warn(`Warning: Could not list playlists: ${(err as Error).message}`);
  }

  // Create new playlist
  try {
    const createResponse = await youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: playlistTitle,
          description: `Complete ${topicName} series by Guru Sishya. FREE practice at guru-sishya.in`,
        },
        status: {
          privacyStatus: 'public',
        },
      },
    });

    const playlistId = createResponse.data.id;
    if (playlistId) {
      console.log(`Created playlist: ${playlistTitle} (${playlistId})`);
      return playlistId;
    }
  } catch (err) {
    console.warn(`Warning: Could not create playlist: ${(err as Error).message}`);
  }

  return '';
}

async function addToPlaylist(
  youtube: youtube_v3.Youtube,
  playlistId: string,
  videoId: string,
): Promise<void> {
  if (!playlistId) return;

  try {
    await youtube.playlistItems.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId,
          },
        },
      },
    });
    console.log(`Added to playlist: ${playlistId}`);
  } catch (err) {
    console.warn(`Warning: Could not add to playlist: ${(err as Error).message}`);
  }
}

// ─── Upload with Retry ─────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadWithRetry(
  youtube: youtube_v3.Youtube,
  requestBody: youtube_v3.Schema$Video,
  videoPath: string,
  thumbnailPath: string | undefined,
  retries: number = MAX_UPLOAD_RETRIES,
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Upload attempt ${attempt}/${retries}...`);

      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody,
        media: {
          body: fs.createReadStream(videoPath),
        },
      });

      const videoId = response.data.id;
      if (!videoId) throw new Error('Upload completed but no video ID returned');

      // Upload thumbnail if provided
      if (thumbnailPath && fs.existsSync(thumbnailPath)) {
        try {
          await youtube.thumbnails.set({
            videoId,
            media: {
              body: fs.createReadStream(thumbnailPath),
            },
          });
          console.log(`Thumbnail uploaded for ${videoId}`);
        } catch (err) {
          console.warn(`Warning: Thumbnail upload failed: ${(err as Error).message}`);
        }
      }

      return videoId;
    } catch (err: unknown) {
      const error = err as Error & { code?: number; errors?: Array<{ message: string; reason: string }> };

      // Don't retry on auth errors or quota exceeded
      if (error.code === 401 || error.code === 403) {
        throw error;
      }

      // Rate limit — longer backoff
      if (error.code === 429) {
        console.warn(`Rate limited. Waiting 60s before retry...`);
        await sleep(60000);
        continue;
      }

      if (attempt === retries) throw error;

      const delay = RETRY_DELAY_MS * attempt;
      console.warn(`Upload failed (attempt ${attempt}): ${error.message}. Retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }
  }

  throw new Error('All upload attempts failed');
}

// ─── Verify Upload ─────────────────────────────────────────────────────────

async function verifyUpload(
  youtube: youtube_v3.Youtube,
  videoId: string,
): Promise<{ status: string; processingStatus: string }> {
  console.log(`Waiting ${VERIFICATION_DELAY_MS / 1000}s before verification...`);
  await sleep(VERIFICATION_DELAY_MS);

  const response = await youtube.videos.list({
    part: ['status', 'processingDetails'],
    id: [videoId],
  });

  const video = response.data.items?.[0];
  if (!video) {
    throw new Error(`Video ${videoId} not found after upload`);
  }

  const uploadStatus = video.status?.uploadStatus || 'unknown';
  const processingStatus = video.processingDetails?.processingStatus || 'unknown';

  console.log(`Verification: uploadStatus=${uploadStatus}, processingStatus=${processingStatus}`);

  if (uploadStatus === 'rejected') {
    const reason = video.status?.rejectionReason || 'unknown';
    throw new Error(`Video rejected: ${reason}`);
  }

  if (uploadStatus === 'failed') {
    const reason = video.status?.failureReason || 'unknown';
    throw new Error(`Upload failed: ${reason}`);
  }

  return { status: uploadStatus, processingStatus };
}

// ─── Main Upload Flow ──────────────────────────────────────────────────────

async function publishVideo(options: {
  videoPath: string;
  metadataPath: string;
  type: 'long' | 'short';
  topic: string;
  session: number;
  part?: number;
  thumbnailPath?: string;
  additionalVideos?: string[];
}): Promise<UploadResult[]> {
  const auth = getAuthClient();
  const youtube = google.youtube({ version: 'v3', auth });

  // Load metadata
  const metadata: SessionMetadata = JSON.parse(
    fs.readFileSync(options.metadataPath, 'utf-8'),
  );

  const results: UploadResult[] = [];

  // Collect all videos to upload
  const videosToUpload: Array<{
    path: string;
    title: string;
    description: string;
    isShort: boolean;
    partNumber?: number;
  }> = [];

  if (options.type === 'long') {
    videosToUpload.push({
      path: options.videoPath,
      title: generateLongTitle(metadata),
      description: generateLongDescription(metadata),
      isShort: false,
    });
  } else {
    // Short / vertical
    const partNum = options.part || 1;
    videosToUpload.push({
      path: options.videoPath,
      title: generateShortTitle(metadata, partNum),
      description: generateShortDescription(metadata, partNum),
      isShort: true,
      partNumber: partNum,
    });

    // Additional videos (e.g., parts 2+3 in one call)
    if (options.additionalVideos) {
      for (let i = 0; i < options.additionalVideos.length; i++) {
        const additionalPartNum = partNum + i + 1;
        videosToUpload.push({
          path: options.additionalVideos[i],
          title: generateShortTitle(metadata, additionalPartNum),
          description: generateShortDescription(metadata, additionalPartNum),
          isShort: true,
          partNumber: additionalPartNum,
        });
      }
    }
  }

  const tags = truncateTags(generateTags(metadata));

  // Find or create playlist for long-form
  let playlistId = '';
  if (options.type === 'long') {
    playlistId = await findOrCreatePlaylist(youtube, metadata.topic || options.topic);
  }

  for (const video of videosToUpload) {
    if (!fs.existsSync(video.path)) {
      console.warn(`Skipping missing file: ${video.path}`);
      continue;
    }

    const fileSize = fs.statSync(video.path).size;
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);

    const title = truncateTitle(video.title);
    const description = truncateDescription(video.description);

    console.log('');
    console.log(`=== YouTube Upload: ${video.isShort ? 'Short' : 'Long'} ===`);
    console.log(`File:     ${video.path} (${fileSizeMB} MB)`);
    console.log(`Title:    ${title}`);
    console.log(`Tags:     ${tags.length} tags`);

    const requestBody: youtube_v3.Schema$Video = {
      snippet: {
        title,
        description,
        tags,
        categoryId: metadata.youtube?.categoryId || CATEGORY_EDUCATION,
        defaultLanguage: 'en',
        defaultAudioLanguage: 'en',
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    };

    const videoId = await uploadWithRetry(
      youtube,
      requestBody,
      video.path,
      !video.isShort ? options.thumbnailPath : undefined,
    );

    console.log(`Uploaded: https://youtu.be/${videoId}`);

    // Add to playlist
    if (playlistId && !video.isShort) {
      await addToPlaylist(youtube, playlistId, videoId);
    }

    // Verify
    try {
      const verification = await verifyUpload(youtube, videoId);
      console.log(`Verified: ${verification.status} / ${verification.processingStatus}`);
    } catch (err) {
      console.warn(`Verification warning: ${(err as Error).message}`);
    }

    results.push({
      videoId,
      url: `https://youtu.be/${videoId}`,
      title,
      status: 'public',
      playlistId: playlistId || undefined,
    });
  }

  return results;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

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

  const videoPath = getArg('video') || getArg('file');
  const metadataPath = getArg('metadata');
  const type = (getArg('type') || 'long') as 'long' | 'short';
  const topic = getArg('topic') || '';
  const session = parseInt(getArg('session') || '1', 10);
  const part = getArg('part') ? parseInt(getArg('part')!, 10) : undefined;
  const thumbnailPath = getArg('thumbnail');
  const additionalRaw = getArg('additional');
  const additionalVideos = additionalRaw ? additionalRaw.split(',') : undefined;

  if (!videoPath || !metadataPath) {
    console.error('Usage: publish-to-youtube.ts --video <file> --metadata <file> --type <long|short>');
    console.error('  --topic <slug> --session <N> [--part <N>] [--thumbnail <file>]');
    console.error('  [--additional <file1,file2>]');
    process.exit(1);
  }

  const resolvedVideo = path.resolve(videoPath);
  const resolvedMetadata = path.resolve(metadataPath);

  if (!fs.existsSync(resolvedVideo)) {
    console.error(`Video file not found: ${resolvedVideo}`);
    process.exit(1);
  }
  if (!fs.existsSync(resolvedMetadata)) {
    console.error(`Metadata file not found: ${resolvedMetadata}`);
    process.exit(1);
  }

  try {
    const results = await publishVideo({
      videoPath: resolvedVideo,
      metadataPath: resolvedMetadata,
      type,
      topic,
      session,
      part,
      thumbnailPath: thumbnailPath ? path.resolve(thumbnailPath) : undefined,
      additionalVideos: additionalVideos?.map(v => path.resolve(v)),
    });

    // Output for CI consumption
    if (results.length > 0) {
      const primary = results[0];
      // Write to GITHUB_OUTPUT if available
      const outputFile = process.env.GITHUB_OUTPUT;
      if (outputFile) {
        const lines = [
          `youtube_video_id=${primary.videoId}`,
          `youtube_url=${primary.url}`,
          `youtube_title=${primary.title}`,
        ];
        if (results.length > 1) {
          lines.push(`youtube_additional_ids=${results.slice(1).map(r => r.videoId).join(',')}`);
        }
        fs.appendFileSync(outputFile, lines.join('\n') + '\n');
      }

      // Also write result JSON
      const resultPath = resolvedVideo.replace(/\.[^.]+$/, '.youtube-result.json');
      fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
      console.log(`\nResult saved to: ${resultPath}`);

      // Print for CI
      console.log(`\nYOUTUBE_VIDEO_ID=${primary.videoId}`);
      console.log(`YOUTUBE_URL=${primary.url}`);
    }
  } catch (err: unknown) {
    const error = err as Error & { code?: number };
    console.error('\nUpload failed!');

    if (error.code === 403) {
      console.error('Access denied. Check YouTube Data API v3 is enabled and OAuth scopes include youtube.upload.');
    } else if (error.code === 401) {
      console.error('Authentication expired. Refresh the YOUTUBE_REFRESH_TOKEN.');
    } else {
      console.error(`Error: ${error.message}`);
    }

    process.exit(1);
  }
}

main();
