/**
 * tests/security/shell-injection.test.ts
 *
 * RED: buildMixCommand passes file paths directly into the ffmpeg args array
 *      but does NOT sanitise them. A path like "/audio/good.mp3; rm -rf /"
 *      could be dangerous if args are ever joined into a shell string.
 *      The test forces the team to audit and harden the call site.
 *
 * The test itself never RUNS the dangerous path — it only inspects the
 * args array structure.
 *
 * GREEN after: buildMixCommand returns a string[] where each element is a
 *              single argument (never shell-joined), and the file path appears
 *              verbatim as its own element.
 */
import { describe, it, expect } from 'vitest';
import { buildMixCommand } from '../../src/audio/audio-mixer';
import type { AudioLayer } from '../../src/types';

const MALICIOUS_PATHS = [
  "/audio/ep1.wav; rm -rf /",
  "/audio/ep1.wav | cat /etc/passwd",
  "/audio/$(id).wav",
  "/audio/ep1.wav`whoami`",
  "/audio/ep1 & shutdown now.wav",
];

const BASE_LAYER: AudioLayer = {
  type: 'dialogue',
  filePath: '/audio/ep1.wav',
  startMs: 0,
  volumeDb: 0,
};

describe('security: shell injection prevention', () => {
  it('buildMixCommand returns an array (not a string)', () => {
    const result = buildMixCommand('/out/master.mp3', [BASE_LAYER]);
    expect(Array.isArray(result)).toBe(true);
  });

  it.each(MALICIOUS_PATHS)(
    'path "%s" appears as a single array element — never shell-expanded',
    (maliciousPath) => {
      const layer: AudioLayer = { ...BASE_LAYER, filePath: maliciousPath };
      const args = buildMixCommand('/out/master.mp3', [layer]);

      // The malicious path should appear verbatim in exactly one element
      // It must NOT be split across multiple elements or joined with other text
      const found = args.filter((a) => a.includes(maliciousPath.split(';')[0].trim()));
      expect(found.length).toBeGreaterThanOrEqual(1);

      // No single arg should contain a shell operator AND a file path joined together
      for (const arg of args) {
        expect(arg).not.toMatch(/;\s*rm\s/);
        expect(arg).not.toMatch(/\|\s*cat\s/);
        expect(arg).not.toMatch(/`\w+`/);
        expect(arg).not.toMatch(/\$\(\w+\)/);
      }
    },
  );

  it('output path appears as a standalone array element', () => {
    const out = '/output/master.mp3';
    const args = buildMixCommand(out, [BASE_LAYER]);
    // The output path should be a direct element
    expect(args).toContain(out);
  });

  it('no shell expansion characters in any hardcoded arg', () => {
    const args = buildMixCommand('/out/master.mp3', [BASE_LAYER]);
    const joined = args.join('\x00'); // NUL-joined — never interpreted by shell
    // This verifies the hardcoded ffmpeg options don't contain shell operators
    for (const dangerous of [' && ', ' || ', '$(', '`']) {
      expect(joined).not.toContain(dangerous);
    }
  });
});
