import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const SCRIPT = path.resolve(__dirname, '..', 'upload-tiktok.ts');

function run(env: Record<string, string>, args: string[] = ['/tmp/x.mp4', '/tmp/x.json']) {
  return spawnSync('npx', ['tsx', SCRIPT, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

describe('upload-tiktok wrapper', () => {
  it('exits 0 when TIKTOK_ACCESS_TOKEN is missing', () => {
    const r = run({
      TIKTOK_CLIENT_KEY: 'x',
      TIKTOK_CLIENT_SECRET: 'x',
      TIKTOK_ACCESS_TOKEN: '',
      TIKTOK_OPEN_ID: 'x',
    });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/TIKTOK_ACCESS_TOKEN/);
    expect(r.stdout + r.stderr).toMatch(/skipping/i);
  });

  it('exits 0 when TIKTOK_OPEN_ID is missing', () => {
    const r = run({
      TIKTOK_CLIENT_KEY: 'x',
      TIKTOK_CLIENT_SECRET: 'x',
      TIKTOK_ACCESS_TOKEN: 'x',
      TIKTOK_OPEN_ID: '',
    });
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toMatch(/TIKTOK_OPEN_ID/);
  });

  it('exits non-zero with no positional args', () => {
    const r = spawnSync('npx', ['tsx', SCRIPT], { encoding: 'utf8' });
    expect(r.status).not.toBe(0);
  });
});
