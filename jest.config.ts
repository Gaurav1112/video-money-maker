/**
 * jest.config.ts
 *
 * NOTE: The cartoon-pipeline uses Vitest. This jest.config.ts is provided
 * as a drop-in for teams that prefer Jest or run Jest in a monorepo context.
 * The test files themselves use Vitest-compatible `describe/it/expect` syntax
 * which is 100% compatible with Jest.
 *
 * To use with Jest instead of Vitest:
 *   npm install -D jest ts-jest @types/jest
 *   npx jest --config jest.config.ts
 */
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^../../src/(.*)$': '<rootDir>/src/$1',
  },
  testTimeout: 60_000,
  setupFilesAfterEach: [],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },

  // Coverage
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/studio/**',
    '!src/Root.tsx',
  ],
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageDirectory: 'coverage',

  // Hard gates per path — these thresholds are ENFORCED (CI fails if below)
  coverageThreshold: {
    global: {
      statements: 40,
      branches: 35,
      functions: 40,
      lines: 40,
    },
    './src/types.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/pipeline/': {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
    './src/audio/': {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
    './src/story/': {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
    './src/dialogues/': {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60,
    },
  },

  // Group tests by layer for --testPathPattern filtering
  // e.g.: jest --testPathPattern='retention'
  testPathDirs: ['<rootDir>/tests'],
};

export default config;
