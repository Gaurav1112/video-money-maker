/**
 * script-density.ts — Script information-density measurer
 *
 * Measures how much value-per-second a generated script delivers.
 * Minimum density threshold is enforced as a CI ship gate.
 *
 * Density model:
 *   - Base density = (TEACH word count) / (total word count)
 *   - Specificity bonus = proportion of "anchor" tokens (companies, salaries, years, percentages)
 *   - Question bonus = questions add engagement, not filler
 *   - Repetition penalty = sentences sharing >70% token overlap drag density down
 *
 * Calibration targets (from expert-findings.md):
 *   - Fireship baseline: 0.55–0.65
 *   - Filler content: 0.20–0.30
 *   - Our minimum to ship: 0.40
 *   - Our target (after v2): 0.45+
 */

import type { GeneratedScript, ScriptSegment } from '../pipeline/script-generator-v2';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DensityReport {
  overall: number;               // 0–1, the ship gate value
  perSegment: SegmentDensity[];  // per-segment breakdown
  byType: Record<string, number>;
  teachRatio: number;            // proportion of words in TEACH segments
  specificityScore: number;      // anchor token density
  questionDensity: number;       // questions per 100 sentences
  repetitionPenalty: number;     // how much overlap drags score down
  passesShipGate: boolean;       // overall >= MIN_DENSITY
  recommendation: string;        // human-readable next action
}

export interface SegmentDensity {
  segmentIndex: number;
  type: string;
  timeRange: string;
  wordCount: number;
  density: number;
  anchors: string[];
  flag?: 'LOW' | 'OK' | 'HIGH';
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const MIN_DENSITY = 0.40;
export const TARGET_DENSITY = 0.48;

/** Token patterns that contribute to "specificity" (Fireship's secret sauce) */
const ANCHOR_PATTERNS = [
  /₹\d+\s*LPA/gi,               // salary bands
  /amazon|flipkart|swiggy|zomato|phonepe|razorpay|meesho|cred|hotstar|google|microsoft|uber/gi,
  /\b20\d{2}\b/g,               // years
  /\d+%/g,                      // percentages
  /\d+[MBK]\s*(requests|users|transactions|events)/gi,
  /[Qq]\d\s+20\d{2}/g,          // quarter references
  /SDE-[123]|L[456]|principal\s+engineer/gi,
  /faang|iit-[a-z]/gi,
] as const;

// ─── Token helpers ─────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
}

function extractAnchors(text: string): string[] {
  const found: string[] = [];
  for (const pattern of ANCHOR_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) found.push(...matches);
  }
  return found;
}

/** Jaccard similarity between two token sets */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Compute repetition penalty across all segment pairs */
function computeRepetitionPenalty(segments: ScriptSegment[]): number {
  const tokenSets = segments.map((s) => tokenize(s.text));
  let totalSimilarity = 0;
  let pairs = 0;

  for (let i = 0; i < tokenSets.length; i++) {
    for (let j = i + 1; j < tokenSets.length; j++) {
      // Only compare same-type segments — cross-type overlap is expected
      if (segments[i].type === segments[j].type) {
        totalSimilarity += jaccardSimilarity(tokenSets[i], tokenSets[j]);
        pairs++;
      }
    }
  }
  if (pairs === 0) return 0;
  const avgSimilarity = totalSimilarity / pairs;
  // Scale: 0 overlap = 0 penalty, 1.0 overlap = 0.15 penalty
  return Math.min(avgSimilarity * 0.15, 0.15);
}

// ─── Per-segment density ───────────────────────────────────────────────────────

function scoreSegment(seg: ScriptSegment, index: number): SegmentDensity {
  const anchors = extractAnchors(seg.text);
  const words = seg.wordCount || 1;
  const anchorDensity = anchors.length / words;

  // TEACH is worth 1.0 base, TENSION 0.7, HOOK 0.6, CTA 0.3
  const typeWeight: Record<string, number> = {
    TEACH: 1.0,
    TENSION: 0.7,
    HOOK: 0.6,
    CTA: 0.3,
  };
  const base = typeWeight[seg.type] ?? 0.5;
  const density = Math.round((base + anchorDensity * 0.3) * 100) / 100;

  const flag: 'LOW' | 'OK' | 'HIGH' =
    density < 0.3 ? 'LOW' : density > 0.7 ? 'HIGH' : 'OK';

  return {
    segmentIndex: index,
    type: seg.type,
    timeRange: `${seg.timeStartSec}s–${seg.timeEndSec}s`,
    wordCount: seg.wordCount,
    density,
    anchors,
    flag,
  };
}

// ─── Main density report ───────────────────────────────────────────────────────

export function measureDensity(script: GeneratedScript): DensityReport {
  const { segments, metadata } = script;
  if (segments.length === 0) {
    return {
      overall: 0,
      perSegment: [],
      byType: {},
      teachRatio: 0,
      specificityScore: 0,
      questionDensity: 0,
      repetitionPenalty: 0,
      passesShipGate: false,
      recommendation: 'Script is empty.',
    };
  }

  const totalWords = segments.reduce((acc, s) => acc + s.wordCount, 0);
  const teachWords = segments
    .filter((s) => s.type === 'TEACH')
    .reduce((acc, s) => acc + s.wordCount, 0);
  const teachRatio = totalWords > 0 ? teachWords / totalWords : 0;

  // Specificity score
  const fullText = segments.map((s) => s.text).join(' ');
  const allAnchors = extractAnchors(fullText);
  const specificityScore = Math.min(allAnchors.length / Math.max(totalWords / 100, 1) / 10, 0.20);

  // Question density
  const allSentences = fullText.split(/(?<=[.!?])\s+/).length;
  const questionCount = (fullText.match(/\?/g) ?? []).length;
  const questionDensity = allSentences > 0 ? questionCount / allSentences : 0;

  // Repetition penalty
  const repetitionPenalty = computeRepetitionPenalty(segments);

  // Per-segment scores
  const perSegment = segments.map((seg, i) => scoreSegment(seg, i));

  // By-type aggregation
  const typeGroups: Record<string, number[]> = {};
  perSegment.forEach((ps) => {
    if (!typeGroups[ps.type]) typeGroups[ps.type] = [];
    typeGroups[ps.type].push(ps.density);
  });
  const byType: Record<string, number> = {};
  for (const [type, scores] of Object.entries(typeGroups)) {
    byType[type] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
  }

  // Overall: weighted combination
  const overall = Math.round(
    Math.max(0, teachRatio * 0.5 + specificityScore * 0.3 + questionDensity * 0.1 - repetitionPenalty + 0.1) * 100,
  ) / 100;

  const passesShipGate = overall >= MIN_DENSITY;

  // Recommendation
  let recommendation: string;
  if (!passesShipGate) {
    if (teachRatio < 0.5) recommendation = 'Add more TEACH segments. At least 50% of words should deliver value.';
    else if (specificityScore < 0.05) recommendation = 'Add company names, salary bands, and years. Generic scripts fail.';
    else if (repetitionPenalty > 0.08) recommendation = 'Too much repetition between segments. Vary your phrasing.';
    else recommendation = `Density ${overall.toFixed(2)} below ${MIN_DENSITY}. Add concrete examples and stats.`;
  } else if (overall < TARGET_DENSITY) {
    recommendation = `Passes gate (${overall.toFixed(2)}). Target ${TARGET_DENSITY} for Fireship-tier density — add one more stat or company example.`;
  } else {
    recommendation = `Excellent density: ${overall.toFixed(2)}. Script is information-dense and ready to ship.`;
  }

  return {
    overall,
    perSegment,
    byType,
    teachRatio: Math.round(teachRatio * 100) / 100,
    specificityScore: Math.round(specificityScore * 100) / 100,
    questionDensity: Math.round(questionDensity * 100) / 100,
    repetitionPenalty: Math.round(repetitionPenalty * 100) / 100,
    passesShipGate,
    recommendation,
  };
}

/** Ship gate check — returns true if script is dense enough to publish */
export function passesShipGate(script: GeneratedScript): boolean {
  return measureDensity(script).passesShipGate;
}

/** Convenience: get just the overall score */
export function getDensityScore(script: GeneratedScript): number {
  return measureDensity(script).overall;
}
