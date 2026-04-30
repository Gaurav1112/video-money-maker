#!/usr/bin/env npx tsx
/**
 * verify-publish-setup.ts — Pre-flight check for the auto-publish pipeline
 *
 * Verifies that all required credentials, files, and configs are in place
 * before enabling the automated pipeline.
 *
 * Usage:
 *   npx tsx scripts/verify-publish-setup.ts
 *   npx tsx scripts/verify-publish-setup.ts --check-videos   # also verify video files exist
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const CHECK_MARK = '[OK]';
const CROSS_MARK = '[FAIL]';
const WARN_MARK = '[WARN]';

let errors = 0;
let warnings = 0;

function check(label: string, condition: boolean, errorMsg?: string): void {
  if (condition) {
    console.log(`  ${CHECK_MARK} ${label}`);
  } else {
    console.log(`  ${CROSS_MARK} ${label}${errorMsg ? ` — ${errorMsg}` : ''}`);
    errors++;
  }
}

function warn(label: string, condition: boolean, warnMsg?: string): void {
  if (condition) {
    console.log(`  ${CHECK_MARK} ${label}`);
  } else {
    console.log(`  ${WARN_MARK} ${label}${warnMsg ? ` — ${warnMsg}` : ''}`);
    warnings++;
  }
}

// ─── Config Files ──────────────────────────────────────────────────────────

console.log('\n=== Config Files ===');

const configDir = path.resolve(__dirname, '../config');
check('config/publish-queue.json exists',
  fs.existsSync(path.join(configDir, 'publish-queue.json')),
  'Run: npx tsx scripts/generate-publish-queue.ts');

check('config/topic-queue.json exists',
  fs.existsSync(path.join(configDir, 'topic-queue.json')));

check('config/publish-config.json exists',
  fs.existsSync(path.join(configDir, 'publish-config.json')));

check('config/publish-history.json exists',
  fs.existsSync(path.join(configDir, 'publish-history.json')));

// Check publish-queue has entries
const queuePath = path.join(configDir, 'publish-queue.json');
if (fs.existsSync(queuePath)) {
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
  check(`publish-queue.json has entries (${queue.entries?.length || 0})`,
    (queue.entries?.length || 0) > 0,
    'Run: npx tsx scripts/generate-publish-queue.ts');
}

// ─── Environment Variables ─────────────────────────────────────────────────

console.log('\n=== Environment / Secrets ===');
console.log('  (These should be set as GitHub Secrets for CI)');

warn('YOUTUBE_CLIENT_ID',
  !!process.env.YOUTUBE_CLIENT_ID,
  'Set in GitHub Secrets');

warn('YOUTUBE_CLIENT_SECRET',
  !!process.env.YOUTUBE_CLIENT_SECRET,
  'Set in GitHub Secrets');

warn('YOUTUBE_REFRESH_TOKEN',
  !!process.env.YOUTUBE_REFRESH_TOKEN,
  'Run: npx tsx scripts/auth-youtube.ts to get token, then add to GitHub Secrets');

warn('INSTAGRAM_ACCESS_TOKEN',
  !!process.env.INSTAGRAM_ACCESS_TOKEN,
  'Get from Facebook Developer portal, then add to GitHub Secrets');

warn('INSTAGRAM_BUSINESS_ID',
  !!process.env.INSTAGRAM_BUSINESS_ID,
  'Get from Graph API Explorer');

// Local token file (for local usage)
const tokenPath = path.resolve(__dirname, '../.youtube-token.json');
warn('.youtube-token.json exists (local auth)',
  fs.existsSync(tokenPath),
  'Run: npx tsx scripts/auth-youtube.ts');

// ─── Video Files (optional deep check) ─────────────────────────────────────

const checkVideos = process.argv.includes('--check-videos');

if (checkVideos) {
  console.log('\n=== Video Files ===');
  const base = path.join(process.env.HOME || '~', 'Documents', 'guru-sishya');

  if (!fs.existsSync(base)) {
    console.log(`  ${CROSS_MARK} Base directory not found: ${base}`);
    errors++;
  } else {
    const topics = fs.readdirSync(base).filter(f =>
      fs.statSync(path.join(base, f)).isDirectory() && !f.startsWith('.'),
    );
    console.log(`  Found ${topics.length} topic directories in ${base}`);

    let totalLong = 0;
    let totalVertical = 0;
    let totalMetadata = 0;

    for (const topic of topics) {
      const topicDir = path.join(base, topic);
      const sessions = fs.readdirSync(topicDir)
        .filter(f => f.startsWith('session-') && fs.statSync(path.join(topicDir, f)).isDirectory());

      for (const session of sessions) {
        const sessionDir = path.join(topicDir, session);
        const longDir = path.join(sessionDir, 'long');
        const verticalDir = path.join(sessionDir, 'vertical');
        const verticalPartsDir = path.join(sessionDir, 'vertical-parts');
        const metadataFile = path.join(sessionDir, 'metadata.json');

        if (fs.existsSync(longDir)) {
          const longFiles = fs.readdirSync(longDir).filter(f => f.endsWith('.mp4'));
          totalLong += longFiles.length;
        }

        if (fs.existsSync(verticalDir) || fs.existsSync(verticalPartsDir)) {
          const dir = fs.existsSync(verticalPartsDir) ? verticalPartsDir : verticalDir;
          const vertFiles = fs.readdirSync(dir).filter(f => f.endsWith('.mp4'));
          totalVertical += vertFiles.length;
        }

        if (fs.existsSync(metadataFile)) totalMetadata++;
      }
    }

    console.log(`  ${CHECK_MARK} Long-form videos: ${totalLong}`);
    console.log(`  ${CHECK_MARK} Vertical videos: ${totalVertical}`);
    console.log(`  ${CHECK_MARK} Metadata files: ${totalMetadata}`);
  }
}

// ─── GitHub CLI ────────────────────────────────────────────────────────────

console.log('\n=== Tools ===');

try {
  const ghVersion = execSync('gh --version 2>/dev/null', { encoding: 'utf-8' }).trim().split('\n')[0];
  check(`GitHub CLI: ${ghVersion}`, true);
} catch {
  warn('GitHub CLI (gh)', false, 'Install: brew install gh');
}

try {
  const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
  check(`Node.js: ${nodeVersion}`, true);
} catch {
  check('Node.js', false, 'Install Node.js 20+');
}

try {
  execSync('aws --version 2>/dev/null', { encoding: 'utf-8' });
  check('AWS CLI (for R2 uploads)', true);
} catch {
  warn('AWS CLI (for R2 uploads)', false, 'Install: brew install awscli (needed for Instagram uploads via R2)');
}

// ─── Workflow File ─────────────────────────────────────────────────────────

console.log('\n=== Workflow ===');

const workflowPath = path.resolve(__dirname, '../.github/workflows/auto-publish.yml');
check('auto-publish.yml exists', fs.existsSync(workflowPath));

// ─── Summary ───────────────────────────────────────────────────────────────

console.log('\n=== Summary ===');

if (errors === 0 && warnings === 0) {
  console.log('  All checks passed! Pipeline is ready.');
} else if (errors === 0) {
  console.log(`  ${warnings} warning(s), no errors. Pipeline should work for configured platforms.`);
} else {
  console.log(`  ${errors} error(s), ${warnings} warning(s). Fix errors before enabling the pipeline.`);
}

console.log('\n=== Required GitHub Secrets ===');
console.log('  YOUTUBE_CLIENT_ID          — Google Cloud OAuth2 client ID');
console.log('  YOUTUBE_CLIENT_SECRET      — Google Cloud OAuth2 client secret');
console.log('  YOUTUBE_REFRESH_TOKEN      — From: npx tsx scripts/auth-youtube.ts');
console.log('  INSTAGRAM_ACCESS_TOKEN     — Long-lived token from Facebook Developer portal');
console.log('  INSTAGRAM_BUSINESS_ID      — Instagram Business account ID');
console.log('  SLACK_WEBHOOK_URL          — (optional) Slack incoming webhook for notifications');
console.log('  R2_ACCOUNT_ID              — (optional) Cloudflare R2 for Instagram video hosting');
console.log('  R2_ACCESS_KEY_ID           — (optional) R2 access key');
console.log('  R2_SECRET_ACCESS_KEY       — (optional) R2 secret key');
console.log('  R2_BUCKET_NAME             — (optional) R2 bucket name');
console.log('  R2_PUBLIC_URL              — (optional) R2 public URL prefix');
console.log('');

process.exit(errors > 0 ? 1 : 0);
