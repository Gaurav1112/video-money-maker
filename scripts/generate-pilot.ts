import { getDemoSession, listDemoTopics, extractSession, loadTopicContent, listAvailableTopics } from '../src/pipeline/content-loader';
import { generateScript } from '../src/pipeline/script-generator';
import { generateSceneAudios } from '../src/pipeline/tts-engine';
import { generateStoryboard, getStoryboardDuration, validateStoryboard } from '../src/pipeline/storyboard';

async function generatePilot() {
  console.log('=== AI Video Pipeline — Pilot Video Generator ===\n');

  // Check for --demo flag or --demo=<topic> argument
  const demoArg = process.argv.find(a => a.startsWith('--demo'));
  const useDemo = !!demoArg;
  const demoTopic = demoArg?.includes('=') ? demoArg.split('=')[1] : undefined;

  // 1. Load content
  console.log('Step 1: Loading content...');
  let session;

  if (useDemo) {
    console.log(`  Using demo session${demoTopic ? ` (${demoTopic})` : ''}.`);
    console.log(`  Available demo topics: ${listDemoTopics().join(', ')}`);
    session = getDemoSession(demoTopic);
  } else {
    const topics = listAvailableTopics();
    if (topics.length > 0) {
      console.log(`  Found ${topics.length} topic files. Using first available.`);
      const content = loadTopicContent(topics[0]);
      session = extractSession(content, 0);
    }
  }

  if (!session) {
    console.log('  No content files found. Using demo session (Load Balancing).');
    session = getDemoSession();
  }

  console.log(`  Topic: ${session.topic}`);
  console.log(`  Title: ${session.title}`);
  console.log(`  Objectives: ${session.objectives.length}`);
  console.log(`  Review Questions: ${session.reviewQuestions.length}`);

  // 2. Generate scripts for both languages
  for (const language of ['python', 'java']) {
    console.log(`\n--- Generating ${language.toUpperCase()} version ---\n`);

    console.log('Step 2: Generating script...');
    const script = generateScript(session, { language });
    console.log(`  Generated ${script.length} scenes`);
    script.forEach((s, i) => {
      console.log(`    Scene ${i + 1}: [${s.type}] ${s.narration.slice(0, 60)}...`);
    });

    // 3. Generate TTS audio (or estimate if Kokoro unavailable)
    console.log('\nStep 3: Generating TTS audio...');
    const audioResults = await generateSceneAudios(
      script.map(s => ({ narration: s.narration, type: s.type }))
    );
    const totalAudioDuration = audioResults.reduce((sum, a) => sum + a.duration, 0);
    console.log(`  Total audio duration: ${totalAudioDuration.toFixed(1)}s (${(totalAudioDuration / 60).toFixed(1)} min)`);

    // 4. Generate storyboard
    console.log('\nStep 4: Generating storyboard...');
    const storyboard = generateStoryboard(script, audioResults, {
      topic: session.topic,
      sessionNumber: session.sessionNumber,
    });

    const duration = getStoryboardDuration(storyboard);
    console.log(`  Duration: ${duration.minutes} (${duration.frames} frames)`);

    // 5. Validate
    const validation = validateStoryboard(storyboard);
    if (validation.valid) {
      console.log('  Validation: PASSED');
    } else {
      console.log('  Validation ISSUES:');
      validation.issues.forEach(issue => console.log(`    - ${issue}`));
    }

    // 6. Print summary
    console.log(`\n=== ${language.toUpperCase()} Pilot Summary ===`);
    console.log(`  Topic: ${storyboard.topic}`);
    console.log(`  Scenes: ${storyboard.scenes.length}`);
    console.log(`  Duration: ${duration.minutes}`);
    console.log(`  Format: Long (1920x1080) + Short (1080x1920) + Thumb (1280x720)`);
    console.log(`  Audio: ${storyboard.audioFile || '(estimated, Kokoro not running)'}`);
  }

  console.log('\n=== Pilot Generation Complete ===');
  console.log('To render the actual video, start Kokoro TTS Docker and run:');
  console.log('  docker-compose up -d kokoro-tts');
  console.log('  npm run pilot');
  console.log('\nOr preview in Remotion Studio:');
  console.log('  npm start');
}

generatePilot().catch(console.error);
