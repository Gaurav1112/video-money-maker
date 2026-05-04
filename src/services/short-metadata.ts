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
/**
 * Brand site + value-prop tagline. The watermark previously showed only
 * @GuruSishya-India which gave viewers nowhere to go between Shorts —
 * the only conversion path was YT subscribe. Surfacing the .in domain
 * + a concrete promise ("Interview Ready in 21 Days") moves a passive
 * subscribe-pull into an active off-platform funnel where the channel
 * owns the audience relationship (not the YT algorithm).
 *
 * Single source of truth: every scene watermark, end-card CTA,
 * description footer, and metadata tagline must derive from these
 * constants so a future rebrand is a one-line change.
 */
export const BRAND_SITE = 'guru-sishya.in';
export const BRAND_SITE_URL = `https://www.${BRAND_SITE}`;
export const BRAND_TAGLINE = 'Interview Ready in 21 Days';
export const BRAND_TAGLINE_HINGLISH = 'Interview Ready in 21 Din';

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
  /**
   * Topic-bank curated `shortTitle` (Panel-8 Dist P0). When provided, this
   * overrides the formulaic TITLE_TEMPLATES path so each topic ships with
   * a unique, hand-tuned title — eliminating shelf-fatigue from the
   * "Most engineers get X wrong" stamp pattern.
   */
  shortTitle?: string;
  /**
   * Topic-bank `salaryBand` (e.g. "₹35-55LPA"). When set, surfaces in
   * the description as a stake anchor — Panel-9 Aud P1 (was dead).
   */
  salaryBand?: string;
  /**
   * Topic-bank `stake` line (e.g. "fail Amazon SDE-2 system design
   * round"). When set, surfaces in the description as the consequence
   * frame — Panel-9 Aud P1 (was dead).
   */
  stake?: string;
  /**
   * Hinglish hook spoken in the audio. Surfaced in the description as
   * a quoted line so the YT search index gets the Hindi keywords —
   * Panel-10 Dist P1 (Schiffer): hookHinglish was previously only in
   * the audio waveform; nothing pulled it into the indexable text.
   */
  hookHinglish?: string;
  /**
   * Topic-bank `category` (system-design / dsa / behavioral /
   * db-internals). Panel-11 Aud P1 (Striver): when category is not
   * "dsa" we drop the `strivergrind` tag — algorithmically incoherent
   * for behavioral/system-design content and poisons recommendation
   * signal for Striver's ICP.
   */
  category?: string;
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
  const { licenses = [], extraTags = [], siteTopicSlug, hookHeadline, shortTitle, salaryBand, stake, hookHinglish, category } = input;
  // Panel-8 Dist P0: prefer topic-bank curated shortTitle when present —
  // each one is a hand-written power-line tuned to the specific topic
  // ("90% of Engineers Get Kafka Consumer Groups WRONG 😳"). Avoids
  // formulaic shelf-fatigue across 110 videos. Falls back to template
  // path when the bank has no entry.
  const trimmedShortTitle = (shortTitle ?? '').replace(/\s+/g, ' ').trim();
  const baseHook = trimmedShortTitle.length > 0
    ? trimmedShortTitle.length <= HOOK_BUDGET
      ? trimmedShortTitle
      : trimmedShortTitle.slice(0, HOOK_BUDGET - 1).trimEnd() + '…'
    : shortHook(storyboard.topic, hookHeadline);
  const hook = baseHook;
  const title = `${baseHook} #Shorts`.slice(0, TITLE_MAX);

  // Tag set: topic-derived + ICP-search + brand + caller extras + category-
  // aware additions. Panel-12 Dist P1 (Schiffer) + Panel-13 Aud/Dist P0:
  // expand to ≥25 unique tags after merge — YT allows up to 30 free
  // indexable signals, leaving them empty is foregone SEO surface area.
  // BUT: tags must be category-coherent. Panel-13 flagged that
  // `gate2026`, `tier1college`, `campusplacement`, and `leetcode` route
  // system-design / db-internals videos into the wrong recommendation
  // bucket (academic exam-prep grind vs senior-dev / global-backend).
  // These are now gated on category just like `strivergrind` was in P11.
  const baseTags = topicToTags(storyboard.topic);
  const cat = (category ?? '').toLowerCase();
  const isFresherFunnel = cat === 'dsa' || cat === 'behavioral' || cat === '';
  const isDsaSurface = cat === 'dsa' || cat === '';
  // Core tags safe across every category (true cross-funnel CSE / FAANG
  // search anchors that don't bias the recommendation graph).
  // Panel-15 Aud P1 (Kunal/Apna): `apnacollege` was identical pollution
  // class to `strivergrind` and `leetcode` already gated in P11/P13 —
  // when system-design or db-internals shorts ship with `apnacollege`
  // they pull mass-fresher recommendation signal that suppresses the
  // senior-dev / global discovery graph. Moved into the fresher-funnel
  // bucket so it only fires on dsa / behavioral / empty category.
  const CORE_ICP_TAGS = [
    'faang', 'dsa', 'systemdesign', 'placement',
    'interviewprep', 'codingshorts', 'cseducation', 'lowleveldesign',
    'softwareengineer', 'computerscience',
  ];
  // India-academic / fresher-funnel tags — only attach to dsa /
  // behavioral / empty category. On system-design + db-internals
  // they suppress global / senior-dev discovery (Kunal + Harkirat ICP).
  const FRESHER_FUNNEL_TAGS = isFresherFunnel
    ? ['gate2026', 'tier1college', 'campusplacement', 'apnacollege']
    : [];
  // Panel-13 Dist P0 (Schiffer): `leetcode` is a DSA-platform signal,
  // identical pollution risk to the `strivergrind` problem fixed in
  // P11 — gate identically on dsa / empty category.
  const DSA_PLATFORM_TAGS = isDsaSurface
    ? ['leetcode', 'strivergrind']
    : [];
  // Panel-12 Dist P1 (Schiffer): category-aware high-volume tag
  // expansion. Uses verifiably high-volume Indian-CSE search terms
  // (validated via Apna College / Striver / Take U Forward tag clouds).
  const CATEGORY_TAGS: Record<string, string[]> = {
    'dsa': [
      'leetcodeindia', 'codingproblems', 'dsainterview',
      'algorithms', 'datastructures', 'codingpractice',
      'striver', 'neetcode', 'cphelp',
    ],
    'system-design': [
      'systemdesigninterview', 'hld', 'lld',
      'designpatterns', 'scalability', 'distributedsystems',
      'microservices', 'backendengineering', 'softwarearchitecture',
    ],
    'behavioral': [
      'hrinterview', 'behavioralinterview', 'softskills',
      'placementtips', 'tellmeaboutyourself', 'starmethod',
      'careeradvice', 'jobinterview',
    ],
    'db-internals': [
      // Panel-13 Aud P1 (Harkirat): `sqlinterview` and `dbms` are
      // university-course / interview-prep vocabulary — Harkirat's
      // production-DB ICP searches `postgresql`, `query planner`,
      // `explain analyze`, not `dbms`. Swapped academic terms for
      // production-DB ones; kept `database`, `mysql`, `transactions`,
      // `indexing`, `queryoptimization` which serve both audiences.
      'database', 'postgresql', 'mysql',
      'queryplanner', 'explainanalyze', 'transactions',
      'indexing', 'queryoptimization',
    ],
  };
  const ICP_TAGS = [
    ...CORE_ICP_TAGS,
    ...FRESHER_FUNNEL_TAGS,
    ...DSA_PLATFORM_TAGS,
    ...(CATEGORY_TAGS[cat] ?? []),
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
  // Stake line shows ONLY when the bank entry curated both salaryBand
  // and stake (Panel-9 Aud P1 — make the consequence concrete in the
  // first 4 lines of the description).
  const stakeLine = salaryBand && stake
    ? `🤑 ${salaryBand} roles · ${stake}`
    : salaryBand
      ? `🤑 ${salaryBand} roles`
      : stake
        ? `⚠️ ${stake}`
        : null;

  // Panel-15 Aud P1 (Apna College / Harkirat): when the bank entry has
  // no curated salaryBand (most system-design / db-internals topics)
  // the description still needs a Rs-anchor for the GATE/fresher ICP
  // — Apna College persona converts on numeric salary tiers, not on
  // abstract FAANG positioning. Surface the canonical 2026 India SDE
  // band (E3 -> E4 -> E5 / Tier-2 -> Tier-1 -> FAANG-India ladder)
  // when no per-topic band exists. Fires on every category — system
  // design and db-internals viewers also map to these tiers.
  const fallbackSalaryLine = !salaryBand
    ? '💼 FAANG India SDE band: ₹14L (entry) → ₹26L (mid) → ₹45L+ (senior)'
    : null;

  // Panel-21 Dist P0-A (Schiffer/Moore): pre-B28 the hashtag wall sat
  // on line 2 — directly after the hook — which placed 11 hashtags
  // ABOVE the YT mobile "see more" fold and visibly suppressed
  // cold-start CTR (Schiffer 6.5, Moore 6.5). Reorganized to lead-
  // with-value: hook → stake → spoken Hinglish → CTAs → topic
  // narrative → ladder → PRO/sessions → THEN the hashtag block at the
  // very bottom. YT only needs the FIRST 3 hashtags to count as topic
  // signal — keeping the full wall at the foot still gives legacy
  // parsers something to chew on without burning the fold.
  const description = [
    `⚡ ${hook}`,
    ...(stakeLine ? [stakeLine] : []),
    ...(fallbackSalaryLine ? [fallbackSalaryLine] : []),
    ...(hookHinglish ? [`🎙️ "${hookHinglish}"`] : []),
    `🔗 Full deep-dive + practice: ${ctaUrl}`,
    `📘 Instant FREE 80-Q FAANG cheatsheet (no signup) → ${leadMagnetUrl}`,
    `👉 Bhai, subscribe karo ${BRAND_AT} — roz ek naya 60-sec tech Short; pinned comment me aaj ka deep-dive PDF link milega.`,
    `— ${BRAND_HANDLE_RAW} | Empowering Indian engineers, one Short at a time.`,
    '',
    `Is Short me tum sikhoge ${storyboard.topic} — exactly waise jaise ek senior engineer apne junior ko code review me samjhata hai. Hum cover karenge core idea, kab use karna hai, common interview trap, aur ek-line takeaway jo tum next FAANG / system-design round me bol sakte ho.`,
    '',
    'Inside this 60-second Short:',
    sceneSummaries || '1. The hook — why this matters now\n2. The core mechanism\n3. The interview trap\n4. The takeaway',
    '',
    `🎯 Roz ek naya Hinglish dev Short — system design, DSA, low-level design, OS/DBMS internals — Indian CSE students ke liye, FAANG ki taiyaari ke liye.`,
    '',
    `📗 PRO tier — 500+ curated Q-bank · weekly new questions · ₹149/mo → ${proUrl}`,
    `👉 Mock interviews + 1:1 mentoring (limited slots this week) → ${sessionsUrl}`,
    `👉 Comment karo agla topic — top-voted topic 7 din me ship hota hai.`,
    '',
    // License credits (when present) sit just above the hashtag block.
    ...(credits ? [credits, ''] : []),
    // Panel-21 P0-A: hashtag block now lives at the BOTTOM of the
    // description. YT counts only the first 3 hashtags (top of the
    // string OR hashtags adjacent to the title) as topic signal — the
    // full wall here serves legacy parsers + accessibility tools
    // without consuming above-fold real estate.
    `${NICHE_HASHTAGS} ${BROAD_HASHTAGS}`,
  ].join('\n');

  return { title, description, tags };
}
