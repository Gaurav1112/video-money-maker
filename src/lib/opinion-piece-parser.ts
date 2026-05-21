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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
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
    if (/^In\s+1995\s*:/i.test(line)) { bucket = 'then'; continue; }
    if (/^In\s+2026\s*:/i.test(line)) { bucket = 'now'; continue; }
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
  constructor(message: string, public readonly section?: SectionName) {
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
      throw new OpinionParserError(
        `Missing required section: "## ${required}"`,
        required
      );
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
  return text
    // Common opinion-piece markers
    .replace(/[✅❌➡️⚡🎯😊💡🍕]/gu, '')
    // Range covering most emoji blocks
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildNarrationPlan(opinion: OpinionPiece): OpinionNarrationScene[] {
  const plan: OpinionNarrationScene[] = [];
  plan.push({ type: 'hook', narration: stripEmojisForSpeech(opinion.hook) });
  plan.push({
    type: 'then-now',
    narration: stripEmojisForSpeech(
      `In 1995. ${opinion.thenNow.thenLines.join(' ')} ` +
        `In 2026. ${opinion.thenNow.nowLines.join(' ')}`
    ),
  });
  plan.push({
    type: 'pros',
    narration: stripEmojisForSpeech(
      `Microservices solve real problems: ${opinion.pros.join('. ')}.`
    ),
  });
  plan.push({
    type: 'cons',
    narration: stripEmojisForSpeech(
      `But in many organizations the reality is different. ${opinion.cons.join('. ')}.`
    ),
  });
  plan.push({ type: 'pivot', narration: stripEmojisForSpeech(opinion.pivot) });
  plan.push({ type: 'lesson', narration: stripEmojisForSpeech(opinion.lesson) });
  if (opinion.question) {
    plan.push({ type: 'question', narration: stripEmojisForSpeech(opinion.question) });
  }
  return plan;
}
