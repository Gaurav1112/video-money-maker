#!/usr/bin/env tsx
/**
 * Verifies that all URLs in assets/stock/manifest.json return 2xx HEAD responses.
 * Usage: npm run test:manifest
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Clip { id: string; url: string; }
interface Manifest { clips: Clip[]; }

const manifestPath = join(process.cwd(), 'assets/stock/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;

let failures = 0;
const results: Array<{ id: string; url: string; status: number | string }> = [];

console.log(`Checking ${manifest.clips.length} clips...`);

await Promise.all(
  manifest.clips.map(async (clip) => {
    try {
      const res = await fetch(clip.url, { method: 'HEAD' });
      results.push({ id: clip.id, url: clip.url, status: res.status });
      if (!res.ok) {
        console.error(`FAIL [${res.status}] ${clip.id}: ${clip.url}`);
        failures++;
      } else {
        console.log(`OK   [${res.status}] ${clip.id}`);
      }
    } catch (err) {
      results.push({ id: clip.id, url: clip.url, status: String(err) });
      console.error(`ERR  ${clip.id}: ${err}`);
      failures++;
    }
  })
);

if (failures > 0) {
  console.error(`\n${failures} URL(s) failed`);
  process.exit(1);
} else {
  console.log(`\nAll ${manifest.clips.length} URLs OK`);
}
