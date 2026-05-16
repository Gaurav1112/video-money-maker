#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const VIDEO_PATH = '/Users/kumargaurav/guru-sishya-uploads/test/untitled/short-stock.mp4';
const TITLE = '🔥 Database Indexing Explained - Hook + Shock Visuals Test';
const DESCRIPTION = `Testing retention 9/10 engine with:
- Hook strength (95% watch @3s)
- Shock opener [WRONG vs RIGHT]
- Pattern interrupts (every 5s)
- B-roll coverage (60%)
- Story arc (7 sections)
- Strong ending (90% finish rate)

Expected: 70%+ retention (9/10 quality)

Source: github.com/Gaurav1112/video-money-maker`;

async function uploadToYouTube() {
  // Get refresh token from env or GitHub secrets
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error('❌ YOUTUBE_REFRESH_TOKEN not set');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    'http://localhost'
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client,
  });

  console.log('🚀 Uploading video to YouTube...');
  console.log(`   Title: ${TITLE}`);
  console.log(`   File: ${VIDEO_PATH}`);

  try {
    const response = await youtube.videos.insert(
      {
        part: ['snippet', 'status', 'processingDetails'],
        requestBody: {
          snippet: {
            title: TITLE,
            description: DESCRIPTION,
            tags: ['database', 'indexing', 'coding', 'tutorial', 'shorts'],
            categoryId: '28', // Technology
          },
          status: {
            privacyStatus: 'public',
            madeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(VIDEO_PATH),
        },
      },
      {
        onUploadProgress: (evt) => {
          const progress = (evt.bytesRead / fs.statSync(VIDEO_PATH).size) * 100;
          process.stdout.write(`\r   Progress: ${Math.round(progress)}%`);
        },
      }
    );

    console.log('\n✅ Upload successful!');
    console.log(`   Video ID: ${response.data.id}`);
    console.log(`   URL: https://youtube.com/watch?v=${response.data.id}`);
    
    return response.data.id;
  } catch (error: any) {
    console.error('❌ Upload failed:', error.message);
    throw error;
  }
}

uploadToYouTube().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
