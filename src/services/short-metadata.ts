import type { StockStoryboard } from '../stock/types.js';
import { createHash } from 'node:crypto';

export interface ShortMetadata {
  title: string;
  description: string;
  tags: string[];
}

export interface LicenseClip {
  id: string;
  provider: string;
  url?: string;
  attribution?: string;
}

export interface MetadataInput {
  /** Optional license credits to surface in description (legal + trust). */
  licenses?: LicenseClip[];
  /** Extra tags to merge into the tag list. */
  extraTags?: string[];
  /** Specific topic-bank slug for the deep-link CTA on the site. */
  siteTopicSlug?: string;
}

/** YouTube hard cap is 100 chars; we leave 6 for `#Shorts` ⇒ 94 for hook copy. */
const TITLE_MAX = 100;
const HOOK_BUDGET = TITLE_MAX - ' #Shorts'.length;
const SITE_BASE = 'https://guru-sishya.in';

/**
 * Power-word title templates validated across Fireship/NeetCode/ByteByteGo/
 * Striver/Aman Dhattarwal Shorts. Picked deterministically by hash(topic) so
 * every run for the same topic emits the same title (idempotent uploads).
 *
 * Each template MUST keep `${topic}` ≤ ~38 chars to stay within HOOK_BUDGET
 * even when the verb prefix is long.
 */
const TITLE_TEMPLATES: Array<(topic: string) => string> = [
  (t) => `${t} explained in 60 seconds`,
  (t) => `Most engineers get ${t} wrong`,
  (t) => `If you don't know ${t}, you'll fail FAANG`,
  (t) => `${t} — what no one tells you`,
  (t) => `3 things about ${t} you must know`,
  (t) => `Why FAANG asks ${t} in every round`,
];

function pickByHash<T>(seed: string, options: T[]): T {
  const hash = createHash('sha1').update(seed).digest();
  const idx = hash.readUInt32BE(0) % options.length;
  return options[idx]!;
}

function shortHook(topic: string): string {
  const cleaned = topic.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim();
  // Pick a deterministic template; if it overflows, fall back to plain topic
  // (no template) which always fits.
  const template = pickByHash(cleaned, TITLE_TEMPLATES);
  const candidate = template(cleaned);
  if (candidate.length <= HOOK_BUDGET) return candidate;
  // Fall back to short form
  if (cleaned.length <= HOOK_BUDGET) return cleaned;
  return cleaned.slice(0, HOOK_BUDGET - 1).trimEnd() + '…';
}

function topicToTags(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 10);
}

function slugifyTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function summariseLicenses(clips: LicenseClip[]): string {
  if (!clips.length) return '';
  const credits = clips
    .map((c) => `${c.provider}: ${c.attribution ?? c.id}`)
    .filter(Boolean)
    .slice(0, 6);
  return `📽️ Footage credits — ${credits.join(' · ')}`;
}

/**
 * Builds full YT Shorts metadata: title (≤100 chars, power-word template),
 * description (CTA-first, lead-magnet, license attribution, hashtag block),
 * tags (ICP-relevant FAANG/DSA/system-design search terms).
 *
 * Pipeline-internal callers should pass `licenses` so footage attribution
 * shows up in the published description (Mixkit/Pexels/Pixabay TOS).
 */
export function generateShortMetadata(
  storyboard: StockStoryboard,
  input: MetadataInput = {}
): ShortMetadata {
  const { licenses = [], extraTags = [], siteTopicSlug } = input;
  const hook = shortHook(storyboard.topic);
  const title = `${hook} #Shorts`.slice(0, TITLE_MAX);

  // Tag set: topic-derived + ICP-search + brand + caller extras. ICP tags
  // are validated against the search-volume tags Striver/NeetCode/Apna
  // College Shorts surface under.
  const baseTags = topicToTags(storyboard.topic);
  const ICP_TAGS = [
    'faang', 'leetcode', 'dsa', 'systemdesign', 'placement',
    'interviewprep', 'codingshorts', 'cseducation', 'lowleveldesign',
    'softwareengineer', 'computerscience', 'gate2026',
  ];
  const tags = Array.from(
    new Set([...baseTags, ...extraTags, ...ICP_TAGS, 'shorts', 'gurusishyaindia'])
  ).slice(0, 30);

  const slug = siteTopicSlug ?? slugifyTopic(storyboard.topic);
  const ctaUrl = `${SITE_BASE}/topics/${slug}`;
  const leadMagnetUrl = `${SITE_BASE}/free-pdf-faang-80-questions`;

  const sceneSummaries = storyboard.scenes
    .slice(0, 4)
    .map((s, i) => `${i + 1}. ${(s.narration || s.type).replace(/\s+/g, ' ').trim().slice(0, 110)}`)
    .join('\n');

  const niche = baseTags.slice(0, 3).map((t) => `#${t}`).join(' ');
  const broad = '#Shorts #TechShorts #FAANG #DSA #SystemDesign';
  const credits = summariseLicenses(licenses);

  // Description: front-load the two CTAs (deep link + lead magnet) so they
  // appear above the fold on YT mobile (first ~2 lines visible before
  // "...more" tap).
  const description = [
    `${hook} — Hinglish me, 60 seconds me.`,
    `🔗 Full deep-dive + practice: ${ctaUrl}`,
    `📘 FREE 80-Q FAANG interview cheatsheet → ${leadMagnetUrl}`,
    '',
    `In this Short you will learn ${storyboard.topic} the way a senior engineer explains it to a junior in a code review. We cover the core idea, when to use it, the most common interview trap, and the one-line takeaway you can quote in your next FAANG / system-design round.`,
    '',
    'Inside this 60-second Short:',
    sceneSummaries || '1. The hook — why this matters now\n2. The core mechanism\n3. The interview trap\n4. The takeaway',
    '',
    '🎯 Daily Hinglish dev-edu Shorts — system design, DSA, low-level design, OS/DBMS internals, behavioural — every single day. Built for Indian CSE students preparing for FAANG.',
    '',
    `👉 Subscribe @GuruSishya-India for daily 60-second tech Shorts.`,
    `👉 Comment which topic to cover next — top-voted topic ships within 7 days.`,
    `👉 Mock interviews + 1:1 mentoring → ${SITE_BASE}/sessions`,
    '',
    credits,
    '',
    `${niche} ${broad}`.trim(),
  ].filter((line) => line !== undefined).join('\n');

  return { title, description, tags };
}
