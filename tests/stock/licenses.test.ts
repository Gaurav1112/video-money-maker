/**
 * tests/stock/licenses.test.ts
 *
 * Verifies that after running the orchestrator on the demo storyboard,
 * licenses.json lists every used clip and no clip has an empty license.
 *
 * This is an integration test — it runs the full pipeline (manifest only).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ManifestProvider } from '../../src/stock/providers/manifest.js';
import { pickClipsForStoryboard } from '../../src/stock/picker.js';
import type { StockStoryboard } from '../../src/stock/types.js';

const MANIFEST_PATH = path.join(__dirname, '../../assets/stock/manifest.json');
const STORYBOARD_PATH = path.join(__dirname, '../fixtures/demo-storyboard.json');

interface LicenseEntry {
  sceneIndex: number;
  id: string;
  provider: string;
  url: string;
  license: string;
  pageUrl: string;
  credit: string;
}

interface LicensesFile {
  clips: LicenseEntry[];
}

let licenses: LicensesFile;

beforeAll(async () => {
  const sbRaw = fs.readFileSync(STORYBOARD_PATH, 'utf8');
  const storyboard = JSON.parse(sbRaw) as StockStoryboard;

  const manifestData = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as { clips: import('../../src/stock/types.js').StockClip[] };
  const coverr = new ManifestProvider('coverr', manifestData.clips);
  const mixkit = new ManifestProvider('mixkit', manifestData.clips);

  const picked = await pickClipsForStoryboard(storyboard, [coverr, mixkit]);

  const clips: LicenseEntry[] = picked.map((p, i) => ({
    sceneIndex: i,
    id: p.clip.id,
    provider: p.clip.provider,
    url: p.clip.url,
    license: p.clip.license,
    pageUrl: p.clip.pageUrl ?? '',
    credit: p.clip.credit ?? '',
  }));

  licenses = { clips };
});

describe('licenses.json', () => {
  it('lists one entry per scene in the storyboard', () => {
    const storyboard = JSON.parse(
      fs.readFileSync(STORYBOARD_PATH, 'utf8')
    ) as StockStoryboard;
    expect(licenses.clips).toHaveLength(storyboard.scenes.length);
  });

  it('no clip has an empty license string', () => {
    const empty = licenses.clips.filter((c) => !c.license);
    expect(empty).toHaveLength(0);
  });

  it('all entries have a non-empty id', () => {
    const noId = licenses.clips.filter((c) => !c.id);
    expect(noId).toHaveLength(0);
  });

  it('all entries have a known provider', () => {
    const valid = new Set(['coverr', 'mixkit', 'pexels', 'pixabay', 'synthetic']);
    const invalid = licenses.clips.filter((c) => !valid.has(c.provider));
    expect(invalid).toHaveLength(0);
  });
});
