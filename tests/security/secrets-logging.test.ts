/**
 * tests/security/secrets-logging.test.ts
 *
 * RED: No logging-sanitiser exists. Any console.log/error call in the
 *      pipeline that includes process.env.YOUTUBE_API_KEY verbatim would
 *      leak it to CI logs.
 *
 * GREEN after: Audit all console.log calls in pipeline/** and audio/**;
 *              replace credential env-vars with redacted placeholders in logs.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateMetadata } from '../../src/pipeline/metadata-generator';
import { buildMixCommand } from '../../src/audio/audio-mixer';
import { generateEpisode } from '../../src/story/story-engine';
import type { AudioLayer } from '../../src/types';

const SENSITIVE_KEYS = [
  'YOUTUBE_API_KEY',
  'GOOGLE_CLIENT_SECRET',
  'OAUTH_TOKEN',
  'REFRESH_TOKEN',
  'CLIENT_SECRET',
  'API_KEY',
];

// Inject fake values so any accidental log would be detectable
const FAKE_VALUES: Record<string, string> = {
  YOUTUBE_API_KEY: 'AIzaSy_FAKE_KEY_DO_NOT_LOG',
  GOOGLE_CLIENT_SECRET: 'GOCSPX-FAKE_SECRET_DO_NOT_LOG',
  OAUTH_TOKEN: 'ya29.FAKE_OAUTH_TOKEN_DO_NOT_LOG',
  REFRESH_TOKEN: '1//FAKE_REFRESH_TOKEN_DO_NOT_LOG',
  CLIENT_SECRET: 'FAKE-CLIENT-SECRET-DO-NOT-LOG',
  API_KEY: 'FAKE-API-KEY-DO-NOT-LOG',
};

describe('security: secrets not logged', () => {
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    stdoutSpy.mockClear();
    stderrSpy.mockClear();
    consoleSpy.mockClear();
    consoleErrSpy.mockClear();
  });

  // Inject env vars before test
  beforeAll(() => {
    for (const [k, v] of Object.entries(FAKE_VALUES)) {
      process.env[k] = v;
    }
  });

  it('generateMetadata does not log any secret key values', () => {
    const ep = generateEpisode(1, 1);
    generateMetadata(ep, 'hi', 1);

    const allOutput = [
      ...consoleSpy.mock.calls.flat(),
      ...consoleErrSpy.mock.calls.flat(),
    ].join('\n');

    for (const v of Object.values(FAKE_VALUES)) {
      expect(allOutput).not.toContain(v);
    }
  });

  it('buildMixCommand does not log any secret key values', () => {
    const layer: AudioLayer = {
      type: 'dialogue',
      filePath: '/audio/ep1.wav',
      startMs: 0,
      volumeDb: 0,
    };
    buildMixCommand('/out/master.mp3', [layer]);

    const allOutput = [
      ...consoleSpy.mock.calls.flat(),
      ...consoleErrSpy.mock.calls.flat(),
    ].join('\n');

    for (const v of Object.values(FAKE_VALUES)) {
      expect(allOutput).not.toContain(v);
    }
  });

  it('source files do not hard-code any secret key names in console.log calls', async () => {
    const { execSync } = await import('child_process');
    const root = new URL('../../src', import.meta.url).pathname;
    for (const key of SENSITIVE_KEYS) {
      // grep for console.log/error that contain the key name literally
      let found = '';
      try {
        found = execSync(
          `grep -rn "console\\.log.*${key}\\|console\\.error.*${key}" "${root}" || true`,
          { encoding: 'utf8' },
        );
      } catch {
        found = '';
      }
      expect(found.trim()).toBe('');
    }
  });
});
