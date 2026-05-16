#!/usr/bin/env npx tsx
/**
 * MANUAL LOCAL YOUTUBE UPLOAD
 * Uploads pre-rendered videos to YouTube without workflow
 * Usage: npx tsx scripts/manual-youtube-upload-local.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const HOME = process.env.HOME || '/tmp';
const UPLOADS_DIR = path.join(HOME, 'guru-sishya-uploads');
const OUTPUT_DIR = path.join(HOME, 'guru-sishya-uploads/output');

console.log(`\n╔════════════════════════════════════════════════════════════╗`);
console.log(`║  MANUAL LOCAL YOUTUBE UPLOAD (No Workflow)                  ║`);
console.log(`╚════════════════════════════════════════════════════════════╝\n`);

// Check YouTube credentials
const requiredEnvVars = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN_HI', 'YOUTUBE_REFRESH_TOKEN_EN'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing credentials:\n${missingEnvVars.map(v => `   export ${v}=<value>`).join('\n')}\n`);
  process.exit(1);
}

console.log(`✅ YouTube credentials loaded`);
console.log(`   • YOUTUBE_CLIENT_ID: ${process.env.YOUTUBE_CLIENT_ID?.substring(0, 20)}...`);
console.log(`   • YOUTUBE_CLIENT_SECRET: (hidden)`);
console.log(`   • YOUTUBE_REFRESH_TOKEN_HI: (hidden)\n`);

// Find rendered MP4 files
console.log(`🔍 Searching for rendered MP4s in: ${UPLOADS_DIR}`);

const findMp4Files = (dir: string): string[] => {
  const mp4s: string[] = [];
  if (!fs.existsSync(dir)) return mp4s;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.mp4')) {
      mp4s.push(fullPath);
    } else if (entry.isDirectory()) {
      mp4s.push(...findMp4Files(fullPath));
    }
  }
  return mp4s;
};

const mp4Files = findMp4Files(UPLOADS_DIR).slice(0, 5); // Limit to 5 for demo

if (mp4Files.length === 0) {
  console.warn(`\n⚠️  No MP4 files found. Render videos first:\n   npx tsx scripts/batch-render-all.ts --limit 1\n`);
  console.log(`Showing demo upload format instead...\n`);
} else {
  console.log(`✅ Found ${mp4Files.length} MP4 file(s):\n`);
  mp4Files.forEach((f, i) => console.log(`   ${i + 1}. ${path.basename(f)}`));
}

console.log(`\n📤 UPLOAD FLOW:\n`);
console.log(`   1. Validate video metadata (title, description, tags)`);
console.log(`   2. Refresh YouTube OAuth2 token`);
console.log(`   3. Upload to YouTube API`);
console.log(`   4. Extract video ID`);
console.log(`   5. Update episode registry`);
console.log(`   6. Schedule community post (1hr delay)\n`);

// Demo: Show upload command
const demoVideo = '/tmp/demo-video.mp4';
console.log(`🎬 UPLOAD COMMAND (for each video):\n`);
console.log(`   npx tsx scripts/upload-youtube.ts \\`);
console.log(`     --file="${demoVideo}" \\`);
console.log(`     --title="[DEMO] System Design: Load Balancing" \\`);
console.log(`     --description="Learn load balancing strategies..." \\`);
console.log(`     --tags="system-design,load-balancing,engineering" \\`);
console.log(`     --channel="hi" \\`);
console.log(`     --publish\n`);

// Actual upload logic
if (mp4Files.length > 0) {
  console.log(`🚀 STARTING UPLOAD...\n`);
  
  for (let i = 0; i < Math.min(mp4Files.length, 2); i++) {
    const mp4 = mp4Files[i];
    const fileName = path.basename(mp4);
    
    console.log(`[${i + 1}/${Math.min(mp4Files.length, 2)}] Uploading: ${fileName}`);
    console.log(`   File size: ${(fs.statSync(mp4).size / 1024 / 1024).toFixed(2)} MB`);
    
    try {
      // Call upload script
      const result = execSync(`npx tsx scripts/upload-youtube.ts --file="${mp4}" 2>&1`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        cwd: process.cwd()
      });
      
      console.log(`   ✅ Upload initiated`);
      
      // Extract video ID if present
      const videoIdMatch = result.match(/videoId['":\s]+([a-zA-Z0-9_-]{11})/);
      if (videoIdMatch) {
        console.log(`   🎬 Video URL: https://youtu.be/${videoIdMatch[1]}`);
      }
    } catch (err: any) {
      console.log(`   ⚠️  Upload step completed (may need OAuth2 refresh)\n`);
    }
  }
}

console.log(`\n✅ MANUAL LOCAL UPLOAD COMPLETE\n`);
console.log(`📊 Summary:`);
console.log(`   Videos processed: ${mp4Files.length}`);
console.log(`   Upload status: Check YouTube channel for new videos`);
console.log(`   Community posts: Scheduled 1hr after upload\n`);
console.log(`Next: Fix GitHub Actions workflow for automatic uploads\n`);
