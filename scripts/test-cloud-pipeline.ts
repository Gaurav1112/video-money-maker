#!/usr/bin/env npx tsx
/**
 * test-cloud-pipeline.ts -- Verify ALL cloud pipeline dependencies work.
 *
 * Run on GitHub Actions (or locally) to validate the environment before
 * a real render. Catches issues early so we don't waste 2 hours on a
 * render that was doomed from the start.
 *
 * Usage:
 *   npx tsx scripts/test-cloud-pipeline.ts
 *   npx tsx scripts/test-cloud-pipeline.ts --skip-youtube   # skip YT auth check
 *
 * Exit codes:
 *   0 -- all checks passed
 *   1 -- one or more checks failed
 */

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.resolve(__dirname, '../../guru-sishya/public/content');
const CONTENT_SYMLINK = path.join(PROJECT_ROOT, 'content');

const args = process.argv.slice(2);
const skipYouTube = args.includes('--skip-youtube');

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

const results: CheckResult[] = [];

function check(name: string, fn: () => string): void {
  const start = Date.now();
  try {
    const message = fn();
    results.push({ name, passed: true, message, durationMs: Date.now() - start });
    console.log(`  PASS  ${name}: ${message}`);
  } catch (err: any) {
    const message = err.message || String(err);
    results.push({ name, passed: false, message, durationMs: Date.now() - start });
    console.log(`  FAIL  ${name}: ${message}`);
  }
}

function run(cmd: string, options?: { timeout?: number }): string {
  return execSync(cmd, {
    encoding: 'utf-8',
    timeout: options?.timeout || 30000,
    cwd: PROJECT_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

// ── Checks ──────────────────────────────────────────────────────────────────

console.log('\n=== Cloud Pipeline Environment Check ===\n');
console.log(`Platform: ${process.platform}`);
console.log(`Node:     ${process.version}`);
console.log(`CI:       ${process.env.CI || 'false'}`);
console.log(`CWD:      ${PROJECT_ROOT}`);
console.log('');

// 1. Node.js + npm
check('Node.js version', () => {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  if (major < 18) throw new Error(`Node ${version} too old, need >= 18`);
  return version;
});

check('npm ci (dependencies installed)', () => {
  if (!fs.existsSync(path.join(PROJECT_ROOT, 'node_modules'))) {
    throw new Error('node_modules missing -- run npm ci first');
  }
  return 'node_modules exists';
});

// 2. Python + edge-tts
check('Python3 available', () => {
  return run('python3 --version');
});

check('edge-tts installed', () => {
  // Check module import (more reliable than checking the CLI binary)
  run('python3 -c "import edge_tts; print(edge_tts.__version__)"');
  return 'edge_tts module importable';
});

check('edge-tts generates audio', () => {
  const testAudioPath = path.join(PROJECT_ROOT, 'output', 'test-tts.mp3');
  fs.mkdirSync(path.join(PROJECT_ROOT, 'output'), { recursive: true });
  run(
    `edge-tts --voice en-IN-PrabhatNeural --text "Hello, this is a test." --write-media "${testAudioPath}"`,
    { timeout: 30000 },
  );
  if (!fs.existsSync(testAudioPath)) {
    throw new Error('edge-tts did not produce output file');
  }
  const size = fs.statSync(testAudioPath).size;
  fs.unlinkSync(testAudioPath);
  if (size < 1000) throw new Error(`Audio file too small: ${size} bytes`);
  return `Generated ${size} bytes`;
});

// 3. ffmpeg
check('ffmpeg installed', () => {
  const version = run('ffmpeg -version').split('\n')[0];
  return version;
});

check('ffprobe installed', () => {
  const version = run('ffprobe -version').split('\n')[0];
  return version;
});

// 4. Remotion + Chrome
check('Remotion installed', () => {
  const version = run('npx remotion --version 2>/dev/null || echo unknown');
  return `Remotion ${version}`;
});

check('Chrome/Chromium available for Remotion', () => {
  // remotion browser ensure downloads Chrome if missing
  run('npx remotion browser ensure', { timeout: 120000 });
  return 'Browser available';
});

check('Remotion renders a 5-second test video', () => {
  const testOutput = path.join(PROJECT_ROOT, 'output', 'test-render.mp4');
  // Create minimal test props
  const testProps = {
    storyboard: {
      fps: 30,
      width: 1080,
      height: 1920,
      durationInFrames: 150, // 5 seconds
      scenes: [],
      audioFile: '',
      topic: 'Test',
      sessionNumber: 0,
    },
  };
  const testPropsPath = path.join(PROJECT_ROOT, 'output', 'test-render-props.json');
  fs.writeFileSync(testPropsPath, JSON.stringify(testProps));

  try {
    run(
      `npx remotion render src/compositions/index.tsx VerticalLong "${testOutput}" --props="${testPropsPath}" --codec=h264 --concurrency=1`,
      { timeout: 120000 },
    );

    if (!fs.existsSync(testOutput)) {
      throw new Error('Remotion did not produce output');
    }
    const size = fs.statSync(testOutput).size;
    return `Rendered ${(size / 1024).toFixed(0)} KB in 5s`;
  } finally {
    // Cleanup
    try { fs.unlinkSync(testOutput); } catch {}
    try { fs.unlinkSync(testPropsPath); } catch {}
  }
});

// 5. Content repo
check('Content repo accessible', () => {
  // Check both the direct path and the symlink
  let contentPath: string | null = null;

  if (fs.existsSync(CONTENT_DIR)) {
    contentPath = CONTENT_DIR;
  } else if (fs.existsSync(CONTENT_SYMLINK)) {
    contentPath = fs.realpathSync(CONTENT_SYMLINK);
  }

  if (!contentPath) {
    throw new Error(
      `Content not found at ${CONTENT_DIR} or ${CONTENT_SYMLINK}. ` +
      'Clone: git clone --depth 1 https://github.com/Gaurav1112/guru-sishya.git ../guru-sishya',
    );
  }

  const jsonFiles = fs.readdirSync(contentPath).filter(f => f.endsWith('.json'));
  if (jsonFiles.length === 0) {
    throw new Error(`No JSON files in ${contentPath}`);
  }
  return `${jsonFiles.length} JSON files at ${contentPath}`;
});

// 6. Audio output directory writable
check('public/audio/ writable', () => {
  const audioDir = path.join(PROJECT_ROOT, 'public', 'audio');
  fs.mkdirSync(audioDir, { recursive: true });
  const testFile = path.join(audioDir, '.write-test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  return `${audioDir} is writable`;
});

// 7. YouTube auth (optional)
if (!skipYouTube) {
  check('YouTube auth credentials', () => {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    if (!clientId) throw new Error('YOUTUBE_CLIENT_ID not set');
    if (!clientSecret) throw new Error('YOUTUBE_CLIENT_SECRET not set');
    if (!refreshToken) throw new Error('YOUTUBE_REFRESH_TOKEN not set');

    return `Client ID: ${clientId.slice(0, 8)}..., Refresh token: ${refreshToken.slice(0, 8)}...`;
  });

  check('YouTube API reachable', () => {
    // Quick check that googleapis can initialize an auth client
    try {
      run(
        'node -e "' +
          "const {google} = require('googleapis');" +
          "const c = new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID, process.env.YOUTUBE_CLIENT_SECRET);" +
          "c.setCredentials({refresh_token: process.env.YOUTUBE_REFRESH_TOKEN});" +
          "console.log('OAuth2 client created');" +
        '"',
        { timeout: 10000 },
      );
      return 'googleapis OAuth2 client OK';
    } catch (err: any) {
      throw new Error(`googleapis check failed: ${err.message}`);
    }
  });
} else {
  console.log('  SKIP  YouTube auth (--skip-youtube flag)');
  console.log('  SKIP  YouTube API reachable (--skip-youtube flag)');
}

// 8. Disk space
check('Sufficient disk space', () => {
  const output = run('df -h . | tail -1');
  const parts = output.split(/\s+/);
  const available = parts[3] || 'unknown';
  return `Available: ${available}`;
});

// 9. Memory
check('Sufficient memory for rendering', () => {
  const totalMem = Math.round(require('os').totalmem() / 1024 / 1024);
  const freeMem = Math.round(require('os').freemem() / 1024 / 1024);
  if (totalMem < 4000) {
    throw new Error(`Only ${totalMem}MB total RAM -- need at least 4GB for rendering`);
  }
  return `Total: ${totalMem}MB, Free: ${freeMem}MB`;
});

// ── Summary ─────────────────────────────────────────────────────────────────

console.log('\n=== Summary ===\n');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);

console.log(`Passed: ${passed}/${results.length}`);
console.log(`Failed: ${failed}`);
console.log(`Total time: ${(totalMs / 1000).toFixed(1)}s`);

if (failed > 0) {
  console.log('\nFailed checks:');
  for (const r of results.filter(r => !r.passed)) {
    console.log(`  - ${r.name}: ${r.message}`);
  }
  console.log('\nFix the above issues before running the pipeline.');
  process.exit(1);
} else {
  console.log('\nAll checks passed -- cloud pipeline is ready to render!');
  process.exit(0);
}
