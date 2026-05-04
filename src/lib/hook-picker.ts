/**
 * Deterministic hook selection for consistent, reproducible video generation.
 * Same input always produces same output across renders.
 */

import type { HookResult } from './hook-generator';

interface HookTemplate {
  id: string;
  claim: string;
  topic: string;
  strength: number;
  pattern: string;
}

interface HookPattern {
  id: string;
  name: string;
  templates: HookTemplate[];
}

interface HookLibrary {
  version: string;
  generated: string;
  patterns: HookPattern[];
}

let cachedLibrary: HookLibrary | null = null;

/**
 * Deterministic hash for seeding selection.
 * Same input always produces same hash.
 */
function deterministicHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash) & 0x7FFFFFFF;
}

/**
 * Load hook library from JSON.
 */
function loadLibrary(): HookLibrary {
  if (cachedLibrary) return cachedLibrary;
  
  // In production, this would load from file or HTTP
  // For now, return a minimal library structure
  cachedLibrary = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    patterns: []
  };
  
  return cachedLibrary;
}

/**
 * Pick best hook based on topic, deterministically.
 * Same topic always returns same hook.
 */
export function pickBestHook(topic: string, minStrength: number = 8.0): HookTemplate | null {
  const library = loadLibrary();
  
  if (!library.patterns || library.patterns.length === 0) {
    return null;
  }
  
  // Collect all templates meeting strength threshold
  const candidates: HookTemplate[] = [];
  library.patterns.forEach(pattern => {
    pattern.templates.forEach(template => {
      if (template.topic === topic && template.strength >= minStrength) {
        candidates.push(template);
      }
    });
  });
  
  if (candidates.length === 0) {
    return null;
  }
  
  // Use deterministic hash to pick one
  const seed = deterministicHash(topic);
  const index = seed % candidates.length;
  
  return candidates[index];
}

/**
 * Get multiple hooks for a topic (e.g., for fallbacks or A/B testing).
 */
export function pickMultipleHooks(topic: string, count: number = 3, minStrength: number = 8.0): HookTemplate[] {
  const library = loadLibrary();
  
  const candidates: HookTemplate[] = [];
  library.patterns.forEach(pattern => {
    pattern.templates.forEach(template => {
      if (template.topic === topic && template.strength >= minStrength) {
        candidates.push(template);
      }
    });
  });
  
  if (candidates.length === 0) {
    return [];
  }
  
  const seed = deterministicHash(topic);
  const results: HookTemplate[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < Math.min(count, candidates.length); i++) {
    let index = (seed + i * 7) % candidates.length;
    while (used.has(index)) {
      index = (index + 1) % candidates.length;
    }
    used.add(index);
    results.push(candidates[index]);
  }
  
  return results;
}

/**
 * Format hook for on-screen display (max 8 words, punchy).
 */
export function formatTextHook(hook: HookTemplate): string {
  const words = hook.claim.split(/\s+/);
  
  if (words.length <= 8) {
    return hook.claim;
  }
  
  // Truncate to first 8 words
  return words.slice(0, 8).join(' ') + '...';
}

/**
 * Format hook for narration (add sting reference, 1-2 sentences).
 */
export function formatSpokenHook(hook: HookTemplate, ctaUrl: string = 'guru-sishya.in'): string {
  const claim = hook.claim;
  const cta = `Get more at ${ctaUrl} — link in bio.`;
  
  return `${claim} ${cta}`;
}

export type { HookTemplate, HookPattern, HookLibrary };
