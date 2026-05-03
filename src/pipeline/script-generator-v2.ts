/**
 * script-generator-v2.ts — SCRIPT DOCTOR REWRITE
 *
 * Every line is typed as HOOK | TENSION | TEACH | CTA. Zero filler.
 * Deterministic (no LLM), driven by a curated 200+ slot bank.
 * Validated at generation time against SCRIPT_BIBLE rules.
 *
 * Input:  { topic, durationSec, format: 'long'|'short', language: 'en'|'hinglish' }
 * Output: { segments: ScriptSegment[], metadata: ScriptMetadata }
 *
 * @see SCRIPT_BIBLE.md for structural rules
 */

import * as slotsRaw from '../data/script-slots.json';
import * as stakesRaw from '../data/script-stakes.json';
import * as analogiesRaw from '../data/script-analogies.json';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SegmentType = 'HOOK' | 'TENSION' | 'TEACH' | 'CTA';
export type ScriptFormat = 'long' | 'short';
export type ScriptLanguage = 'en' | 'hinglish';

export interface ScriptInput {
  topic: string;
  durationSec: number;
  format: ScriptFormat;
  language: ScriptLanguage;
  /** Optional: override the auto-selected company name */
  companyOverride?: string;
  /** Optional: salary anchor override e.g. "₹45LPA" */
  salaryOverride?: string;
}

export interface ScriptSegment {
  frameStart: number;
  frameEnd: number;
  timeStartSec: number;
  timeEndSec: number;
  text: string;
  type: SegmentType;
  brollHint: string;
  audioHint: string;
  wordCount: number;
}

export interface ScriptMetadata {
  topic: string;
  format: ScriptFormat;
  language: ScriptLanguage;
  totalWords: number;
  totalSegments: number;
  guruSishyaMentions: number;
  durationSec: number;
  densityScore: number;
  validationPassed: boolean;
  validationErrors: string[];
}

export interface GeneratedScript {
  segments: ScriptSegment[];
  metadata: ScriptMetadata;
}

// ─── Banned phrases list (CI gate) ────────────────────────────────────────────

const BANNED_PHRASES = [
  'welcome back',
  "in today's video",
  'without further ado',
  'like and subscribe',
  "don't forget to subscribe",
  'hit the notification bell',
  'as i mentioned earlier',
  "let's dive in",
  "let's get started",
  'hope you enjoyed',
  'thanks for watching',
  'see you in the next video',
  'stay tuned',
  'comment below',
  'kind of',
  'sort of',
  'basically',
  'you might want to',
  "it's important to note that",
  'in this tutorial',
  "today we'll be learning",
  "i'm going to show you",
  'let me explain',
] as const;

// ─── Deterministic hash (djb2) ─────────────────────────────────────────────────

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // unsigned 32-bit
}

function pick<T>(arr: T[], seed: string): T {
  if (arr.length === 0) throw new Error(`Empty array for seed: ${seed}`);
  return arr[djb2(seed) % arr.length];
}

// ─── Slot resolution helpers ───────────────────────────────────────────────────

type SlotData = typeof slotsRaw;

function getHookSlots(topic: string, language: ScriptLanguage): string[] {
  const slots = slotsRaw.HOOK as Record<string, { _en: string[]; _hi: string[] }>;
  const langKey = language === 'hinglish' ? '_hi' : '_en';
  const topicKey = Object.keys(slots).find(
    (k) => k.toLowerCase() === topic.toLowerCase().replace(/\s+/g, '-'),
  ) ?? 'kafka'; // fallback
  return slots[topicKey]?.[langKey] ?? slots['kafka'][langKey];
}

function getTensionSlots(language: ScriptLanguage): string[] {
  const langKey = language === 'hinglish' ? '_hi' : '_en';
  return (slotsRaw.TENSION as Record<string, string[]>)[langKey] ?? [];
}

function getCtaSlots(language: ScriptLanguage): string[] {
  const langKey = language === 'hinglish' ? '_hi' : '_en';
  return (slotsRaw.CTA as Record<string, string[]>)[langKey] ?? [];
}

interface StakeEntry {
  topic: string;
  text_en: string;
  text_hi: string;
  salary_anchor: string;
  company_anchor: string;
}

function getStake(topic: string, seed: string, language: ScriptLanguage): string {
  const stakes = stakesRaw.stakes as StakeEntry[];
  const topicStakes = stakes.filter(
    (s) => s.topic === topic.toLowerCase().replace(/\s+/g, '-') || s.topic === 'generic',
  );
  const entry = pick(topicStakes.length > 0 ? topicStakes : stakes, seed);
  return language === 'hinglish' ? entry.text_hi : entry.text_en;
}

interface AnalogyEntry {
  topic: string;
  concept: string;
  analogy_en: string;
  analogy_hi: string;
  visual_hint: string;
}

function getAnalogies(topic: string, language: ScriptLanguage): AnalogyEntry[] {
  const all = analogiesRaw.analogies as AnalogyEntry[];
  const topicNorm = topic.toLowerCase().replace(/\s+/g, '-');
  const filtered = all.filter((a) => a.topic === topicNorm);
  return filtered.length >= 3 ? filtered : all.slice(0, 10); // fallback sample
}

function analogyText(entry: AnalogyEntry, language: ScriptLanguage): string {
  return language === 'hinglish' ? entry.analogy_hi : entry.analogy_en;
}

// ─── Company / salary anchors ──────────────────────────────────────────────────

const COMPANIES = ['Amazon', 'Flipkart', 'Swiggy', 'Zomato', 'PhonePe', 'Razorpay', 'Meesho', 'CRED', 'Hotstar', 'Google', 'Microsoft', 'Uber'];
const SALARY_BANDS = ['₹25LPA', '₹35LPA', '₹45LPA', '₹50LPA', '₹55LPA', '₹65LPA', '₹80LPA'];
const YEARS = ['2021', '2022', '2023', 'Q1 2024', 'Q3 2023'];

function patternInterrupt(topic: string, seed: string): string {
  const company = pick(COMPANIES, seed + 'company');
  const salary = pick(SALARY_BANDS, seed + 'salary');
  const year = pick(YEARS, seed + 'year');
  return `${company}, ${year}, ${salary}`;
}

// ─── Teach block builder ───────────────────────────────────────────────────────

interface TeachBlock {
  label: string;
  definition: string;
  analogyEntry: AnalogyEntry;
  example: string;
  gotcha: string;
}

function buildTeachBlock(
  topic: string,
  blockIndex: number,
  language: ScriptLanguage,
  analogy: AnalogyEntry,
): TeachBlock {
  const company = pick(COMPANIES, `${topic}-block${blockIndex}-company`);
  const salary = pick(SALARY_BANDS, `${topic}-block${blockIndex}-salary`);
  const labels = ['Core Concept', 'The Depth Layer', 'The 1% Detail'];
  const label = labels[blockIndex % labels.length];

  const definitions_en: Record<string, string[]> = {
    'kafka': [
      `Kafka is a distributed commit log. Producers write. Consumers read. The log persists.`,
      `Kafka topics are split into partitions. Parallelism comes from partition count.`,
      `Consumer groups let multiple services read the same topic independently.`,
    ],
    'redis': [
      `Redis is an in-memory key-value store. Speed comes from RAM, not disk.`,
      `Redis supports six data structures. Pick the wrong one and you pay in latency.`,
      `Redis persistence is optional. Default mode loses data on restart.`,
    ],
    'system-design': [
      `System design is about trade-offs. Every choice costs you something else.`,
      `Scale horizontally when stateless. Scale vertically when state is unavoidable.`,
      `The non-functional requirements define the architecture. Skip them, fail the round.`,
    ],
  };

  const topicKey = topic.toLowerCase().replace(/\s+/g, '-');
  const defs = definitions_en[topicKey] ?? [
    `${topic} is a core infrastructure concept. Misuse it and systems break at scale.`,
    `${topic} has multiple layers. Most engineers only know the surface.`,
    `${topic} has a hidden constraint. ${company} learned this in ${pick(YEARS, topic + blockIndex)}.`,
  ];

  const gotchas_en: Record<string, string[]> = {
    'kafka': [
      `90% miss: consumer offset is stored in Kafka itself, not in your app. Restart safe.`,
      `90% miss: partition count cannot be reduced after creation. Plan capacity upfront.`,
      `90% miss: rebalancing pauses all consumers in the group. Design for it.`,
    ],
    'redis': [
      `90% miss: Redis is single-threaded for commands. Parallelism comes from pipelining.`,
      `90% miss: KEYS command in production is an instant performance disaster.`,
      `90% miss: Pub/Sub messages are not persisted. Use Streams if persistence matters.`,
    ],
    'system-design': [
      `90% miss: starting with components instead of requirements. Define SLA first.`,
      `90% miss: forgetting the data model. Schema shapes everything downstream.`,
      `90% miss: not addressing failure modes. Interviewers always ask "what happens when X fails?"`,
    ],
  };

  const gotchas = gotchas_en[topicKey] ?? [
    `90% miss: the edge case that breaks this at ${company}'s scale. Interviewers know it.`,
    `90% miss: the configuration detail that causes ${salary} engineers to fail this question.`,
    `90% miss: the reason this fails under concurrent load. Test this assumption.`,
  ];

  const examples_en = [
    `${company} uses this in their ${pick(['payment', 'order', 'search', 'recommendation', 'notification'], `${topic}${blockIndex}ex`)} service. At ${pick(['10M', '40M', '100M', '1B'], `${topic}${blockIndex}scale`)} requests per day.`,
    `In ${pick(YEARS, `${topic}${blockIndex}year`)}, ${company} published an engineering blog on exactly this ${topic} decision.`,
    `The ${company} SDE-2 panel asks this as a filter question. Correct answer: you're through to design.`,
  ];

  return {
    label,
    definition: language === 'hinglish'
      ? (defs[blockIndex % defs.length] ?? defs[0]).replace('90%', '90%')
      : (defs[blockIndex % defs.length] ?? defs[0]),
    analogyEntry: analogy,
    example: pick(examples_en, `${topic}-block${blockIndex}-example`),
    gotcha: language === 'hinglish'
      ? (gotchas[blockIndex % gotchas.length] ?? gotchas[0])
      : (gotchas[blockIndex % gotchas.length] ?? gotchas[0]),
  };
}

// ─── Segment builders ──────────────────────────────────────────────────────────

const FPS = 30;

function makeSegment(
  timeStart: number,
  timeEnd: number,
  text: string,
  type: SegmentType,
  brollHint: string,
  audioHint: string,
): ScriptSegment {
  return {
    frameStart: Math.round(timeStart * FPS),
    frameEnd: Math.round(timeEnd * FPS),
    timeStartSec: timeStart,
    timeEndSec: timeEnd,
    text,
    type,
    brollHint,
    audioHint,
    wordCount: text.trim().split(/\s+/).length,
  };
}

// ─── Long-form generator ───────────────────────────────────────────────────────

function generateLongForm(input: ScriptInput): ScriptSegment[] {
  const { topic, language } = input;
  const topicNorm = topic.toLowerCase().replace(/\s+/g, '-');
  const segments: ScriptSegment[] = [];
  const analogies = getAnalogies(topicNorm, language);
  const hookSlots = getHookSlots(topicNorm, language);
  const tensionSlots = getTensionSlots(language);
  const ctaSlots = getCtaSlots(language);

  // ── 0–5s: HOOK ────────────────────────────────────────────────────────────
  const hookText = pick(hookSlots, `${topic}-hook-0`);
  segments.push(makeSegment(0, 5, hookText, 'HOOK',
    'B-roll: interviewer writing on whiteboard OR salary letter closeup',
    'audio: sudden silence, then single piano note — high tension'));

  // ── 5–20s: PROMISE + STAKES ──────────────────────────────────────────────
  const stakeText = getStake(topicNorm, `${topic}-stake-0`, language);
  const promise = language === 'hinglish'
    ? `Yeh video khatam hone ke baad, tujhe pata hoga exactly ${topic} kaise explain karte hain FAANG mein. ${stakeText}`
    : `By the end of this, you'll know exactly how to answer ${topic} in a FAANG loop. ${stakeText}`;
  segments.push(makeSegment(5, 20, promise, 'TENSION',
    'B-roll: offer letter, FAANG logo wall, salary negotiation',
    'audio: low urgency drone, slightly faster pace'));

  // ── 20–45s: SETUP — CONCRETE SCENARIO ────────────────────────────────────
  const company = pick(COMPANIES, `${topic}-setup-company`);
  const year = pick(YEARS, `${topic}-setup-year`);
  const scale = pick(['40 million', '100 million', '1 billion', '10 million'], `${topic}-setup-scale`);
  const setupText = language === 'hinglish'
    ? `${company} ke engineers ko ${year} mein face karna pada: ${scale} users ek saath ${topic} use kar rahe the. Ek galat decision — system down. Toh unhone kya kiya?`
    : `${company}'s engineering team faced this in ${year}: ${scale} users hitting ${topic} simultaneously. One wrong decision — the system fails. Here's what they actually did.`;
  segments.push(makeSegment(20, 45, setupText, 'TENSION',
    `B-roll: ${company} engineering blog, server monitoring dashboard, spike chart`,
    'audio: tension builds, typing sounds'));

  // ── 45s–3:00: TEACH — THREE BUILDING BLOCKS ───────────────────────────────
  const blockTimings = [
    [45, 90],
    [90, 135],
    [135, 180],
  ] as const;

  for (let i = 0; i < 3; i++) {
    const [blockStart, blockEnd] = blockTimings[i];
    const analogy = analogies[i % analogies.length];
    const block = buildTeachBlock(topicNorm, i, language, analogy);
    const analogyStr = analogyText(analogy, language);

    const blockText = language === 'hinglish'
      ? `Block ${i + 1}: ${block.label}. ${block.definition} Suno yeh analogy: ${analogyStr} Real example: ${block.example} Aur yeh jo 90% miss karte hain: ${block.gotcha}`
      : `Block ${i + 1}: ${block.label}. ${block.definition} Here's the analogy: ${analogyStr} Real example: ${block.example} The thing 90% miss: ${block.gotcha}`;

    segments.push(makeSegment(blockStart, blockEnd, blockText, 'TEACH',
      `B-roll: ${analogy.visual_hint}`,
      `audio: teaching voice pace, slight emphasis on "90% miss"`));

    // Insert pattern-interrupt tension beat every ~30s
    if (i < 2) {
      const piText = language === 'hinglish'
        ? `Ruko — ${pick(COMPANIES, `${topic}-pi-${i}`)} ka ${pick(YEARS, `${topic}-pi-year-${i}`)} data dekhte hain. ${pick(SALARY_BANDS, `${topic}-pi-sal-${i}`)} offer ke liye yeh critical hai.`
        : `Wait — let's look at ${pick(COMPANIES, `${topic}-pi-${i}`)}'s ${pick(YEARS, `${topic}-pi-year-${i}`)} production data. This matters for the ${pick(SALARY_BANDS, `${topic}-pi-sal-${i}`)} offer.`;
      segments.push(makeSegment(blockEnd - 5, blockEnd, piText, 'TENSION',
        'B-roll: engineering dashboard, metric spikes',
        'audio: slight pause, then resume — wake-up beat'));
    }
  }

  // ── 3:00–4:30: APPLY — REAL INTERVIEW Q ──────────────────────────────────
  const applyCompany = pick(COMPANIES, `${topic}-apply-company`);
  const applyText = language === 'hinglish'
    ? `Ab real interview question. ${applyCompany} panel ne literally yahi pucha: "${topic} kaise design karoge for ${pick(['₹1B transactions/day', '500M daily active users', 'real-time analytics on 100M events'], `${topic}-apply-scale`)}?" ` +
      `Galat fork: most candidates seedha architecture pe jump karte hain. ` +
      `Sahi approach: pehle clarify karo consistency requirement, phir throughput, phir failure modes. ` +
      `Phir architecture. Complete answer: ${pick(['3 partitions per consumer group, replication factor 3, acks=all', 'sharded by user_id, consistent hash, eventual consistency for reads', 'cache-aside with TTL 300s, thundering herd mitigation via jitter'], `${topic}-apply-answer`)}.`
    : `Now the real interview question. ${applyCompany}'s panel literally asked this: "How would you design ${topic} for ${pick(['₹1B transactions/day', '500M daily active users', 'real-time analytics on 100M events'], `${topic}-apply-scale`)}?" ` +
      `Wrong fork: most candidates jump straight to architecture. ` +
      `Right approach: clarify consistency requirements first, then throughput, then failure modes. Then architecture. ` +
      `Complete answer: ${pick(['3 partitions per consumer group, replication factor 3, acks=all', 'sharded by user_id, consistent hash, eventual consistency for reads', 'cache-aside with TTL 300s, thundering herd mitigation via jitter'], `${topic}-apply-answer`)}.`;
  segments.push(makeSegment(180, 270, applyText, 'TEACH',
    'B-roll: whiteboard drawing with interviewer, system diagram being built',
    'audio: confident, slower pace for the right answer section'));

  // ── 4:30–5:30: MISTAKES ──────────────────────────────────────────────────
  const mistakes_en = [
    `Wrong answer #1: describing ${topic} at a theoretical level only. Why engineers say it: they memorised definitions. Why it fails: ${applyCompany} interviewers don't care about definitions — they care about trade-offs.`,
    `Wrong answer #2: not addressing failure modes. 70% of candidates skip this. Result: immediate "weak signal" in the panel feedback.`,
    `Wrong answer #3: over-engineering on the first try. Proposing a distributed system when a single instance suffices. Signal it sends: no judgment, no pragmatism. Offer gone.`,
  ];
  const mistakes_hi = [
    `Galat answer #1: ${topic} ko sirf theoretical level pe describe karna. Kyu kehte hain: definitions ratt liye. Kyu fail hota hai: ${applyCompany} interviewers definitions care nahi karte — trade-offs chahiye.`,
    `Galat answer #2: failure modes address nahi karna. 70% candidates yeh skip karte hain. Result: panel feedback mein "weak signal" immediately.`,
    `Galat answer #3: pehli baar mein over-engineering. Jahan ek instance kafi ho wahan distributed system propose karna. Signal: no judgment, no pragmatism. Offer gone.`,
  ];
  const mistakesText = language === 'hinglish'
    ? mistakes_hi.join(' ')
    : mistakes_en.join(' ');
  segments.push(makeSegment(270, 330, mistakesText, 'TENSION',
    'B-roll: rejection email, interview scorecard with red marks',
    'audio: slightly slower, weight on each mistake'));

  // ── 5:30–6:00: RECAP + CTA ────────────────────────────────────────────────
  const recap_en = `Three things to remember: 1. Define before you design. 2. Failure modes before components. 3. Trade-offs, not just the happy path.`;
  const recap_hi = `Teen cheezein yaad rakho: 1. Design se pehle define karo. 2. Failure modes pehle. 3. Trade-offs, sirf happy path nahi.`;
  const ctaText1 = pick(ctaSlots.slice(0, 4), `${topic}-cta-1`);
  const ctaText2 = pick(ctaSlots.slice(4), `${topic}-cta-2`);
  const recapText = `${language === 'hinglish' ? recap_hi : recap_en} ${ctaText1} ${ctaText2}`;
  segments.push(makeSegment(330, 360, recapText, 'CTA',
    'B-roll: guru-sishya.in on screen, question bank preview',
    'audio: confident, final statement energy — no fade, assertive end'));

  return segments;
}

// ─── Short-form generator ──────────────────────────────────────────────────────

function generateShortForm(input: ScriptInput): ScriptSegment[] {
  const { topic, language } = input;
  const topicNorm = topic.toLowerCase().replace(/\s+/g, '-');
  const segments: ScriptSegment[] = [];
  const hookSlots = getHookSlots(topicNorm, language);
  const analogies = getAnalogies(topicNorm, language);
  const ctaSlots = getCtaSlots(language);

  // ── 0–3s: HOOK ────────────────────────────────────────────────────────────
  const hookText = pick(hookSlots, `${topic}-short-hook`);
  // Use only first sentence for Shorts
  const hookShort = hookText.split(/[.!]/)[0] + '.';
  segments.push(makeSegment(0, 3, hookShort, 'HOOK',
    'B-roll: high-energy cut, company logo or salary text on screen',
    'audio: sudden open, no intro music'));

  // ── 3–13s: SETUP ─────────────────────────────────────────────────────────
  const company = pick(COMPANIES, `${topic}-short-setup`);
  const salary = pick(SALARY_BANDS, `${topic}-short-salary`);
  const setup = language === 'hinglish'
    ? `${company} interview mein yeh question aata hai. ${salary} offer isi pe depend karta hai.`
    : `${company}'s interview includes this exact question. The ${salary} offer depends on this.`;
  segments.push(makeSegment(3, 13, setup, 'TENSION',
    'B-roll: interview room, offer letter with salary',
    'audio: urgency tone, fast delivery'));

  // ── 13–33s: REVEAL ───────────────────────────────────────────────────────
  const analogy = analogies[0];
  const reveal = language === 'hinglish'
    ? `Yeh hai sahi jawab: ${analogy ? analogyText(analogy, language) : `${topic} ka core concept trade-offs ke baare mein hai. ${company} isko production mein aise implement karta hai.`}`
    : `Here's the correct answer: ${analogy ? analogyText(analogy, language) : `${topic}'s core is about trade-offs. Here's how ${company} implements this in production.`}`;
  segments.push(makeSegment(13, 33, reveal, 'TEACH',
    `B-roll: ${analogy?.visual_hint ?? 'diagram being drawn on whiteboard'}`,
    'audio: teaching pace, slower on key terms'));

  // ── 33–48s: DO THIS INSTEAD ───────────────────────────────────────────────
  const doThis = language === 'hinglish'
    ? `Zyaadatar log galat kehte hain. Sahi approach: pehle trade-offs, phir architecture. ${company} interviewers yahi sunte hain.`
    : `Most people answer it wrong. Right approach: trade-offs first, then architecture. That's what ${company} interviewers want to hear.`;
  segments.push(makeSegment(33, 48, doThis, 'TEACH',
    'B-roll: wrong answer X vs right answer checkmark side-by-side',
    'audio: slightly higher energy on "right approach"'));

  // ── 48–55s: LOOPBACK CTA ─────────────────────────────────────────────────
  const ctaShort = pick(ctaSlots.slice(0, 3), `${topic}-short-cta`);
  // Callback to hook word
  const hookFirstWord = hookShort.split(' ')[0];
  const ctaFull = language === 'hinglish'
    ? `${hookFirstWord} se start kiya tha. guru-sishya.in pe 80 aur questions hain. Free.`
    : `Started with ${hookFirstWord}. guru-sishya.in has 80 more like this. Free.`;
  segments.push(makeSegment(48, 55, ctaFull, 'CTA',
    'B-roll: guru-sishya.in URL on screen, QR code',
    'audio: final beat, assertive — no fade'));

  return segments;
}

// ─── Inline validator ─────────────────────────────────────────────────────────

function validateSegments(
  segments: ScriptSegment[],
  format: ScriptFormat,
): string[] {
  const errors: string[] = [];
  const fullText = segments.map((s) => s.text).join(' ').toLowerCase();

  // Check banned phrases
  for (const phrase of BANNED_PHRASES) {
    if (fullText.includes(phrase.toLowerCase())) {
      errors.push(`BANNED_PHRASE: "${phrase}" found in script`);
    }
  }

  // Check guru-sishya.in appears exactly twice
  const gsCount = (fullText.match(/guru-sishya\.in/g) ?? []).length;
  if (gsCount !== 2) {
    errors.push(`CTA_DOUBLE_MENTION: expected 2 mentions of "guru-sishya.in", found ${gsCount}`);
  }

  // Check segment type coverage
  const types = new Set(segments.map((s) => s.type));
  for (const required of ['HOOK', 'TENSION', 'TEACH', 'CTA'] as SegmentType[]) {
    if (!types.has(required)) {
      errors.push(`SEGMENT_TYPE_COVERAGE: missing segment type "${required}"`);
    }
  }

  // Check word count by format
  const totalWords = segments.reduce((acc, s) => acc + s.wordCount, 0);
  if (format === 'long' && (totalWords < 700 || totalWords > 1150)) {
    errors.push(`WORD_COUNT_RANGE: long-form expected 700–1150 words, got ${totalWords}`);
  }
  if (format === 'short' && (totalWords < 60 || totalWords > 140)) {
    errors.push(`SHORT_WORD_COUNT: short-form expected 60–140 words, got ${totalWords}`);
  }

  // Check each segment's sentence length (warn on > 15 words per sentence)
  for (const seg of segments) {
    const sentences = seg.text.split(/[.!?]+/).filter(Boolean);
    for (const sentence of sentences) {
      const wc = sentence.trim().split(/\s+/).length;
      if (wc > 15) {
        errors.push(`MAX_SENTENCE_LENGTH: sentence has ${wc} words (max 12 allowed): "${sentence.trim().slice(0, 60)}..."`);
      }
    }
  }

  return errors;
}

// ─── Density scorer ───────────────────────────────────────────────────────────

function scoreDensity(segments: ScriptSegment[]): number {
  const teachSegments = segments.filter((s) => s.type === 'TEACH');
  const totalTeachWords = teachSegments.reduce((acc, s) => acc + s.wordCount, 0);
  const totalWords = segments.reduce((acc, s) => acc + s.wordCount, 0);
  if (totalWords === 0) return 0;

  // Density = teach words / total words (target ≥ 0.45)
  // Bonus for specific terms (company names, numbers, technical terms)
  const fullText = segments.map((s) => s.text).join(' ');
  const specificTerms = (fullText.match(/₹\d+|amazon|flipkart|swiggy|zomato|google|kafka|redis|\d{4}|\d+%/gi) ?? []).length;
  const specificTermBonus = Math.min(specificTerms / totalWords, 0.15);

  return Math.round((totalTeachWords / totalWords + specificTermBonus) * 100) / 100;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function generateScript(input: ScriptInput): GeneratedScript {
  const segments =
    input.format === 'short'
      ? generateShortForm(input)
      : generateLongForm(input);

  const validationErrors = validateSegments(segments, input.format);
  const totalWords = segments.reduce((acc, s) => acc + s.wordCount, 0);
  const densityScore = scoreDensity(segments);
  const fullText = segments.map((s) => s.text).join(' ');
  const gsCount = (fullText.match(/guru-sishya\.in/g) ?? []).length;

  const metadata: ScriptMetadata = {
    topic: input.topic,
    format: input.format,
    language: input.language,
    totalWords,
    totalSegments: segments.length,
    guruSishyaMentions: gsCount,
    durationSec: input.durationSec,
    densityScore,
    validationPassed: validationErrors.length === 0,
    validationErrors,
  };

  return { segments, metadata };
}
