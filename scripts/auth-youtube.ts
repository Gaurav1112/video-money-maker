/**
 * One-time OAuth2 authentication script for YouTube Data API v3.
 *
 * Usage:
 *   YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy npx tsx scripts/auth-youtube.ts
 *
 * This opens a browser for Google consent, captures the authorization code,
 * exchanges it for tokens, and saves the refresh token to .youtube-token.json.
 */

import { google } from 'googleapis';
import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN_PATH = path.resolve(__dirname, '..', '.youtube-token.json');

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl', // needed for comments, captions
];

async function main(): Promise<void> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Error: YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET environment variables are required.');
    console.error('');
    console.error('Usage:');
    console.error('  YOUTUBE_CLIENT_ID=xxx YOUTUBE_CLIENT_SECRET=yyy npx tsx scripts/auth-youtube.ts');
    console.error('');
    console.error('Get credentials from: https://console.cloud.google.com/apis/credentials');
    process.exit(1);
  }

  const redirectUri = 'http://localhost:3491/oauth2callback';

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to always get a refresh_token
  });

  console.log('');
  console.log('Opening browser for Google OAuth consent...');
  console.log('If the browser does not open, visit this URL manually:');
  console.log('');
  console.log(authUrl);
  console.log('');

  // Open browser
  const { exec } = await import('child_process');
  const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${openCmd} "${authUrl}"`);

  // Start local server to capture the OAuth callback
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsed = url.parse(req.url || '', true);
      if (parsed.pathname === '/oauth2callback') {
        const authCode = parsed.query.code as string | undefined;
        const error = parsed.query.error as string | undefined;

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        if (!authCode) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>No authorization code received</h1>');
          server.close();
          reject(new Error('No authorization code'));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization successful!</h1><p>You can close this tab now.</p>');
        server.close();
        resolve(authCode);
      }
    });

    server.listen(3491, () => {
      console.log('Waiting for authorization on http://localhost:3491/oauth2callback ...');
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timed out after 2 minutes'));
    }, 120_000);
  });

  console.log('Authorization code received. Exchanging for tokens...');

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.error('Warning: No refresh_token received. Try revoking access at https://myaccount.google.com/permissions and re-running this script.');
  }

  const tokenData = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope,
    token_type: tokens.token_type,
    expiry_date: tokens.expiry_date,
  };

  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
  console.log('');
  console.log(`Tokens saved to ${TOKEN_PATH}`);
  console.log('You can now use scripts/upload-youtube.ts to upload videos.');
}

main().catch((err) => {
  console.error('Authentication failed:', err.message);
  process.exit(1);
});
