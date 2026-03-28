/**
 * YouTube Video Upload Script
 *
 * Usage:
 *   npx tsx scripts/upload-youtube.ts output/video.mp4 output/metadata.json [--shorts] [--private]
 *
 * Prerequisites:
 *   1. Run `npx tsx scripts/auth-youtube.ts` first to generate .youtube-token.json
 *   2. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars
 *
 * Flags:
 *   --shorts   Add #Shorts to title, optimized for vertical (9:16) content
 *   --private  Upload as private (default: public)
 */

import { google, youtube_v3 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetadataFile {
  youtube: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    chapters: string;
  };
  instagramCaption?: string;
  thumbnailText?: string;
}

interface UploadResult {
  videoId: string;
  url: string;
  title: string;
  status: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TOKEN_PATH = path.resolve(__dirname, '..', '.youtube-token.json');
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_TAGS_TOTAL_CHARS = 500;

// ─── Auth ────────────────────────────────────────────────────────────────────

function getAuthClient(): InstanceType<typeof google.auth.OAuth2> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Error: YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars required.');
    process.exit(1);
  }

  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('Error: .youtube-token.json not found.');
    console.error('Run: npx tsx scripts/auth-youtube.ts');
    process.exit(1);
  }

  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials(tokens);

  // Auto-save refreshed tokens
  oauth2Client.on('tokens', (newTokens) => {
    const existing = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    const merged = { ...existing, ...newTokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
    console.log('Access token refreshed and saved.');
  });

  return oauth2Client;
}

// ─── Metadata Processing ─────────────────────────────────────────────────────

function prepareTitle(rawTitle: string, isShorts: boolean): string {
  let title = rawTitle;

  if (isShorts && !title.includes('#Shorts')) {
    title = `${title} #Shorts`;
  }

  if (title.length > MAX_TITLE_LENGTH) {
    // Truncate but keep #Shorts if present
    if (isShorts) {
      const suffix = ' #Shorts';
      title = title.slice(0, MAX_TITLE_LENGTH - suffix.length).trimEnd() + suffix;
    } else {
      title = title.slice(0, MAX_TITLE_LENGTH - 1).trimEnd() + '\u2026';
    }
  }

  return title;
}

function prepareDescription(description: string): string {
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return description.slice(0, MAX_DESCRIPTION_LENGTH - 3) + '...';
  }
  return description;
}

function prepareTags(tags: string[]): string[] {
  const result: string[] = [];
  let totalChars = 0;

  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) continue;

    // +1 for the comma separator YouTube uses internally
    if (totalChars + trimmed.length + (result.length > 0 ? 1 : 0) > MAX_TAGS_TOTAL_CHARS) {
      break;
    }

    result.push(trimmed);
    totalChars += trimmed.length + (result.length > 1 ? 1 : 0);
  }

  return result;
}

// ─── Upload ──────────────────────────────────────────────────────────────────

async function uploadVideo(
  videoPath: string,
  metadata: MetadataFile,
  options: { shorts: boolean; private: boolean },
): Promise<UploadResult> {
  const auth = getAuthClient();
  const youtube = google.youtube({ version: 'v3', auth });

  const title = prepareTitle(metadata.youtube.title, options.shorts);
  const description = prepareDescription(metadata.youtube.description);
  const tags = prepareTags(metadata.youtube.tags);
  const privacyStatus = options.private ? 'private' : 'public';

  const fileSize = fs.statSync(videoPath).size;
  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);

  console.log('');
  console.log('=== YouTube Upload ===');
  console.log(`File:        ${videoPath} (${fileSizeMB} MB)`);
  console.log(`Title:       ${title}`);
  console.log(`Privacy:     ${privacyStatus}`);
  console.log(`Category:    ${metadata.youtube.categoryId} (Education)`);
  console.log(`Tags:        ${tags.length} tags`);
  console.log(`Shorts:      ${options.shorts ? 'Yes' : 'No'}`);
  console.log('');
  console.log('Uploading...');

  const requestBody: youtube_v3.Schema$Video = {
    snippet: {
      title,
      description,
      tags,
      categoryId: metadata.youtube.categoryId || '27',
      defaultLanguage: 'en',
      defaultAudioLanguage: 'en',
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  };

  const media = {
    body: fs.createReadStream(videoPath),
  };

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody,
    media,
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error('Upload completed but no video ID returned');
  }

  const result: UploadResult = {
    videoId,
    url: `https://youtu.be/${videoId}`,
    title,
    status: privacyStatus,
  };

  console.log('');
  console.log('Upload successful!');
  console.log(`Video ID:    ${result.videoId}`);
  console.log(`URL:         ${result.url}`);
  console.log(`Status:      ${result.status}`);

  return result;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const positional = args.filter((a) => !a.startsWith('--'));

  if (positional.length < 2) {
    console.error('Usage: npx tsx scripts/upload-youtube.ts <video.mp4> <metadata.json> [--shorts] [--private]');
    console.error('');
    console.error('Arguments:');
    console.error('  video.mp4       Path to the video file');
    console.error('  metadata.json   Path to the metadata JSON (from pipeline)');
    console.error('');
    console.error('Flags:');
    console.error('  --shorts        Upload as YouTube Short (adds #Shorts to title)');
    console.error('  --private       Upload as private instead of public');
    process.exit(1);
  }

  const [videoPath, metadataPath] = positional;

  // Validate video file
  const resolvedVideoPath = path.resolve(videoPath);
  if (!fs.existsSync(resolvedVideoPath)) {
    console.error(`Error: Video file not found: ${resolvedVideoPath}`);
    process.exit(1);
  }

  // Validate metadata file
  const resolvedMetadataPath = path.resolve(metadataPath);
  if (!fs.existsSync(resolvedMetadataPath)) {
    console.error(`Error: Metadata file not found: ${resolvedMetadataPath}`);
    process.exit(1);
  }

  // Parse metadata
  let metadata: MetadataFile;
  try {
    const raw = fs.readFileSync(resolvedMetadataPath, 'utf-8');
    metadata = JSON.parse(raw);
  } catch (err) {
    console.error(`Error: Failed to parse metadata JSON: ${(err as Error).message}`);
    process.exit(1);
  }

  if (!metadata.youtube) {
    console.error('Error: Metadata JSON missing "youtube" key. Expected output from metadata-generator.');
    process.exit(1);
  }

  const options = {
    shorts: flags.includes('--shorts'),
    private: flags.includes('--private'),
  };

  try {
    const result = await uploadVideo(resolvedVideoPath, metadata, options);

    // Write result to a sidecar file for pipeline integration
    const resultPath = resolvedVideoPath.replace(/\.[^.]+$/, '.upload-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`\nResult saved to: ${resultPath}`);
  } catch (err: unknown) {
    const error = err as Error & { code?: number; errors?: Array<{ message: string }> };
    console.error('');
    console.error('Upload failed!');

    if (error.code === 403) {
      console.error('Access denied. Check that:');
      console.error('  1. YouTube Data API v3 is enabled in Google Cloud Console');
      console.error('  2. Your OAuth credentials have youtube.upload scope');
      console.error('  3. Your YouTube channel is in good standing');
    } else if (error.code === 401) {
      console.error('Authentication expired. Re-run: npx tsx scripts/auth-youtube.ts');
    } else {
      console.error(`Error: ${error.message}`);
      if (error.errors) {
        for (const e of error.errors) {
          console.error(`  - ${e.message}`);
        }
      }
    }

    process.exit(1);
  }
}

main();
