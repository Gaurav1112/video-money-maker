import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const WRAPPER = path.resolve(__dirname, '..', 'upload-instagram-wrapper.ts');

function runWrapper(env: Record<string, string>) {
  return spawnSync('npx', ['tsx', WRAPPER, '/tmp/x.mp4', '/tmp/x.json'], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

describe('upload-instagram-wrapper', () => {
  it('exits 0 when INSTAGRAM_ACCESS_TOKEN is missing', () => {
    const r = runWrapper({
      INSTAGRAM_ACCESS_TOKEN: '',
      INSTAGRAM_BUSINESS_ID: 'x',
      R2_ACCOUNT_ID: 'x',
      R2_ACCESS_KEY_ID: 'x',
      R2_SECRET_ACCESS_KEY: 'x',
      R2_BUCKET_NAME: 'x',
      R2_PUBLIC_URL: 'x',
    });
    expect(r.status).toBe(0);
    expect((r.stdout + r.stderr)).toMatch(/INSTAGRAM_ACCESS_TOKEN/);
    expect((r.stdout + r.stderr)).toMatch(/skipping/i);
  });

  it('exits 0 when any R2 env var is missing', () => {
    const r = runWrapper({
      INSTAGRAM_ACCESS_TOKEN: 'x',
      INSTAGRAM_BUSINESS_ID: 'x',
      R2_ACCOUNT_ID: '',
      R2_ACCESS_KEY_ID: 'x',
      R2_SECRET_ACCESS_KEY: 'x',
      R2_BUCKET_NAME: 'x',
      R2_PUBLIC_URL: 'x',
    });
    expect(r.status).toBe(0);
    expect((r.stdout + r.stderr)).toMatch(/R2_ACCOUNT_ID/);
  });

  it('exits 1 when invoked with no positional args', () => {
    const r = spawnSync('npx', ['tsx', WRAPPER], { encoding: 'utf8' });
    expect(r.status).not.toBe(0);
  });
});
