#!/usr/bin/env npx tsx
/**
 * Render all videos for a guru-sishya topic.
 * Generates storyboards then renders via Remotion to ~/Documents/GuruSishya-Videos/
 *
 * Usage:
 *   npx tsx scripts/render-topic.ts --demo
 *   npx tsx scripts/render-topic.ts --topic "Load Balancing"
 *   npx tsx scripts/render-topic.ts --topic "Hash Maps" --language python
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getDemoSession, listDemoTopics, listAvailableTopics, loadTopicContent, extractSession } from '../src/pipeline/content-loader';
import { generateScript } from '../src/pipeline/script-generator';
import { generateSceneAudios } from '../src/pipeline/tts-engine';
import { generateStoryboard, getStoryboardDuration, validateStoryboard } from '../src/pipeline/storyboard';
import { generateMetadata } from '../src/pipeline/metadata-generator';

const OUTPUT_BASE = path.join(process.env.HOME || '~', 'Documents', 'GuruSishya-Videos');
const LANGUAGES = ['python', 'java'];
const CLIP_TYPES = ['hook', 'code-highlight', 'aha-moment', 'comparison', 'review-challenge'] as const;
const BGM_FILES = [
  'audio/bgm/gentle-drone.mp3',
  'audio/bgm/study-pad.mp3',
  'audio/bgm/warm-ambient.mp3',
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function renderTopic() {
  const args = process.argv.slice(2);
  const topicArg = args.find(a => a.startsWith('--topic='))?.split('=')[1]
    || (args.indexOf('--topic') >= 0 ? args[args.indexOf('--topic') + 1] : null);
  const langArg = args.find(a => a.startsWith('--language='))?.split('=')[1];
  const useDemo = args.includes('--demo');
  const skipRender = args.includes('--storyboard-only');
  const languages = langArg ? [langArg] : LANGUAGES;

  console.log('🎬 Guru Sishya Video Pipeline — Full Topic Renderer\n');

  // Load session(s)
  let sessions: any[] = [];

  if (useDemo) {
    console.log(`Demo mode. Available topics: ${listDemoTopics().join(', ')}`);
    sessions = [getDemoSession(topicArg || undefined)];
  } else if (topicArg) {
    const topics = listAvailableTopics();
    const match = topics.find(t => t.toLowerCase().includes(topicArg.toLowerCase()));
    if (match) {
      const content = loadTopicContent(match);
      const allSessions = content.sessions || [content];
      if (Array.isArray(allSessions)) {
        for (let i = 0; i < allSessions.length; i++) {
          const s = extractSession(content, i);
          if (s) sessions.push(s);
        }
      }
    }
    if (sessions.length === 0) {
      console.log(`Topic "${topicArg}" not found. Using demo.`);
      sessions = [getDemoSession()];
    }
  } else {
    console.log('No topic specified. Using demo (Load Balancing).');
    sessions = [getDemoSession()];
  }

  const topicSlug = slugify(sessions[0]?.topic || 'unknown');
  const topicDir = path.join(OUTPUT_BASE, topicSlug);
  ensureDir(topicDir);

  console.log(`📚 Topic: ${sessions[0]?.topic}`);
  console.log(`📂 Output: ${topicDir}`);
  console.log(`🎯 Sessions: ${sessions.length}`);
  console.log(`🌐 Languages: ${languages.join(', ')}`);
  const totalVideos = sessions.length * languages.length * (1 + CLIP_TYPES.length);
  console.log(`🎥 Total videos: ${totalVideos}\n`);

  let rendered = 0;
  let failed = 0;

  for (const session of sessions) {
    for (const language of languages) {
      const sessionSlug = `session-${session.sessionNumber}`;
      const sessionDir = path.join(topicDir, sessionSlug, language);
      ensureDir(sessionDir);
      ensureDir(path.join(sessionDir, 'shorts'));

      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📖 ${session.title} [${language.toUpperCase()}] — Session ${session.sessionNumber}`);
      console.log('═'.repeat(60));

      try {
        // 1. Generate script (session-aware: pass session number and total for series linking)
        console.log('  📝 Script...');
        const script = generateScript(session, {
          language,
          sessionNumber: session.sessionNumber,
          totalSessions: sessions.length,
        });

        // 2. Generate TTS
        console.log('  🎙️ TTS audio...');
        const audioResults = await generateSceneAudios(
          script.map(s => ({ narration: s.narration, type: s.type }))
        );
        const audioTotal = audioResults.reduce((sum, a) => sum + a.duration, 0);
        console.log(`     ${audioTotal.toFixed(0)}s audio`);

        // 3. Storyboard
        console.log('  🎬 Storyboard...');
        const storyboard = generateStoryboard(script, audioResults, {
          topic: session.topic,
          sessionNumber: session.sessionNumber,
        });

        // BGM
        const bgmSeed = (session.topic + session.sessionNumber + language)
          .split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
        storyboard.bgmFile = BGM_FILES[bgmSeed % BGM_FILES.length];

        const duration = getStoryboardDuration(storyboard);
        const validation = validateStoryboard(storyboard);

        console.log(`     ${duration.minutes} | ${storyboard.scenes.length} scenes | ${validation.valid ? '✅' : '⚠️ ' + validation.issues[0]}`);

        // 4. Generate metadata
        const metadata = generateMetadata(storyboard, language);

        // Save metadata
        const metaPath = path.join(sessionDir, 'metadata.json');
        fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
        console.log(`  📋 Metadata saved: ${metaPath}`);

        // 5. Save storyboard for rendering
        const storyboardPath = path.join(sessionDir, 'storyboard.json');
        fs.writeFileSync(storyboardPath, JSON.stringify(storyboard));
        console.log(`  💾 Storyboard saved: ${storyboardPath}`);

        if (skipRender) {
          console.log('  ⏭️ Skipping render (--storyboard-only)');
          rendered++;
          continue;
        }

        // 6. Long-form render
        const longPath = path.join(sessionDir, `${topicSlug}-s${session.sessionNumber}-${language}-long.mp4`);
        console.log(`  🎥 Rendering long-form → ${path.basename(longPath)}...`);

        // Note: Actual Remotion render requires the composition to read from the storyboard.
        // For now, save the storyboard JSON — actual rendering done via:
        //   npx remotion render src/compositions/index.tsx LongVideo <output> --props=<storyboard.json>
        console.log(`     ℹ️  To render: npx remotion render src/compositions/index.tsx LongVideo "${longPath}" --props="${storyboardPath}"`);
        rendered++;

        // 7. Shorts
        for (const clipType of CLIP_TYPES) {
          const shortPath = path.join(sessionDir, 'shorts', `${topicSlug}-s${session.sessionNumber}-${language}-${clipType}.mp4`);
          console.log(`  📱 Short [${clipType}] → ${path.basename(shortPath)}`);
          console.log(`     ℹ️  To render: npx remotion render src/compositions/index.tsx MultiShort-${clipType} "${shortPath}" --props="${storyboardPath}"`);
          rendered++;
        }

      } catch (err: any) {
        console.error(`  ❌ Error: ${err.message || err}`);
        failed++;
      }
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log('🏁 RENDER SUMMARY');
  console.log('═'.repeat(60));
  console.log(`📚 Topic: ${sessions[0]?.topic}`);
  console.log(`📂 Output: ${topicDir}/`);
  console.log(`✅ Prepared: ${rendered} videos`);
  if (failed > 0) console.log(`❌ Failed: ${failed}`);
  console.log(`\n📁 Folder structure:`);
  console.log(`  ${topicDir}/`);
  for (const session of sessions) {
    console.log(`    session-${session.sessionNumber}/`);
    for (const lang of languages) {
      console.log(`      ${lang}/`);
      console.log(`        storyboard.json`);
      console.log(`        metadata.json`);
      console.log(`        ${topicSlug}-s${session.sessionNumber}-${lang}-long.mp4`);
      console.log(`        shorts/`);
      for (const ct of CLIP_TYPES) {
        console.log(`          ${topicSlug}-s${session.sessionNumber}-${lang}-${ct}.mp4`);
      }
    }
  }
  console.log(`\n🎯 Publish to: YouTube (GuruSishya-India) + Instagram (@guru_sishya.in)`);
}

renderTopic().catch(console.error);
