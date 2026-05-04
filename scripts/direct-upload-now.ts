#!/usr/bin/env npx tsx
/**
 * DIRECT UPLOAD — No workflow, no delays
 * Uploads test video to YouTube right now
 */

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

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

  console.log('🚀 Starting upload...');
  console.log(`   File: ${VIDEO_FILE}`);
  console.log(`   Size: ${(fs.statSync(VIDEO_FILE).size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`   Title: ${TITLE}`);

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'http://localhost');
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client,
  });

  try {
    console.log('\n📤 Uploading to YouTube...');
    
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

    console.log('\n\n✅ UPLOAD SUCCESSFUL!');
    console.log(`   Video ID: ${response.data.id}`);
    console.log(`   URL: https://www.youtube.com/watch?v=${response.data.id}`);
    console.log(`   Studio: https://studio.youtube.com/video/${response.data.id}`);
    
    // Save video ID for tracking
    const logEntry = {
      timestamp: new Date().toISOString(),
      videoId: response.data.id,
      title: TITLE,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
    };
    
    fs.appendFileSync('tmp/uploaded-videos.json', JSON.stringify(logEntry) + '\n');
    console.log('\n📝 Logged to: tmp/uploaded-videos.json');
    
  } catch (error: any) {
    console.error('\n❌ Upload failed!');
    console.error('Error:', error.message);
    if (error.errors) {
      error.errors.forEach((e: any) => console.error('  -', e.message));
    }
    process.exit(1);
  }
}

uploadNow();
