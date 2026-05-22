// Upload ledger: a per-quiz dedup record so the same quiz never uploads to
// YouTube twice — even when auto-shorts.yml rotation wraps across days.
//
// F009: the 13-workflow audit (docs/upload-workflow-audit.md) disabled the
// redundant scheduled workflows; this ledger is the defense-in-depth layer
// inside the canonical auto-shorts.yml pipeline.
//
// Storage: one JSON file per quizKey at data/uploaded/<quizKey>.json. The
// file's existence IS the "uploaded" signal — committed back to the repo by
// the workflow so it survives across CI runs.
//
// Constitution I: deterministic — pure filesystem ops, no Math.random, no
// network egress.

import * as fs from 'fs';
import * as path from 'path';

/**
 * quizKey format: `${topic}-quiz-${index}` (matches the existing episodeId
 * convention). For A/B variants append `-variantA` / `-variantB` so BOTH
 * variants of a quiz may upload once each, but neither re-uploads.
 */
export interface UploadRecord {
  quizKey: string;
  videoId: string;
  variant?: string;
  uploadedAt: string;
}

/** Directory holding the ledger, resolved relative to the current cwd. */
function ledgerDir(): string {
  return path.join(process.cwd(), 'data', 'uploaded');
}

/** Path to the ledger record for a given quizKey. */
function recordPath(quizKey: string): string {
  return path.join(ledgerDir(), `${quizKey}.json`);
}

/**
 * Returns true if this quizKey has already been uploaded (its ledger record
 * file exists).
 */
export function hasUploaded(quizKey: string): boolean {
  return fs.existsSync(recordPath(quizKey));
}

/**
 * Records that `quizKey` was uploaded as `videoId`. Writes
 * data/uploaded/<quizKey>.json. Idempotent — re-recording overwrites with the
 * latest videoId/timestamp.
 */
export function recordUpload(quizKey: string, videoId: string, variant?: string): void {
  fs.mkdirSync(ledgerDir(), { recursive: true });
  const record: UploadRecord = {
    quizKey,
    videoId,
    ...(variant ? { variant } : {}),
    uploadedAt: new Date().toISOString(),
  };
  fs.writeFileSync(recordPath(quizKey), JSON.stringify(record, null, 2) + '\n');
}
