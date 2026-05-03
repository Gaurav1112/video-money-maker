import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      // Legacy specs from pre-pivot "cartoon" paradigm — reference symbols that
      // were never implemented (enqueueEpisode, story-engine, CartoonEpisode).
      // Re-enable when the corresponding production code lands.
      'tests/integrity/**',
      'tests/determinism/**',
      'tests/security/**',
      'tests/publishing/**',
      'tests/format/**',
      // Pre-pivot retention specs reference dead modules (audio-mixer,
      // scenes-lion-rabbit, wrapCaption export). Top-level retention-engine /
      // retention-proxy tests still run and pass.
      'tests/retention/**',
      // tests/stock/** is intentionally NOT excluded — runs via test:stock

      // Pre-pivot root-level specs against the dead "cartoon" pipeline
      // (Remotion-only render path, broll-templates, script-generator-v2,
      // hinglish-rewriter, audio-stitcher, queue, telegram). Stock-pipeline
      // replaces this entire surface; re-enable individually if/when the
      // underlying modules are revived. Note tests/stock/quality-gate.test.ts
      // is the live one; tests/quality-gate.test.ts is the cartoon one.
      'tests/audio-stitcher.test.ts',
      'tests/broll-orchestrator.test.ts',
      'tests/hinglish-rewriter.test.ts',
      'tests/loopable-short.test.ts',
      'tests/publish-pipeline.test.ts',
      'tests/queue.test.ts',
      'tests/quality-gate.test.ts',
      'tests/script-generator-v2.test.ts',
      'tests/script-validator.test.ts',
      'tests/telegram.test.ts',
      'tests/integration/end-to-end.test.ts',
      // topic-bank.test.ts uses node:test (not vitest) — vitest sees 0 tests
      // but node-test auto-runs at exit and writes TAP. Run via:
      //   npx tsx --test tests/topic-bank.test.ts
      'tests/topic-bank.test.ts',
    ],

    // Per-file timeout — audio/fixture tests need more headroom
    testTimeout: 60_000,

    // Coverage via @vitest/coverage-v8
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.d.ts',
        'src/studio/**',
        'src/Root.tsx',
        'src/index.ts',
      ],

      // Hard gates — CI fails if below threshold
      thresholds: {
        global: {
          statements: 40,
          branches: 35,
          functions: 40,
          lines: 40,
        },
        // Per-path overrides (vitest v2+ supports perFile or glob patterns)
        // See INTEGRATION.md for per-layer target table
      },
    },
  },
});
