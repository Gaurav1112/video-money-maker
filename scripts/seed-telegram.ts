/**
 * scripts/seed-telegram.ts — B2 Telegram seed broadcast for Shorts
 *
 * Why this exists
 * ───────────────
 * The 944-view ceiling on a fresh Short is largely a first-30-minute
 * problem: if no traffic arrives in that window, YouTube's recommender
 * concludes there's no demand and stops surfacing the video to non-
 * subscribers. Cold-start ceiling = subscriber-impression count.
 *
 * The cheapest, most reliable fix is to broadcast every freshly-
 * uploaded Short to a Telegram channel where the existing audience
 * lives. Even modest CTR from Telegram (≈10–20 immediate views in
 * the first 5 minutes) is enough velocity to lift the algorithm's
 * "this video has demand" verdict.
 *
 * Why a new script (instead of reusing publish-telegram.ts)
 * ────────────────────────────────────────────────────────
 * publish-telegram.ts is built around the longform-episode metadata
 * shape (episodeNumber, communityPost, etc.). Shorts metadata has a
 * different shape (slug/topic/youtube.title). Rather than retrofit,
 * this is a dedicated, small script for the Shorts use case so we
 * don't risk breaking the longform path.
 *
 * Required env
 * ────────────
 *   TG_BOT_TOKEN    Telegram Bot API token from @BotFather
 *   TG_CHANNEL_ID   Channel username "@GuruSishya_India" or numeric "-100…"
 *
 * Failure mode
 * ────────────
 * If TG_BOT_TOKEN is unset → exits 0 with a clear message ("seed
 * skipped, no token"). The workflow gates the step on the secret being
 * present, so this is a defense-in-depth check.
 *
 * If the API call fails → exits 1 so the workflow surfaces it.
 */

import * as fs from 'node:fs';

type ShortMetadata = {
  topic?: string;
  slug?: string;
  youtube?: { title?: string };
};

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

export function buildSeedMessage(args: {
  videoId: string;
  metadata: ShortMetadata | null;
}): string {
  const topic = (args.metadata?.topic || 'today').trim();
  const title = (args.metadata?.youtube?.title || `${topic} (60 sec)`).trim();
  const url = `https://youtube.com/shorts/${args.videoId}`;
  return [
    `🚀 New Short is live!`,
    ``,
    `*${title}*`,
    ``,
    `Watch & like to help the algorithm push this to more engineers 🙏`,
    ``,
    url,
  ].join('\n');
}

async function sendTelegramMessage(
  botToken: string,
  channelId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = `${TELEGRAM_API_BASE}${botToken}/sendMessage`;
  const body = {
    chat_id: channelId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: false,
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    return { ok: false, error: `HTTP ${resp.status}: ${errText.slice(0, 300)}` };
  }
  const json = (await resp.json()) as { ok?: boolean; description?: string };
  if (!json.ok) {
    return { ok: false, error: json.description || 'unknown' };
  }
  return { ok: true };
}

export async function seedTelegram(args: {
  videoId: string;
  metadata: ShortMetadata | null;
  botToken?: string;
  channelId?: string;
  send?: (token: string, channel: string, text: string) => Promise<{ ok: boolean; error?: string }>;
}): Promise<{ skipped: boolean; reason?: string }> {
  const botToken =
    args.botToken ??
    process.env['TELEGRAM_BOT_TOKEN'] ??
    process.env['TG_BOT_TOKEN'];
  const channelId =
    args.channelId ??
    process.env['TELEGRAM_CHANNEL_ID'] ??
    process.env['TG_CHANNEL_ID'];

  if (!botToken) {
    console.log('[seed-telegram] TELEGRAM_BOT_TOKEN not set — skipping seed (returning ok)');
    return { skipped: true, reason: 'no-token' };
  }
  if (!channelId) {
    console.log('[seed-telegram] TELEGRAM_CHANNEL_ID not set — skipping seed (returning ok)');
    return { skipped: true, reason: 'no-channel' };
  }

  const text = buildSeedMessage(args);
  console.log(`[seed-telegram] sending to ${channelId} (${text.length} chars)`);
  const sender = args.send ?? sendTelegramMessage;
  const result = await sender(botToken, channelId, text);
  if (!result.ok) {
    throw new Error(`Telegram API error: ${result.error}`);
  }
  console.log('[seed-telegram] sent');
  return { skipped: false };
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
    console.error('[seed-telegram] no videoId provided — skipping seed (returning ok 0)');
    process.exit(0);
  }

  let meta: ShortMetadata | null = null;
  if (metadataPath && fs.existsSync(metadataPath)) {
    meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as ShortMetadata;
  }

  try {
    const result = await seedTelegram({ videoId, metadata: meta });
    if (result.skipped) {
      console.log(`[seed-telegram] skipped (${result.reason})`);
    }
  } catch (err) {
    console.error(`[seed-telegram] FATAL: ${(err as Error).message}`);
    process.exit(1);
  }
}

if (process.argv[1]?.endsWith('seed-telegram.ts')) {
  cli();
}
