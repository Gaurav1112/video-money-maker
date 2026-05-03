/**
 * Keyword extractor for the stock footage picker.
 *
 * Derives an ordered, deduped keyword list (max 6) from a scene.
 *
 * Priority:
 *   1. Static keywords mapped from scene.templateId (if known)
 *   2. Nouns extracted from scene.narration via stoplist (English-only heuristic)
 *   3. Words from the storyboard topic string
 */

import type { StockScene } from './types.js';

// ─── Template keyword map ─────────────────────────────────────────────────────
// Add every templateId found in src/compositions/ or real storyboards here.

const TEMPLATE_KEYWORDS: Record<string, string[]> = {
  LoadBalancerArch: ['server', 'load', 'traffic', 'network', 'routing'],
  CacheArch:        ['cache', 'memory', 'data', 'storage'],
  VSBattle:         ['comparison', 'versus', 'choice', 'decision'],
  CodeArch:         ['code', 'programming', 'developer', 'software'],
  DiagramArch:      ['diagram', 'architecture', 'system', 'design'],
  DatabaseArch:     ['database', 'data', 'storage', 'query'],
  NetworkArch:      ['network', 'connection', 'server', 'infrastructure'],
  CloudArch:        ['cloud', 'server', 'infrastructure', 'datacenter'],
  APIArch:          ['api', 'request', 'server', 'network'],
  SecurityArch:     ['security', 'auth', 'protection', 'encryption'],
};

// ─── English stopwords ────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the','and','for','are','but','not','you','all','any','can','had','her','was','one',
  'our','out','day','get','has','him','his','how','man','new','now','old','see','two',
  'way','who','boy','did','its','let','put','say','she','too','use','that','this',
  'with','have','from','they','know','want','been','good','much','some','time','very',
  'when','come','here','just','like','long','make','many','more','only','over','such',
  'take','than','them','well','were','will','your','about','after','again','being',
  'could','every','first','found','great','large','never','other','place','right',
  'same','shall','since','small','start','their','there','these','those','three',
  'under','until','where','which','while','would','year','years','also','even',
  'into','most','must','then','upon','what','each','both','does','done','down',
  'form','gave','goes','gone','half','held','help','high','hold','home','hour',
  'keep','kind','last','less','life','line','list','live','look','love','main',
  'mean','meet','mind','miss','move','name','near','need','next','once','open',
  'page','part','past','plan','play','read','real','rest','role','rule','said',
  'sent','set','show','side','sign','sort','step','tell','tend','term','test',
  'text','type','used','view','walk','week','went','work','world','write','written',
]);

const DEFAULT_TAGS = ['technology', 'business', 'abstract', 'digital'];
const DEVANAGARI_RE = /[\u0900-\u097F]/;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns up to 6 lower-cased keywords for a scene, in priority order.
 *
 * @param scene   - The scene to extract keywords from.
 * @param topic   - Storyboard-level topic string (used as fallback).
 */
export function extractKeywords(scene: StockScene, topic: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  function add(word: string): void {
    const w = word.toLowerCase().trim();
    if (!seen.has(w)) {
      seen.add(w);
      result.push(w);
    }
  }

  // 1. Template keywords (highest priority)
  if (scene.templateId) {
    const mapped = TEMPLATE_KEYWORDS[scene.templateId] ?? [];
    for (const kw of mapped) add(kw);
  }

  // 2. Noun-like tokens from narration (English only; skip Hindi/non-ASCII heavy tokens)
  const narrationTokens = tokenize(scene.narration);
  for (const token of narrationTokens) {
    if (result.length >= 6) break;
    add(token);
  }

  // Hindi/Devanagari fallback: if narration has Devanagari AND we got <2 English tokens
  if (DEVANAGARI_RE.test(scene.narration) && result.length < 2) {
    for (const tag of DEFAULT_TAGS) {
      if (result.length >= 6) break;
      add(tag);
    }
  }

  // 3. Topic words
  const topicTokens = tokenize(topic);
  for (const token of topicTokens) {
    if (result.length >= 6) break;
    add(token);
  }

  return result.slice(0, 6);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Keep only ASCII letters, digits, spaces
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => {
      if (t.length < 4 || t.length > 18) return false;
      if (STOPWORDS.has(t)) return false;
      return true;
    });
}
