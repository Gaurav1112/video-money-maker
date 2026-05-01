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
    /** Playlist name — auto-created if doesn't exist, video added to it */
    playlistTitle?: string;
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
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    console.error('Error: YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars required.');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

  // Priority 1: YOUTUBE_REFRESH_TOKEN env var (for GitHub Actions / cloud runners)
  if (refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  // Priority 2: .youtube-token.json file (for local development)
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('Error: YOUTUBE_REFRESH_TOKEN env var or .youtube-token.json required.');
    console.error('For cloud: set YOUTUBE_REFRESH_TOKEN secret');
    console.error('For local: run npx tsx scripts/auth-youtube.ts');
    process.exit(1);
  }

  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
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

  // ─── Expert 1 (Dr. Padma Lakshmi): Hidden YouTube API Parameters ───────
  // These parameters are rarely used by creators but significantly impact
  // discovery, algorithm treatment, and international reach.

  const requestBody: youtube_v3.Schema$Video = {
    snippet: {
      title,
      description,
      tags,
      categoryId: metadata.youtube.categoryId || '27',
      // (1) defaultLanguage — tells YouTube the metadata language for search indexing.
      // Without this, YouTube guesses and may mis-index for non-English audiences.
      defaultLanguage: 'en',
      // (2) defaultAudioLanguage — critical for Discover feed and international
      // recommendations. YouTube uses this to decide which language cohort sees
      // your video. "en" ensures it enters the global English pool (larger than
      // "hi" for tech content, even for Indian creators).
      defaultAudioLanguage: 'en',
    },
    status: {
      privacyStatus,
      // (3) selfDeclaredMadeForKids — MUST be false for educational content.
      // If true, YouTube disables personalized ads, comments, notifications,
      // and end screens — destroying engagement and revenue.
      selfDeclaredMadeForKids: false,
      // (4) license — "youtube" (standard) vs "creativeCommon". Standard is
      // correct for original educational content. Creative Commons allows
      // re-use which dilutes your SEO authority.
      license: 'youtube',
      // (5) embeddable — allows embedding on external sites. Embedded views
      // count toward watch time AND generate backlinks that help SEO.
      embeddable: true,
      // (6) publicStatsViewable — show view count publicly. Social proof
      // increases CTR from browse/suggested. Only hide if view count is
      // embarrassingly low in the first 48 hours.
      publicStatsViewable: true,
    },
    // (7) recordingDetails — setting recordingDate tells YouTube this is
    // "fresh" content. Videos with recent recordingDate get a small boost
    // in the "new videos" recommendation pipeline. Also enables location-
    // based discovery if you set locationDescription.
    recordingDetails: {
      recordingDate: new Date().toISOString().split('T')[0],
    },
    // (8) localizations — multi-language metadata for international reach.
    // YouTube shows localized title/description to users browsing in that
    // language. Hindi localizations capture the massive Indian tech audience
    // that browses in Hindi but searches for English tech terms.
    localizations: {
      hi: {
        title: `${title.replace(/—/g, '-').replace(/'/g, "'")}`,
        description: description.slice(0, 200) + '\n\n[Hindi localization — same content, better discovery for Hindi-browsing users]',
      },
    },
  };

  const media = {
    body: fs.createReadStream(videoPath),
  };

  // (9) Include 'recordingDetails' and 'localizations' in the part parameter
  // so YouTube actually processes those fields. Most creators only send
  // 'snippet,status' and wonder why their localizations don't appear.
  const response = await youtube.videos.insert({
    part: ['snippet', 'status', 'recordingDetails', 'localizations'],
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

  // ── Auto-Playlist: find or create playlist, add video ──────────────────
  const playlistTitle = metadata.youtube.playlistTitle;
  if (playlistTitle) {
    try {
      const playlistId = await findOrCreatePlaylist(youtube, playlistTitle, tags);
      await addVideoToPlaylist(youtube, playlistId, videoId);
      console.log(`Playlist:    "${playlistTitle}" (${playlistId})`);
    } catch (e) {
      console.log(`Playlist:    Failed — ${(e as Error).message} (video still uploaded)`);
    }
  }

  return result;
}

// ── Playlist Management (deterministic: same topic = same playlist) ──────────

/** Cache of playlist title → ID to avoid repeated API calls within a session */
const _playlistCache: Record<string, string> = {};

async function findOrCreatePlaylist(
  youtube: youtube_v3.Youtube,
  title: string,
  tags: string[],
): Promise<string> {
  // Check cache first
  if (_playlistCache[title]) return _playlistCache[title];

  // Search existing playlists
  const existing = await youtube.playlists.list({
    part: ['snippet'],
    mine: true,
    maxResults: 50,
  });

  const found = existing.data.items?.find(
    (p) => p.snippet?.title === title,
  );

  if (found?.id) {
    _playlistCache[title] = found.id;
    return found.id;
  }

  // Create new playlist
  const created = await youtube.playlists.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description: `Complete ${title} tutorial series for interview preparation. All sessions from basics to advanced.\n\nPractice at guru-sishya.in\n\n#SystemDesign #InterviewPrep #FAANG`,
        tags: tags.slice(0, 10),
      },
      status: {
        privacyStatus: 'public',
      },
    },
  });

  const newId = created.data.id!;
  _playlistCache[title] = newId;
  console.log(`Playlist:    Created "${title}" (${newId})`);
  return newId;
}

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
