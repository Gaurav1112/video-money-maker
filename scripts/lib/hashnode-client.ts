/**
 * hashnode-client.ts — single-purpose GraphQL mutation against gql.hashnode.com.
 *
 * No SDK; uses node:https. Mirrors the pattern in scripts/cross-post-x.ts.
 */

import * as https from 'node:https';
import type { WeeklyArticle } from './weekly-template';
import { CANONICAL_URL } from './weekly-template';

export interface HashnodeResult {
  url: string;
  id: string;
}

interface HashnodeResponse {
  data?: {
    publishPost?: {
      post?: { id: string; url: string };
    };
  };
  errors?: Array<{ message: string }>;
}

const MUTATION = `
mutation PublishPost($input: PublishPostInput!) {
  publishPost(input: $input) {
    post {
      id
      url
    }
  }
}`;

export function publishToHashnode(
  article: WeeklyArticle,
  apiKey: string,
  publicationId: string,
): Promise<HashnodeResult> {
  const payload = JSON.stringify({
    query: MUTATION,
    variables: {
      input: {
        title: article.title,
        contentMarkdown: article.body,
        publicationId,
        originalArticleURL: CANONICAL_URL,
        tags: article.tags.slice(0, 5).map((slug) => ({ slug, name: slug })),
      },
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: 'gql.hashnode.com',
        path: '/',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Authorization: apiKey,
          'User-Agent': 'gurusishya-video-pipeline/1.0',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Hashnode HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
            return;
          }
          try {
            const parsed = JSON.parse(raw) as HashnodeResponse;
            if (parsed.errors && parsed.errors.length > 0) {
              reject(new Error(`Hashnode GraphQL error: ${parsed.errors[0]?.message}`));
              return;
            }
            const post = parsed.data?.publishPost?.post;
            if (!post) {
              reject(new Error(`Hashnode: missing publishPost.post in response: ${raw.slice(0, 200)}`));
              return;
            }
            resolve({ url: post.url, id: post.id });
          } catch (e) {
            reject(new Error(`Hashnode JSON parse failure: ${(e as Error).message}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
