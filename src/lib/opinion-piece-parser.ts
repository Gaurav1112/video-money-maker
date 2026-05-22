/**
 * Opinion-piece markdown parser (Feature 006).
 *
 * Parses a leadership-opinion markdown file with YAML frontmatter and
 * named `##` sections into a typed `OpinionPiece` object.
 *
 * Pure function — no I/O beyond what the caller hands in. Determinism is
 * a hard requirement (Constitution I): same input → same output, always.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface OpinionFrontmatter {
  title: string;
  slug?: string;
  publishDate?: string;
  durationSec?: number;
}

export interface OpinionThenNow {
  thenLines: string[];
  nowLines: string[];
}

export interface OpinionPiece {
  slug: string;
  title: string;
  publishDate: string;
  durationSec: number;
  hook: string;
  thenNow: OpinionThenNow;
  pros: string[];
  cons: string[];
  pivot: string;
  lesson: string;
  question?: string;
}

// ─── Section name registry ────────────────────────────────────────────────

const REQUIRED_SECTIONS = ['Hook', 'Then-vs-Now', 'Pros', 'Cons', 'Pivot', 'Lesson'] as const;
const OPTIONAL_SECTIONS = ['Question'] as const;
type SectionName = (typeof REQUIRED_SECTIONS)[number] | (typeof OPTIONAL_SECTIONS)[number];

// ─── Frontmatter parser ───────────────────────────────────────────────────

/**
 * Minimal YAML frontmatter extractor. Handles key: value pairs at the top of
 * the file between `---` delimiters. Quotes (single/double) are stripped.
 * No nested structures supported — none needed for opinion-piece frontmatter.
 */
function extractFrontmatter(markdown: string): { frontmatter: OpinionFrontmatter; body: string } {
  const trimmed = markdown.replace(/^﻿/, ''); // strip BOM if present
  if (!trimmed.startsWith('---')) {
    return { frontmatter: { title: '' }, body: trimmed };
  }
  const end = trimmed.indexOf('\n---', 3);
  if (end === -1) {
    return { frontmatter: { title: '' }, body: trimmed };
  }
  const fmBlock = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + 4).replace(/^\n+/, '');

  const fm: Record<string, string | number> = {};
  for (const line of fmBlock.split('\n')) {
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val: string | number = m[2];
    // Strip wrapping quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Coerce durationSec to number
    if (key === 'durationSec') {
      const n = parseInt(String(val), 10);
      val = Number.isNaN(n) ? 600 : n;
    }
    fm[key] = val;
  }

  return {
    frontmatter: {
      title: typeof fm.title === 'string' ? fm.title : '',
      slug: typeof fm.slug === 'string' ? fm.slug : undefined,
      publishDate: typeof fm.publishDate === 'string' ? fm.publishDate : undefined,
      durationSec: typeof fm.durationSec === 'number' ? fm.durationSec : undefined,
    },
    body,
  };
}

// ─── Section splitter ─────────────────────────────────────────────────────

/**
 * Split body by `## SectionName` headers. Section names are matched
 * case-sensitively after trimming; whitespace and hyphens normalized.
 */
function splitSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  // Split on `## Header` boundaries, keep the headers.
  const parts = body.split(/^##\s+(.+?)\s*$/m);
  // parts[0] is preamble before first ##; parts[1] is first header name; parts[2] body, etc.
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i].trim();
    const content = (parts[i + 1] || '').trim();
    sections[name] = content;
  }
  return sections;
}

// ─── Then-vs-Now sub-parser ───────────────────────────────────────────────

/**
 * `## Then-vs-Now` body has the shape:
 *
 *   In 1995:
 *   Simple flow.
 *   Limited options.
 *
 *   In 2026:
 *   Apps are smarter.
 *   Features are richer.
 */
function parseThenNow(raw: string): OpinionThenNow {
  const lines = raw.split('\n').map((l) => l.trim());
  const then: string[] = [];
  const now: string[] = [];
  let bucket: 'then' | 'now' | null = null;
  for (const line of lines) {
    if (!line) continue;
    if (/^In\s+1995\s*:/i.test(line)) {
      bucket = 'then';
      continue;
    }
    if (/^In\s+2026\s*:/i.test(line)) {
      bucket = 'now';
      continue;
    }
    if (bucket === 'then') then.push(line);
    else if (bucket === 'now') now.push(line);
  }
  return { thenLines: then, nowLines: now };
}

// ─── Bullet extractor (pros / cons) ───────────────────────────────────────

/**
 * Extract bullet items from a section body. Matches lines starting with
 * any of the well-known opinion-piece markers: ✅ ❌ ➡️ -.  Preserves the
 * text after the marker (trimmed).
 */
function extractBullets(raw: string, markers: RegExp): string[] {
  const out: string[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(markers);
    if (m) {
      out.push(trimmed.slice(m[0].length).trim());
    }
  }
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────

export class OpinionParserError extends Error {
  constructor(
    message: string,
    public readonly section?: SectionName
  ) {
    super(message);
    this.name = 'OpinionParserError';
  }
}

export function parseOpinionPiece(markdown: string, fallbackSlug: string): OpinionPiece {
  const { frontmatter, body } = extractFrontmatter(markdown);
  const sections = splitSections(body);

  // Validate required sections
  for (const required of REQUIRED_SECTIONS) {
    if (!sections[required] || !sections[required].trim()) {
      throw new OpinionParserError(`Missing required section: "## ${required}"`, required);
    }
  }

  const slug = frontmatter.slug || fallbackSlug;
  const title = frontmatter.title || slug;
  const publishDate = frontmatter.publishDate || new Date().toISOString().slice(0, 10);
  const durationSec = frontmatter.durationSec ?? 600;

  return {
    slug,
    title,
    publishDate,
    durationSec,
    hook: sections['Hook'].trim(),
    thenNow: parseThenNow(sections['Then-vs-Now']),
    pros: extractBullets(sections['Pros'], /^✅\s*/),
    cons: extractBullets(sections['Cons'], /^(❌|➡️)\s*/u),
    pivot: sections['Pivot'].trim(),
    lesson: sections['Lesson'].trim(),
    question: sections['Question']?.trim() || undefined,
  };
}

// ─── Narration plan helper ────────────────────────────────────────────────

/**
 * Convert an `OpinionPiece` into a flat list of narration scenes for the TTS
 * engine. Each entry has a `type` (used purely for logging) and a `narration`
 * string. Emojis are dropped at narration time — TTS reads only words.
 */
export interface OpinionNarrationScene {
  type: 'hook' | 'then-now' | 'pros' | 'cons' | 'pivot' | 'lesson' | 'question';
  narration: string;
}

function stripEmojisForSpeech(text: string): string {
  return (
    text
      // Common opinion-piece markers
      .replace(/[✅❌➡️⚡🎯😊💡🍕]/gu, '')
      // Range covering most emoji blocks
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export function buildNarrationPlan(opinion: OpinionPiece): OpinionNarrationScene[] {
  // Each scene gets a wrapper + elaboration so the long-form lands in the
  // 8-12 minute spec window even when source markdown is terse. Wrappers are
  // deterministic templates — no LLM at runtime (Constitution I).
  const plan: OpinionNarrationScene[] = [];

  plan.push({
    type: 'hook',
    narration: stripEmojisForSpeech(
      `Let me tell you about something I saw today. ${opinion.hook} ` +
        `Stay with me here, because what looks like a meme about pizza is actually a story about how we ship software in 2026. ` +
        `And I think a lot of technology leaders are quietly wrestling with the same question.`
    ),
  });

  // Then-vs-Now: read each line individually with connective tissue.
  const thenSegment = opinion.thenNow.thenLines.map((l) => l.replace(/\.$/, '')).join(', ');
  const nowSegment = opinion.thenNow.nowLines.map((l) => l.replace(/\.$/, '')).join(', ');
  plan.push({
    type: 'then-now',
    narration: stripEmojisForSpeech(
      `Picture nineteen ninety five. ${thenSegment}. You ordered something, and it just worked. ` +
        `Now jump to twenty twenty six. ${nowSegment}. ` +
        `On paper, every one of those things is an improvement. But somewhere along the way, ` +
        `the user journey became exhausting. That is what this piece is about.`
    ),
  });

  plan.push({
    type: 'pros',
    narration: stripEmojisForSpeech(
      `First, let us be fair. Microservices absolutely solve real enterprise problems. ` +
        opinion.pros.map((p, i) => `Number ${i + 1}. ${p}.`).join(' ') +
        ' ' +
        `These are not hypothetical benefits — large engineering organizations have shipped real value on the back of these properties. ` +
        `If you have ever scaled one service to ten thousand requests per second without scaling everything else, you know exactly why this architecture exists.`
    ),
  });

  plan.push({
    type: 'cons',
    narration: stripEmojisForSpeech(
      `But in many organizations, the reality looks different. Let me walk through what I keep seeing. ` +
        opinion.cons.map((c, i) => `${i + 1}. ${c}.`).join(' ') +
        ' ' +
        `Sometimes the architecture becomes so distributed that customer simplicity decreases ` +
        `while technical complexity increases. And here is the uncomfortable truth — customers do not care whether the backend is a monolith, microservices, event driven, or serverless. ` +
        `They only care about three things. Speed. Reliability. Experience. That is it.`
    ),
  });

  plan.push({
    type: 'pivot',
    narration: stripEmojisForSpeech(
      `So here is the pivot I want to leave you with. The real question is not, are we using microservices. ` +
        `${opinion.pivot} ` +
        `A well designed monolith can outperform a badly designed microservices ecosystem any day of the week. ` +
        `I have seen it happen — both directions.`
    ),
  });

  plan.push({
    type: 'lesson',
    narration: stripEmojisForSpeech(
      `${opinion.lesson} ` +
        `As engineering leaders, our job is not to chase the architecture that sounds best on a conference talk. ` +
        `Our job is to choose the architecture that genuinely improves customer outcomes, ` +
        `business agility, and operational efficiency. Everything else is just engineering theatre.`
    ),
  });

  if (opinion.question) {
    plan.push({
      type: 'question',
      narration: stripEmojisForSpeech(
        `Now I want to hear from you. ${opinion.question} ` +
          `Drop your honest take in the comments. And if this resonated, share it with a colleague who is wrestling with the same decision.`
      ),
    });
  }

  // Feature 012: fit the plan to the 4-6 min duration budget. A terse source
  // markdown is padded UP to the floor; a verbose one is capped DOWN to the
  // ceiling. Both bounds are deterministic (Constitution I).
  return capNarrationPlan(padNarrationPlan(plan));
}

// ─── Narration budget bounds (Feature 012) ────────────────────────────────

/**
 * Per-section deterministic elaboration sentences. Used to pad a terse source
 * markdown UP toward the 4-6 min retention window so the rendered long-form
 * does not fall short of 240 s. No LLM, no randomness — fixed templates.
 */
const ELABORATIONS: Record<OpinionNarrationScene['type'], string[]> = {
  hook: [
    'I have watched this exact pattern play out across very different teams.',
    'Once you notice it, you cannot unsee it on your own systems.',
    'So before we judge anything, let us slow down and look at it honestly.',
  ],
  'then-now': [
    'Each individual change felt obviously correct at the time it was made.',
    'It is the accumulation, not any single decision, that creates the drag.',
    'That is the trap, every step forward can quietly add a little more friction.',
  ],
  pros: [
    'When these benefits are real, they are genuinely worth the operational cost.',
    'The mistake is assuming they apply uniformly to every team and every product.',
    'A team with the right maturity can turn each of these into a durable advantage.',
  ],
  cons: [
    'None of this means the architecture is wrong. It means it is often misapplied.',
    'The failure mode is adopting the shape of a solution without its preconditions.',
    'Complexity you did not need is the most expensive thing an engineering team buys.',
  ],
  pivot: [
    'Architecture is a means to an outcome, never the outcome itself.',
    'Judge it by what your customers and your delivery speed actually experience.',
    'Strip away the labels and ask only whether the system serves the people using it.',
  ],
  lesson: [
    'Write down the outcome you are optimising for before you pick the pattern.',
    'If you cannot name that outcome, no architecture diagram will rescue the project.',
    'Discipline about that one question separates senior judgement from cargo culting.',
  ],
  question: [
    'There is no universally right answer here, only an honest one for your context.',
    'I genuinely change my own mind on this depending on the team in front of me.',
  ],
};

/** A terse markdown should still fill ~4 min; pad up to this word floor. */
const NARRATION_WORD_FLOOR = 800;

/**
 * Pad a narration plan UP to {@link NARRATION_WORD_FLOOR} words by appending
 * deterministic per-section elaboration sentences in a fixed order. Pure +
 * deterministic; a plan already at/above the floor is returned unchanged.
 */
export function padNarrationPlan(
  plan: OpinionNarrationScene[],
  minWords = NARRATION_WORD_FLOOR
): OpinionNarrationScene[] {
  const total = plan.reduce((n, s) => n + countWords(s.narration), 0);
  if (total >= minWords || plan.length === 0) return plan;

  const out = plan.map((s) => ({ ...s }));
  let words = total;
  let added = true;
  // Round-robin one elaboration per scene per pass until the floor is met or
  // the fixed elaboration bank is exhausted (bounded — no infinite loop).
  for (let pass = 0; added && words < minWords; pass++) {
    added = false;
    for (const scene of out) {
      if (words >= minWords) break;
      const bank = ELABORATIONS[scene.type];
      const extra = bank[pass];
      if (!extra) continue;
      scene.narration = stripEmojisForSpeech(`${scene.narration} ${extra}`);
      words += countWords(extra);
      added = true;
    }
  }
  return out;
}

// ─── Narration budget cap (Feature 012) ───────────────────────────────────

/** Words a single sentence chunk owns. */
function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Split narration into sentence chunks, each chunk keeping its terminating
 * punctuation. Used so truncation lands only on sentence boundaries.
 */
function splitSentences(narration: string): string[] {
  const matches = narration.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g);
  return (matches || []).map((s) => s.trim()).filter(Boolean);
}

/**
 * Cap a narration plan to a total word budget (default 900 words ~ 6 min at
 * ~150 wpm), so a fully-rendered opinion long-form lands in the 240-360 s
 * retention window (Feature 012).
 *
 * Pure + deterministic (Constitution I): under-budget plans are returned
 * unchanged; over-budget plans are trimmed sentence-by-sentence in document
 * order. Each scene receives a proportional share of the budget but is never
 * cut mid-sentence; the budget is a maximum, never a minimum (terse markdown
 * is left alone).
 */
export function capNarrationPlan(
  plan: OpinionNarrationScene[],
  maxWords = 900
): OpinionNarrationScene[] {
  const total = plan.reduce((n, s) => n + countWords(s.narration), 0);
  if (total <= maxWords || plan.length === 0) return plan;

  // Distribute the budget proportionally to each scene's original length.
  let remaining = maxWords;
  return plan.map((scene, idx) => {
    const sentences = splitSentences(scene.narration);
    const scenesLeft = plan.length - idx;
    // Reserve at least one word of budget per remaining scene so later
    // scenes (hook, lesson, question) are never starved entirely.
    const share = Math.max(1, remaining - (scenesLeft - 1));
    const kept: string[] = [];
    let used = 0;
    for (const sentence of sentences) {
      const w = countWords(sentence);
      if (used + w > share) break;
      kept.push(sentence);
      used += w;
    }
    // Guarantee at least the first sentence so no scene becomes empty.
    if (kept.length === 0 && sentences.length > 0) {
      kept.push(sentences[0]);
      used = countWords(sentences[0]);
    }
    remaining = Math.max(0, remaining - used);
    return { ...scene, narration: kept.join(' ') };
  });
}
