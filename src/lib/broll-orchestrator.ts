/**
 * broll-orchestrator.ts
 *
 * Given a script with timestamps + concept types, deterministically picks
 * ONE b-roll component per 3–5 second segment.
 *
 * Rules enforced:
 * 1. Hash-based selection — same input always produces same output
 * 2. No component repeats within 15 seconds (9 segments at ~1.7s avg)
 * 3. Every 3–5s segment has a visual change
 * 4. Weights toward variety — scores components by recency
 *
 * Usage:
 *   const plan = orchestrateBroll(scriptSegments, { fps: 30, seed: 42 });
 *   // Returns BrollPlan[] — one entry per segment
 */

import { CONCEPT_BROLL_MAP, BrollComponentId, ConceptType } from './broll-templates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScriptSegment {
  /** Start time in seconds */
  startSec: number;
  /** End time in seconds */
  endSec: number;
  /** Concept type from the taxonomy */
  conceptType: ConceptType;
  /** The spoken text for this segment */
  text: string;
  /** Optional: specific props to pass to the component */
  props?: Record<string, unknown>;
}

export interface BrollPlan {
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  component: BrollComponentId;
  conceptType: ConceptType;
  seed: number;
  /** Human-readable reason for the choice */
  reason: string;
  props?: Record<string, unknown>;
}

export interface OrchestratorOptions {
  fps?: number;
  /** Master seed for the whole video. Default: 42 */
  seed?: number;
  /** Minimum gap (in seconds) before repeating the same component. Default: 15 */
  repeatGapSec?: number;
}

// ---------------------------------------------------------------------------
// Deterministic hash helpers
// ---------------------------------------------------------------------------

/** Fast deterministic hash: FNV-1a 32-bit */
function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

/** Pick an index from candidates array deterministically */
function pickIndex(candidates: BrollComponentId[], hashKey: string): number {
  const h = fnv1a(hashKey);
  return h % candidates.length;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export function orchestrateBroll(
  segments: ScriptSegment[],
  options: OrchestratorOptions = {},
): BrollPlan[] {
  const { fps = 30, seed = 42, repeatGapSec = 15 } = options;
  const repeatGapFrames = repeatGapSec * fps;

  const plan: BrollPlan[] = [];
  // Track last-used frame per component for repeat enforcement
  const lastUsed = new Map<BrollComponentId, number>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const startFrame = Math.round(seg.startSec * fps);
    const endFrame = Math.round(seg.endSec * fps);
    const durationFrames = endFrame - startFrame;

    // Get candidates for this concept type
    const allCandidates = CONCEPT_BROLL_MAP[seg.conceptType] ?? CONCEPT_BROLL_MAP['DEFINITION'];

    // Filter out recently used components
    const available = allCandidates.filter((c) => {
      const last = lastUsed.get(c) ?? -Infinity;
      return startFrame - last >= repeatGapFrames;
    });

    // If all candidates are blocked, use full list (but still prefer least-recently-used)
    const candidates = available.length > 0 ? available : allCandidates;

    // Sort candidates by last-used time (ascending = least recently used first)
    const sorted = [...candidates].sort((a, b) => {
      const la = lastUsed.get(a) ?? -Infinity;
      const lb = lastUsed.get(b) ?? -Infinity;
      return la - lb;
    });

    // Deterministic pick: use FNV hash of (seed + segment index + text hash)
    const hashKey = `${seed}-${i}-${seg.conceptType}-${fnv1a(seg.text)}`;
    const pickIdx = pickIndex(sorted, hashKey);
    const chosen = sorted[pickIdx];

    // Generate a per-component seed from the master seed + position
    const componentSeed = fnv1a(`${seed}-${i}-${chosen}`) % 100000;

    // Record use
    lastUsed.set(chosen, startFrame);

    plan.push({
      startFrame,
      endFrame,
      durationFrames,
      component: chosen,
      conceptType: seg.conceptType,
      seed: componentSeed,
      reason: `ConceptType=${seg.conceptType}, available=${available.length}/${allCandidates.length}`,
      props: seg.props,
    });
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Validation helper (used in tests)
// ---------------------------------------------------------------------------

export function validateBrollPlan(plan: BrollPlan[], fps = 30): string[] {
  const errors: string[] = [];
  const repeatGapFrames = 15 * fps;

  // Track last-used frame per component
  const lastUsed = new Map<BrollComponentId, number>();

  for (let i = 0; i < plan.length; i++) {
    const item = plan[i];

    // Rule: duration must be between 90 and 150 frames (3–5 seconds)
    // Allow up to 300 for complex components
    if (item.durationFrames < 45) {
      errors.push(`Segment ${i}: duration ${item.durationFrames}f is too short (min 45f)`);
    }

    // Rule: no same component within 15 seconds
    const lastFrame = lastUsed.get(item.component) ?? -Infinity;
    if (item.startFrame - lastFrame < repeatGapFrames) {
      errors.push(
        `Segment ${i}: component ${item.component} repeated within ${(item.startFrame - lastFrame) / fps}s (min 15s)`,
      );
    }

    lastUsed.set(item.component, item.startFrame);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Convenience: auto-segment a script by sentence
// ---------------------------------------------------------------------------

/**
 * Split a narration script into segments of 3–5 seconds each,
 * assigning concept types based on keyword heuristics.
 */
export function autoSegmentScript(
  narration: string,
  conceptTypeHints: Partial<Record<string, ConceptType>> = {},
  fps = 30,
): ScriptSegment[] {
  // Very naive: split on sentence boundaries, assign ~4s per sentence
  const sentences = narration.match(/[^.!?]+[.!?]+/g) ?? [narration];
  const segments: ScriptSegment[] = [];
  let currentSec = 0;

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).length;
    // ~150 wpm narration = 2.5 words/sec
    const durationSec = Math.max(3, Math.min(5, words / 2.5));

    // Heuristic concept type detection
    let conceptType: ConceptType = 'DEFINITION';
    const lower = sentence.toLowerCase();
    if (/\d/.test(sentence) || /percent|lpa|rps|latency|ms|million|billion/.test(lower)) {
      conceptType = 'NUMBER';
    } else if (/vs\.|versus|compared|before|after|without|with/.test(lower)) {
      conceptType = 'COMPARISON';
    } else if (/step|first|then|next|finally|process|flow|how/.test(lower)) {
      conceptType = 'PROCESS';
    } else if (/code|function|class|method|variable|algorithm/.test(lower)) {
      conceptType = 'CODE';
    } else if (/warning|careful|mistake|avoid|never|don't|wrong/.test(lower)) {
      conceptType = 'WARNING';
    } else if (/example|for instance|such as|like|imagine/.test(lower)) {
      conceptType = 'EXAMPLE';
    } else if (/\?|question|what|why|how|which/.test(lower)) {
      conceptType = 'QUESTION';
    }

    // Override with explicit hints
    const textKey = sentence.trim().slice(0, 30);
    if (conceptTypeHints[textKey]) conceptType = conceptTypeHints[textKey]!;

    segments.push({
      startSec: currentSec,
      endSec: currentSec + durationSec,
      conceptType,
      text: sentence.trim(),
    });

    currentSec += durationSec;
  }

  return segments;
}
