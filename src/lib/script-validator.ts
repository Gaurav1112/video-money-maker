/**
 * script-validator.ts — SCRIPT BIBLE enforcement engine
 *
 * Validates a script against all SCRIPT_BIBLE rules.
 * Used as CI gate: ship only if validate() returns 0 errors.
 *
 * Usage:
 *   import { validate } from './script-validator';
 *   const result = validate(generatedScript);
 *   if (!result.passed) process.exit(1);
 */

import type { GeneratedScript, ScriptSegment, SegmentType } from '../pipeline/script-generator-v2';

// ─── Validation result types ───────────────────────────────────────────────────

export interface ValidationError {
  code: ValidationCode;
  severity: 'error' | 'warning';
  message: string;
  segmentIndex?: number;
  value?: string | number;
}

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  score: number; // 0–100
  breakdown: Record<ValidationCode, boolean>;
}

export type ValidationCode =
  | 'NO_BANNED_PHRASES'
  | 'MAX_SENTENCE_LENGTH'
  | 'ACTIVE_VOICE_RATIO'
  | 'QUESTION_CADENCE'
  | 'STAT_CADENCE'
  | 'CTA_DOUBLE_MENTION'
  | 'PATTERN_INTERRUPT_DENSITY'
  | 'SEGMENT_TYPE_COVERAGE'
  | 'MIN_DENSITY'
  | 'WORD_COUNT_RANGE'
  | 'SHORT_WORD_COUNT'
  | 'NO_HEDGE_WORDS'
  | 'TEACH_RATIO'
  | 'HOOK_WITHIN_5S'
  | 'CTA_ENDS_SCRIPT'
  | 'TOPIC_SPECIFICITY';

// ─── Rule thresholds ───────────────────────────────────────────────────────────

const THRESHOLDS = {
  MAX_SENTENCE_WORDS: 12,
  MAX_SENTENCE_WORDS_HARD: 15,    // hard fail above this
  MIN_ACTIVE_VOICE_RATIO: 0.80,
  MIN_DENSITY: 0.40,
  LONG_WORD_MIN: 700,
  LONG_WORD_MAX: 1150,
  SHORT_WORD_MIN: 60,
  SHORT_WORD_MAX: 140,
  MIN_TEACH_RATIO: 0.50,
  QUESTION_CADENCE_EVERY_N: 5,    // 1 question per 5 sentences
  STAT_CADENCE_EVERY_N: 10,       // 1 stat per 10 sentences
  PATTERN_INTERRUPT_EVERY_SEC: 35, // 1 interrupt per 35s
} as const;

// ─── Banned phrases ────────────────────────────────────────────────────────────

const BANNED_PHRASES: readonly string[] = [
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
  "in this tutorial",
  "today we'll be learning",
  "i'm going to show you",
  'let me explain',
];

const HEDGE_WORDS: readonly string[] = [
  'kind of', 'sort of', 'maybe', 'perhaps', 'might want',
  'could be', 'possibly', 'in a way', 'more or less', 'i think',
  'i believe', 'arguably', 'somewhat', 'fairly', 'rather',
];

// ─── Pattern detection helpers ─────────────────────────────────────────────────

/** Returns all sentences in a text block */
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
}

/** Check if a sentence appears to use passive voice */
function looksPassive(sentence: string): boolean {
  // Simple heuristic: "is/are/was/were/been/being + past participle"
  return /\b(is|are|was|were|has been|have been|had been|being|be)\s+\w+ed\b/i.test(sentence);
}

/** Check if a sentence contains a number or stat */
function containsStat(sentence: string): boolean {
  return /\d+%|\d+[MBK]?\s*(LPA|crore|lakh|million|billion|requests|users|ms|seconds)|₹\d+|\b\d{4}\b/.test(sentence);
}

/** Check if a sentence is a question */
function isQuestion(sentence: string): boolean {
  return sentence.trim().endsWith('?');
}

/** Check for pattern-interrupt markers (company, salary, year, archetype) */
function hasPatternInterrupt(text: string): boolean {
  return /amazon|flipkart|swiggy|zomato|phonepe|razorpay|meesho|cred|hotstar|google|microsoft|uber|₹\d+LPA|\b20\d{2}\b/i.test(text);
}

// ─── Individual rule checkers ──────────────────────────────────────────────────

function checkBannedPhrases(
  segments: ScriptSegment[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  segments.forEach((seg, idx) => {
    const lower = seg.text.toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (lower.includes(phrase)) {
        errors.push({
          code: 'NO_BANNED_PHRASES',
          severity: 'error',
          message: `Banned phrase "${phrase}" found in segment ${idx}`,
          segmentIndex: idx,
          value: phrase,
        });
      }
    }
  });
  return errors;
}

function checkHedgeWords(
  segments: ScriptSegment[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  segments.forEach((seg, idx) => {
    const lower = seg.text.toLowerCase();
    for (const hedge of HEDGE_WORDS) {
      if (lower.includes(hedge)) {
        errors.push({
          code: 'NO_HEDGE_WORDS',
          severity: 'error',
          message: `Hedge phrase "${hedge}" found in segment ${idx}. Remove or replace with direct statement.`,
          segmentIndex: idx,
          value: hedge,
        });
      }
    }
  });
  return errors;
}

function checkSentenceLength(
  segments: ScriptSegment[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  segments.forEach((seg, idx) => {
    const sentences = splitSentences(seg.text);
    sentences.forEach((sentence) => {
      const wc = sentence.trim().split(/\s+/).length;
      if (wc > THRESHOLDS.MAX_SENTENCE_WORDS_HARD) {
        errors.push({
          code: 'MAX_SENTENCE_LENGTH',
          severity: 'error',
          message: `Sentence has ${wc} words (hard max: ${THRESHOLDS.MAX_SENTENCE_WORDS_HARD}): "${sentence.trim().slice(0, 50)}..."`,
          segmentIndex: idx,
          value: wc,
        });
      } else if (wc > THRESHOLDS.MAX_SENTENCE_WORDS) {
        errors.push({
          code: 'MAX_SENTENCE_LENGTH',
          severity: 'warning',
          message: `Sentence has ${wc} words (soft max: ${THRESHOLDS.MAX_SENTENCE_WORDS}): "${sentence.trim().slice(0, 50)}..."`,
          segmentIndex: idx,
          value: wc,
        });
      }
    });
  });
  return errors;
}

function checkActiveVoice(
  segments: ScriptSegment[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  let totalSentences = 0;
  let passiveSentences = 0;

  segments.forEach((seg) => {
    const sentences = splitSentences(seg.text);
    totalSentences += sentences.length;
    passiveSentences += sentences.filter(looksPassive).length;
  });

  if (totalSentences === 0) return errors;
  const ratio = 1 - passiveSentences / totalSentences;

  if (ratio < THRESHOLDS.MIN_ACTIVE_VOICE_RATIO) {
    errors.push({
      code: 'ACTIVE_VOICE_RATIO',
      severity: 'warning',
      message: `Active voice ratio is ${(ratio * 100).toFixed(1)}% (min: ${THRESHOLDS.MIN_ACTIVE_VOICE_RATIO * 100}%). Rewrite passive sentences.`,
      value: ratio,
    });
  }
  return errors;
}

function checkQuestionCadence(
  segments: ScriptSegment[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const allSentences: string[] = [];
  segments.forEach((seg) => allSentences.push(...splitSentences(seg.text)));

  if (allSentences.length < THRESHOLDS.QUESTION_CADENCE_EVERY_N) return errors;

  // Check each window of 5 sentences
  for (let i = 0; i < allSentences.length - THRESHOLDS.QUESTION_CADENCE_EVERY_N; i += THRESHOLDS.QUESTION_CADENCE_EVERY_N) {
    const window = allSentences.slice(i, i + THRESHOLDS.QUESTION_CADENCE_EVERY_N);
    if (!window.some(isQuestion)) {
      errors.push({
        code: 'QUESTION_CADENCE',
        severity: 'warning',
        message: `No question found in sentences ${i + 1}–${i + THRESHOLDS.QUESTION_CADENCE_EVERY_N}. Add one to maintain engagement.`,
        value: i,
      });
    }
  }
  return errors;
}

function checkStatCadence(
  segments: ScriptSegment[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const allSentences: string[] = [];
  segments.forEach((seg) => allSentences.push(...splitSentences(seg.text)));

  if (allSentences.length < THRESHOLDS.STAT_CADENCE_EVERY_N) return errors;

  for (let i = 0; i < allSentences.length - THRESHOLDS.STAT_CADENCE_EVERY_N; i += THRESHOLDS.STAT_CADENCE_EVERY_N) {
    const window = allSentences.slice(i, i + THRESHOLDS.STAT_CADENCE_EVERY_N);
    if (!window.some(containsStat)) {
      errors.push({
        code: 'STAT_CADENCE',
        severity: 'warning',
        message: `No stat/number found in sentences ${i + 1}–${i + THRESHOLDS.STAT_CADENCE_EVERY_N}. Add a concrete figure.`,
        value: i,
      });
    }
  }
  return errors;
}

function checkCtaMentions(
  segments: ScriptSegment[],
): ValidationError[] {
  const fullText = segments.map((s) => s.text).join(' ');
  const count = (fullText.match(/guru-sishya\.in/gi) ?? []).length;
  if (count !== 2) {
    return [{
      code: 'CTA_DOUBLE_MENTION',
      severity: 'error',
      message: `"guru-sishya.in" must appear exactly 2 times. Found: ${count}`,
      value: count,
    }];
  }
  return [];
}

function checkPatternInterruptDensity(
  segments: ScriptSegment[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  // Check every ~35s window for a pattern interrupt
  const windowEnd = segments.filter((s) => s.timeEndSec > 0).reduce((max, s) => Math.max(max, s.timeEndSec), 0);

  for (let t = 0; t < windowEnd; t += THRESHOLDS.PATTERN_INTERRUPT_EVERY_SEC) {
    const windowSegs = segments.filter(
      (s) => s.timeStartSec >= t && s.timeStartSec < t + THRESHOLDS.PATTERN_INTERRUPT_EVERY_SEC,
    );
    const windowText = windowSegs.map((s) => s.text).join(' ');
    if (windowText.length > 10 && !hasPatternInterrupt(windowText)) {
      errors.push({
        code: 'PATTERN_INTERRUPT_DENSITY',
        severity: 'warning',
        message: `No pattern interrupt (company/salary/year) in ${t}s–${t + THRESHOLDS.PATTERN_INTERRUPT_EVERY_SEC}s window. Add a company name, salary band, or year.`,
        value: `${t}–${t + THRESHOLDS.PATTERN_INTERRUPT_EVERY_SEC}s`,
      });
    }
  }
  return errors;
}

function checkSegmentTypeCoverage(
  segments: ScriptSegment[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const found = new Set(segments.map((s) => s.type));
  for (const required of ['HOOK', 'TENSION', 'TEACH', 'CTA'] as SegmentType[]) {
    if (!found.has(required)) {
      errors.push({
        code: 'SEGMENT_TYPE_COVERAGE',
        severity: 'error',
        message: `Required segment type "${required}" not found. Every script needs HOOK + TENSION + TEACH + CTA.`,
        value: required,
      });
    }
  }
  return errors;
}

function checkDensity(
  segments: ScriptSegment[],
  densityScore: number,
): ValidationError[] {
  if (densityScore < THRESHOLDS.MIN_DENSITY) {
    return [{
      code: 'MIN_DENSITY',
      severity: 'error',
      message: `Density score ${densityScore.toFixed(2)} below minimum ${THRESHOLDS.MIN_DENSITY}. Script is too sparse. Add company examples, stats, and concrete details.`,
      value: densityScore,
    }];
  }
  return [];
}

function checkWordCount(
  segments: ScriptSegment[],
  format: 'long' | 'short',
): ValidationError[] {
  const totalWords = segments.reduce((acc, s) => acc + s.wordCount, 0);
  const code = format === 'long' ? 'WORD_COUNT_RANGE' : 'SHORT_WORD_COUNT';
  const [min, max] = format === 'long'
    ? [THRESHOLDS.LONG_WORD_MIN, THRESHOLDS.LONG_WORD_MAX]
    : [THRESHOLDS.SHORT_WORD_MIN, THRESHOLDS.SHORT_WORD_MAX];

  if (totalWords < min || totalWords > max) {
    return [{
      code,
      severity: 'error',
      message: `${format} script has ${totalWords} words. Expected ${min}–${max}.`,
      value: totalWords,
    }];
  }
  return [];
}

function checkTeachRatio(
  segments: ScriptSegment[],
): ValidationError[] {
  const total = segments.reduce((acc, s) => acc + s.wordCount, 0);
  const teachWords = segments.filter((s) => s.type === 'TEACH').reduce((acc, s) => acc + s.wordCount, 0);
  if (total === 0) return [];

  const ratio = teachWords / total;
  if (ratio < THRESHOLDS.MIN_TEACH_RATIO) {
    return [{
      code: 'TEACH_RATIO',
      severity: 'warning',
      message: `TEACH segments are only ${(ratio * 100).toFixed(1)}% of total words (min: ${THRESHOLDS.MIN_TEACH_RATIO * 100}%). Add more TEACH content.`,
      value: ratio,
    }];
  }
  return [];
}

function checkHookFirst(
  segments: ScriptSegment[],
): ValidationError[] {
  if (segments.length === 0) return [];
  const firstHook = segments.find((s) => s.type === 'HOOK');
  if (!firstHook) {
    return [{
      code: 'HOOK_WITHIN_5S',
      severity: 'error',
      message: 'No HOOK segment found. Script must open with a hook.',
    }];
  }
  if (firstHook.timeStartSec > 5) {
    return [{
      code: 'HOOK_WITHIN_5S',
      severity: 'error',
      message: `First HOOK starts at ${firstHook.timeStartSec}s. Must start within first 5 seconds.`,
      value: firstHook.timeStartSec,
    }];
  }
  return [];
}

function checkCtaEndsScript(
  segments: ScriptSegment[],
): ValidationError[] {
  if (segments.length === 0) return [];
  const last = segments[segments.length - 1];
  if (last.type !== 'CTA') {
    return [{
      code: 'CTA_ENDS_SCRIPT',
      severity: 'error',
      message: `Last segment is type "${last.type}". Script must end with CTA.`,
      value: last.type,
    }];
  }
  return [];
}

function checkTopicSpecificity(
  segments: ScriptSegment[],
): ValidationError[] {
  const fullText = segments.map((s) => s.text).join(' ');
  if (!hasPatternInterrupt(fullText)) {
    return [{
      code: 'TOPIC_SPECIFICITY',
      severity: 'error',
      message: 'No company names, salary bands, or years found in script. Every script needs at least one specific anchor (Amazon, ₹45LPA, 2023).',
    }];
  }
  return [];
}

// ─── Main validate function ────────────────────────────────────────────────────

export function validate(
  script: GeneratedScript,
): ValidationResult {
  const { segments, metadata } = script;
  const allIssues: ValidationError[] = [
    ...checkBannedPhrases(segments),
    ...checkHedgeWords(segments),
    ...checkSentenceLength(segments),
    ...checkActiveVoice(segments),
    ...checkQuestionCadence(segments),
    ...checkStatCadence(segments),
    ...checkCtaMentions(segments),
    ...checkPatternInterruptDensity(segments),
    ...checkSegmentTypeCoverage(segments),
    ...checkDensity(segments, metadata.densityScore),
    ...checkWordCount(segments, metadata.format),
    ...checkTeachRatio(segments),
    ...checkHookFirst(segments),
    ...checkCtaEndsScript(segments),
    ...checkTopicSpecificity(segments),
  ];

  const errors = allIssues.filter((i) => i.severity === 'error');
  const warnings = allIssues.filter((i) => i.severity === 'warning');

  // Score: start at 100, -5 per error, -2 per warning
  const score = Math.max(0, 100 - errors.length * 5 - warnings.length * 2);

  // Build breakdown map
  const allCodes: ValidationCode[] = [
    'NO_BANNED_PHRASES', 'MAX_SENTENCE_LENGTH', 'ACTIVE_VOICE_RATIO',
    'QUESTION_CADENCE', 'STAT_CADENCE', 'CTA_DOUBLE_MENTION',
    'PATTERN_INTERRUPT_DENSITY', 'SEGMENT_TYPE_COVERAGE', 'MIN_DENSITY',
    'WORD_COUNT_RANGE', 'SHORT_WORD_COUNT', 'NO_HEDGE_WORDS', 'TEACH_RATIO',
    'HOOK_WITHIN_5S', 'CTA_ENDS_SCRIPT', 'TOPIC_SPECIFICITY',
  ];
  const failedCodes = new Set(errors.map((e) => e.code));
  const breakdown = Object.fromEntries(
    allCodes.map((code) => [code, !failedCodes.has(code)]),
  ) as Record<ValidationCode, boolean>;

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    score,
    breakdown,
  };
}

/**
 * CI gate helper — throws if validation fails.
 * Use this in build/render pipelines.
 */
export function validateOrThrow(script: GeneratedScript): void {
  const result = validate(script);
  if (!result.passed) {
    const msg = result.errors.map((e) => `  [${e.code}] ${e.message}`).join('\n');
    throw new Error(`Script validation failed with ${result.errors.length} error(s):\n${msg}`);
  }
}
