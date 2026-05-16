#!/usr/bin/env tsx
/**
 * Generates per-topic teach-blocks.
 *
 * Replaces the Batch-23 traffic-cop template (Panel-23 Content review:
 * "intuition: think of {X} like a traffic cop... mechanism: distributes
 * work, manages state... example: Netflix and Uber use {X}") which produced
 * 108 narrations that bore no resemblance to their topics.
 *
 * Two output streams:
 *   1. data/teach-blocks/{topicId}.json — keyed by TOPIC_BANK_100 numeric id.
 *      Hand-curated when present in AUTHORED_TOPICS; otherwise marked
 *      `quality: 'placeholder'` so the quality gate / publisher skip them.
 *   2. data/teach-blocks/{slug}-s{n}.json — per-CORE-session blocks for the
 *      4 multi-session series (load-balancing, caching, database-design,
 *      api-gateway × 10 sessions = 40 files). Always authored.
 *
 * Determinism: pure data tables. No LLM, no time, no random. Same TOPIC_BANK
 * input → byte-identical output every run.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  AUTHORED_TOPICS,
  AUTHORED_CORE_SESSIONS,
  type AuthoredScene,
} from '../data/teach-block-sources.js';

interface Topic {
  id: number;
  topic: string;
  category?: string;
  hookSpoken?: string;
  tags?: string[];
}

const topics = JSON.parse(
  readFileSync(join(process.cwd(), 'TOPIC_BANK_100.json'), 'utf8'),
) as Topic[];

const outputDir = join(process.cwd(), 'data/teach-blocks');
mkdirSync(outputDir, { recursive: true });

const authoredById = new Map(AUTHORED_TOPICS.map((a) => [a.topicId, a]));

function placeholderScenes(t: string, hookSpoken?: string): AuthoredScene[] {
  // Generic placeholder — explicitly marked so the quality gate skips it.
  // Kept intentionally bland so authors immediately notice and replace
  // before shipping content for that topic. Do NOT add concept-specific
  // language here; that is exactly the bug we are fixing.
  return [
    { type: 'hook', narration: hookSpoken || `Today: ${t} — quick technical primer.` },
    { type: 'problem', narration: `Why ${t} matters: pending hand-authoring.` },
    { type: 'intuition', narration: `Intuition for ${t}: pending hand-authoring.` },
    { type: 'mechanism', narration: `Mechanism for ${t}: pending hand-authoring.` },
    { type: 'mechanism-detail', narration: `Details for ${t}: pending hand-authoring.` },
    { type: 'example', narration: `Real-world ${t} example: pending hand-authoring.` },
    { type: 'recap', narration: `${t} recap: pending hand-authoring.` },
  ];
}

let authoredCount = 0;
let placeholderCount = 0;

for (const topic of topics) {
  const authored = authoredById.get(topic.id);
  const block = authored
    ? {
        topicId: topic.id,
        topic: authored.topic,
        quality: 'authored' as const,
        mechanismKeywords: authored.mechanismKeywords,
        mistakeKeyword: authored.mistakeKeyword,
        scenes: authored.scenes,
      }
    : {
        topicId: topic.id,
        topic: topic.topic,
        quality: 'placeholder' as const,
        scenes: placeholderScenes(topic.topic, topic.hookSpoken),
      };
  if (authored) authoredCount++;
  else placeholderCount++;
  writeFileSync(
    join(outputDir, `${topic.id}.json`),
    JSON.stringify(block, null, 2) + '\n',
    'utf8',
  );
}

let coreCount = 0;
for (const s of AUTHORED_CORE_SESSIONS) {
  const block = {
    slug: s.slug,
    session: s.sessionN,
    totalSessions: s.totalSessions,
    topic: s.topic,
    quality: 'authored' as const,
    mechanismKeywords: s.mechanismKeywords,
    mistakeKeyword: s.mistakeKeyword,
    scenes: s.scenes,
  };
  writeFileSync(
    join(outputDir, `${s.slug}-s${s.sessionN}.json`),
    JSON.stringify(block, null, 2) + '\n',
    'utf8',
  );
  coreCount++;
}

console.log(
  `Generated teach-blocks: ${authoredCount} authored + ${placeholderCount} placeholder TOPIC_BANK ids; ${coreCount} CORE-session blocks.`,
);
