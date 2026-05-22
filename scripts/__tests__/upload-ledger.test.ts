import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { hasUploaded, recordUpload } from '../lib/upload-ledger';

// The ledger writes under <cwd>/data/uploaded/. Run each test in an isolated
// temp cwd so tests never touch the repo's real data/uploaded/ dir.
let tmp: string;
let prevCwd: string;

beforeEach(() => {
  prevCwd = process.cwd();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
  process.chdir(tmp);
});

afterEach(() => {
  process.chdir(prevCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('upload-ledger', () => {
  it('hasUploaded returns false for a quiz that was never uploaded', () => {
    expect(hasUploaded('kafka-quiz-3')).toBe(false);
  });

  it('recordUpload then hasUploaded returns true', () => {
    recordUpload('kafka-quiz-3', 'vid_abc123');
    expect(hasUploaded('kafka-quiz-3')).toBe(true);

    const rec = JSON.parse(
      fs.readFileSync(path.join(tmp, 'data', 'uploaded', 'kafka-quiz-3.json'), 'utf8')
    );
    expect(rec.quizKey).toBe('kafka-quiz-3');
    expect(rec.videoId).toBe('vid_abc123');
  });

  it('tracks A/B variants separately — both allowed once, neither re-uploaded', () => {
    recordUpload('kafka-quiz-3-variantA', 'vid_a');
    // variantA recorded, variantB still free
    expect(hasUploaded('kafka-quiz-3-variantA')).toBe(true);
    expect(hasUploaded('kafka-quiz-3-variantB')).toBe(false);

    recordUpload('kafka-quiz-3-variantB', 'vid_b', 'B');
    expect(hasUploaded('kafka-quiz-3-variantB')).toBe(true);

    // base key (no variant suffix) is distinct from both variants
    expect(hasUploaded('kafka-quiz-3')).toBe(false);
  });
});
