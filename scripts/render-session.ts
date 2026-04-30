#!/usr/bin/env npx tsx
/**
 * Render a specific session from a guru-sishya topic's study plan.
 *
 * Usage:
 *   npx tsx scripts/render-session.ts load-balancing 2
 *   npx tsx scripts/render-session.ts load-balancing 3 --language python
 *
 * This script:
 *   1. Loads the topic from guru-sishya/public/content/
 *   2. Finds the session by number from the topic's plan.sessions array
 *   3. Generates TTS audio via Kokoro (port 8880)
 *   4. Builds storyboard with viz variants
 *   5. Saves to output/test-props-s{N}.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateScript } from '../src/pipeline/script-generator';
import { generateSceneAudios } from '../src/pipeline/tts-engine';
import { generateStoryboard, getStoryboardDuration, validateStoryboard } from '../src/pipeline/storyboard';
import type { SessionInput } from '../src/types';

const CONTENT_DIR = path.resolve(__dirname, '../../guru-sishya/public/content');

const BGM_FILES = [
  'audio/bgm/gentle-drone.mp3',
  'audio/bgm/study-pad.mp3',
  'audio/bgm/warm-ambient.mp3',
];

function pickBgm(seed: string): string {
  const hash = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return BGM_FILES[hash % BGM_FILES.length];
}

/**
 * Search all content JSON files for a topic matching the given slug.
 * Returns the topic object or null.
 */
function findTopic(slug: string): any | null {
  const searchTerms = slug.toLowerCase().split('-');

  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'));

  let fallback: any = null;

  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8'));
      if (!Array.isArray(data)) continue;

      for (const topic of data) {
        const topicName = (topic.topic || topic.title || '').toLowerCase();
        const matches = searchTerms.every(term => topicName.includes(term));
        if (matches) {
          // Prefer topics that have plan.sessions (renderable)
          if (Array.isArray(topic?.plan?.sessions)) {
            return topic;
          }
          // Also accept topics with sessions as an object (e.g. {"1": "md", "2": "md"})
          if (topic.sessions && typeof topic.sessions === 'object' && !Array.isArray(topic.sessions)) {
            if (!fallback) fallback = topic;
            continue;
          }
          if (!fallback) fallback = topic;
        }
      }
    } catch {
      // skip malformed files
    }
  }
  return fallback;
}

/**
 * Extract a SessionInput from a topic's plan.sessions array by session number.
 * Session number is 1-based (session 2 = the second session in the plan).
 */
function extractPlanSession(topic: any, sessionNumber: number): SessionInput | null {
  const planSessions = topic?.plan?.sessions;
  if (!Array.isArray(planSessions)) {
    // Try object-style sessions (e.g. {"1": {...}, "2": {...}})
    const objSessions = topic?.sessions;
    if (objSessions && typeof objSessions === 'object' && !Array.isArray(objSessions)) {
      const session = objSessions[String(sessionNumber)];
      if (!session) {
        console.error(`Session ${sessionNumber} not found in object-style sessions. Available: ${Object.keys(objSessions).join(', ')}`);
        return null;
      }
      return buildSessionInput(topic, session, sessionNumber);
    }
    console.error('Topic does not have plan.sessions array or object-style sessions.');
    return null;
  }

  // Find session by sessionNumber field
  const session = planSessions.find((s: any) => s.sessionNumber === sessionNumber);
  if (!session) {
    // Fall back to index-based lookup (0-based)
    const byIndex = planSessions[sessionNumber - 1];
    if (!byIndex) return null;
    return buildSessionInput(topic, byIndex, sessionNumber);
  }

  return buildSessionInput(topic, session, sessionNumber);
}

function buildSessionInput(topic: any, session: any, sessionNumber: number): SessionInput {
  return {
    topic: topic.topic || topic.title || 'Unknown Topic',
    sessionNumber,
    title: session.title || `Session ${sessionNumber}`,
    content: session.content || '',
    objectives: session.objectives || [],
    reviewQuestions: (session.reviewQuestions || []).map((q: string) => {
      // Strip :::hint suffix if present
      return q.includes(':::') ? q.split(':::')[0].trim() : q;
    }),
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/render-session.ts <topic-slug> <session-number> [--language python|java]');
    console.log('Example: npx tsx scripts/render-session.ts load-balancing 2');
    process.exit(1);
  }

  const topicSlug = args[0];
  const sessionNumber = parseInt(args[1], 10);
  const langArg = args.find(a => a.startsWith('--language='))?.split('=')[1]
    || (args.indexOf('--language') >= 0 ? args[args.indexOf('--language') + 1] : 'python');

  if (isNaN(sessionNumber) || sessionNumber < 1) {
    console.error('Session number must be a positive integer.');
    process.exit(1);
  }

  console.log(`\n=== Guru Sishya Video Pipeline — Session Renderer ===\n`);
  console.log(`Topic slug:     ${topicSlug}`);
  console.log(`Session:        ${sessionNumber}`);
  console.log(`Language:       ${langArg}`);
  console.log(`Content dir:    ${CONTENT_DIR}\n`);

  // 1. Find the topic
  console.log('Searching for topic...');
  const topic = findTopic(topicSlug);
  if (!topic) {
    console.error(`Topic "${topicSlug}" not found in content files.`);
    process.exit(1);
  }
  console.log(`  Found: "${topic.topic}"`);

  // List available sessions
  const planSessions = topic?.plan?.sessions;
  if (Array.isArray(planSessions)) {
    console.log(`  Available sessions (${planSessions.length}):`);
    for (const s of planSessions) {
      const marker = s.sessionNumber === sessionNumber ? ' <-- THIS ONE' : '';
      console.log(`    Session ${s.sessionNumber}: ${s.title}${marker}`);
    }
  }

  // 2. Extract the session
  console.log(`\nExtracting session ${sessionNumber}...`);
  const session = extractPlanSession(topic, sessionNumber);
  if (!session) {
    console.error(`Session ${sessionNumber} not found. Available: 1-${planSessions?.length || '?'}`);
    process.exit(1);
  }
  console.log(`  Title: "${session.title}"`);
  console.log(`  Content: ${session.content.length} chars`);
  console.log(`  Objectives: ${session.objectives.length}`);
  console.log(`  Review Qs: ${session.reviewQuestions.length}`);

  // 3. Generate script
  console.log('\nGenerating script...');
  const script = generateScript(session, { language: langArg });
  console.log(`  ${script.length} scenes generated`);

  // 4. Generate TTS audio
  console.log('\nGenerating TTS audio (Kokoro)...');
  const audioResults = await generateSceneAudios(
    script.map(s => ({ narration: s.narration, type: s.type })),
    'af_heart',
    'indian-english'
  );
  const totalAudioSecs = audioResults.reduce((sum, a) => sum + a.duration, 0);
  console.log(`  ${totalAudioSecs.toFixed(1)}s audio (${(totalAudioSecs / 60).toFixed(1)} min)`);

  // 5. Generate storyboard
  console.log('\nGenerating storyboard...');
  const storyboard = generateStoryboard(script, audioResults, {
    topic: session.topic,
    sessionNumber: session.sessionNumber,
  });

  // Attach BGM
  storyboard.bgmFile = pickBgm(`${session.topic}:${session.sessionNumber}:${langArg}`);

  const duration = getStoryboardDuration(storyboard);
  const validation = validateStoryboard(storyboard);

  console.log(`  Duration: ${duration.minutes}`);
  console.log(`  Scenes: ${storyboard.scenes.length}`);
  console.log(`  Valid: ${validation.valid ? 'YES' : 'NO — ' + validation.issues.join('; ')}`);

  // 6. Save output
  fs.mkdirSync('output', { recursive: true });
  const propsPath = `output/test-props-s${sessionNumber}.json`;
  fs.writeFileSync(propsPath, JSON.stringify({ storyboard }));
  console.log(`\nSaved: ${propsPath}`);

  // Scene breakdown
  console.log('\nScene breakdown:');
  storyboard.scenes.forEach((s, i) => {
    const dur = ((s.endFrame - s.startFrame) / 30).toFixed(1);
    console.log(`  Scene ${i + 1}: [${s.type}] frames ${s.startFrame}-${s.endFrame} (${dur}s)${s.vizVariant ? ' viz=' + s.vizVariant : ''}`);
  });

  console.log(`\nTo render:`);
  console.log(`  npx remotion render src/compositions/index.tsx LongVideo output/${topicSlug}-s${sessionNumber}.mp4 --props=${propsPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
