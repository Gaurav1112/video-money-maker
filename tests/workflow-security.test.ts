/**
 * tests/workflow-security.test.ts
 *
 * Asserts security invariants across ALL GitHub Actions workflow files.
 *
 * Rules enforced (all derived from RANK-10 / Wave-3 security findings):
 *
 *  1. No `${{ github.event.* }}` expressions inside `run:` blocks (shell injection)
 *  2. No `${{ inputs.* }}` expressions inside `run:` blocks (shell injection)
 *  3. No `${{ steps.*.outputs.* }}` expressions inside `run:` blocks (shell injection)
 *  4. Every `uses:` line references a 40-hex-char SHA, not a mutable tag
 *  5. Every workflow file has a top-level `permissions:` key (no implicit write-all)
 *  6. Every workflow file has a top-level or job-level `concurrency:` key
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// ── helpers ──────────────────────────────────────────────────────────────────

const WORKFLOWS_DIR = path.resolve(__dirname, '../.github/workflows');

/** Read every *.yml file in .github/workflows/ */
function getWorkflowFiles(): Array<{ name: string; content: string }> {
  if (!fs.existsSync(WORKFLOWS_DIR)) {
    // Return empty when running outside repo root — tests will be skipped
    return [];
  }
  return fs
    .readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => ({
      name: f,
      content: fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf8'),
    }));
}

/**
 * Extract the SHELL SCRIPT content from all `run:` blocks in a workflow YAML.
 *
 * This is line-by-line rather than regex-only to avoid over-capturing sibling
 * `env:` blocks or adjacent steps. We only care about what the SHELL executes —
 * `env:` values with `${{ }}` are safe (GHA expands them into env vars, not
 * shell text).
 */
function extractRunBlocks(content: string): string[] {
  const lines = content.split('\n');
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // Match `run:` YAML key (must be indented — part of a step, not top-level)
    const inlineMatch = line.match(/^(\s+)run:\s+(\S.*)$/);
    const blockMatch = line.match(/^(\s+)run:\s*[|>][-+]?\s*$/);

    if (blockMatch) {
      // Multiline block: `run: |` — check this FIRST since `run: |` also
      // matches the inline regex (| is \S). Block check must take priority.
      const runIndent = blockMatch[1].length;
      // Collect subsequent lines that are indented MORE than the `run:` key
      const blockLines: string[] = [];
      i++;
      while (i < lines.length) {
        const blockLine = lines[i];
        // Empty / whitespace-only lines are part of the block
        if (blockLine.trim() === '') {
          blockLines.push(blockLine);
          i++;
          continue;
        }
        // A non-empty line with indent <= runIndent means the block ended
        const leadingSpaces = blockLine.match(/^(\s*)/)?.[1]?.length ?? 0;
        if (leadingSpaces <= runIndent) {
          break;
        }
        blockLines.push(blockLine);
        i++;
      }
      blocks.push(blockLines.join('\n'));
    } else if (inlineMatch) {
      // Inline: `run: single command` (only if not already matched as a block)
      blocks.push(inlineMatch[2]);
      i++;
    } else {
      i++;
    }
  }

  return blocks;
}

/** Return all `uses:` values from a workflow file (skips YAML comments) */
function extractUsesValues(content: string): string[] {
  // Only match `uses:` at YAML key position (leading whitespace + `uses:`)
  // and not inside comments (lines starting with optional whitespace + `#`)
  const re = /^(?!\s*#)\s+uses:\s*(\S+)/gm;
  const values: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    values.push(m[1]);
  }
  return values;
}

/** A SHA-pinned uses reference looks like `owner/repo@<40-hex-chars>` */
const SHA_RE = /^[^@]+@[0-9a-f]{40}(\s*#.*)?$/i;

// Patterns that constitute shell injection if found inside a run: block
const INJECTION_PATTERNS: Array<{ label: string; re: RegExp }> = [
  {
    label: '${{ github.event.* }} in run:',
    re: /\$\{\{\s*github\.event\./,
  },
  {
    label: '${{ inputs.* }} in run:',
    re: /\$\{\{\s*inputs\./,
  },
  {
    label: '${{ steps.*.outputs.* }} in run:',
    re: /\$\{\{\s*steps\.[^}]+\.outputs\./,
  },
  {
    label: '${{ github.head_ref }} in run: (branch injection)',
    re: /\$\{\{\s*github\.head_ref\s*\}\}/,
  },
  {
    label: '${{ github.event.pull_request.title }} in run:',
    re: /\$\{\{\s*github\.event\.pull_request\./,
  },
];

// ── load files once ───────────────────────────────────────────────────────

const workflowFiles = getWorkflowFiles();

// ── test suites ───────────────────────────────────────────────────────────

describe('GHA Workflow Security — no shell injection via template expressions', () => {
  if (workflowFiles.length === 0) {
    it.skip('no workflow files found — skipping (run from repo root)', () => {});
    return;
  }

  for (const { name, content } of workflowFiles) {
    const runBlocks = extractRunBlocks(content);
    const combined = runBlocks.join('\n');

    for (const { label, re } of INJECTION_PATTERNS) {
      it(`[${name}] must NOT contain "${label}"`, () => {
        // Find the offending block for a helpful error message
        const offender = runBlocks.find((b) => re.test(b));
        expect(
          offender,
          `Shell injection risk in ${name}: found "${label}" inside a run: block.\n` +
            `Offending block:\n${offender}\n\n` +
            `Fix: move the expression to an env: variable and reference $VAR in the script.`
        ).toBeUndefined();
      });
    }
  }
});

describe('GHA Workflow Security — all uses: pinned to SHA', () => {
  if (workflowFiles.length === 0) {
    it.skip('no workflow files found — skipping', () => {});
    return;
  }

  for (const { name, content } of workflowFiles) {
    const uses = extractUsesValues(content);

    // Local/reusable workflow references (./path) don't need SHA pinning
    const externalUses = uses.filter((u) => !u.startsWith('.'));

    it(`[${name}] all external uses: must be SHA-pinned (40-hex commit hash)`, () => {
      const unpinned = externalUses.filter((u) => !SHA_RE.test(u));
      expect(
        unpinned,
        `Unpinned action(s) in ${name}: ${unpinned.join(', ')}\n\n` +
          `Supply-chain risk: mutable tags can be moved to point to malicious code.\n` +
          `Fix: replace @tagname with @<40-hex-sha>  # tagname\n` +
          `Get SHA: curl -s https://api.github.com/repos/<owner>/<repo>/commits/<tag> | jq .sha`
      ).toHaveLength(0);
    });
  }
});

describe('GHA Workflow Security — explicit permissions block', () => {
  if (workflowFiles.length === 0) {
    it.skip('no workflow files found — skipping', () => {});
    return;
  }

  for (const { name, content } of workflowFiles) {
    it(`[${name}] must have a top-level permissions: key`, () => {
      // Check for `permissions:` at the start of a line (top-level YAML key)
      const hasPermissions = /^permissions:/m.test(content);
      expect(
        hasPermissions,
        `No top-level permissions: block in ${name}.\n` +
          `Without it, GITHUB_TOKEN defaults to write access on all scopes.\n` +
          `Fix: add permissions: read-all or list the minimum required scopes.`
      ).toBe(true);
    });
  }
});

describe('GHA Workflow Security — concurrency guards', () => {
  if (workflowFiles.length === 0) {
    it.skip('no workflow files found — skipping', () => {});
    return;
  }

  for (const { name, content } of workflowFiles) {
    it(`[${name}] must have a concurrency: key`, () => {
      const hasConcurrency = /^concurrency:/m.test(content);
      expect(
        hasConcurrency,
        `No concurrency: block in ${name}.\n` +
          `Without it, two simultaneous triggers produce duplicate runs and TOCTOU\n` +
          `race conditions on any shared state (queue files, git pushes).\n` +
          `Fix: add a concurrency: group scoped to the workflow + ref.`
      ).toBe(true);
    });
  }
});
