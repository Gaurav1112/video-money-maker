/**
 * weekly-template.ts — pure deterministic Markdown builder for the
 * Sunday Dev.to + Hashnode synthesis article.
 *
 * Determinism: no Math.random, no Date.now, no LLM. Same input → byte-identical
 * output. Tested via snapshot in scripts/__tests__/weekly-template.test.ts.
 */

export interface Short {
  id: string;
  title: string;
  youtubeUrl: string;
  publishedAt: string;
  topic: string;
}

export interface WeeklyArticle {
  title: string;
  body: string;
  tags: string[];
}

export const CANONICAL_URL = 'https://www.youtube.com/@GuruSishya-India';

const DEFAULT_TAGS = ['programming', 'webdev', 'computerscience', 'learning'];

/** Stable, lowercase, dedup. Cap at 4 (Dev.to article tag limit). */
function deriveTags(shorts: Short[]): string[] {
  if (shorts.length === 0) return DEFAULT_TAGS.slice(0, 4);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of shorts) {
    const t = s.topic.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
      if (out.length === 4) break;
    }
  }
  // Pad with defaults so an article always has 4 tags.
  for (const d of DEFAULT_TAGS) {
    if (out.length === 4) break;
    if (!seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out;
}

export function buildWeeklyArticle(shorts: Short[], isoWeek: string): WeeklyArticle {
  const title = `Week in Tech Shorts — ${isoWeek}`;

  const intro =
    shorts.length > 0
      ? `This week on the GuruSishya channel I shipped ${shorts.length} bite-sized tech Shorts covering systems-design fundamentals. Below is the digest with direct links — each one is under 60 seconds.`
      : `No new Shorts this week; the digest is paused.`;

  const sections = shorts
    .map((s, i) => {
      const num = i + 1;
      return [
        `## ${num}. ${s.title}`,
        ``,
        `Topic: \`${s.topic}\``,
        ``,
        `Watch: ${s.youtubeUrl}`,
        ``,
      ].join('\n');
    })
    .join('\n');

  const cta = [
    `## Subscribe`,
    ``,
    `Daily Shorts every weekday — subscribe at ${CANONICAL_URL} so the next one lands in your feed.`,
    ``,
  ].join('\n');

  const body = [intro, ``, sections, cta].join('\n');

  return {
    title,
    body,
    tags: deriveTags(shorts),
  };
}
