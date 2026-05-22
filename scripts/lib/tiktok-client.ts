/**
 * tiktok-client.ts — F005 TikTok Content Posting API client.
 *
 * Direct-post flow:
 *   1. POST /v2/post/publish/video/init/   → { publish_id, upload_url }
 *   2. PUT  <upload_url>                   ← binary video bytes
 *
 * No SDK; node:https + node:fs for keep-it-CI-friendly. Caller (the wrapper)
 * is responsible for env var guarding.
 *
 * Docs: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
 */

import * as https from 'node:https';
import * as fs from 'node:fs';
import { URL } from 'node:url';

export interface TikTokOpts {
  accessToken: string;
  openId: string;
  privacyLevel?: 'SELF_ONLY' | 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS';
}

export interface TikTokResult {
  publishId: string;
}

interface InitResponse {
  data?: {
    publish_id?: string;
    upload_url?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
}

function postJson<T>(url: string, body: object, headers: Record<string, string>): Promise<T> {
  const payload = JSON.stringify(body);
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`TikTok HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
            return;
          }
          try {
            resolve(JSON.parse(raw) as T);
          } catch (e) {
            reject(new Error(`TikTok JSON parse failure: ${(e as Error).message}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function putBinary(uploadUrl: string, filePath: string, fileSize: number): Promise<void> {
  const u = new URL(uploadUrl);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'PUT',
        hostname: u.hostname,
        path: u.pathname + u.search,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': fileSize,
          'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            const raw = Buffer.concat(chunks).toString('utf8');
            reject(new Error(`TikTok upload HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
            return;
          }
          resolve();
        });
      }
    );
    req.on('error', reject);
    fs.createReadStream(filePath).pipe(req);
  });
}

export async function uploadToTikTok(
  videoPath: string,
  caption: string,
  opts: TikTokOpts
): Promise<TikTokResult> {
  const stat = fs.statSync(videoPath);
  const videoSize = stat.size;
  if (videoSize === 0) throw new Error(`TikTok: video file is empty: ${videoPath}`);
  if (videoSize > 4 * 1024 * 1024 * 1024) throw new Error(`TikTok: video > 4GB`);

  const initBody = {
    post_info: {
      title: caption,
      privacy_level: opts.privacyLevel || 'SELF_ONLY',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoSize,
      chunk_size: videoSize,
      total_chunk_count: 1,
    },
  };

  const init = await postJson<InitResponse>(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    initBody,
    { Authorization: `Bearer ${opts.accessToken}` }
  );

  if (init.error && init.error.code && init.error.code !== 'ok') {
    throw new Error(`TikTok init error ${init.error.code}: ${init.error.message}`);
  }
  const publishId = init.data?.publish_id;
  const uploadUrl = init.data?.upload_url;
  if (!publishId || !uploadUrl) {
    throw new Error(`TikTok init missing publish_id or upload_url: ${JSON.stringify(init)}`);
  }

  await putBinary(uploadUrl, videoPath, videoSize);
  return { publishId };
}
