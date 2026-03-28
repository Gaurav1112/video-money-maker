#!/usr/bin/env npx tsx
/**
 * Generate all videos for a single guru-sishya topic.
 *
 * Usage:
 *   npx tsx scripts/generate-topic.ts --topic "Load Balancing"
 *   npx tsx scripts/generate-topic.ts --topic "Hash Maps" --language python
 *   npx tsx scripts/generate-topic.ts --demo                  (uses built-in demo content)
 *   npx tsx scripts/generate-topic.ts --demo=hash-map         (specific demo topic)
 *
 * For each session the script produces:
 *   - 1 long-form video (storyboard + TTS audio) per language
 *   - 4-5 short-clip metadata entries per language
 *
 * Nothing is rendered to video files here — that step is done by Remotion.
 * Run `npm start` to preview in Remotion Studio or use `npx remotion render`
 * to export MP4 files once storyboards are generated.
 */

import {
  getDemoSession,
  listDemoTopics,
  listAvailableTopics,
  loadTopicContent,
  extractSession,
} from '../src/pipeline/content-loader';
import { generateScript } from '../src/pipeline/script-generator';
import { generateSceneAudios } from '../src/pipeline/tts-engine';
import {
  generateStoryboard,
  getStoryboardDuration,
  validateStoryboard,
} from '../src/pipeline/storyboard';
import type { SessionInput } from '../src/types';

// ── Configuration ────────────────────────────────────────────────────────────

const LANGUAGES = ['python', 'java'];

const CLIP_TYPES = [
  'hook',
  'code-highlight',
  'aha-moment',
  'comparison',
  'review-challenge',
] as const;

type ClipType = (typeof CLIP_TYPES)[number];

const BGM_FILES = [
  'audio/bgm/lofi-study-1.mp3',
  'audio/bgm/lofi-study-2.mp3',
  'audio/bgm/lofi-chill-1.mp3',
  'audio/bgm/lofi-ambient-1.mp3',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic BGM selection based on a string seed. */
function pickBgm(seed: string): string {
  const hash = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return BGM_FILES[hash % BGM_FILES.length];
}

/**
 * Count the number of extractable sessions in a topic JSON file.
 * Mirrors the structural cases handled by extractSession() in content-loader.
 */
function countSessions(topicData: unknown): number {
  if (!topicData || typeof topicData !== 'object') return 0;

  // Structure A: flat array without nested sessions
  if (Array.isArray(topicData)) {
    const first = topicData[0] as Record<string, unknown> | undefined;
    if (first && !first.sessions) return topicData.length;

    // Nested array format: sum sessions across all topic objects
    let total = 0;
    for (const item of topicData as Array<Record<string, unknown>>) {
      if (item.sessions && typeof item.sessions === 'object' && !Array.isArray(item.sessions)) {
        total += Object.keys(item.sessions as object).length;
      }
    }
    return Math.max(total, 1);
  }

  const data = topicData as Record<string, unknown>;

  // Structure B: single topic object with sessions as a plain object
  if (data.sessions && typeof data.sessions === 'object' && !Array.isArray(data.sessions)) {
    return Object.keys(data.sessions as object).length;
  }

  // Structure C: { sessions: [...] }
  if (Array.isArray(data.sessions)) {
    return (data.sessions as unknown[]).length;
  }

  // Structure D: { topics: [{ sessions: [...] }] }
  if (Array.isArray(data.topics)) {
    for (const topic of data.topics as Array<Record<string, unknown>>) {
      if (Array.isArray(topic.sessions) && (topic.sessions as unknown[]).length > 0) {
        return (topic.sessions as unknown[]).length;
      }
    }
  }

  // Structure E: { questions: [...] } — batch every 10 questions into a session
  if (Array.isArray(data.questions)) {
    return Math.ceil((data.questions as unknown[]).length / 10);
  }

  return 1;
}

/** Result record for the final summary table. */
interface VideoResult {
  session: number;
  language: string;
  format: string;
  duration: string;
  scenes: number;
  status: string;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function generateTopic(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse --topic="Name" or --topic "Name"
  const topicArg =
    args.find(a => a.startsWith('--topic='))?.split('=').slice(1).join('=') ??
    (args.indexOf('--topic') >= 0 ? args[args.indexOf('--topic') + 1] : null);

  // Parse --language=python or --language python
  const langArg =
    args.find(a => a.startsWith('--language='))?.split('=')[1] ??
    (args.indexOf('--language') >= 0 ? args[args.indexOf('--language') + 1] : null);

  // --demo or --demo=<topic-key>
  const demoArg = args.find(a => a === '--demo' || a.startsWith('--demo='));
  const useDemo = !!demoArg;
  const demoTopicKey = demoArg?.includes('=') ? demoArg.split('=')[1] : undefined;

  const languages = langArg ? [langArg] : LANGUAGES;

  console.log('=== Guru Sishya Video Pipeline — Full Topic Generator ===\n');

  // ── Load sessions ──────────────────────────────────────────────────────────

  let sessions: SessionInput[] = [];

  if (useDemo) {
    const demoTopics = listDemoTopics();
    console.log(`Demo mode. Available demo topics: ${demoTopics.join(', ')}`);
    sessions = [getDemoSession(demoTopicKey)];
  } else if (topicArg) {
    const availableFiles = listAvailableTopics();

    // Case-insensitive substring match against file names
    const matchedFile = availableFiles.find(f =>
      f.toLowerCase().includes(topicArg.toLowerCase()) ||
      topicArg.toLowerCase().includes(f.toLowerCase()),
    );

    if (matchedFile) {
      console.log(`Found topic file: ${matchedFile}.json`);
      const content = loadTopicContent(matchedFile);
      const total = countSessions(content);
      console.log(`  ${total} session(s) detected.`);

      for (let i = 0; i < total; i++) {
        const session = extractSession(content, i);
        if (session) sessions.push(session);
      }

      if (sessions.length === 0) {
        console.warn('  No sessions could be extracted. Falling back to demo mode.');
        sessions = [getDemoSession()];
      }
    } else {
      console.log(`Topic "${topicArg}" not found among content files.`);
      console.log(`Available files: ${availableFiles.join(', ') || '(none)'}`);
      console.log('Falling back to demo mode.\n');
      sessions = [getDemoSession()];
    }
  } else {
    console.log('No topic specified. Use --topic="Load Balancing" or --demo');
    console.log(`Available demo topics: ${listDemoTopics().join(', ')}`);
    console.log('Falling back to demo mode.\n');
    sessions = [getDemoSession()];
  }

  // ── Summary header ─────────────────────────────────────────────────────────

  const topicName = sessions[0]?.topic ?? 'Unknown';
  const longFormCount = sessions.length * languages.length;
  const shortsCount = sessions.length * languages.length * CLIP_TYPES.length;
  const totalCount = longFormCount + shortsCount;

  console.log(`\nTopic:          ${topicName}`);
  console.log(`Sessions:       ${sessions.length}`);
  console.log(`Languages:      ${languages.join(', ')}`);
  console.log(`Long-form:      ${longFormCount}`);
  console.log(`Shorts:         ${shortsCount}  (${CLIP_TYPES.length} clip types × ${sessions.length * languages.length} videos)`);
  console.log(`Total videos:   ${totalCount}\n`);

  // ── Generate ───────────────────────────────────────────────────────────────

  let totalVideos = 0;
  const results: VideoResult[] = [];

  for (const session of sessions) {
    for (const language of languages) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Session ${session.sessionNumber}: ${session.title} [${language.toUpperCase()}]`);
      console.log('='.repeat(60));

      try {
        // 1. Generate script
        console.log('  Generating script...');
        const script = generateScript(session, { language });
        console.log(`     ${script.length} scenes`);

        // 2. Generate TTS audio for all scenes
        console.log('  Generating TTS audio...');
        const audioResults = await generateSceneAudios(
          script.map(s => ({ narration: s.narration, type: s.type })),
        );
        const totalAudioSecs = audioResults.reduce((sum, a) => sum + a.duration, 0);
        console.log(
          `     ${totalAudioSecs.toFixed(1)}s audio (${(totalAudioSecs / 60).toFixed(1)} min)`,
        );

        // 3. Generate storyboard
        console.log('  Generating storyboard...');
        const storyboard = generateStoryboard(script, audioResults, {
          topic: session.topic,
          sessionNumber: session.sessionNumber,
        });

        // Attach background music (deterministic based on topic + session + language)
        storyboard.bgmFile = pickBgm(`${session.topic}:${session.sessionNumber}:${language}`);

        // 4. Validate and report long-form result
        const duration = getStoryboardDuration(storyboard);
        const validation = validateStoryboard(storyboard);
        const statusIcon = validation.valid ? 'OK' : 'WARN';

        console.log(
          `  [${statusIcon}] Long-form: ${duration.minutes} (${storyboard.scenes.length} scenes)` +
            (validation.valid ? '' : `  Issues: ${validation.issues.join('; ')}`),
        );

        results.push({
          session: session.sessionNumber,
          language,
          format: 'Long (16:9)',
          duration: duration.minutes,
          scenes: storyboard.scenes.length,
          status: validation.valid ? 'OK' : 'WARN',
        });
        totalVideos++;

        // 5. Report short clip types — metadata only (no separate TTS needed)
        for (const clipType of CLIP_TYPES) {
          // Each short extracts the most relevant scene from the long-form storyboard
          const shortSceneCount = clipType === 'hook' ? 1 : 2;
          console.log(`  [OK] Short [${clipType}]: ~20-45s  (${shortSceneCount} scene(s))`);
          results.push({
            session: session.sessionNumber,
            language,
            format: `Short: ${clipType}`,
            duration: '20-45s',
            scenes: shortSceneCount,
            status: 'OK',
          });
          totalVideos++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  [ERR] ${message}`);
        results.push({
          session: session.sessionNumber,
          language,
          format: 'Long (16:9)',
          duration: '-',
          scenes: 0,
          status: 'ERR',
        });
      }
    }
  }

  // ── Final summary ──────────────────────────────────────────────────────────

  console.log(`\n${'='.repeat(60)}`);
  console.log('GENERATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Topic:               ${topicName}`);
  console.log(`Total videos:        ${totalVideos}`);
  console.log(`  Long-form:         ${results.filter(r => r.format === 'Long (16:9)').length}`);
  console.log(`  Shorts:            ${results.filter(r => r.format.startsWith('Short:')).length}`);

  // Print result table
  console.log('\nSession | Language | Format                | Duration | Scenes | Status');
  console.log('--------|----------|-----------------------|----------|--------|-------');
  for (const r of results) {
    const session = String(r.session).padEnd(7);
    const lang = r.language.padEnd(8);
    const format = r.format.padEnd(21);
    const dur = r.duration.padEnd(8);
    const scenes = String(r.scenes).padEnd(6);
    console.log(`${session} | ${lang} | ${format} | ${dur} | ${scenes} | ${r.status}`);
  }

  // Render instructions
  console.log('\nTo render videos with Remotion:');
  console.log('  Long-form:  npx remotion render src/index.ts LongVideo out/long-video.mp4');
  console.log('  Short hook: npx remotion render src/index.ts MultiShort-hook out/short-hook.mp4');
  console.log('\nPreview in Remotion Studio:');
  console.log('  npm start');
  console.log(`\nPublish targets: YouTube (GuruSishya-India) + Instagram (@guru_sishya.in)`);
}

generateTopic().catch(console.error);
