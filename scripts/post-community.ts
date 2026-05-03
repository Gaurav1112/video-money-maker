#!/usr/bin/env tsx
/**
 * post-community.ts
 *
 * Posts a community post to YouTube Studio using Playwright + saved session cookies.
 * Called by the GitHub Actions workflow at T-30min (teaser) and T+1h (recap).
 *
 * Usage:
 *   npx tsx scripts/post-community.ts --episode 42 --type teaser
 *   npx tsx scripts/post-community.ts --episode 42 --type recap --video-id abc123
 *
 * Required env:
 *   YT_STUDIO_COOKIES   JSON string of Playwright cookie objects (full session)
 *   YT_CHANNEL_ID       YouTube channel ID (UCxxxxxxxx) for the primary channel
 *
 * Optional env:
 *   COMMUNITY_DRY_RUN   Set to "true" to print post text and exit without posting
 *   PLAYWRIGHT_HEADLESS Set to "false" to watch the browser (local debugging only)
 */

import { chromium, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { MetadataFile, EpisodeRegistry } from '../src/types';

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(): { episode: number; type: 'teaser' | 'recap'; videoId?: string } {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  const episodeStr = get('--episode');
  const type = get('--type') as 'teaser' | 'recap' | undefined;

  if (!episodeStr || !type) {
    console.error('Usage: post-community.ts --episode <n> --type <teaser|recap> [--video-id <id>]');
    process.exit(1);
  }
  return { episode: parseInt(episodeStr, 10), type, videoId: get('--video-id') };
}

// ─── Cookie loading ───────────────────────────────────────────────────────────

interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

function loadCookies(): PlaywrightCookie[] {
  const raw = process.env.YT_STUDIO_COOKIES;
  if (!raw) throw new Error('YT_STUDIO_COOKIES env var is not set. See INTEGRATION.md for setup.');
  try {
    const cookies: PlaywrightCookie[] = JSON.parse(raw);
    if (!Array.isArray(cookies) || cookies.length === 0) throw new Error('Cookie array is empty');
    return cookies;
  } catch (err) {
    throw new Error(`YT_STUDIO_COOKIES is not valid JSON: ${(err as Error).message}`);
  }
}

// ─── Post text builders ───────────────────────────────────────────────────────

interface PostContent {
  text: string;
  poll?: { question: string; options: string[] };
}

function buildTeaserPost(metadata: MetadataFile): PostContent {
  const { communityPost } = metadata;
  if (!communityPost) throw new Error(`metadata.communityPost is missing for episode ${metadata.episodeNumber}`);
  return {
    text: communityPost.teaser,
    poll: communityPost.poll,
  };
}

function buildRecapPost(metadata: MetadataFile, videoId: string): PostContent {
  const { communityPost } = metadata;
  if (!communityPost) throw new Error(`metadata.communityPost is missing for episode ${metadata.episodeNumber}`);
  const url = `https://youtu.be/${videoId}`;
  return {
    text: communityPost.recap.replace('{VIDEO_URL}', url),
  };
}

// ─── Playwright automation ────────────────────────────────────────────────────

const STUDIO_URL = 'https://studio.youtube.com/';
const TIMEOUT_MS = 30_000;

async function assertNoLoginChallenge(page: Page): Promise<void> {
  // If cookies expired, Studio redirects to accounts.google.com
  const url = page.url();
  if (url.includes('accounts.google.com') || url.includes('signin')) {
    await page.screenshot({ path: 'community-post-auth-failure.png' });
    throw new Error(
      'Cookie session has expired — Studio redirected to login. ' +
      'Refresh YT_STUDIO_COOKIES secret (see INTEGRATION.md) and retry.'
    );
  }
}

async function openCommunityComposer(page: Page): Promise<void> {
  // Primary path: Create button → Community post
  await page.waitForSelector('[aria-label="Create"], [data-testid="create-button"]', { timeout: TIMEOUT_MS });
  await page.click('[aria-label="Create"], [data-testid="create-button"]');

  // The Create menu shows Community post option
  const communityOption = page.locator('tp-yt-paper-item:has-text("Community post"), ytcp-ve:has-text("Community post")').first();
  await communityOption.waitFor({ timeout: TIMEOUT_MS });
  await communityOption.click();
}

async function typePostText(page: Page, text: string): Promise<void> {
  // The community post composer uses a contenteditable div
  const composer = page.locator(
    '[contenteditable="true"][aria-label*="community"], ' +
    '[contenteditable="true"][placeholder*="What"], ' +
    'ytcp-social-suggestion-input [contenteditable="true"]'
  ).first();
  await composer.waitFor({ timeout: TIMEOUT_MS });
  await composer.click();
  // Clear any placeholder content then type
  await page.keyboard.press('Control+A');
  await composer.type(text, { delay: 20 });
}

async function attachPoll(page: Page, poll: { question: string; options: string[] }): Promise<void> {
  // Click "Add poll" button if present
  const pollButton = page.locator('[aria-label="Add poll"], button:has-text("Poll")').first();
  try {
    await pollButton.waitFor({ timeout: 5_000 });
  } catch {
    console.warn('⚠️  Poll button not found — posting without poll');
    return;
  }
  await pollButton.click();

  // Fill poll question
  const questionInput = page.locator('[placeholder*="question"], [aria-label*="question"]').first();
  await questionInput.waitFor({ timeout: TIMEOUT_MS });
  await questionInput.fill(poll.question);

  // Fill poll options (YouTube requires at least 2, supports up to 5)
  const optionInputs = page.locator('[placeholder*="option"], [aria-label*="option"]');
  const count = Math.min(poll.options.length, await optionInputs.count());
  for (let i = 0; i < count; i++) {
    await optionInputs.nth(i).fill(poll.options[i]);
  }
}

async function submitPost(page: Page): Promise<void> {
  const postButton = page.locator('ytcp-button[id="post-button"], button:has-text("Post")').first();
  await postButton.waitFor({ timeout: TIMEOUT_MS });

  // Guard: make sure button is enabled (not greyed out)
  const isDisabled = await postButton.getAttribute('disabled');
  if (isDisabled !== null) throw new Error('Post button is disabled — text may be empty or invalid');

  await postButton.click();

  // Wait for success indicator: the composer closes or a toast appears
  await page.waitForFunction(
    () => {
      const toast = document.querySelector('ytcp-notification-bar, [class*="success"]');
      return toast !== null;
    },
    { timeout: TIMEOUT_MS }
  ).catch(async () => {
    // Fallback: just wait for the dialog to disappear
    await page.waitForSelector('ytcp-uploads-dialog, [role="dialog"]', {
      state: 'hidden',
      timeout: TIMEOUT_MS,
    });
  });
}

// ─── Registry helpers ─────────────────────────────────────────────────────────

async function markPosted(
  episodeNumber: number,
  type: 'teaser' | 'recap',
  videoId?: string
): Promise<void> {
  const registryPath = 'config/episode-registry.json';
  try {
    const data = await fs.readFile(registryPath, 'utf-8');
    const registry: EpisodeRegistry = JSON.parse(data);
    const entry = registry.episodes[episodeNumber];
    if (entry) {
      if (type === 'teaser') {
        (entry as any).communityTeaserPostedAt = new Date().toISOString();
      } else {
        (entry as any).communityRecapPostedAt = new Date().toISOString();
        if (videoId) (entry as any).communityRecapVideoId = videoId;
      }
      await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));
    }
  } catch {
    // Registry update is best-effort; post itself already succeeded
    console.warn('⚠️  Could not update episode-registry.json (non-fatal)');
  }
}

async function alreadyPosted(episodeNumber: number, type: 'teaser' | 'recap'): Promise<boolean> {
  try {
    const data = await fs.readFile('config/episode-registry.json', 'utf-8');
    const registry: EpisodeRegistry = JSON.parse(data);
    const entry = registry.episodes[episodeNumber] as any;
    if (!entry) return false;
    return type === 'teaser'
      ? Boolean(entry.communityTeaserPostedAt)
      : Boolean(entry.communityRecapPostedAt);
  } catch {
    return false;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { episode, type, videoId } = parseArgs();

  // Idempotency guard
  if (await alreadyPosted(episode, type)) {
    console.log(`✅ Community ${type} for episode ${episode} already posted — skipping.`);
    return;
  }

  // Load primary language (Hindi) metadata for post text
  const metadataPath = path.join('output', `episode-${episode}`, 'metadata-hi.json');
  let metadata: MetadataFile;
  try {
    metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
  } catch {
    throw new Error(`Could not read ${metadataPath}. Run batch-render first.`);
  }

  const post: PostContent = type === 'teaser'
    ? buildTeaserPost(metadata)
    : buildRecapPost(metadata, videoId ?? '');

  if (process.env.COMMUNITY_DRY_RUN === 'true') {
    console.log(`\n🔍 DRY RUN — would post (${type}):\n`);
    console.log(post.text);
    if (post.poll) console.log('\nPoll:', JSON.stringify(post.poll, null, 2));
    return;
  }

  console.log(`\n📣 Posting community ${type} for episode ${episode}…`);

  const cookies = loadCookies();
  const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
  const browser = await chromium.launch({ headless });

  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    await context.addCookies(cookies);
    const page = await context.newPage();

    await page.goto(STUDIO_URL, { waitUntil: 'networkidle', timeout: 60_000 });
    await assertNoLoginChallenge(page);

    await openCommunityComposer(page);
    await typePostText(page, post.text);

    if (post.poll) {
      await attachPoll(page, post.poll);
    }

    await submitPost(page);

    console.log(`✅ Community ${type} posted for episode ${episode}`);
    await markPosted(episode, type, videoId);
  } finally {
    await context?.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error('❌ post-community failed:', err.message);
  process.exit(1);
});
