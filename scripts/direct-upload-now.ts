#!/usr/bin/env npx tsx
/**
 * DIRECT UPLOAD — No workflow, no delays
 * Uploads test video to YouTube right now
 * ENHANCED: OAuth2 refresh + exponential backoff retry + health checks
 */

import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import { refreshYouTubeToken, getValidAccessToken } from '../src/lib/auth-validator';
import { retryableUpload } from '../src/lib/upload-retry';
import { runHealthChecks, reportHealthCheckStatus } from '../src/lib/upload-health-check';
import { logUpload, flushLogs } from '../src/lib/upload-logger';

const VIDEO_FILE = '/Users/kumargaurav/guru-sishya-uploads/test/untitled/short-stock.mp4';
const TITLE = '🔥 Database Indexing Explained - Retention 9/10 Test';
const DESCRIPTION = `Testing retention 9/10 engine with 7 levers:
• Hook strength (95% watch @3s)
• Shock opener [WRONG vs RIGHT]
• Pattern interrupts (every 5s)
• B-roll coverage (60%)
• Story arc (7 sections)
• Fast pacing (no gap >5s)
• Strong ending (90% finish)

Expected: 70%+ retention (9/10 quality)
GitHub: github.com/Gaurav1112/video-money-maker`;

async function uploadNow() {
  // Credentials from environment
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('❌ Missing YouTube credentials:');
    console.error('   YOUTUBE_CLIENT_ID:', clientId ? '✓' : '✗');
    console.error('   YOUTUBE_CLIENT_SECRET:', clientSecret ? '✓' : '✗');
    console.error('   YOUTUBE_REFRESH_TOKEN:', refreshToken ? '✓' : '✗');
    process.exit(1);
  }

  try {
    // STEP 1: Run health checks
    console.log('🏥 Running pre-flight health checks...');
    const health = await runHealthChecks(
      VIDEO_FILE,
      clientId,
      clientSecret,
      refreshToken,
      100
    );
    reportHealthCheckStatus(health);
    
    if (!health.healthy) {
      console.error('\n❌ Upload blocked by health check failures');
      logUpload('error', 'Health check failed', health.checks.errors);
      flushLogs();
      process.exit(1);
    }

    // STEP 2: Get file info
    console.log('📦 Upload Details:');
    console.log(`   File: ${VIDEO_FILE}`);
    const fileSize = fs.statSync(VIDEO_FILE).size / 1024 / 1024;
    console.log(`   Size: ${fileSize.toFixed(1)} MB`);
    console.log(`   Title: ${TITLE}`);

    // STEP 3: Refresh token before upload
    console.log('\n🔑 Refreshing OAuth2 token...');
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(refreshToken);
      logUpload('info', 'OAuth2 token refreshed successfully', { expiresIn: 3600 });
    } catch (err: any) {
      logUpload('error', 'Failed to refresh OAuth2 token', { error: err.message });
      throw err;
    }

    // STEP 4: Perform upload with retry logic
    console.log('\n📤 Starting upload with automatic retry logic...');
    logUpload('info', 'Upload started', { title: TITLE, fileSize: `${fileSize.toFixed(1)}MB` });
    
    // Wrapper to convert logUpload signature to retryable format
    const retryLogger = (msg: string) => {
      logUpload('info', msg);
    };
    
    const uploadResult = await retryableUpload(async () => {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost');
      oauth2Client.setCredentials({ access_token: accessToken });

      const youtube = google.youtube({
        version: 'v3',
        auth: oauth2Client,
      });

      const response = await youtube.videos.insert(
        {
          part: ['snippet', 'status'],
          requestBody: {
            snippet: {
              title: TITLE,
              description: DESCRIPTION,
              tags: ['database', 'indexing', 'system-design', 'tutorial'],
              categoryId: '28',
            },
            status: {
              privacyStatus: 'unlisted',
              madeForKids: false,
            },
          },
          media: {
            body: fs.createReadStream(VIDEO_FILE),
          },
        },
        {
          onUploadProgress: (evt: any) => {
            const progress = ((evt.bytesRead / fs.statSync(VIDEO_FILE).size) * 100).toFixed(1);
            process.stdout.write(`\r   Progress: ${progress}%`);
          },
        }
      );
      
      return response;
    }, retryLogger);

    if (!uploadResult.success) {
      console.error('\n❌ UPLOAD FAILED!');
      console.error(`Failed after ${uploadResult.attempts} attempts`);
      console.error(`Error: ${uploadResult.error}`);
      logUpload('error', 'Upload failed after retries', {
        attempts: uploadResult.attempts,
        error: uploadResult.error,
      });
      flushLogs();
      process.exit(1);
    }

    // STEP 5: Success
    const response = uploadResult.data;
    console.log('\n\n✅ UPLOAD SUCCESSFUL!');
    console.log(`   Video ID: ${response.data.id}`);
    console.log(`   URL: https://www.youtube.com/watch?v=${response.data.id}`);
    console.log(`   Studio: https://studio.youtube.com/video/${response.data.id}`);
    
    logUpload('info', 'Upload successful', {
      videoId: response.data.id,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
      attempts: uploadResult.attempts,
    });
    
    // Save video ID for tracking
    const logEntry = {
      timestamp: new Date().toISOString(),
      videoId: response.data.id,
      title: TITLE,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
    };
    
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    fs.appendFileSync(path.join(tmpDir, 'uploaded-videos.json'), JSON.stringify(logEntry) + '\n');
    console.log('\n📝 Logged to: tmp/uploaded-videos.json');
    
    flushLogs();
    
  } catch (error: any) {
    console.error('\n❌ Upload failed!');
    console.error('Error:', error.message);
    if (error.errors) {
      error.errors.forEach((e: any) => console.error('  -', e.message));
    }
    logUpload('error', 'Upload exception', { error: error.message });
    flushLogs();
    process.exit(1);
  }
}

uploadNow();
