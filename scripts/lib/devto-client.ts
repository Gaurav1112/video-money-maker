/**
 * devto-client.ts — single-purpose POST to https://dev.to/api/articles.
 *
 * No SDK; uses node:https to keep the script CI-friendly (mirrors the pattern
 * in scripts/cross-post-x.ts). Caller is responsible for missing-token guard.
 */

import * as https from 'node:https';
import type { WeeklyArticle } from './weekly-template';
import { CANONICAL_URL } from './weekly-template';

export interface DevtoResult {
  url: string;
  id: number;
}

interface DevtoResponse {
  id: number;
  url: string;
  error?: string;
}

export function publishToDevto(article: WeeklyArticle, apiKey: string): Promise<DevtoResult> {
  const payload = JSON.stringify({
    article: {
      title: article.title,
      body_markdown: article.body,
      canonical_url: CANONICAL_URL,
      tags: article.tags,
      published: true,
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: 'dev.to',
        path: '/api/articles',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'api-key': apiKey,
          'User-Agent': 'gurusishya-video-pipeline/1.0',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Dev.to HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
            return;
          }
          try {
            const parsed = JSON.parse(raw) as DevtoResponse;
            if (parsed.error) {
              reject(new Error(`Dev.to error: ${parsed.error}`));
              return;
            }
            resolve({ url: parsed.url, id: parsed.id });
          } catch (e) {
            reject(new Error(`Dev.to JSON parse failure: ${(e as Error).message}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
