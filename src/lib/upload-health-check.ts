/**
 * UPLOAD HEALTH CHECK
 * Pre-flight checks before starting upload
 * Fails fast and reports blockers clearly
 */

import * as fs from 'fs';
import * as https from 'https';

export interface HealthCheckResult {
  healthy: boolean;
  checks: {
    youtubeReachable: boolean;
    tokenValid: boolean;
    videoReadable: boolean;
    videoSize: boolean;
    errors: string[];
  };
}

export async function isYouTubeReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.youtube.com',
      port: 443,
      path: '/health',
      method: 'HEAD',
      timeout: 5000,
    };
    
    const req = https.request(options, (res) => {
      resolve(res.statusCode !== undefined);
      res.resume();
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

export function isVideoFileReadable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function isVideoSizeValid(filePath: string, maxMbytes: number = 100): boolean {
  try {
    const stats = fs.statSync(filePath);
    const sizeInMb = stats.size / (1024 * 1024);
    return sizeInMb <= maxMbytes && sizeInMb > 0;
  } catch {
    return false;
  }
}

export async function validateTokenRefresh(
  clientId: string | undefined,
  clientSecret: string | undefined,
  refreshToken: string | undefined
): Promise<boolean> {
  if (!clientId || !clientSecret || !refreshToken) {
    return false;
  }
  
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(10000),
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

export async function runHealthChecks(
  videoFile: string,
  clientId?: string,
  clientSecret?: string,
  refreshToken?: string,
  maxFileSize?: number
): Promise<HealthCheckResult> {
  const errors: string[] = [];
  
  // Check YouTube reachability
  const youtubeReachable = await isYouTubeReachable();
  if (!youtubeReachable) {
    errors.push('YouTube API not reachable');
  }
  
  // Check token validity
  const tokenValid = await validateTokenRefresh(clientId, clientSecret, refreshToken);
  if (!tokenValid) {
    errors.push('OAuth2 token validation failed or credentials incomplete');
  }
  
  // Check video file readability
  const videoReadable = isVideoFileReadable(videoFile);
  if (!videoReadable) {
    errors.push(`Video file not readable: ${videoFile}`);
  }
  
  // Check video file size
  const videoSize = videoReadable && isVideoSizeValid(videoFile, maxFileSize);
  if (videoReadable && !videoSize) {
    const sizeInMb = fs.statSync(videoFile).size / (1024 * 1024);
    const maxSize = maxFileSize || 100;
    errors.push(`Video file size (${sizeInMb.toFixed(1)}MB) exceeds limit (${maxSize}MB)`);
  }
  
  return {
    healthy: youtubeReachable && tokenValid && videoReadable && videoSize,
    checks: {
      youtubeReachable,
      tokenValid,
      videoReadable,
      videoSize,
      errors,
    },
  };
}

export function reportHealthCheckStatus(result: HealthCheckResult): void {
  console.log('\n📋 HEALTH CHECK RESULTS:');
  console.log(`   YouTube Reachable: ${result.checks.youtubeReachable ? '✅' : '❌'}`);
  console.log(`   Token Valid:       ${result.checks.tokenValid ? '✅' : '❌'}`);
  console.log(`   Video Readable:    ${result.checks.videoReadable ? '✅' : '❌'}`);
  console.log(`   Video Size OK:     ${result.checks.videoSize ? '✅' : '❌'}`);
  
  if (result.checks.errors.length > 0) {
    console.log('\n⚠️  BLOCKERS:');
    result.checks.errors.forEach(err => {
      console.log(`   • ${err}`);
    });
  }
  
  console.log(`\n${result.healthy ? '✅ READY TO UPLOAD' : '❌ BLOCKED - Fix errors above'}\n`);
}
