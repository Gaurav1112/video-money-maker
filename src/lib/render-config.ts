/**
 * RENDER CONFIGURATION (P0 FIX #3, #4)
 * - P0-3: Bitrate cap (prevent >100MB files)
 * - P0-4: Environment-based paths (CI/CD portable)
 */

import path from 'path';
import os from 'os';

const OUTPUT_DIR = process.env.VIDEO_OUTPUT_DIR || path.join(os.homedir(), 'guru-sishya-uploads');
const CACHE_DIR = process.env.CACHE_DIR || path.join(process.cwd(), '.render-cache');
const ASSETS_DIR = process.env.ASSETS_DIR || path.join(process.cwd(), 'assets');
const BROLL_DIR = process.env.BROLL_DIR || path.join(process.cwd(), 'public/broll/cache');

export const RENDER_CONFIG = {
  // Video quality settings
  quality: {
    resolution: '1080x1920', // Vertical (shorts/reels format)
    fps: 30,
    codec: 'h264',
    preset: 'medium', // faster for speed, slower for quality
  },
  
  // 🔥 BITRATE CAP (P0-3 FIX)
  // YouTube: rejects >100MB for shorts
  // With 180s video: max bitrate = ~1400 kbps for 30 MB output
  bitrate: {
    video: '1200k',   // Main video bitrate
    audio: '128k',    // Audio bitrate
    maxFileSize: 50,  // MB - safety margin below 100MB limit
  },
  
  // 🔥 ENVIRONMENT PATHS (P0-4 FIX)
  paths: {
    output: OUTPUT_DIR,
    cache: CACHE_DIR,
    assets: ASSETS_DIR,
    broll: BROLL_DIR,
    temp: path.join(CACHE_DIR, 'temp'),
  },
  
  // Rendering options
  render: {
    timeout: 600000, // 10 min max per video
    retries: 2,
    concurrency: 1, // Single render at a time to prevent CPU thrashing
  },
};

export function getOutputPath(videoName: string): string {
  return path.join(RENDER_CONFIG.paths.output, `${videoName}.mp4`);
}

export function getCachePath(key: string): string {
  return path.join(RENDER_CONFIG.paths.cache, key);
}

export function validateRenderConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check output dir writable
  try {
    require('fs').accessSync(RENDER_CONFIG.paths.output, require('fs').constants.W_OK);
  } catch (e: any) {
    errors.push(`Output directory not writable: ${RENDER_CONFIG.paths.output}`);
  }
  
  // Check assets exist
  if (!require('fs').existsSync(RENDER_CONFIG.paths.assets)) {
    errors.push(`Assets directory missing: ${RENDER_CONFIG.paths.assets}`);
  }
  
  // Validate bitrate settings
  const maxBitrate = parseInt(RENDER_CONFIG.bitrate.video);
  const estimatedFileSizeMB = (maxBitrate * 180) / 8 / 1000; // Rough estimate
  if (estimatedFileSizeMB > RENDER_CONFIG.bitrate.maxFileSize) {
    errors.push(`Bitrate too high: estimated ${estimatedFileSizeMB}MB > ${RENDER_CONFIG.bitrate.maxFileSize}MB limit`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export const ENV_VARS = {
  // User can override these
  VIDEO_OUTPUT_DIR: 'Where rendered MP4s go',
  CACHE_DIR: 'Temporary render files',
  ASSETS_DIR: 'Audio/image assets',
  BROLL_DIR: 'B-roll stock footage',
  
  // GitHub Actions usage:
  // export VIDEO_OUTPUT_DIR=$GITHUB_WORKSPACE/output
  // export CACHE_DIR=$RUNNER_TEMP/cache
};
