import type { StockStoryboard } from '../stock/types.js';
import { createHash } from 'node:crypto';

/**
 * SINGLE source of truth for every variant of the brand identifier.
 * Aud4 P1: previously `@GuruSishya-India` (subscribe), `#GuruSishyaIndia`
 * (hashtag block), and `gurusishyaindia` (tag list) were three hardcoded
 * literals in one file — any rename required a manual multi-site sed.
 * Now derived programmatically so they cannot drift.
 */
export const BRAND_HANDLE_RAW = 'GuruSishya-India';
export const BRAND_AT = `@${BRAND_HANDLE_RAW}`;
export const BRAND_HASHTAG = `#${BRAND_HANDLE_RAW.replace(/-/g, '')}`;
export const BRAND_TAG = BRAND_HANDLE_RAW.toLowerCase().replace(/-/g, '');

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
  /**
   * The exact 4-7 word hook headline rendered on-screen for scene 0. When
   * present, the YT title wraps this verbatim so the first thing a viewer
   * sees on the Shorts shelf matches what they hear in the first 3s of
   * audio (Dist2 coherence requirement).
   */
  hookHeadline?: string;
}

/** YouTube hard cap is 100 chars; we leave 6 for `#Shorts` ⇒ 94 for hook copy. */
const TITLE_MAX = 100;
const HOOK_BUDGET = TITLE_MAX - ' #Shorts'.length;
const SITE_BASE = 'https://guru-sishya.in';
const UTM_BASE = 'utm_source=yt_shorts&utm_medium=description';

/**
 * Power-word title templates validated across Fireship/NeetCode/ByteByteGo/
 * Striver/Aman Dhattarwal/Apna College Shorts. Mix of English (~60%) and
 * Hinglish (~40%) — the Hinglish variants test substantially better on
 * Indian audience CTR per Apna College / Anuj Bhaiya analytics. Picked
 * deterministically by hash(topic) so every run for the same topic emits
 * the same title (idempotent uploads).
 *
 * Each template MUST keep `${topic}` ≤ ~38 chars to stay within HOOK_BUDGET
 * even when the verb prefix is long.
 */
const TITLE_TEMPLATES: Array<(topic: string) => string> = [
  (t) => `${t} explained in 60 seconds`,
  (t) => `Most engineers get ${t} wrong`,
  (t) => `If you don't know ${t}, you'll fail FAANG`,
  (t) => `Bhai, ${t} ek baar dhyaan se samajh lo`,
  (t) => `3 things about ${t} you must know`,
  (t) => `Why FAANG asks ${t} in every round`,
  (t) => `${t} ka asli concept — placement walo ke liye`,
  (t) => `Sirf 60 seconds me ${t} clear`,
  (t) => `${t} samajh gaye toh placement pakka`,
];

function pickByHash<T>(seed: string, options: T[]): T {
  const hash = createHash('sha1').update(seed).digest();
  const idx = hash.readUInt32BE(0) % options.length;
  return options[idx]!;
}

function shortHook(topic: string, override?: string): string {
  // If the renderer passed the on-screen hook headline, use it verbatim so
  // the YT title and the first 3s of on-screen text/voice all carry the
  // same words (Dist2 coherence requirement). Falls back to template-pick
  // when no override is provided.
  if (override) {
    const trimmed = override.replace(/\s+/g, ' ').trim();
    if (trimmed) {
      return trimmed.length <= HOOK_BUDGET
        ? trimmed
        : trimmed.slice(0, HOOK_BUDGET - 1).trimEnd() + '…';
    }
  }
  const cleaned = topic.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim();
  const template = pickByHash(cleaned, TITLE_TEMPLATES);
  const candidate = template(cleaned);
  if (candidate.length <= HOOK_BUDGET) return candidate;
  if (cleaned.length <= HOOK_BUDGET) return cleaned;
  return cleaned.slice(0, HOOK_BUDGET - 1).trimEnd() + '…';
}

/**
 * Curated brand-vocabulary niche hashtags. Replaces the previous
 * `baseTags.slice(0,3)` word-split which emitted noise like
 * "#load #balancer #explained" — fragmented words that have no
 * search authority and dilute brand signal (Aud4 P0).
 */
const NICHE_HASHTAGS = '#SystemDesignShorts #DSAShorts #FAANGPrep #HinglishTech #CodingShorts';
const BROAD_HASHTAGS = `#Shorts #TechShorts #FAANG #DSA #SystemDesign ${BRAND_HASHTAG}`;

function withUtm(url: string, slug: string, content: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${UTM_BASE}&utm_campaign=${encodeURIComponent(slug)}&utm_content=${content}`;
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
  const { licenses = [], extraTags = [], siteTopicSlug, hookHeadline } = input;
  const hook = shortHook(storyboard.topic, hookHeadline);
  const title = `${hook} #Shorts`.slice(0, TITLE_MAX);

  // Tag set: topic-derived + ICP-search + brand + caller extras. Expanded
  // ICP tags target tier-1 college / campus-placement search alongside
  // FAANG (Aud1 + Dist4 P1).
  const baseTags = topicToTags(storyboard.topic);
  const ICP_TAGS = [
    'faang', 'leetcode', 'dsa', 'systemdesign', 'placement',
    'interviewprep', 'codingshorts', 'cseducation', 'lowleveldesign',
    'softwareengineer', 'computerscience', 'gate2026',
    'campusplacement', 'tier1college', 'apnacollege', 'strivergrind',
  ];
  const tags = Array.from(
    new Set([...baseTags, ...extraTags, ...ICP_TAGS, 'shorts', BRAND_TAG])
  ).slice(0, 30);

  const slug = siteTopicSlug ?? slugifyTopic(storyboard.topic);
  // UTM-tag every CTA URL so we can attribute email sign-ups, deep-link
  // taps, and session bookings to specific topic Shorts (Aud2 P0).
  const ctaUrl = withUtm(`${SITE_BASE}/topics/${slug}`, slug, 'cta_deeplink');
  const leadMagnetUrl = withUtm(`${SITE_BASE}/free-pdf-faang-80-questions`, slug, 'cta_leadmagnet');
  const sessionsUrl = withUtm(`${SITE_BASE}/sessions`, slug, 'cta_sessions');
  const proUrl = withUtm(`${SITE_BASE}/pro`, slug, 'cta_pro');

  const sceneSummaries = storyboard.scenes
    .slice(0, 4)
    .map((s, i) => `${i + 1}. ${(s.narration || s.type).replace(/\s+/g, ' ').trim().slice(0, 110)}`)
    .join('\n');

  const credits = summariseLicenses(licenses);

  // Description: front-load ALL primary CTAs (deep-link + lead-magnet +
  // subscribe) within the first 4 lines so they sit above the YT mobile
  // "...more" fold (Aud3 P0). Body, branding, and supporting CTAs follow
  // below. License credits last to keep them legally compliant but out of
  // the conversion path.
  //
  // Aud3 P0: empty `credits` (no license) used to leak as `''` past the
  // `line !== undefined` filter, producing a triple blank line in the
  // published description. The conditional spread below removes it
  // cleanly when there are no credits.
  const description = [
    `${hook} — Hinglish me, 60 seconds me. Isko samajhna zaroori hai agar tum FAANG mein jaana chahte ho.`,
    `🔗 Full deep-dive + practice: ${ctaUrl}`,
    `📘 Instant FREE 80-Q FAANG cheatsheet (no signup) → ${leadMagnetUrl}`,
    `👉 Subscribe ${BRAND_AT} — daily 60-sec tech Shorts; pinned-comment links the day's deep-dive PDF.`,
    `— ${BRAND_HANDLE_RAW} | Empowering Indian engineers, one Short at a time.`,
    '',
    `In this Short you will learn ${storyboard.topic} the way a senior engineer explains it to a junior in a code review. Hum cover karenge core idea, kab use karna hai, common interview trap, aur ek-line takeaway jo tum next FAANG / system-design round me bol sakte ho.`,
    '',
    'Inside this 60-second Short:',
    sceneSummaries || '1. The hook — why this matters now\n2. The core mechanism\n3. The interview trap\n4. The takeaway',
    '',
    '🎯 Daily Hinglish dev-edu Shorts — system design, DSA, low-level design, OS/DBMS internals, behavioural — every single day. Built for Indian CSE students preparing for FAANG.',
    '',
    `📗 PRO tier — 500+ curated Q-bank · weekly new questions · ₹149/mo → ${proUrl}`,
    `👉 Mock interviews + 1:1 mentoring (limited slots this week) → ${sessionsUrl}`,
    `👉 Comment which topic to cover next — top-voted topic ships within 7 days.`,
    '',
    ...(credits ? [credits, ''] : []),
    `${NICHE_HASHTAGS} ${BROAD_HASHTAGS}`,
  ].join('\n');

  return { title, description, tags };
}
