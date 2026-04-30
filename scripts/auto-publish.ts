#!/usr/bin/env npx tsx
/**
 * auto-publish.ts — Fully Automated Video Publishing Orchestrator
 *
 * Handles end-to-end publishing to YouTube + Instagram on a schedule:
 *   1. Picks the next video from the queue (round-robin across categories)
 *   2. Uploads long-form video to YouTube (with metadata, tags, thumbnail)
 *   3. Uploads vertical parts as YouTube Shorts
 *   4. Uploads vertical parts as Instagram Reels
 *   5. Updates the queue, logs results, sends notifications
 *
 * Designed to run via cron every Tuesday, Thursday, Saturday at 7:15 PM IST.
 *
 * Usage:
 *   npx tsx scripts/auto-publish.ts                    # Normal run (picks next, publishes)
 *   npx tsx scripts/auto-publish.ts --dry-run           # Preview what would be published
 *   npx tsx scripts/auto-publish.ts --topic caching --session 3  # Force specific video
 *   npx tsx scripts/auto-publish.ts --retry             # Retry last failed publish
 *   npx tsx scripts/auto-publish.ts --status            # Show publish history & stats
 *   npx tsx scripts/auto-publish.ts --health            # Health check (verify tokens, files)
 *
 * Environment variables:
 *   YOUTUBE_CLIENT_ID        Google OAuth2 client ID
 *   YOUTUBE_CLIENT_SECRET    Google OAuth2 client secret
 *   INSTAGRAM_ACCESS_TOKEN   Instagram Graph API long-lived token
 *   INSTAGRAM_BUSINESS_ID   Instagram Business account ID
 *   UPLOAD_HOST_URL          Public tunnel URL for Instagram (e.g., ngrok)
 *   SLACK_WEBHOOK_URL        (optional) Slack webhook for notifications
 *   SKIP_YOUTUBE             Set to "1" to skip YouTube upload
 *   SKIP_INSTAGRAM           Set to "1" to skip Instagram upload
 */

import { google, youtube_v3 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { execSync } from 'child_process';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(PROJECT_ROOT, 'config');
const PUBLISH_CONFIG_PATH = path.join(CONFIG_DIR, 'publish-config.json');
const PUBLISH_HISTORY_PATH = path.join(CONFIG_DIR, 'publish-history.json');
const TOPIC_QUEUE_PATH = path.join(CONFIG_DIR, 'topic-queue.json');
const YOUTUBE_TOKEN_PATH = path.join(PROJECT_ROOT, '.youtube-token.json');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'auto-publish.log');
const HOME = process.env.HOME || '~';
const GURU_SISHYA_BASE = path.join(HOME, 'Documents', 'guru-sishya');

// ─── Types ──────────────────────────────────────────────────────────────────

interface TopicEntry {
  slug: string;
  name: string;
  sessions: number;
  category: string;
  priority: 'high' | 'medium' | 'low';
  rendered: number[];
  published: number[];
}

interface TopicQueue {
  version: number;
  lastUpdated: string;
  topics: TopicEntry[];
}

interface PublishHistoryEntry {
  timestamp: string;
  topic: string;
  topicName: string;
  session: number;
  category: string;
  youtube?: {
    longFormId?: string;
    longFormUrl?: string;
    shortIds?: string[];
    playlistId?: string;
  };
  instagram?: {
    reelIds?: string[];
  };
  status: 'success' | 'partial' | 'failed';
  errors?: string[];
  durationMs: number;
}

interface PublishHistory {
  version: number;
  lastPublished: string | null;
  lastCategoryIndex: number;
  totalPublished: number;
  entries: PublishHistoryEntry[];
}

interface PublishConfig {
  schedule: {
    days: string[];
    timeIST: string;
    timezone: string;
  };
  youtube: {
    enabled: boolean;
    longForm: boolean;
    shorts: boolean;
    scheduledPublish: boolean;
    defaultPrivacy: string;
    playlistPrefix: string;
    categoryId: string;
  };
  instagram: {
    enabled: boolean;
    reels: boolean;
    maxReelsPerSession: number;
    tunnelPort: number;
  };
  rotation: {
    strategy: string;
    categoryOrder: string[];
    maxConsecutiveSameTopic: number;
    priorityWeight: Record<string, number>;
  };
  retry: {
    maxAttempts: number;
    backoffMinutes: number[];
    retryOnCodes: number[];
  };
  notifications: {
    slackWebhookUrl: string;
    emailOnFailure: boolean;
    logFile: string;
  };
  paths: {
    guruSishyaBase: string;
    publishHistory: string;
    topicQueue: string;
  };
}

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

// ─── Logging ────────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function log(level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}`;
  console.log(line);

  ensureDir(LOG_DIR);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// ─── Config & History Loading ───────────────────────────────────────────────

function loadConfig(): PublishConfig {
  if (!fs.existsSync(PUBLISH_CONFIG_PATH)) {
    log('ERROR', `Config not found: ${PUBLISH_CONFIG_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(PUBLISH_CONFIG_PATH, 'utf-8'));
}

function loadHistory(): PublishHistory {
  if (!fs.existsSync(PUBLISH_HISTORY_PATH)) {
    return {
      version: 1,
      lastPublished: null,
      lastCategoryIndex: -1,
      totalPublished: 0,
      entries: [],
    };
  }
  return JSON.parse(fs.readFileSync(PUBLISH_HISTORY_PATH, 'utf-8'));
}

function saveHistory(history: PublishHistory): void {
  fs.writeFileSync(PUBLISH_HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
}

function loadQueue(): TopicQueue {
  if (!fs.existsSync(TOPIC_QUEUE_PATH)) {
    log('ERROR', `Topic queue not found: ${TOPIC_QUEUE_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(TOPIC_QUEUE_PATH, 'utf-8'));
}

function saveQueue(queue: TopicQueue): void {
  queue.lastUpdated = new Date().toISOString().split('T')[0];
  fs.writeFileSync(TOPIC_QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
}

// ─── Expert 4: Content Queue Management (Mike Chen) ─────────────────────────
// Round-robin across categories so viewers get variety.
// Within each category, pick the highest-priority topic with the most
// unpublished rendered sessions. Never repeat the same topic twice in a row.

function pickNextVideo(
  queue: TopicQueue,
  history: PublishHistory,
  config: PublishConfig,
): { topic: TopicEntry; session: number } | null {
  const { categoryOrder, maxConsecutiveSameTopic, priorityWeight } = config.rotation;

  // Find last published topic slug to avoid repeating
  const recentSlugs = history.entries
    .slice(-maxConsecutiveSameTopic)
    .map((e) => e.topic);

  // Start from the next category after the last one we published from
  const startIdx = (history.lastCategoryIndex + 1) % categoryOrder.length;

  // Try each category in order, wrapping around
  for (let offset = 0; offset < categoryOrder.length; offset++) {
    const catIdx = (startIdx + offset) % categoryOrder.length;
    const category = categoryOrder[catIdx];

    // Get topics in this category that have rendered but unpublished sessions
    const candidates = queue.topics
      .filter((t) => {
        if (t.category !== category) return false;
        // Must have at least one rendered session that hasn't been published
        const unpublished = t.rendered.filter((s) => !t.published.includes(s));
        return unpublished.length > 0;
      })
      .filter((t) => {
        // Avoid repeating the same topic consecutively
        if (maxConsecutiveSameTopic > 0) {
          const consecutiveCount = recentSlugs.filter((s) => s === t.slug).length;
          return consecutiveCount < maxConsecutiveSameTopic;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by priority weight (high first), then by fewer published (less saturated first)
        const wa = priorityWeight[a.priority] || 1;
        const wb = priorityWeight[b.priority] || 1;
        if (wb !== wa) return wb - wa;

        // Prefer topics with more remaining sessions (bigger backlog)
        const remainA = a.rendered.filter((s) => !a.published.includes(s)).length;
        const remainB = b.rendered.filter((s) => !b.published.includes(s)).length;
        return remainB - remainA;
      });

    if (candidates.length > 0) {
      const topic = candidates[0];
      // Pick the lowest unpublished rendered session
      const unpublished = topic.rendered
        .filter((s) => !topic.published.includes(s))
        .sort((a, b) => a - b);
      const session = unpublished[0];

      // Update category index so next run picks from the next category
      history.lastCategoryIndex = catIdx;

      return { topic, session };
    }
  }

  // Fallback: any topic with rendered but unpublished sessions
  for (const topic of queue.topics) {
    const unpublished = topic.rendered
      .filter((s) => !topic.published.includes(s))
      .sort((a, b) => a - b);
    if (unpublished.length > 0) {
      return { topic, session: unpublished[0] };
    }
  }

  return null;
}

// ─── File Discovery ─────────────────────────────────────────────────────────

interface SessionFiles {
  longFormVideo: string | null;
  verticalParts: string[];
  metadataJson: string | null;
  metadataMd: string | null;
  thumbnail: string | null;
  /** Per-part metadata JSON files (from generate-upload-metadata.ts) */
  partMetadataJsons: (string | null)[];
}

function discoverSessionFiles(topicSlug: string, sessionNum: number): SessionFiles {
  const sessionDir = path.join(GURU_SISHYA_BASE, topicSlug, `session-${sessionNum}`);
  const result: SessionFiles = {
    longFormVideo: null,
    verticalParts: [],
    metadataJson: null,
    metadataMd: null,
    thumbnail: null,
    partMetadataJsons: [],
  };

  if (!fs.existsSync(sessionDir)) {
    log('WARN', `Session directory not found: ${sessionDir}`);
    return result;
  }

  // Long-form video
  const longDir = path.join(sessionDir, 'long');
  if (fs.existsSync(longDir)) {
    const mp4s = fs.readdirSync(longDir).filter((f) => f.endsWith('.mp4'));
    if (mp4s.length > 0) {
      // Pick the largest (most recent full render)
      result.longFormVideo = mp4s
        .map((f) => path.join(longDir, f))
        .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
    }
  }

  // Vertical parts
  const verticalDir = path.join(sessionDir, 'vertical-parts');
  if (fs.existsSync(verticalDir)) {
    result.verticalParts = fs
      .readdirSync(verticalDir)
      .filter((f) => f.endsWith('.mp4'))
      .sort()
      .map((f) => path.join(verticalDir, f));
  }

  // Per-part metadata (generated by generate-upload-metadata.ts)
  if (result.verticalParts.length > 0) {
    const verticalMetaDir = path.join(sessionDir, 'vertical-parts');
    for (let i = 1; i <= result.verticalParts.length; i++) {
      const partMeta = path.join(verticalMetaDir, `part${i}-metadata.json`);
      result.partMetadataJsons.push(fs.existsSync(partMeta) ? partMeta : null);
    }
  }

  // Metadata JSON (generated by pipeline / generate-upload-metadata.ts)
  const metaJsonCandidates = [
    path.join(sessionDir, 'metadata.json'),
    path.join(sessionDir, 'long', 'metadata.json'),
  ];
  for (const candidate of metaJsonCandidates) {
    if (fs.existsSync(candidate)) {
      result.metadataJson = candidate;
      break;
    }
  }

  // Metadata markdown
  const metaMd = path.join(sessionDir, 'metadata.md');
  if (fs.existsSync(metaMd)) {
    result.metadataMd = metaMd;
  }

  // Thumbnail
  const thumbCandidates = [
    path.join(sessionDir, 'thumbnail.png'),
    path.join(sessionDir, 'thumbnail.jpg'),
    path.join(sessionDir, 'long', 'thumbnail.png'),
    path.join(sessionDir, 'long', 'thumbnail.jpg'),
  ];
  for (const candidate of thumbCandidates) {
    if (fs.existsSync(candidate)) {
      result.thumbnail = candidate;
      break;
    }
  }

  return result;
}

// ─── Expert 1: YouTube Upload (Sarah Lin) ───────────────────────────────────

function getYouTubeAuth(): InstanceType<typeof google.auth.OAuth2> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars required. ' +
        'Get them from https://console.cloud.google.com/apis/credentials',
    );
  }

  if (!fs.existsSync(YOUTUBE_TOKEN_PATH)) {
    throw new Error(
      '.youtube-token.json not found. Run: npx tsx scripts/auth-youtube.ts',
    );
  }

  const tokens = JSON.parse(fs.readFileSync(YOUTUBE_TOKEN_PATH, 'utf-8'));
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials(tokens);

  // Auto-save refreshed tokens
  oauth2Client.on('tokens', (newTokens) => {
    const existing = JSON.parse(fs.readFileSync(YOUTUBE_TOKEN_PATH, 'utf-8'));
    const merged = { ...existing, ...newTokens };
    fs.writeFileSync(YOUTUBE_TOKEN_PATH, JSON.stringify(merged, null, 2));
    log('INFO', 'YouTube access token refreshed and saved');
  });

  return oauth2Client;
}

async function uploadToYouTube(
  videoPath: string,
  metadata: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    isShort: boolean;
    privacy: string;
    scheduledAt?: string; // ISO 8601 for scheduled publishing
    thumbnailPath?: string;
    playlistId?: string;
  },
): Promise<{ videoId: string; url: string }> {
  const auth = getYouTubeAuth();
  const youtube = google.youtube({ version: 'v3', auth });

  let title = metadata.title;
  if (metadata.isShort && !title.includes('#Shorts')) {
    title = `${title} #Shorts`;
  }
  if (title.length > 100) {
    if (metadata.isShort) {
      title = title.slice(0, 92).trimEnd() + ' #Shorts';
    } else {
      title = title.slice(0, 99).trimEnd() + '\u2026';
    }
  }

  // Truncate description
  const description =
    metadata.description.length > 5000
      ? metadata.description.slice(0, 4997) + '...'
      : metadata.description;

  // Truncate tags to 500 chars total
  const tags: string[] = [];
  let tagChars = 0;
  for (const tag of metadata.tags) {
    const t = tag.trim();
    if (!t) continue;
    if (tagChars + t.length + (tags.length > 0 ? 1 : 0) > 500) break;
    tags.push(t);
    tagChars += t.length + (tags.length > 1 ? 1 : 0);
  }

  // ─── Hidden YouTube API Parameters (Expert 1: Dr. Padma Lakshmi) ─────
  const requestBody: youtube_v3.Schema$Video = {
    snippet: {
      title,
      description,
      tags,
      categoryId: metadata.categoryId || '27',
      defaultLanguage: 'en',
      defaultAudioLanguage: 'en',
    },
    status: {
      privacyStatus: metadata.scheduledAt ? 'private' : metadata.privacy,
      selfDeclaredMadeForKids: false,
      license: 'youtube',
      embeddable: true,
      publicStatsViewable: true,
      ...(metadata.scheduledAt
        ? {
            privacyStatus: 'private',
            publishAt: metadata.scheduledAt,
          }
        : {}),
    },
    recordingDetails: {
      recordingDate: new Date().toISOString().split('T')[0],
    },
    localizations: {
      hi: {
        title: title.replace(/—/g, '-'),
        description: description.slice(0, 300),
      },
    },
  };

  const fileSize = fs.statSync(videoPath).size;
  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
  log('INFO', `YouTube upload: ${path.basename(videoPath)} (${fileSizeMB} MB) — "${title}"`);

  const response = await youtube.videos.insert({
    part: ['snippet', 'status', 'recordingDetails', 'localizations'],
    requestBody,
    media: { body: fs.createReadStream(videoPath) },
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error('Upload completed but no video ID returned');
  }

  // Upload thumbnail if available
  if (metadata.thumbnailPath && fs.existsSync(metadata.thumbnailPath)) {
    try {
      await youtube.thumbnails.set({
        videoId,
        media: {
          mimeType: metadata.thumbnailPath.endsWith('.png') ? 'image/png' : 'image/jpeg',
          body: fs.createReadStream(metadata.thumbnailPath),
        },
      });
      log('SUCCESS', `Thumbnail uploaded for ${videoId}`);
    } catch (err) {
      log('WARN', `Thumbnail upload failed (video still uploaded): ${(err as Error).message}`);
    }
  }

  // Add to playlist if specified
  if (metadata.playlistId) {
    try {
      await youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId: metadata.playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId,
            },
          },
        },
      });
      log('SUCCESS', `Added to playlist ${metadata.playlistId}`);
    } catch (err) {
      log('WARN', `Playlist add failed: ${(err as Error).message}`);
    }
  }

  const url = `https://youtu.be/${videoId}`;
  log('SUCCESS', `YouTube upload complete: ${url}`);

  return { videoId, url };
}

async function findOrCreatePlaylist(
  topicName: string,
  config: PublishConfig,
): Promise<string | undefined> {
  try {
    const auth = getYouTubeAuth();
    const youtube = google.youtube({ version: 'v3', auth });
    const playlistTitle = `${config.youtube.playlistPrefix}${topicName}`;

    // Search existing playlists
    const existing = await youtube.playlists.list({
      part: ['snippet'],
      mine: true,
      maxResults: 50,
    });

    const found = existing.data.items?.find(
      (p) => p.snippet?.title === playlistTitle,
    );

    if (found?.id) {
      return found.id;
    }

    // Create new playlist
    const created = await youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: playlistTitle,
          description: `Complete ${topicName} series — ${topicName} explained with code, interviews, and real-world architecture. FREE practice at www.guru-sishya.in`,
        },
        status: {
          privacyStatus: 'public',
        },
      },
    });

    log('SUCCESS', `Created playlist: ${playlistTitle} (${created.data.id})`);
    return created.data.id || undefined;
  } catch (err) {
    log('WARN', `Playlist management failed: ${(err as Error).message}`);
    return undefined;
  }
}

// ─── Expert 2: Instagram Upload (Raj Mehta) ─────────────────────────────────

function graphApiRequest<T>(
  urlPath: string,
  method: 'GET' | 'POST',
  params?: Record<string, string>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(`https://graph.facebook.com/v21.0${urlPath}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        fullUrl.searchParams.set(key, value);
      }
    }

    const req = https.request(
      {
        method,
        hostname: fullUrl.hostname,
        path: `${fullUrl.pathname}${fullUrl.search}`,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              reject(new Error(`Instagram API: ${parsed.error.message || JSON.stringify(parsed.error)}`));
            } else {
              resolve(parsed as T);
            }
          } catch {
            reject(new Error(`Failed to parse Instagram response: ${data.slice(0, 200)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

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
    log('INFO', `Local file server on port ${port} for Instagram upload`);
  });

  return server;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadToInstagram(
  videoPath: string,
  caption: string,
  config: PublishConfig,
): Promise<string> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const businessId = process.env.INSTAGRAM_BUSINESS_ID;

  if (!accessToken || !businessId) {
    throw new Error(
      'INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ID env vars required. ' +
        'See: https://developers.facebook.com/tools/explorer/',
    );
  }

  // Truncate caption to 2200 chars
  const trimmedCaption =
    caption.length > 2200 ? caption.slice(0, 2197) + '...' : caption;

  // Determine video URL
  let videoUrl: string;
  let localServer: http.Server | undefined;

  if (process.env.UPLOAD_HOST_URL) {
    const port = config.instagram.tunnelPort || 9876;
    localServer = startLocalFileServer(videoPath, port);
    videoUrl = `${process.env.UPLOAD_HOST_URL}/video`;
    // Wait for server to start
    await sleep(1000);
  } else {
    throw new Error(
      'UPLOAD_HOST_URL env var required for Instagram. ' +
        'Start a tunnel: ngrok http 9876, then set UPLOAD_HOST_URL=https://xxxx.ngrok.io',
    );
  }

  try {
    log('INFO', `Instagram Reel upload: ${path.basename(videoPath)}`);

    // Step 1: Create container
    const container = await graphApiRequest<{ id: string }>(
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
    log('INFO', `Instagram container created: ${container.id}`);

    // Step 2: Poll for processing
    const maxPollAttempts = 60;
    let attempts = 0;
    while (attempts < maxPollAttempts) {
      const status = await graphApiRequest<{ status_code: string }>(
        `/${container.id}`,
        'GET',
        { fields: 'status_code', access_token: accessToken },
      );

      if (status.status_code === 'FINISHED') break;
      if (status.status_code === 'ERROR') {
        throw new Error('Video processing failed. Check format (9:16, MP4, 3-90s).');
      }

      attempts++;
      if (attempts % 10 === 0) {
        log('INFO', `Instagram processing: attempt ${attempts}/${maxPollAttempts}`);
      }
      await sleep(5000);
    }

    if (attempts >= maxPollAttempts) {
      throw new Error('Instagram processing timed out after 5 minutes');
    }

    // Step 3: Publish
    const published = await graphApiRequest<{ id: string }>(
      `/${businessId}/media_publish`,
      'POST',
      { creation_id: container.id, access_token: accessToken },
    );

    log('SUCCESS', `Instagram Reel published: ${published.id}`);
    return published.id;
  } finally {
    if (localServer) {
      localServer.close();
    }
  }
}

// ─── Expert 5: Monitoring & Notifications (Priya Sharma) ────────────────────

async function sendSlackNotification(
  webhookUrl: string,
  message: {
    title: string;
    status: 'success' | 'failure' | 'warning';
    details: string;
    links?: { label: string; url: string }[];
  },
): Promise<void> {
  if (!webhookUrl) return;

  const emoji =
    message.status === 'success'
      ? ':white_check_mark:'
      : message.status === 'failure'
        ? ':x:'
        : ':warning:';

  const linkText =
    message.links?.map((l) => `<${l.url}|${l.label}>`).join(' | ') || '';

  const payload = {
    text: `${emoji} *${message.title}*\n${message.details}${linkText ? '\n' + linkText : ''}`,
  };

  return new Promise((resolve, reject) => {
    const url = new URL(webhookUrl);
    const data = JSON.stringify(payload);

    const req = https.request(
      {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve());
      },
    );
    req.on('error', (err) => {
      log('WARN', `Slack notification failed: ${err.message}`);
      resolve(); // Don't fail the publish because of Slack
    });
    req.write(data);
    req.end();
  });
}

async function verifyYouTubeVideoLive(videoId: string): Promise<boolean> {
  try {
    const auth = getYouTubeAuth();
    const youtube = google.youtube({ version: 'v3', auth });

    const response = await youtube.videos.list({
      part: ['status'],
      id: [videoId],
    });

    const video = response.data.items?.[0];
    if (!video) return false;

    const status = video.status?.uploadStatus;
    return status === 'processed' || status === 'uploaded';
  } catch {
    return false;
  }
}

async function refreshInstagramToken(): Promise<boolean> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) return false;

  try {
    const response = await graphApiRequest<{
      access_token: string;
      token_type: string;
      expires_in: number;
    }>('/oauth/access_token', 'GET', {
      grant_type: 'fb_exchange_token',
      client_id: process.env.FB_APP_ID || '',
      client_secret: process.env.FB_APP_SECRET || '',
      fb_exchange_token: accessToken,
    });

    log('SUCCESS', `Instagram token refreshed, expires in ${response.expires_in}s`);
    // User should update their env var with the new token
    log('INFO', `New token: ${response.access_token.slice(0, 20)}...`);
    return true;
  } catch (err) {
    log('WARN', `Instagram token refresh failed: ${(err as Error).message}`);
    return false;
  }
}

// ─── Expert 3: Retry Logic (Elena Torres) ───────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  config: PublishConfig,
): Promise<T> {
  const { maxAttempts, backoffMinutes } = config.retry;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err as Error & { code?: number };
      const isRetryable =
        config.retry.retryOnCodes.includes(error.code || 0) ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('socket hang up');

      if (attempt < maxAttempts && isRetryable) {
        const waitMinutes = backoffMinutes[attempt - 1] || backoffMinutes[backoffMinutes.length - 1];
        log('WARN', `${label} failed (attempt ${attempt}/${maxAttempts}): ${error.message}`);
        log('INFO', `Retrying in ${waitMinutes} minutes...`);
        await sleep(waitMinutes * 60 * 1000);
      } else {
        log('ERROR', `${label} failed permanently after ${attempt} attempts: ${error.message}`);
        throw err;
      }
    }
  }

  throw new Error(`${label}: should not reach here`);
}

// ─── Build Metadata from .md if .json is Missing ────────────────────────────

function buildMetadataFromMd(
  mdPath: string,
  topicName: string,
  sessionNum: number,
): MetadataFile {
  const content = fs.readFileSync(mdPath, 'utf-8');

  // Extract title from the first "### Title" section under YOUTUBE LONG VIDEO
  const titleMatch = content.match(/## .*YOUTUBE LONG VIDEO[\s\S]*?### Title[^\n]*\n([^\n]+)/);
  const title = titleMatch?.[1]?.trim() || `${topicName} — Session ${sessionNum}`;

  // Extract description
  const descMatch = content.match(
    /### Description[^\n]*\n([\s\S]*?)(?=\n###|\n---)/,
  );
  const description = descMatch?.[1]?.trim() || '';

  // Extract tags
  const tagsMatch = content.match(/### Tags[^\n]*\n([^\n]+)/);
  const tags = tagsMatch?.[1]?.split(',').map((t) => t.trim()) || [];

  // Extract Instagram caption
  const instaMatch = content.match(
    /### Caption\n([\s\S]*?)(?=\n###|\n---)/,
  );
  const instagramCaption = instaMatch?.[1]?.trim() || '';

  return {
    youtube: {
      title,
      description,
      tags,
      categoryId: '27',
      chapters: '',
    },
    instagramCaption,
  };
}

// ─── Health Check ───────────────────────────────────────────────────────────

async function healthCheck(): Promise<void> {
  log('INFO', '=== Health Check ===');
  const issues: string[] = [];

  // YouTube credentials
  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET) {
    issues.push('Missing YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET env vars');
  }
  if (!fs.existsSync(YOUTUBE_TOKEN_PATH)) {
    issues.push('Missing .youtube-token.json — run: npx tsx scripts/auth-youtube.ts');
  } else {
    try {
      const tokens = JSON.parse(fs.readFileSync(YOUTUBE_TOKEN_PATH, 'utf-8'));
      if (!tokens.refresh_token) {
        issues.push('YouTube token missing refresh_token — re-run auth');
      }
      if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
        log('WARN', 'YouTube access token expired (will auto-refresh on next use)');
      } else {
        log('SUCCESS', 'YouTube token OK');
      }
    } catch {
      issues.push('YouTube token file is corrupted');
    }
  }

  // Instagram credentials
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) {
    issues.push('Missing INSTAGRAM_ACCESS_TOKEN env var');
  } else {
    log('SUCCESS', 'Instagram token present');
  }
  if (!process.env.INSTAGRAM_BUSINESS_ID) {
    issues.push('Missing INSTAGRAM_BUSINESS_ID env var');
  }
  if (!process.env.UPLOAD_HOST_URL) {
    issues.push('Missing UPLOAD_HOST_URL for Instagram (need ngrok or similar tunnel)');
  }

  // Config files
  if (fs.existsSync(PUBLISH_CONFIG_PATH)) {
    log('SUCCESS', 'Publish config OK');
  } else {
    issues.push('Missing config/publish-config.json');
  }

  if (fs.existsSync(TOPIC_QUEUE_PATH)) {
    const queue = loadQueue();
    const totalSessions = queue.topics.reduce((s, t) => s + t.sessions, 0);
    const totalRendered = queue.topics.reduce((s, t) => s + t.rendered.length, 0);
    const totalPublished = queue.topics.reduce((s, t) => s + t.published.length, 0);
    log('INFO', `Queue: ${totalRendered}/${totalSessions} rendered, ${totalPublished} published`);
  } else {
    issues.push('Missing config/topic-queue.json');
  }

  // Guru sishya output directory
  if (fs.existsSync(GURU_SISHYA_BASE)) {
    log('SUCCESS', `Output directory OK: ${GURU_SISHYA_BASE}`);
  } else {
    issues.push(`Output directory not found: ${GURU_SISHYA_BASE}`);
  }

  // Check cron
  try {
    const crontab = execSync('crontab -l 2>/dev/null || echo "no crontab"').toString();
    if (crontab.includes('auto-publish')) {
      log('SUCCESS', 'Cron job found');
    } else {
      log('WARN', 'No auto-publish cron job found. See --setup-cron');
    }
  } catch {
    log('WARN', 'Could not check crontab');
  }

  if (issues.length > 0) {
    log('ERROR', `${issues.length} issue(s) found:`);
    issues.forEach((issue) => log('ERROR', `  - ${issue}`));
  } else {
    log('SUCCESS', 'All checks passed');
  }
}

// ─── Status Report ──────────────────────────────────────────────────────────

function showStatus(): void {
  const history = loadHistory();
  const queue = loadQueue();

  console.log('\n=== Auto-Publish Status ===\n');

  // Queue stats
  const totalSessions = queue.topics.reduce((s, t) => s + t.sessions, 0);
  const totalRendered = queue.topics.reduce((s, t) => s + t.rendered.length, 0);
  const totalPublished = queue.topics.reduce((s, t) => s + t.published.length, 0);

  console.log(`Queue:     ${totalRendered}/${totalSessions} rendered, ${totalPublished} published`);
  console.log(`Remaining: ${totalRendered - totalPublished} ready to publish`);
  console.log(`History:   ${history.totalPublished} total publishes`);

  if (history.lastPublished) {
    console.log(`Last:      ${history.lastPublished}`);
  }

  // Recent entries
  const recent = history.entries.slice(-10);
  if (recent.length > 0) {
    console.log('\nRecent publishes:');
    for (const entry of recent) {
      const ytStatus = entry.youtube?.longFormUrl ? 'YT OK' : 'YT skip';
      const igStatus = entry.instagram?.reelIds?.length ? `IG x${entry.instagram.reelIds.length}` : 'IG skip';
      const dur = (entry.durationMs / 1000).toFixed(0);
      console.log(
        `  ${entry.timestamp.slice(0, 16)} | ${entry.status.padEnd(7)} | ${entry.topicName} S${entry.session} | ${ytStatus} | ${igStatus} | ${dur}s`,
      );
    }
  }

  // Next up
  const config = loadConfig();
  const next = pickNextVideo(queue, history, config);
  if (next) {
    console.log(`\nNext:      ${next.topic.name} session ${next.session} (${next.topic.category})`);
  } else {
    console.log('\nNext:      No videos ready (render more sessions first)');
  }

  // Schedule info
  console.log(`\nSchedule:  ${config.schedule.days.join(', ')} at ${config.schedule.timeIST} IST`);

  // Days at current pace
  const readyCount = totalRendered - totalPublished;
  const publishesPerWeek = config.schedule.days.length;
  if (readyCount > 0) {
    const weeks = Math.ceil(readyCount / publishesPerWeek);
    console.log(`Runway:    ~${weeks} weeks of content ready (${readyCount} videos)`);
  }

  console.log('');
}

// ─── Cron Setup Helper ──────────────────────────────────────────────────────

function showCronSetup(): void {
  // IST is UTC+5:30, so 19:15 IST = 13:45 UTC
  const cronLine =
    '45 13 * * 2,4,6 cd /Users/racit/PersonalProject/video-pipeline && /usr/local/bin/npx tsx scripts/auto-publish.ts >> logs/cron.log 2>&1';

  console.log('\n=== Cron Setup for macOS ===\n');
  console.log('IST 19:15 = UTC 13:45 (IST is UTC+5:30)\n');
  console.log('Option 1: crontab (simple)\n');
  console.log('  Run: crontab -e');
  console.log('  Add this line:\n');
  console.log(`  ${cronLine}\n`);
  console.log('  Day mapping: 2=Tue, 4=Thu, 6=Sat\n');

  console.log('Option 2: launchd (macOS-native, survives sleep/restart)\n');
  console.log('  Save the plist below to:');
  console.log('  ~/Library/LaunchAgents/com.gurusishya.autopublish.plist\n');

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gurusishya.autopublish</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/npx</string>
        <string>tsx</string>
        <string>/Users/racit/PersonalProject/video-pipeline/scripts/auto-publish.ts</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Users/racit/PersonalProject/video-pipeline</string>

    <key>StartCalendarInterval</key>
    <array>
        <!-- Tuesday 19:15 IST = 13:45 UTC -->
        <dict>
            <key>Weekday</key><integer>2</integer>
            <key>Hour</key><integer>13</integer>
            <key>Minute</key><integer>45</integer>
        </dict>
        <!-- Thursday -->
        <dict>
            <key>Weekday</key><integer>4</integer>
            <key>Hour</key><integer>13</integer>
            <key>Minute</key><integer>45</integer>
        </dict>
        <!-- Saturday -->
        <dict>
            <key>Weekday</key><integer>6</integer>
            <key>Hour</key><integer>13</integer>
            <key>Minute</key><integer>45</integer>
        </dict>
    </array>

    <key>StandardOutPath</key>
    <string>/Users/racit/PersonalProject/video-pipeline/logs/launchd-out.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/racit/PersonalProject/video-pipeline/logs/launchd-err.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
        <key>HOME</key>
        <string>/Users/racit</string>
    </dict>
</dict>
</plist>`;

  console.log(plist);
  console.log('\n  Then load it:');
  console.log('  launchctl load ~/Library/LaunchAgents/com.gurusishya.autopublish.plist\n');
  console.log('  To unload:');
  console.log('  launchctl unload ~/Library/LaunchAgents/com.gurusishya.autopublish.plist\n');

  console.log('IMPORTANT: The plist uses UTC times. macOS launchd interprets');
  console.log('StartCalendarInterval in the system timezone. If your Mac is set');
  console.log('to IST, change Hour to 19 and Minute to 15 instead.\n');

  console.log('If your Mac is set to IST timezone, use these values instead:');
  console.log('  Hour: 19, Minute: 15\n');

  console.log('To check your timezone: systemsetup -gettimezone\n');

  console.log('Environment variables needed in your shell profile (~/.zshrc):');
  console.log('  export YOUTUBE_CLIENT_ID="your-client-id"');
  console.log('  export YOUTUBE_CLIENT_SECRET="your-client-secret"');
  console.log('  export INSTAGRAM_ACCESS_TOKEN="your-token"');
  console.log('  export INSTAGRAM_BUSINESS_ID="your-business-id"');
  console.log('  export UPLOAD_HOST_URL="https://your-tunnel.ngrok.io"');
  console.log('  export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."  # optional\n');
}

// ─── Main Orchestrator ──────────────────────────────────────────────────────

async function publish(options: {
  dryRun: boolean;
  forceTopic?: string;
  forceSession?: number;
  retryLast: boolean;
}): Promise<void> {
  const startTime = Date.now();
  const config = loadConfig();
  const history = loadHistory();
  const queue = loadQueue();
  const errors: string[] = [];

  const slackUrl = process.env.SLACK_WEBHOOK_URL || config.notifications.slackWebhookUrl;
  const skipYouTube = process.env.SKIP_YOUTUBE === '1';
  const skipInstagram = process.env.SKIP_INSTAGRAM === '1';

  // ─── Determine what to publish ─────────────────────────────────────────

  let targetTopic: TopicEntry;
  let targetSession: number;

  if (options.retryLast) {
    // Retry the last failed entry
    const lastFailed = [...history.entries].reverse().find((e) => e.status === 'failed');
    if (!lastFailed) {
      log('INFO', 'No failed entries to retry');
      return;
    }
    const topicEntry = queue.topics.find((t) => t.slug === lastFailed.topic);
    if (!topicEntry) {
      log('ERROR', `Topic ${lastFailed.topic} not found in queue`);
      return;
    }
    targetTopic = topicEntry;
    targetSession = lastFailed.session;
    log('INFO', `Retrying: ${targetTopic.name} session ${targetSession}`);
  } else if (options.forceTopic && options.forceSession) {
    const topicEntry = queue.topics.find((t) => t.slug === options.forceTopic);
    if (!topicEntry) {
      log('ERROR', `Topic "${options.forceTopic}" not found in queue`);
      process.exit(1);
    }
    targetTopic = topicEntry;
    targetSession = options.forceSession;
    log('INFO', `Forced: ${targetTopic.name} session ${targetSession}`);
  } else {
    const next = pickNextVideo(queue, history, config);
    if (!next) {
      log('INFO', 'No videos ready to publish. Render more sessions first.');
      return;
    }
    targetTopic = next.topic;
    targetSession = next.session;
  }

  log('INFO', `Publishing: ${targetTopic.name} session ${targetSession} (${targetTopic.category})`);

  // ─── Discover files ───────────────────────────────────────────────────

  const files = discoverSessionFiles(targetTopic.slug, targetSession);
  log('INFO', `Long-form: ${files.longFormVideo ? 'found' : 'MISSING'}`);
  log('INFO', `Vertical parts: ${files.verticalParts.length} found`);
  log('INFO', `Metadata JSON: ${files.metadataJson ? 'found' : 'MISSING'}`);
  log('INFO', `Metadata MD: ${files.metadataMd ? 'found' : 'missing'}`);
  log('INFO', `Thumbnail: ${files.thumbnail ? 'found' : 'missing'}`);

  if (!files.longFormVideo && files.verticalParts.length === 0) {
    log('ERROR', 'No video files found. Nothing to publish.');
    return;
  }

  // ─── Load metadata ───────────────────────────────────────────────────

  let metadata: MetadataFile;
  if (files.metadataJson) {
    metadata = JSON.parse(fs.readFileSync(files.metadataJson, 'utf-8'));
  } else if (files.metadataMd) {
    metadata = buildMetadataFromMd(files.metadataMd, targetTopic.name, targetSession);
  } else {
    // Auto-generate metadata using generate-upload-metadata.ts
    log('INFO', 'No metadata file found — auto-generating via generate-upload-metadata.ts');
    const propsPath = path.join(PROJECT_ROOT, 'output', `test-props-s${targetSession}.json`);
    if (fs.existsSync(propsPath)) {
      try {
        execSync(
          `npx tsx scripts/generate-upload-metadata.ts ${targetTopic.slug} ${targetSession} --props ${propsPath}`,
          { cwd: PROJECT_ROOT, stdio: 'inherit' },
        );
        // Re-discover files after generation
        const sessionDir = path.join(GURU_SISHYA_BASE, targetTopic.slug, `session-${targetSession}`);
        const generatedMeta = path.join(sessionDir, 'metadata.json');
        if (fs.existsSync(generatedMeta)) {
          files.metadataJson = generatedMeta;
          // Also reload part metadata
          const verticalMetaDir = path.join(sessionDir, 'vertical-parts');
          files.partMetadataJsons = [];
          for (let i = 1; i <= files.verticalParts.length; i++) {
            const partMeta = path.join(verticalMetaDir, `part${i}-metadata.json`);
            files.partMetadataJsons.push(fs.existsSync(partMeta) ? partMeta : null);
          }
          log('SUCCESS', 'Metadata auto-generated successfully');
        }
      } catch (err) {
        log('WARN', `Auto-generation failed: ${(err as Error).message}`);
      }
    } else {
      log('WARN', `Props file not found: ${propsPath}`);
    }

    // Load the generated metadata, or fall back to minimal
    if (files.metadataJson && fs.existsSync(files.metadataJson)) {
      metadata = JSON.parse(fs.readFileSync(files.metadataJson, 'utf-8'));
    } else {
      metadata = {
        youtube: {
          title: `${targetTopic.name} \u2014 Session ${targetSession}`,
          description: `${targetTopic.name} explained with code and real-world examples. FREE practice at www.guru-sishya.in/${targetTopic.slug}`,
          tags: [targetTopic.name.toLowerCase(), 'system design', 'interview prep', 'guru sishya'],
          categoryId: '27',
          chapters: '',
        },
        instagramCaption: `${targetTopic.name} \u2014 Session ${targetSession}/10. Save this for your interview prep! FREE practice at guru-sishya.in`,
      };
      log('WARN', 'Using fallback metadata (auto-generation failed)');
    }
  }

  if (options.dryRun) {
    console.log('\n=== DRY RUN ===\n');
    console.log(`Topic:       ${targetTopic.name} (${targetTopic.slug})`);
    console.log(`Session:     ${targetSession}`);
    console.log(`Category:    ${targetTopic.category}`);
    console.log(`Long-form:   ${files.longFormVideo || 'N/A'}`);
    console.log(`Verticals:   ${files.verticalParts.length} parts`);
    files.verticalParts.forEach((v, i) => console.log(`  Part ${i + 1}: ${v}`));
    console.log(`Thumbnail:   ${files.thumbnail || 'N/A'}`);
    console.log(`\nYT Title:    ${metadata.youtube.title}`);
    console.log(`YT Tags:     ${metadata.youtube.tags.slice(0, 5).join(', ')}...`);
    console.log(`IG Caption:  ${(metadata.instagramCaption || '').slice(0, 80)}...`);
    console.log(`\nWould upload to:`);
    if (!skipYouTube) {
      if (files.longFormVideo) console.log(`  YouTube: long-form video`);
      files.verticalParts.forEach((_, i) => console.log(`  YouTube: Short #${i + 1}`));
    }
    if (!skipInstagram) {
      const maxReels = config.instagram.maxReelsPerSession;
      files.verticalParts.slice(0, maxReels).forEach((_, i) => console.log(`  Instagram: Reel #${i + 1}`));
    }
    console.log('\nNo uploads performed (dry run).\n');
    return;
  }

  // ─── Execute uploads ──────────────────────────────────────────────────

  const entry: PublishHistoryEntry = {
    timestamp: new Date().toISOString(),
    topic: targetTopic.slug,
    topicName: targetTopic.name,
    session: targetSession,
    category: targetTopic.category,
    status: 'success',
    durationMs: 0,
  };

  // YouTube uploads
  if (config.youtube.enabled && !skipYouTube) {
    // Find or create playlist for this topic
    let playlistId: string | undefined;
    try {
      playlistId = await findOrCreatePlaylist(targetTopic.name, config);
    } catch (err) {
      log('WARN', `Playlist setup failed: ${(err as Error).message}`);
    }

    // Upload long-form video
    if (files.longFormVideo && config.youtube.longForm) {
      try {
        const result = await withRetry(
          () =>
            uploadToYouTube(files.longFormVideo!, {
              title: metadata.youtube.title,
              description: metadata.youtube.description,
              tags: metadata.youtube.tags,
              categoryId: metadata.youtube.categoryId,
              isShort: false,
              privacy: config.youtube.defaultPrivacy,
              thumbnailPath: files.thumbnail || undefined,
              playlistId,
            }),
          'YouTube long-form',
          config,
        );

        entry.youtube = {
          longFormId: result.videoId,
          longFormUrl: result.url,
          playlistId,
          shortIds: [],
        };

        // Verify it's live
        await sleep(3000);
        const isLive = await verifyYouTubeVideoLive(result.videoId);
        log(isLive ? 'SUCCESS' : 'WARN', `YouTube long-form verification: ${isLive ? 'live' : 'processing'}`);
      } catch (err) {
        errors.push(`YouTube long-form: ${(err as Error).message}`);
        log('ERROR', `YouTube long-form upload failed: ${(err as Error).message}`);
      }
    }

    // Upload vertical parts as Shorts (using per-part metadata when available)
    if (files.verticalParts.length > 0 && config.youtube.shorts) {
      const shortIds: string[] = [];

      for (let i = 0; i < files.verticalParts.length; i++) {
        const partPath = files.verticalParts[i];
        const partNum = i + 1;

        // Use per-part metadata if available, otherwise fall back to derived metadata
        let shortTitle: string;
        let shortDescription: string;
        let shortTags: string[];

        const partMetaPath = files.partMetadataJsons[i];
        if (partMetaPath && fs.existsSync(partMetaPath)) {
          const partMeta: MetadataFile = JSON.parse(fs.readFileSync(partMetaPath, 'utf-8'));
          shortTitle = partMeta.youtube.title;
          shortDescription = partMeta.youtube.description;
          shortTags = partMeta.youtube.tags;
          log('INFO', `Using per-part metadata for Short #${partNum}`);
        } else {
          shortTitle = `${metadata.youtube.title} (Part ${partNum}/${files.verticalParts.length})`;
          shortDescription = `Part ${partNum} of ${files.verticalParts.length}.\n\n${metadata.youtube.description.slice(0, 500)}`;
          shortTags = [...metadata.youtube.tags, 'shorts'];
        }

        try {
          const result = await withRetry(
            () =>
              uploadToYouTube(partPath, {
                title: shortTitle,
                description: shortDescription,
                tags: shortTags,
                categoryId: metadata.youtube.categoryId,
                isShort: true,
                privacy: config.youtube.defaultPrivacy,
              }),
            `YouTube Short #${partNum}`,
            config,
          );

          shortIds.push(result.videoId);

          // Rate limit: wait 10s between uploads
          if (i < files.verticalParts.length - 1) {
            await sleep(10000);
          }
        } catch (err) {
          errors.push(`YouTube Short #${partNum}: ${(err as Error).message}`);
          log('ERROR', `YouTube Short #${partNum} failed: ${(err as Error).message}`);
        }
      }

      if (!entry.youtube) entry.youtube = {};
      entry.youtube.shortIds = shortIds;
    }
  }

  // Instagram uploads
  if (config.instagram.enabled && config.instagram.reels && !skipInstagram) {
    const maxReels = config.instagram.maxReelsPerSession;
    const reelsToUpload = files.verticalParts.slice(0, maxReels);
    const reelIds: string[] = [];

    if (reelsToUpload.length > 0) {
      for (let i = 0; i < reelsToUpload.length; i++) {
        const partPath = reelsToUpload[i];
        const partNum = i + 1;

        // Use per-part Instagram caption if available
        let caption: string;
        const partMetaPath = files.partMetadataJsons[i];
        if (partMetaPath && fs.existsSync(partMetaPath)) {
          const partMeta: MetadataFile = JSON.parse(fs.readFileSync(partMetaPath, 'utf-8'));
          caption = partMeta.instagramCaption || `${metadata.instagramCaption || ''}\n\nPart ${partNum}/${reelsToUpload.length}`;
        } else {
          caption = `${metadata.instagramCaption || ''}\n\nPart ${partNum}/${reelsToUpload.length}`;
        }

        try {
          const mediaId = await withRetry(
            () => uploadToInstagram(partPath, caption, config),
            `Instagram Reel #${partNum}`,
            config,
          );

          reelIds.push(mediaId);

          // Rate limit: wait 30s between Instagram posts
          if (i < reelsToUpload.length - 1) {
            await sleep(30000);
          }
        } catch (err) {
          errors.push(`Instagram Reel #${partNum}: ${(err as Error).message}`);
          log('ERROR', `Instagram Reel #${partNum} failed: ${(err as Error).message}`);
        }
      }
    }

    entry.instagram = { reelIds };
  }

  // ─── Update queue & history ───────────────────────────────────────────

  const duration = Date.now() - startTime;
  entry.durationMs = duration;

  if (errors.length > 0) {
    entry.errors = errors;
    entry.status = errors.length < 3 ? 'partial' : 'failed';
  }

  // Mark as published in topic queue
  if (entry.status !== 'failed') {
    const topicInQueue = queue.topics.find((t) => t.slug === targetTopic.slug);
    if (topicInQueue && !topicInQueue.published.includes(targetSession)) {
      topicInQueue.published.push(targetSession);
      topicInQueue.published.sort((a, b) => a - b);
    }
    saveQueue(queue);
  }

  // Save to history
  history.entries.push(entry);
  history.lastPublished = entry.timestamp;
  history.totalPublished += entry.status !== 'failed' ? 1 : 0;
  saveHistory(history);

  // ─── Notifications ────────────────────────────────────────────────────

  const durationStr = `${(duration / 1000).toFixed(0)}s`;

  if (slackUrl) {
    const links: { label: string; url: string }[] = [];
    if (entry.youtube?.longFormUrl) {
      links.push({ label: 'YouTube', url: entry.youtube.longFormUrl });
    }

    await sendSlackNotification(slackUrl, {
      title: `${targetTopic.name} S${targetSession} — ${entry.status.toUpperCase()}`,
      status: entry.status === 'success' ? 'success' : entry.status === 'partial' ? 'warning' : 'failure',
      details: [
        `Topic: ${targetTopic.name} (${targetTopic.category})`,
        `Session: ${targetSession}`,
        `YouTube: ${entry.youtube?.longFormId ? 'OK' : 'skipped'} | Shorts: ${entry.youtube?.shortIds?.length || 0}`,
        `Instagram: ${entry.instagram?.reelIds?.length || 0} reels`,
        `Duration: ${durationStr}`,
        ...(errors.length > 0 ? [`Errors: ${errors.join('; ')}`] : []),
      ].join('\n'),
      links,
    });
  }

  // ─── Summary ──────────────────────────────────────────────────────────

  log('INFO', '');
  log('INFO', '=== Publish Summary ===');
  log('INFO', `Topic:    ${targetTopic.name} session ${targetSession}`);
  log('INFO', `Status:   ${entry.status.toUpperCase()}`);
  log('INFO', `Duration: ${durationStr}`);

  if (entry.youtube?.longFormUrl) {
    log('SUCCESS', `YouTube:  ${entry.youtube.longFormUrl}`);
  }
  if (entry.youtube?.shortIds?.length) {
    log('SUCCESS', `Shorts:   ${entry.youtube.shortIds.length} uploaded`);
  }
  if (entry.instagram?.reelIds?.length) {
    log('SUCCESS', `Reels:    ${entry.instagram.reelIds.length} uploaded`);
  }
  if (errors.length > 0) {
    log('ERROR', `Errors:   ${errors.length}`);
    errors.forEach((e) => log('ERROR', `  - ${e}`));
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
auto-publish.ts — Automated Video Publishing Orchestrator

Usage:
  npx tsx scripts/auto-publish.ts                                  # Publish next video
  npx tsx scripts/auto-publish.ts --dry-run                        # Preview only
  npx tsx scripts/auto-publish.ts --topic caching --session 3      # Force specific video
  npx tsx scripts/auto-publish.ts --retry                          # Retry last failure
  npx tsx scripts/auto-publish.ts --status                         # Show history & stats
  npx tsx scripts/auto-publish.ts --health                         # Verify setup
  npx tsx scripts/auto-publish.ts --setup-cron                     # Show cron/launchd setup

Environment:
  YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET  — Google OAuth2
  INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ID — Instagram Graph API
  UPLOAD_HOST_URL — Public tunnel for Instagram (ngrok)
  SLACK_WEBHOOK_URL — Optional Slack notifications
  SKIP_YOUTUBE=1 — Skip YouTube uploads
  SKIP_INSTAGRAM=1 — Skip Instagram uploads
`);
    return;
  }

  if (args.includes('--status')) {
    showStatus();
    return;
  }

  if (args.includes('--health')) {
    await healthCheck();
    return;
  }

  if (args.includes('--setup-cron')) {
    showCronSetup();
    return;
  }

  const dryRun = args.includes('--dry-run');
  const retryLast = args.includes('--retry');

  const topicIdx = args.indexOf('--topic');
  const sessionIdx = args.indexOf('--session');
  const forceTopic = topicIdx >= 0 ? args[topicIdx + 1] : undefined;
  const forceSession = sessionIdx >= 0 ? parseInt(args[sessionIdx + 1], 10) : undefined;

  try {
    await publish({
      dryRun,
      forceTopic,
      forceSession,
      retryLast,
    });
  } catch (err) {
    log('ERROR', `Fatal error: ${(err as Error).message}`);
    log('ERROR', (err as Error).stack || '');

    // Try to send Slack notification on fatal error
    const config = loadConfig();
    const slackUrl = process.env.SLACK_WEBHOOK_URL || config.notifications.slackWebhookUrl;
    if (slackUrl) {
      await sendSlackNotification(slackUrl, {
        title: 'Auto-Publish FATAL ERROR',
        status: 'failure',
        details: (err as Error).message,
      });
    }

    process.exit(1);
  }
}

main();
