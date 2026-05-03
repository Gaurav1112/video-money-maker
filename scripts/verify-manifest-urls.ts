#!/usr/bin/env tsx
/**
 * Verifies that all URLs in assets/stock/manifest.json return 2xx HEAD
 * responses. Wraps in async main() so tsx (cjs) doesn't choke on top-level
 * await. Usage: npm run test:manifest
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Clip { id: string; url: string; }
interface Manifest { clips: Clip[]; }

async function main(): Promise<void> {
  const manifestPath = join(process.cwd(), 'assets/stock/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

  let failures = 0;

  console.log(`Checking ${manifest.clips.length} clips...`);

  // Limit concurrency to 8 to avoid Mixkit rate-limiting
  const queue = [...manifest.clips];
  const failed: Array<{ id: string; url: string; status: number | string }> = [];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const clip = queue.shift();
      if (!clip) return;
      try {
        const res = await fetch(clip.url, { method: 'HEAD', redirect: 'follow' });
        if (!res.ok) {
          console.error(`FAIL [${res.status}] ${clip.id}: ${clip.url}`);
          failed.push({ id: clip.id, url: clip.url, status: res.status });
          failures++;
        } else {
          console.log(`OK   [${res.status}] ${clip.id}`);
        }
      } catch (err) {
        console.error(`ERR  ${clip.id}: ${String(err)}`);
        failed.push({ id: clip.id, url: clip.url, status: String(err) });
        failures++;
      }
    }
  }

  await Promise.all(Array.from({ length: 8 }, () => worker()));

  if (failures > 0) {
    console.error(`\n${failures} URL(s) failed:`);
    failed.forEach((f) => console.error(`  ${f.id} → ${f.status} → ${f.url}`));
    process.exit(1);
  }
  console.log(`\nAll ${manifest.clips.length} URLs OK`);
}

main().catch((err) => {
  console.error('verify-manifest-urls failed:', err);
  process.exit(1);
});
