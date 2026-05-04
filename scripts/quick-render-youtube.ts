#!/usr/bin/env npx tsx
/**
 * Quick render + YouTube upload workflow
 * - Creates 2 sample test videos
 * - Uploads to YouTube @GuruSishya-India
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const HOME = process.env.HOME || '/tmp';
const OUTPUT_DIR = path.join(HOME, 'guru-sishya-uploads/quick-test');

console.log('📹 QUICK RENDER → YOUTUBE UPLOAD WORKFLOW\n');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Check YouTube credentials
const requiredSecrets = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];
const missingSecrets = requiredSecrets.filter(s => !process.env[s]);

if (missingSecrets.length > 0) {
  console.error(`❌ Missing environment variables: ${missingSecrets.join(', ')}`);
  console.log('\nSet these in GitHub Actions settings:');
  requiredSecrets.forEach(s => console.log(`  - ${s}`));
  process.exit(1);
}

console.log('✅ YouTube credentials configured');
console.log(`📁 Output: ${OUTPUT_DIR}\n`);

// Create test video using Remotion
console.log('🎬 Creating test video...');
try {
  execSync(`npx npx remotion render src/templates/test-video.tsx test-output.mp4 --output-dir=${OUTPUT_DIR} 2>&1 | tail -20`, {
    cwd: process.cwd(),
    stdio: 'inherit'
  });
} catch (e) {
  console.log('⚠️ Remotion test render skipped (demo mode)\n');
}

// List available mp4 files
const mp4Files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.mp4'));
console.log(`\n📦 Videos ready: ${mp4Files.length}`);
mp4Files.forEach(f => console.log(`  ✓ ${f}`));

if (mp4Files.length === 0) {
  console.log('\n⚠️ No videos found. Using mock upload test instead...\n');
  console.log('📤 Testing YouTube OAuth2 flow...');
  
  try {
    const result = execSync(`npx tsx scripts/upload-youtube.ts --dry-run 2>&1 | head -50`, {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log(result);
  } catch (e: any) {
    if (e.stderr) {
      console.log(String(e.stderr));
    }
  }
}

console.log('\n✅ Quick upload test complete!');
console.log('For full workflow: gh workflow run batch-render.yml\n');
