/**
 * tiktok-caption.ts — pure deterministic caption builder for F005.
 *
 * Same input → same output. No Math.random. No Date.now. Capped at TikTok's
 * 2200-char limit, preserving the 5 default hashtags even if the title must
 * be truncated.
 */

export const DEFAULT_HASHTAGS = [
  '#programming',
  '#coding',
  '#tech',
  '#devtok',
  '#learnontiktok',
] as const;

const TIKTOK_MAX = 2200;
const HASHTAG_SUFFIX = '\n\n' + DEFAULT_HASHTAGS.join(' ');
const TITLE_BUDGET = TIKTOK_MAX - HASHTAG_SUFFIX.length;

interface MetadataInput {
  youtube?: { title?: string };
  title?: string;
}

export function buildTikTokCaption(meta: MetadataInput): string {
  const rawTitle =
    meta.youtube?.title || meta.title || 'New tech short — watch till the end.';
  const title = rawTitle.length > TITLE_BUDGET ? rawTitle.slice(0, TITLE_BUDGET) : rawTitle;
  return `${title}${HASHTAG_SUFFIX}`;
}
