import { describe, it, expect } from 'vitest';
import { buildVideoIdList, persistMetrics } from '../ingest-analytics';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('buildVideoIdList', () => {
  it('extracts videoIds from upload-result JSONs', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-'));
    fs.writeFileSync(path.join(tmp, 'a.upload-result.json'), JSON.stringify({ videoId: 'aaa' }));
    fs.writeFileSync(path.join(tmp, 'b.upload-result.json'), JSON.stringify({ videoId: 'bbb' }));
    fs.writeFileSync(path.join(tmp, 'c.mp4'), 'not a result');
    const ids = buildVideoIdList(tmp);
    expect(ids.sort()).toEqual(['aaa', 'bbb']);
  });
});

describe('persistMetrics', () => {
  it('writes one JSON per video keyed by videoId', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-out-'));
    persistMetrics(tmp, [
      { videoId: 'xyz', fetchedAt: '2026-05-20T00:00:00Z', views: 100, likes: 5, comments: 1,
        averageViewDuration: 12, averageViewPercentage: 60, shares: 0, estimatedMinutesWatched: 20 },
    ]);
    const written = fs.readFileSync(path.join(tmp, 'xyz.json'), 'utf8');
    expect(JSON.parse(written).views).toBe(100);
  });
});
