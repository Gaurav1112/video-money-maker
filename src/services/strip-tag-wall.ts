/**
 * strip-tag-wall.ts — Panel-21 P1-2 reusable hashtag-wall filter
 *
 * Strips lines whose hashtag-per-token ratio exceeds `maxTagRatio` when
 * the line falls outside the first `preserveTopN` lines. This preserves
 * YouTube's "first 3 hashtag" signal while scrubbing the long tail wall
 * that damages Telegram CTR (Schiffer / Mogilko flag: ratio > 0.7).
 */

export interface StripTagWallOptions {
  /** Lines whose tag ratio exceeds this threshold are dropped. Default 0.7. */
  maxTagRatio?: number;
  /**
   * The first N lines are always kept regardless of tag ratio — they may
   * carry the hook + first hashtag signal YT needs. Default 3.
   */
  preserveTopN?: number;
}

/** Returns true for tokens that look like a #hashtag. */
function isHashtag(token: string): boolean {
  return /^#[^\s#]+$/.test(token);
}

/**
 * Strips lines that are hashtag-wall spam from `text`.
 *
 * Rules:
 * - Empty text → returns ''.
 * - Lines with 0 tokens → kept (blank separator lines).
 * - Lines within the first `preserveTopN` → always kept.
 * - Pure-emoji lines → kept (emoji counted as non-tag tokens).
 * - A line is dropped only when its ratio of hashtag-tokens / total-tokens
 *   is STRICTLY GREATER THAN `maxTagRatio` (equal ratio is kept).
 */
export function stripTagWall(text: string, opts: StripTagWallOptions = {}): string {
  if (!text) return '';

  const maxTagRatio = opts.maxTagRatio ?? 0.7;
  const preserveTopN = opts.preserveTopN ?? 3;

  const lines = text.split('\n');
  const kept: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Always preserve lines in the protected head window.
    if (i < preserveTopN) {
      kept.push(line);
      continue;
    }

    const tokens = line.trim().split(/\s+/).filter(Boolean);

    // Keep lines with no tokens (blank lines / whitespace-only).
    if (tokens.length === 0) {
      kept.push(line);
      continue;
    }

    const tagCount = tokens.filter(isHashtag).length;
    const ratio = tagCount / tokens.length;

    // Drop the line only if strictly above the threshold.
    if (ratio > maxTagRatio) {
      continue;
    }

    kept.push(line);
  }

  return kept.join('\n');
}
