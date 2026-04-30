#!/usr/bin/env npx tsx
/**
 * sync-to-drive.ts — Expert 3: Sanjay Gupta — Upload Queue with Google Drive Staging
 *
 * Manages the lifecycle: staged -> uploaded -> archived.
 * Syncs the staging folder to Google Drive via rclone as backup.
 * After successful YouTube upload, archives files locally.
 *
 * Usage:
 *   npx tsx scripts/sync-to-drive.ts                  # Sync staging to Drive + show status
 *   npx tsx scripts/sync-to-drive.ts --sync           # Only sync to Google Drive
 *   npx tsx scripts/sync-to-drive.ts --archive <topic> <session>  # Archive after upload
 *   npx tsx scripts/sync-to-drive.ts --status         # Show staging/archive status
 *   npx tsx scripts/sync-to-drive.ts --setup          # Print rclone setup instructions
 *   npx tsx scripts/sync-to-drive.ts --verify         # Verify rclone is configured
 *
 * Prerequisites (one-time setup):
 *   1. brew install rclone
 *   2. rclone config  (create remote named "gdrive")
 *   3. Set RCLONE_REMOTE=gdrive (or it defaults to "gdrive")
 *
 * Folder structure:
 *   ~/guru-sishya-uploads/          <- staging (pre-upload)
 *     manifest.json
 *     kafka/session-1/long.mp4, ...
 *   ~/guru-sishya-archive/          <- post-upload archive
 *     kafka/session-1/long.mp4, ...
 *   Google Drive:
 *     guru-sishya-uploads/          <- backup mirror of staging
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ─── Paths ──────────────────────────────────────────────────────────────────

const HOME = process.env.HOME || '/tmp';
const STAGING_BASE = path.join(HOME, 'guru-sishya-uploads');
const ARCHIVE_BASE = path.join(HOME, 'guru-sishya-archive');
const MANIFEST_PATH = path.join(STAGING_BASE, 'manifest.json');
const LOG_DIR = path.join(HOME, 'guru-sishya-logs');
const RCLONE_REMOTE = process.env.RCLONE_REMOTE || 'gdrive';
const DRIVE_FOLDER = 'guru-sishya-uploads';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ManifestEntry {
  topic: string;
  session: number;
  status: string;
  completedAt: string | null;
  files: {
    long?: string;
    verticalFull?: string;
    parts: string[];
    thumbnail?: string;
    metadata?: string;
    partMetadata: string[];
  };
}

interface Manifest {
  version: number;
  lastUpdated: string;
  entries: Record<string, ManifestEntry>;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function log(msg: string): void {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  ensureDir(LOG_DIR);
  fs.appendFileSync(path.join(LOG_DIR, 'sync-to-drive.log'), line + '\n');
}

function loadManifest(): Manifest {
  if (fs.existsSync(MANIFEST_PATH)) {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  }
  return { version: 1, lastUpdated: '', entries: {} };
}

function saveManifest(manifest: Manifest): void {
  manifest.lastUpdated = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

function isRcloneInstalled(): boolean {
  try {
    execSync('which rclone', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function isRcloneConfigured(): boolean {
  try {
    const output = execSync('rclone listremotes', { encoding: 'utf-8', stdio: 'pipe' });
    return output.includes(`${RCLONE_REMOTE}:`);
  } catch {
    return false;
  }
}

function getDirSize(dir: string): string {
  if (!fs.existsSync(dir)) return '0 MB';
  try {
    const output = execSync(`du -sh "${dir}" 2>/dev/null`, { encoding: 'utf-8', stdio: 'pipe' });
    return output.split('\t')[0].trim();
  } catch {
    return '?';
  }
}

// ─── Setup Instructions ─────────────────────────────────────────────────────

function printSetup(): void {
  console.log('');
  console.log('=== rclone Setup for Google Drive ===');
  console.log('');
  console.log('Step 1: Install rclone');
  console.log('  brew install rclone');
  console.log('');
  console.log('Step 2: Configure Google Drive remote');
  console.log('  rclone config');
  console.log('');
  console.log('  When prompted:');
  console.log('    n) New remote');
  console.log('    name> gdrive');
  console.log('    Storage> drive          (Google Drive)');
  console.log('    client_id>              (leave blank for default)');
  console.log('    client_secret>          (leave blank for default)');
  console.log('    scope> 1                (Full access)');
  console.log('    root_folder_id>         (leave blank)');
  console.log('    service_account_file>   (leave blank)');
  console.log('    Edit advanced config?   n');
  console.log('    Use auto config?        y');
  console.log('    (browser opens for OAuth)');
  console.log('    y) Yes this is OK');
  console.log('    q) Quit config');
  console.log('');
  console.log('Step 3: Verify setup');
  console.log('  rclone ls gdrive: --max-depth 1');
  console.log('');
  console.log('Step 4: Test sync');
  console.log('  npx tsx scripts/sync-to-drive.ts --verify');
  console.log('');
  console.log('Step 5: Run first sync');
  console.log('  npx tsx scripts/sync-to-drive.ts --sync');
  console.log('');
  console.log('Optional: Auto-sync via launchd (see scripts/launchd/ plists)');
  console.log('');
}

// ─── Verify Setup ───────────────────────────────────────────────────────────

function verifySetup(): boolean {
  console.log('');
  console.log('=== Verifying rclone Setup ===');
  console.log('');

  let ok = true;

  // Check rclone installed
  if (isRcloneInstalled()) {
    const version = execSync('rclone version --check 2>/dev/null || rclone version', {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).split('\n')[0];
    console.log(`  [OK] rclone installed: ${version.trim()}`);
  } else {
    console.log('  [FAIL] rclone not installed. Run: brew install rclone');
    ok = false;
  }

  // Check remote configured
  if (isRcloneConfigured()) {
    console.log(`  [OK] Remote "${RCLONE_REMOTE}" configured`);
  } else {
    console.log(`  [FAIL] Remote "${RCLONE_REMOTE}" not found. Run: rclone config`);
    ok = false;
  }

  // Check staging directory
  if (fs.existsSync(STAGING_BASE)) {
    console.log(`  [OK] Staging dir exists: ${STAGING_BASE} (${getDirSize(STAGING_BASE)})`);
  } else {
    console.log(`  [WARN] Staging dir does not exist yet: ${STAGING_BASE}`);
  }

  // Check archive directory
  if (fs.existsSync(ARCHIVE_BASE)) {
    console.log(`  [OK] Archive dir exists: ${ARCHIVE_BASE} (${getDirSize(ARCHIVE_BASE)})`);
  } else {
    console.log(`  [INFO] Archive dir does not exist yet (will be created on first archive)`);
  }

  console.log('');
  if (ok) {
    console.log('  Setup looks good. Run --sync to start syncing.');
  } else {
    console.log('  Run --setup for configuration instructions.');
  }
  console.log('');
  return ok;
}

// ─── Sync to Google Drive ───────────────────────────────────────────────────

function syncToDrive(): void {
  log('Starting Google Drive sync...');

  if (!fs.existsSync(STAGING_BASE)) {
    log('Staging directory does not exist. Nothing to sync.');
    return;
  }

  if (!isRcloneInstalled()) {
    log('ERROR: rclone not installed. Run: brew install rclone');
    return;
  }

  if (!isRcloneConfigured()) {
    log(`ERROR: rclone remote "${RCLONE_REMOTE}" not configured. Run: rclone config`);
    return;
  }

  const cmd = [
    'rclone sync',
    `"${STAGING_BASE}"`,
    `"${RCLONE_REMOTE}:${DRIVE_FOLDER}"`,
    '--progress',
    '--transfers=4',
    '--checkers=8',
    '--contimeout=60s',
    '--timeout=300s',
    '--retries=3',
    '--low-level-retries=10',
    '--stats=10s',
    '--log-level=NOTICE',
    `--log-file="${path.join(LOG_DIR, 'rclone-sync.log')}"`,
    // Exclude temp files
    '--exclude="*.tmp"',
    '--exclude=".DS_Store"',
    '--exclude="batch-state.json"',
  ].join(' ');

  log(`Running: rclone sync ${STAGING_BASE} -> ${RCLONE_REMOTE}:${DRIVE_FOLDER}`);

  try {
    execSync(cmd, { stdio: 'inherit', timeout: 30 * 60 * 1000 });
    log('Google Drive sync complete.');
  } catch (err) {
    log(`ERROR: Google Drive sync failed: ${(err as Error).message}`);
  }
}

// ─── Archive After Upload ───────────────────────────────────────────────────

function archiveSession(topic: string, session: number): void {
  const key = `${topic}:${session}`;
  const manifest = loadManifest();
  const entry = manifest.entries[key];

  if (!entry) {
    log(`No manifest entry for ${key}. Cannot archive.`);
    return;
  }

  const stagingDir = path.join(STAGING_BASE, topic, `session-${session}`);
  const archiveDir = path.join(ARCHIVE_BASE, topic, `session-${session}`);

  if (!fs.existsSync(stagingDir)) {
    log(`Staging directory does not exist: ${stagingDir}`);
    return;
  }

  log(`Archiving ${key}...`);
  ensureDir(archiveDir);

  // Move all files from staging to archive
  const files = fs.readdirSync(stagingDir);
  for (const file of files) {
    const src = path.join(stagingDir, file);
    const dest = path.join(archiveDir, file);
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
    log(`  Moved: ${file}`);
  }

  // Remove empty staging directory
  try {
    fs.rmdirSync(stagingDir);
    // Try to remove parent topic dir if empty
    const topicDir = path.join(STAGING_BASE, topic);
    const remaining = fs.readdirSync(topicDir);
    if (remaining.length === 0) fs.rmdirSync(topicDir);
  } catch { /* dir not empty, fine */ }

  // Update manifest
  entry.status = 'uploaded';
  saveManifest(manifest);

  log(`Archived ${key} to ${archiveDir}`);
}

// ─── Status ─────────────────────────────────────────────────────────────────

function showStatus(): void {
  const manifest = loadManifest();

  let staged = 0;
  let uploaded = 0;
  let failed = 0;
  let totalSize = 0;

  const stagedEntries: Array<{ key: string; status: string; completedAt: string | null }> = [];

  for (const [key, entry] of Object.entries(manifest.entries)) {
    if (entry.status === 'staged') {
      staged++;
      stagedEntries.push({ key, status: entry.status, completedAt: entry.completedAt });
    }
    if (entry.status === 'uploaded') uploaded++;
    if (entry.status === 'failed') failed++;
  }

  console.log('');
  console.log('=== Staging & Archive Status ===');
  console.log('');
  console.log(`  Staging dir:  ${STAGING_BASE} (${getDirSize(STAGING_BASE)})`);
  console.log(`  Archive dir:  ${ARCHIVE_BASE} (${getDirSize(ARCHIVE_BASE)})`);
  console.log('');
  console.log(`  Staged (ready for upload):  ${staged}`);
  console.log(`  Uploaded (archived):        ${uploaded}`);
  console.log(`  Failed:                     ${failed}`);
  console.log('');

  if (stagedEntries.length > 0) {
    console.log('  Ready for upload:');
    for (const e of stagedEntries) {
      const date = e.completedAt ? new Date(e.completedAt).toLocaleDateString() : '?';
      console.log(`    ${e.key} (staged ${date})`);
    }
    console.log('');
  }

  // Check Drive sync status
  if (isRcloneInstalled() && isRcloneConfigured()) {
    console.log(`  Google Drive:  ${RCLONE_REMOTE}:${DRIVE_FOLDER}`);
    try {
      const output = execSync(
        `rclone size "${RCLONE_REMOTE}:${DRIVE_FOLDER}" 2>/dev/null`,
        { encoding: 'utf-8', stdio: 'pipe', timeout: 15000 },
      );
      console.log(`  Drive size:    ${output.trim()}`);
    } catch {
      console.log('  Drive size:    (could not query)');
    }
  } else {
    console.log('  Google Drive:  Not configured (run --setup)');
  }
  console.log('');
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--setup')) {
    printSetup();
    return;
  }

  if (args.includes('--verify')) {
    verifySetup();
    return;
  }

  if (args.includes('--archive')) {
    const topicIdx = args.indexOf('--archive') + 1;
    const sessionIdx = topicIdx + 1;
    const topic = args[topicIdx];
    const session = parseInt(args[sessionIdx], 10);

    if (!topic || isNaN(session)) {
      console.error('Usage: --archive <topic> <session>');
      process.exit(1);
    }
    archiveSession(topic, session);
    return;
  }

  if (args.includes('--status')) {
    showStatus();
    return;
  }

  if (args.includes('--sync')) {
    syncToDrive();
    return;
  }

  // Default: sync + status
  syncToDrive();
  showStatus();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
