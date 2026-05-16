/**
 * scripts/lib/youtube-oauth.ts — Shared YouTube OAuth2 helper
 *
 * Extracted from upload-youtube.ts so both the English-track and
 * Hinglish-track upload scripts share a single auth implementation.
 *
 * Priority order:
 *   1. YOUTUBE_REFRESH_TOKEN env var  (CI / GitHub Actions)
 *   2. .youtube-token.json file        (local dev, after auth-youtube.ts)
 */

import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN_PATH = path.resolve(__dirname, '..', '..', '.youtube-token.json');

export function getYouTubeAuthClient(): InstanceType<typeof google.auth.OAuth2> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    console.error('Error: YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET env vars required.');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

  // Priority 1: env var (GitHub Actions / cloud runners)
  if (refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  // Priority 2: local token file
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('Error: YOUTUBE_REFRESH_TOKEN env var or .youtube-token.json required.');
    console.error('For cloud: set YOUTUBE_REFRESH_TOKEN secret');
    console.error('For local: run npx tsx scripts/auth-youtube.ts');
    process.exit(1);
  }

  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  oauth2Client.setCredentials(tokens);

  // Auto-save refreshed tokens to disk
  oauth2Client.on('tokens', (newTokens) => {
    const existing = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    const merged = { ...existing, ...newTokens };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
    console.log('Access token refreshed and saved.');
  });

  return oauth2Client;
}
