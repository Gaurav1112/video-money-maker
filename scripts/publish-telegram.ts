#!/usr/bin/env tsx
/**
 * publish-telegram.ts
 *
 * Broadcasts a daily video post to the GuruSishya Telegram channel.
 * Sends the video file directly if ≤ 50 MB, otherwise sends the thumbnail
 * image with a full caption and clickable links.
 *
 * Usage:
 *   npx tsx scripts/publish-telegram.ts --metadata path/to/metadata.json
 *   npx tsx scripts/publish-telegram.ts --episode 42
 *   npx tsx scripts/publish-telegram.ts --dry-run   (prints message, no network calls)
 *
 * Required env:
 *   TG_BOT_TOKEN    Telegram Bot HTTP API token (from @BotFather)
 *   TG_CHANNEL_ID   Channel username (@GuruSishya_India) or numeric ID (-100xxxxxxxxxx)
 *
 * Optional env:
 *   TG_DRY_RUN      Set to "true" to print the message and exit without posting
 *   METADATA_DIR    Directory containing episode metadata.json files (default: ./out)
 */

import TelegramBot from 'node-telegram-bot-api';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommunityPost {
  teaser: string;
  bullets?: string[];
}

interface MetadataFile {
  episodeNumber: number;
  title: string;
  youtubeUrl: string;
  thumbnailPath?: string;
  videoPath?: string;
  communityPost?: CommunityPost;
  tags?: string[];
}

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(): { metadataPath?: string; episode?: number; dryRun: boolean } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  return {
    metadataPath: get('--metadata'),
    episode: get('--episode') ? parseInt(get('--episode')!, 10) : undefined,
    dryRun: args.includes('--dry-run') || process.env.TG_DRY_RUN === 'true',
  };
}

// ─── Metadata loading ─────────────────────────────────────────────────────────

function loadMetadata(args: ReturnType<typeof parseArgs>): MetadataFile {
  let filePath: string;

  if (args.metadataPath) {
    filePath = path.resolve(args.metadataPath);
  } else if (args.episode !== undefined) {
    const dir = process.env.METADATA_DIR ?? './out';
    filePath = path.join(dir, `episode-${args.episode}`, 'metadata.json');
  } else {
    // Default: latest metadata.json written by upload-youtube step
    const dir = process.env.METADATA_DIR ?? './out';
    filePath = path.join(dir, 'metadata.json');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`metadata.json not found at ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as MetadataFile;
}

// ─── Caption builder ──────────────────────────────────────────────────────────

const MAX_CAPTION_BYTES = 1024; // Telegram caption limit

export function buildCaption(meta: MetadataFile): string {
  const teaser = meta.communityPost?.teaser?.trim() ?? '';
  const bullets = meta.communityPost?.bullets ?? [];

  const bulletsBlock =
    bullets.length > 0
      ? `\n\n📌 What you'll learn:\n${bullets.map((b) => `• ${b}`).join('\n')}`
      : '';

  const tags = (meta.tags ?? ['SystemDesign', 'FAANG', 'InterviewPrep'])
    .slice(0, 5)
    .map((t) => `#${t.replace(/\s+/g, '')}`)
    .join(' ');

  const caption = [
    `🎓 *${escapeMarkdown(meta.title)}*`,
    '',
    escapeMarkdown(teaser),
    bulletsBlock,
    '',
    `▶️ Watch on YouTube → ${meta.youtubeUrl}`,
    `🌐 Crack FAANG interviews → guru\\-sishya\\.in`,
    '',
    tags,
  ]
    .join('\n')
    .trimEnd();

  // Hard-truncate to Telegram's 1024-byte caption limit, preserving UTF-8
  const encoder = new TextEncoder();
  const bytes = encoder.encode(caption);
  if (bytes.length <= MAX_CAPTION_BYTES) return caption;

  // Truncate and append ellipsis
  let truncated = caption;
  while (encoder.encode(truncated + '…').length > MAX_CAPTION_BYTES) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

/** Escape MarkdownV2 special characters per Telegram spec */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

// ─── File size check ──────────────────────────────────────────────────────────

const MAX_DIRECT_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

function fileSizeBytes(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return Infinity;
  }
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 2000 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const delay = baseDelayMs * 2 ** i;
        console.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms…`, (err as Error).message);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ─── Main publish logic ───────────────────────────────────────────────────────

export async function publishToTelegram(meta: MetadataFile, dryRun = false): Promise<void> {
  const token = process.env.TG_BOT_TOKEN;
  const channelId = process.env.TG_CHANNEL_ID;

  if (!token) throw new Error('TG_BOT_TOKEN env var is not set. See INTEGRATION.md.');
  if (!channelId) throw new Error('TG_CHANNEL_ID env var is not set. See INTEGRATION.md.');

  const caption = buildCaption(meta);

  if (dryRun) {
    console.log('── DRY RUN: Telegram message ──────────────────────────────────');
    console.log(`Channel: ${channelId}`);
    console.log(`Caption (${new TextEncoder().encode(caption).length} bytes):\n`);
    console.log(caption);
    console.log('───────────────────────────────────────────────────────────────');
    return;
  }

  // node-telegram-bot-api with polling disabled (we only send, never receive)
  const bot = new TelegramBot(token, { polling: false });

  const videoPath = meta.videoPath;
  const thumbPath = meta.thumbnailPath;

  const sendOpts = {
    caption,
    parse_mode: 'MarkdownV2' as const,
    disable_notification: false,
  };

  // Strategy: send video if small enough, otherwise thumbnail + caption
  if (videoPath && fs.existsSync(videoPath) && fileSizeBytes(videoPath) <= MAX_DIRECT_VIDEO_BYTES) {
    console.log(`Sending video file (${(fileSizeBytes(videoPath) / 1e6).toFixed(1)} MB)…`);
    await withRetry(() =>
      bot.sendVideo(channelId, fs.createReadStream(videoPath), sendOpts),
    );
    console.log('✅ Video sent to Telegram channel');
  } else if (thumbPath && fs.existsSync(thumbPath)) {
    console.log('Video too large or not found — sending thumbnail + caption…');
    await withRetry(() =>
      bot.sendPhoto(channelId, fs.createReadStream(thumbPath), sendOpts),
    );
    console.log('✅ Thumbnail + caption sent to Telegram channel');
  } else {
    // Last resort: text-only message
    console.warn('No video or thumbnail found — sending text message only');
    const textMessage = caption.replace(/\\/g, ''); // plain text fallback
    await withRetry(() =>
      bot.sendMessage(channelId, textMessage, { parse_mode: 'HTML', disable_notification: false }),
    );
    console.log('✅ Text message sent to Telegram channel');
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();
  const meta = loadMetadata(args);

  console.log(`Publishing episode ${meta.episodeNumber}: "${meta.title}"`);
  await publishToTelegram(meta, args.dryRun);
}

main().catch((err) => {
  console.error('❌ publish-telegram failed:', err.message ?? err);
  process.exit(1);
});
