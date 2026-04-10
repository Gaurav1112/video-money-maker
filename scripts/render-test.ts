import { generateScript } from '../src/pipeline/script-generator';
import { generateSceneAudios } from '../src/pipeline/tts-engine';
import { generateStoryboard } from '../src/pipeline/storyboard';
import { getDemoSession } from '../src/pipeline/content-loader';
import fs from 'fs';

async function main() {
  console.log('Generating storyboard for render test...');
  const session = getDemoSession();
  const script = generateScript(session, { language: 'python' });
  const audioResults = await generateSceneAudios(
    script.map(s => ({ narration: s.narration, type: s.type })),
    'af_heart',
    'indian-english'
  );
  const storyboard = generateStoryboard(script, audioResults, {
    topic: session.topic,
    sessionNumber: session.sessionNumber,
  });

  fs.mkdirSync('output', { recursive: true });
  fs.writeFileSync('output/test-props.json', JSON.stringify({ storyboard }));
  console.log(`✅ ${storyboard.scenes.length} scenes, ${storyboard.durationInFrames} frames (${(storyboard.durationInFrames/30).toFixed(0)}s)`);
  console.log('Props: output/test-props.json');

  // Print scene breakdown
  storyboard.scenes.forEach((s, i) => {
    console.log(`  Scene ${i+1}: [${s.type}] frames ${s.startFrame}-${s.endFrame} (${((s.endFrame-s.startFrame)/30).toFixed(1)}s)`);
  });
}
main();
