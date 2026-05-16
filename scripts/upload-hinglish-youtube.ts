#!/usr/bin/env npx tsx
/**
 * upload-hinglish-youtube.ts
 *
 * Composes a Hinglish-VO MP4 (original English video + Hinglish audio),
 * uploads it to YouTube, and optionally adds it to a playlist.
 *
 * Usage:
 *   npx tsx scripts/upload-hinglish-youtube.ts \
 *     --topic <slug> --session <N> \
 *     --audio <path/to/audio-hi.mp3> \
 *     --playlist <playlist-id>
 *
 * Required env vars:
 *   YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
 *
 * Writes to $GITHUB_OUTPUT:
 *   video_id=<id>
 *   metadata_path=<resolved path>
 *   video_path=<hinglish mp4 path>
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFileSync } from 'child_process';

import { google, youtube_v3 } from 'googleapis';
import { getYouTubeAuthClient } from './lib/youtube-oauth.js';

// ─── Types ────────────────────────────────────────────────────────────────

interface PublishEntry {
  id: string;
  topic: string;
  session: number;
  slotType: string;
  youtubeVideoId: string | null;
  files: {
    video: string;
    metadata: string;
    thumbnail?: string;
  };
  [key: string]: unknown;
}

interface PublishQueue {
  entries: PublishEntry[];
  [key: string]: unknown;
}

export interface MetadataFile {
  youtube: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    chapters?: string;
    playlistTitle?: string;
  };
  slug?: string;
  topic?: string;
  [key: string]: unknown;
}

export interface HinglishUploadPayload {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  defaultLanguage: 'hi';
  defaultAudioLanguage: 'hi';
}

// ─── Config ───────────────────────────────────────────────────────────────

const QUEUE_PATH = path.resolve(__dirname, '..', 'config', 'publish-queue.json');
const OUTPUT_ROOT = path.resolve(__dirname, '..', 'output');

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_TAGS_TOTAL_CHARS = 500;

// ─── Payload builder (exported for unit testing) ──────────────────────────

/**
 * Builds the YouTube snippet/status payload for a Hinglish upload.
 * Pure function — no I/O, safe for unit testing.
 */
export function buildHinglishUploadPayload(
  metadata: MetadataFile,
  originalVideoId: string,
): HinglishUploadPayload {
  const originalTitle = metadata.youtube.title;

  // Title: "<original title> (Hinglish)", trimmed to ≤100 chars
  const suffix = ' (Hinglish)';
  let title = `${originalTitle}${suffix}`;
  if (title.length > MAX_TITLE_LENGTH) {
    title =
      originalTitle.slice(0, MAX_TITLE_LENGTH - suffix.length).trimEnd() + suffix;
  }

  // Description: Hinglish banner prepended to original
  const banner =
    `🇮🇳 Hinglish version of: ${originalTitle}\n\n` +
    `📺 English original: https://youtube.com/shorts/${originalVideoId}\n\n`;

  let description = banner + metadata.youtube.description;
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    description = description.slice(0, MAX_DESCRIPTION_LENGTH - 3) + '...';
  }

  // Tags: preserve original tags within 500-char limit
  const tags: string[] = [];
  let totalChars = 0;
  for (const tag of metadata.youtube.tags) {
    const t = tag.trim();
    if (!t) continue;
    if (totalChars + t.length + (tags.length > 0 ? 1 : 0) > MAX_TAGS_TOTAL_CHARS) break;
    tags.push(t);
    totalChars += t.length + (tags.length > 1 ? 1 : 0);
  }

  return {
    title,
    description,
    tags,
    categoryId: metadata.youtube.categoryId,
    defaultLanguage: 'hi',
    defaultAudioLanguage: 'hi',
  };
}

// ─── ffmpeg composition ───────────────────────────────────────────────────

/**
 * Compose Hinglish video: swap audio track of source video for Hinglish MP3.
 *   - Video stream copied as-is (-c:v copy)
 *   - Audio re-encoded to AAC 128k
 *   - Duration = min(video, audio) via -shortest
 * Returns path of the output mp4.
 */
function composeHinglishVideo(videoPath: string, audioPath: string): string {
  const outputPath = path.join(path.dirname(audioPath), 'video-with-hinglish.mp4');

  execFileSync('ffmpeg', [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    outputPath,
  ], { stdio: 'pipe' });

  return outputPath;
}

// ─── YouTube helpers ──────────────────────────────────────────────────────

async function addVideoToPlaylist(
  youtube: youtube_v3.Youtube,
  playlistId: string,
  videoId: string,
): Promise<void> {
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
}

// ─── Args parsing ─────────────────────────────────────────────────────────

function parseArgs(): {
  topic: string;
  session: number;
  audioPath: string;
  playlistId: string;
} {
  const args = process.argv.slice(2);
  function getArg(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : undefined;
  }

  const topic = getArg('topic');
  const sessionStr = getArg('session');
  const audioPath = getArg('audio');
  const playlistId = getArg('playlist') ?? '';

  if (!topic || !sessionStr || !audioPath) {
    console.error(
      'Usage: upload-hinglish-youtube.ts --topic <slug> --session <N> ' +
        '--audio <mp3> [--playlist <playlist-id>]',
    );
    process.exit(1);
  }

  const session = parseInt(sessionStr, 10);
  if (isNaN(session) || session < 1) {
    console.error('--session must be a positive integer');
    process.exit(1);
  }

  return { topic, session, audioPath, playlistId };
}

// ─── GitHub Actions output helper ─────────────────────────────────────────

function writeGitHubOutput(key: string, value: string): void {
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    fs.appendFileSync(ghOutput, `${key}=${value}${os.EOL}`);
  }
  // Always echo to stdout for local visibility
  console.log(`${key}=${value}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { topic, session, audioPath, playlistId } = parseArgs();

  // Check required YouTube OAuth secrets
  const missingSecrets: string[] = [];
  if (!process.env.YOUTUBE_CLIENT_ID) missingSecrets.push('YOUTUBE_CLIENT_ID');
  if (!process.env.YOUTUBE_CLIENT_SECRET) missingSecrets.push('YOUTUBE_CLIENT_SECRET');
  if (!process.env.YOUTUBE_REFRESH_TOKEN) missingSecrets.push('YOUTUBE_REFRESH_TOKEN');

  if (missingSecrets.length > 0) {
    console.error(
      `[upload-hinglish-youtube] ⚠️  missing secrets: ${missingSecrets.join(', ')} — skipping upload`,
    );
    process.exit(0); // non-fatal, matches pattern in cross-post-x.ts / publish-to-instagram.ts
  }

  // 1. Load queue
  if (!fs.existsSync(QUEUE_PATH)) {
    console.error(`[upload-hinglish-youtube] queue not found: ${QUEUE_PATH}`);
    process.exit(1);
  }
  const queue: PublishQueue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8'));

  const entry = queue.entries.find(
    (e) => e.topic === topic && Number(e.session) === session,
  );
  if (!entry) {
    console.error(`[upload-hinglish-youtube] entry not found: topic=${topic} session=${session}`);
    process.exit(1);
  }

  // 2. Resolve source video path
  const videoPath = path.join(OUTPUT_ROOT, entry.files.video);
  if (!fs.existsSync(videoPath)) {
    console.error(`[upload-hinglish-youtube] source video not found: ${videoPath}`);
    process.exit(1);
  }

  // 3. Validate audio file
  const resolvedAudioPath = path.resolve(audioPath);
  if (!fs.existsSync(resolvedAudioPath)) {
    console.error(`[upload-hinglish-youtube] audio not found: ${resolvedAudioPath}`);
    process.exit(1);
  }

  // 4. Resolve metadata path
  const metadataPath = path.join(OUTPUT_ROOT, entry.files.metadata);
  if (!fs.existsSync(metadataPath)) {
    console.error(`[upload-hinglish-youtube] metadata not found: ${metadataPath}`);
    process.exit(1);
  }
  const metadata: MetadataFile = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

  // 5. Compose Hinglish video
  console.error(`[upload-hinglish-youtube] composing Hinglish video…`);
  const hinglishVideoPath = composeHinglishVideo(videoPath, resolvedAudioPath);
  console.error(`[upload-hinglish-youtube] composed: ${hinglishVideoPath}`);

  // 6. Build upload payload
  const originalVideoId = entry.youtubeVideoId ?? '';
  const payload = buildHinglishUploadPayload(metadata, originalVideoId);
  console.error(`[upload-hinglish-youtube] title: ${payload.title}`);

  // 7. Upload to YouTube
  const auth = getYouTubeAuthClient();
  const youtube = google.youtube({ version: 'v3', auth });

  const fileSize = fs.statSync(hinglishVideoPath).size;
  console.error(`[upload-hinglish-youtube] uploading ${(fileSize / 1024 / 1024).toFixed(1)} MB…`);

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: payload.title,
        description: payload.description,
        tags: payload.tags,
        categoryId: payload.categoryId,
        defaultLanguage: payload.defaultLanguage,
        defaultAudioLanguage: payload.defaultAudioLanguage,
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      mimeType: 'video/mp4',
      body: fs.createReadStream(hinglishVideoPath),
    },
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error('[upload-hinglish-youtube] upload completed but no video ID returned');
  }

  console.error(`[upload-hinglish-youtube] ✅ uploaded: https://youtu.be/${videoId}`);

  // 8. Add to playlist
  if (playlistId) {
    try {
      await addVideoToPlaylist(youtube, playlistId, videoId);
      console.error(`[upload-hinglish-youtube] added to playlist: ${playlistId}`);
    } catch (err) {
      console.error(`[upload-hinglish-youtube] ⚠️  playlist add failed: ${(err as Error).message}`);
    }
  }

  // 9. Write GitHub Actions outputs
  writeGitHubOutput('video_id', videoId);
  writeGitHubOutput('metadata_path', metadataPath);
  writeGitHubOutput('video_path', hinglishVideoPath);
}

// Only run when executed as the entry-point script (not when imported by tests)
const _argv1 = process.argv[1] ?? '';
if (_argv1.endsWith('upload-hinglish-youtube.ts') || _argv1.endsWith('upload-hinglish-youtube.js')) {
  main().catch((err) => {
    console.error(`[upload-hinglish-youtube] fatal: ${(err as Error).message}`);
    process.exit(1);
  });
}
