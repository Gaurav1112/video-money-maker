// ESLint flat config — Feature 008 (harden dev harness).
//
// Philosophy: this is a large pre-existing codebase. The config is
// deliberately WARN-HEAVY. Only genuine-bug rules are `error`. Every
// stylistic concern is owned by Prettier (eslint-config-prettier is
// applied last to switch those rules off).
//
// CI runs this with `continue-on-error: true` for now; the intent is to
// flip to blocking once the warning backlog is burned down.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // Directories ESLint should never touch.
    ignores: [
      'node_modules/**',
      'output/**',
      'public/**',
      'tools/**',
      '.specify/**',
      '.claude/**',
      'dist/**',
      'coverage/**',
      'remotion.config.ts',
      // Loose root-level CommonJS generator scripts — not part of the
      // typed src/scripts surface; linting them adds only noise.
      'generate-*.js',
      'jest.config.js',
    ],
  },

  {
    // The tree contains an `eslint-disable react/no-danger` comment but
    // we do not load eslint-plugin-react. Register a no-op `react`
    // plugin so that directive resolves instead of erroring.
    plugins: {
      react: {
        rules: {
          'no-danger': { create: () => ({}) },
        },
      },
    },
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Global rule baseline applied to every linted file (TS and JS).
    // An orphaned `eslint-disable react/no-danger` comment exists in the
    // tree; without the react plugin loaded that directive would error,
    // so unused disable-directives are not reported.
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      // TypeScript / the runtime own undefined-symbol detection.
      'no-undef': 'off',
      // ESLint 10 recommended ships these as `error`; this is a large
      // existing codebase, so downgrade to `warn` (only true bugs error).
      'preserve-caught-error': 'warn',
      'no-useless-assignment': 'warn',
      'no-constant-binary-expression': 'warn',
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      // ── Real bugs → error ───────────────────────────────────────────
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',

      // ── Everything else → warn (large existing codebase) ────────────
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-empty': 'warn',
      'no-constant-condition': 'warn',
      'prefer-const': 'warn',
      'no-useless-escape': 'warn',
      // TypeScript itself reports undefined references; ESLint's no-undef
      // is redundant here and misfires on Node/browser globals.
      'no-misleading-character-class': 'warn',
      'no-irregular-whitespace': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/no-wrapper-object-types': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      '@typescript-eslint/no-namespace': 'warn',
      '@typescript-eslint/triple-slash-reference': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
    },
  },

  // Test files: looser still — fixtures and mocks use `any` freely.
  {
    files: ['**/*.test.ts', '**/__tests__/**', 'tests/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Prettier last — disables all stylistic ESLint rules.
  prettier
);
