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
