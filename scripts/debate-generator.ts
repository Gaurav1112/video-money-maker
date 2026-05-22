#!/usr/bin/env npx tsx
/**
 * debate-generator.ts -- Two-voice tech debate Short generator
 *
 * Generates debate scripts between two technologies with two distinct
 * Edge TTS voices, interleaved audio, and ViralShort rendering.
 *
 * Usage:
 *   npx tsx scripts/debate-generator.ts --topic 0              # preview debate #0
 *   npx tsx scripts/debate-generator.ts --topic 0 --render      # render debate #0
 *   npx tsx scripts/debate-generator.ts --daily                 # today's debate
 *   npx tsx scripts/debate-generator.ts --daily --render        # render today's debate
 *   npx tsx scripts/debate-generator.ts --list                  # list all topics
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { Scene, Storyboard } from '../src/types';

// ---- Types -----------------------------------------------------------------

interface DebateTopic {
  a: string;
  b: string;
  category: string;
}

interface DebateExchange {
  speaker: 'A' | 'B';
  text: string;
  voice: string;
}

interface DebateScript {
  title: string;
  topicA: string;
  topicB: string;
  category: string;
  exchanges: DebateExchange[];
  winner: string;
  winnerDeclaration: string;
  hookText: string;
  spokenHook: string;
  generatedAt: string;
}

// ---- Debate Topics ---------------------------------------------------------

const DEBATE_TOPICS: DebateTopic[] = [
  { a: 'Redis', b: 'Memcached', category: 'caching' },
  { a: 'PostgreSQL', b: 'MySQL', category: 'database' },
  { a: 'REST', b: 'GraphQL', category: 'api' },
  { a: 'Docker', b: 'Podman', category: 'containers' },
  { a: 'Kubernetes', b: 'Docker Swarm', category: 'orchestration' },
  { a: 'Kafka', b: 'RabbitMQ', category: 'messaging' },
  { a: 'MongoDB', b: 'PostgreSQL', category: 'database' },
  { a: 'TypeScript', b: 'JavaScript', category: 'language' },
  { a: 'Rust', b: 'Go', category: 'language' },
  { a: 'AWS', b: 'GCP', category: 'cloud' },
  { a: 'Monolith', b: 'Microservices', category: 'architecture' },
  { a: 'SQL', b: 'NoSQL', category: 'database' },
  { a: 'gRPC', b: 'REST', category: 'api' },
  { a: 'Nginx', b: 'Caddy', category: 'server' },
  { a: 'React', b: 'Vue', category: 'frontend' },
  { a: 'Linux', b: 'macOS', category: 'os' },
  { a: 'Redis', b: 'DynamoDB', category: 'database' },
  { a: 'Jenkins', b: 'GitHub Actions', category: 'cicd' },
  { a: 'Terraform', b: 'Pulumi', category: 'iac' },
  { a: 'Vim', b: 'VS Code', category: 'editor' },
];

// ---- Voice Config ----------------------------------------------------------

const VOICE_A = 'en-US-GuyNeural'; // aggressive, bold claims
const VOICE_B = 'en-US-JennyNeural'; // measured, data-driven counter

// ---- Debate Script Templates -----------------------------------------------

// Speaker A templates: aggressive, makes bold claims
const SPEAKER_A_TEMPLATES: Array<(a: string, b: string) => string[]> = [
  (a, b) => [
    `${a} is objectively superior. Anyone still using ${b} in production is wasting money.`,
    `The benchmarks do not lie. ${a} crushes ${b} in every category that matters. Throughput, latency, reliability.`,
    `Let me be blunt. ${b} had its time. But the industry has moved on. Every top-tier company is standardizing on ${a}.`,
  ],
  (a, b) => [
    `${a} dominates because it was built for scale. ${b} was a side project that got too popular.`,
    `Show me ONE Fortune 500 that chose ${b} over ${a} in the last 2 years. I will wait.`,
    `The migration path is clear. ${b} to ${a}. Nobody is going the other direction. That tells you everything.`,
  ],
  (a, b) => [
    `If you are starting a new project today and you pick ${b} over ${a}, you are making a mistake you will regret in 6 months.`,
    `${a} has a 10x better developer experience. The ecosystem is not even close.`,
    `The real cost of ${b} is invisible. Technical debt, workarounds, missing features. ${a} solves all of that out of the box.`,
  ],
];

// Speaker B templates: measured, counters with data
const SPEAKER_B_TEMPLATES: Array<(a: string, b: string) => string[]> = [
  (a, b) => [
    `That is a bold claim, but the data tells a different story. ${b} handles 40 percent of the market for good reason.`,
    `Benchmarks without context are meaningless. In real-world scenarios with typical workloads, ${b} matches or beats ${a}.`,
    `The companies sticking with ${b} are not making mistakes. They are making pragmatic decisions based on total cost of ownership.`,
  ],
  (a, b) => [
    `Actually, Gartner shows ${b} adoption is growing, not shrinking. The data contradicts your claim.`,
    `Those benchmarks are synthetic. In production, ${b} wins on operational simplicity, which saves more than raw performance gains.`,
    `The migration argument is survivorship bias. You only hear about the ones that switched. The silent majority stayed with ${b} and is doing fine.`,
  ],
  (a, b) => [
    `Interesting take, but you are ignoring the learning curve. Teams that already know ${b} ship faster than teams learning ${a} from scratch.`,
    `Developer experience is subjective. Stack Overflow satisfaction surveys show ${b} developers are just as happy.`,
    `Out of the box features mean nothing if you only use 20 percent of them. ${b} keeps it simple, which means fewer bugs in production.`,
  ],
];

// ---- Generate Debate -------------------------------------------------------

export function generateDebate(topicIndex: number): DebateScript {
  const topic = DEBATE_TOPICS[topicIndex % DEBATE_TOPICS.length];
  const { a, b, category } = topic;

  // Deterministically select template sets based on index
  const aTemplateSet = SPEAKER_A_TEMPLATES[topicIndex % SPEAKER_A_TEMPLATES.length](a, b);
  const bTemplateSet = SPEAKER_B_TEMPLATES[topicIndex % SPEAKER_B_TEMPLATES.length](a, b);

  // Build 6 exchanges: A B A B A B
  const exchanges: DebateExchange[] = [];
  for (let i = 0; i < 3; i++) {
    exchanges.push({ speaker: 'A', text: aTemplateSet[i], voice: VOICE_A });
    exchanges.push({ speaker: 'B', text: bTemplateSet[i], voice: VOICE_B });
  }

  // Alternate winner to create comment disagreement
  const winner = topicIndex % 2 === 0 ? a : b;
  const winnerDeclaration =
    topicIndex % 2 === 0
      ? `${a} wins this debate. Not even close. But I know the ${b} fans will disagree in the comments.`
      : `${b} takes this one. The data is clear. But ${a} fans, tell me why I am wrong.`;

  // Title variations
  const titleVariants = [
    `${a} vs ${b} -- which is ACTUALLY better?`,
    `The ${a} vs ${b} debate is OVER`,
    `${a} vs ${b} -- the TRUTH nobody tells you`,
    `I settled the ${a} vs ${b} debate once and for all`,
  ];
  const title = titleVariants[topicIndex % titleVariants.length];

  const hookText = `${a} vs ${b}\nOne of them is LYING to you`;
  const spokenHook = `${a} versus ${b}. The internet cannot agree. Let us settle this once and for all.`;

  return {
    title,
    topicA: a,
    topicB: b,
    category,
    exchanges,
    winner,
    winnerDeclaration,
    hookText,
    spokenHook,
    generatedAt: new Date().toISOString(),
  };
}

export function getDailyDebate(date: Date): DebateScript {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return generateDebate(dayOfYear % DEBATE_TOPICS.length);
}

// ---- Render ----------------------------------------------------------------

async function renderDebate(debate: DebateScript): Promise<void> {
  const PROJECT_ROOT = path.resolve(__dirname, '..');
  const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'debates');
  const AUDIO_DIR = path.join(PROJECT_ROOT, 'public', 'audio');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(AUDIO_DIR, { recursive: true });

  const slug = `${debate.topicA}-vs-${debate.topicB}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  console.log(`\n=== Rendering Debate: ${debate.title} ===\n`);

  // 1. Generate TTS for each exchange + hook + winner declaration
  console.log('[1/4] Generating TTS audio for all speakers...');

  const { generateAudio } = await import('../src/pipeline/tts-engine');

  // Generate hook audio
  const hookAudio = await generateAudio(
    debate.spokenHook,
    'en-US-AndrewMultilingualNeural',
    `debate-${slug}-hook.mp3`,
    'english',
    '+20%'
  );
  console.log(`  Hook: ${hookAudio.duration.toFixed(1)}s`);

  // Generate exchange audio
  const exchangeAudios: Array<{ path: string; duration: number }> = [];
  for (let i = 0; i < debate.exchanges.length; i++) {
    const ex = debate.exchanges[i];
    const voice = ex.voice;
    const result = await generateAudio(
      ex.text,
      voice,
      `debate-${slug}-ex${i}.mp3`,
      'english',
      ex.speaker === 'A' ? '+25%' : '+15%'
    );
    exchangeAudios.push({ path: result.audioPath, duration: result.duration });
    console.log(`  Exchange ${i + 1} (Speaker ${ex.speaker}): ${result.duration.toFixed(1)}s`);
  }

  // Generate winner declaration audio
  const winnerAudio = await generateAudio(
    debate.winnerDeclaration,
    'en-US-AndrewMultilingualNeural',
    `debate-${slug}-winner.mp3`,
    'english',
    '+10%'
  );
  console.log(`  Winner: ${winnerAudio.duration.toFixed(1)}s`);

  // 2. Interleave audio with gaps using ffmpeg
  console.log('\n[2/4] Stitching audio with 0.3s gaps...');

  const GAP_SECONDS = 0.3;
  const DING_DURATION = 0.5;

  // Build ffmpeg concat file
  const concatEntries: string[] = [];

  // Generate silence + ding files
  const silencePath = path.join(AUDIO_DIR, 'debate-silence.mp3');
  const dingPath = path.join(AUDIO_DIR, 'debate-ding.mp3');

  try {
    execSync(
      `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t ${GAP_SECONDS} -codec:a libmp3lame -b:a 128k "${silencePath}"`,
      { stdio: 'pipe', timeout: 10000 }
    );
  } catch {
    // Create minimal silence file if ffmpeg fails
    fs.writeFileSync(silencePath, Buffer.alloc(1024, 0));
  }

  try {
    // Generate a short ding/beep between exchanges
    execSync(
      `ffmpeg -y -f lavfi -i "sine=frequency=880:duration=${DING_DURATION}" -af "afade=t=in:st=0:d=0.05,afade=t=out:st=${DING_DURATION - 0.1}:d=0.1,volume=0.3" -codec:a libmp3lame -b:a 128k "${dingPath}"`,
      { stdio: 'pipe', timeout: 10000 }
    );
  } catch {
    fs.writeFileSync(dingPath, Buffer.alloc(512, 0));
  }

  // Build concat list: hook + silence + [exchange + ding]... + winner
  const concatListPath = path.join(OUTPUT_DIR, `${slug}-concat.txt`);
  concatEntries.push(`file '${hookAudio.audioPath}'`);
  concatEntries.push(`file '${silencePath}'`);

  for (let i = 0; i < exchangeAudios.length; i++) {
    concatEntries.push(`file '${exchangeAudios[i].path}'`);
    if (i < exchangeAudios.length - 1) {
      concatEntries.push(`file '${dingPath}'`);
    }
  }

  concatEntries.push(`file '${silencePath}'`);
  concatEntries.push(`file '${winnerAudio.audioPath}'`);

  fs.writeFileSync(concatListPath, concatEntries.join('\n'));

  const masterAudioPath = path.join(AUDIO_DIR, `debate-${slug}-master.mp3`);
  try {
    execSync(
      `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -codec:a libmp3lame -b:a 192k "${masterAudioPath}"`,
      { stdio: 'pipe', timeout: 60000 }
    );
  } catch (err) {
    console.error('  ffmpeg concat failed, falling back to first exchange only');
    fs.copyFileSync(hookAudio.audioPath, masterAudioPath);
  }

  // Calculate total duration
  let totalDuration: number;
  try {
    const probe = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${masterAudioPath}"`,
      { timeout: 10000 }
    )
      .toString()
      .trim();
    totalDuration = parseFloat(probe) || 45;
  } catch {
    totalDuration =
      hookAudio.duration +
      exchangeAudios.reduce((s, e) => s + e.duration + GAP_SECONDS, 0) +
      winnerAudio.duration;
  }

  console.log(`  Master audio: ${totalDuration.toFixed(1)}s`);

  // 3. Build storyboard for ViralShort
  console.log('\n[3/4] Building storyboard...');

  const { generateStoryboard } = await import('../src/pipeline/storyboard');

  // Build scenes from exchanges
  const scenes: Scene[] = [];
  let frameOffset = 0;
  const FPS = 30;

  // Hook scene
  const hookDur = hookAudio.duration + GAP_SECONDS;
  scenes.push({
    type: 'title',
    content: debate.hookText,
    narration: debate.spokenHook,
    heading: `${debate.topicA} vs ${debate.topicB}`,
    duration: hookDur,
    startFrame: frameOffset,
    endFrame: frameOffset + Math.round(hookDur * FPS),
    wordTimestamps: hookAudio.wordTimestamps,
  });
  frameOffset += Math.round(hookDur * FPS);

  // Exchange scenes
  for (let i = 0; i < debate.exchanges.length; i++) {
    const ex = debate.exchanges[i];
    const exDur =
      exchangeAudios[i].duration + (i < debate.exchanges.length - 1 ? DING_DURATION : GAP_SECONDS);
    scenes.push({
      type: 'text',
      content: ex.text,
      narration: ex.text,
      heading: `Speaker ${ex.speaker}: ${ex.speaker === 'A' ? debate.topicA : debate.topicB}`,
      duration: exDur,
      startFrame: frameOffset,
      endFrame: frameOffset + Math.round(exDur * FPS),
    });
    frameOffset += Math.round(exDur * FPS);
  }

  // Winner scene
  scenes.push({
    type: 'summary',
    content: debate.winnerDeclaration,
    narration: debate.winnerDeclaration,
    heading: `Winner: ${debate.winner}`,
    duration: winnerAudio.duration,
    startFrame: frameOffset,
    endFrame: frameOffset + Math.round(winnerAudio.duration * FPS),
  });

  const totalFrames = frameOffset + Math.round(winnerAudio.duration * FPS);

  const storyboard: Storyboard = {
    fps: FPS,
    width: 1080,
    height: 1920,
    durationInFrames: totalFrames,
    scenes,
    audioFile: masterAudioPath,
    topic: `${debate.topicA}-vs-${debate.topicB}`,
    sessionNumber: 0,
    bgmFile: 'audio/bgm/warm-ambient.mp3',
  };

  // Write props
  const propsPath = path.join(OUTPUT_DIR, `${slug}-props.json`);
  fs.writeFileSync(propsPath, JSON.stringify({ storyboard }, null, 2));
  console.log(`  Props: ${propsPath}`);

  // 4. Render via Remotion ViralShort
  console.log('\n[4/4] Rendering via ViralShort...');
  const videoOutput = path.join(OUTPUT_DIR, `${slug}.mp4`);

  const renderCmd = [
    'npx',
    'remotion',
    'render',
    'src/compositions/index.tsx',
    'ViralShort',
    videoOutput,
    `--props=${propsPath}`,
    '--codec=h264',
    '--crf=18',
    '--audio-bitrate=192K',
    `--concurrency=${process.env.CI ? '1' : '4'}`,
    '--timeout=180000',
  ].join(' ');

  execSync(renderCmd, { stdio: 'inherit', cwd: PROJECT_ROOT });

  // Generate metadata
  const metadata = {
    slug,
    title: debate.title,
    topic: `${debate.topicA} vs ${debate.topicB}`,
    category: debate.category,
    winner: debate.winner,
    youtube: {
      title: debate.title,
      description: [
        debate.hookText.replace('\n', ' '),
        '',
        `${debate.topicA} vs ${debate.topicB} -- the ultimate showdown.`,
        `Winner: ${debate.winner}`,
        '',
        'Do you agree? Drop your take in the comments!',
        '',
        'Full courses: guru-sishya.in',
        '',
        `#${debate.topicA.replace(/\s+/g, '')} #${debate.topicB.replace(/\s+/g, '')} #techdebate #coding #systemdesign #shorts`,
      ].join('\n'),
      tags: [
        debate.topicA,
        debate.topicB,
        'tech debate',
        debate.category,
        'system design',
        'coding',
      ],
      categoryId: '27',
    },
    instagram: {
      caption: [
        debate.hookText.replace('\n', ' '),
        '',
        `Winner: ${debate.winner}`,
        'Agree or disagree?',
        '',
        '#coding #techdebate #systemdesign #gurusishya #shorts',
      ].join('\n'),
    },
    x_post: {
      text: `${debate.topicA} vs ${debate.topicB} -- which is actually better?\n\nI settled it. Watch the debate.`,
    },
    generatedAt: debate.generatedAt,
  };

  const metadataPath = path.join(OUTPUT_DIR, `${slug}-metadata.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  const fileSize = fs.statSync(videoOutput).size;
  console.log(`\n=== Debate Rendered ===`);
  console.log(`  Video:    ${videoOutput} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  Metadata: ${metadataPath}`);
  console.log(`  Title:    ${debate.title}`);
  console.log(`  Winner:   ${debate.winner}`);
  console.log('');
}

// ---- CLI -------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let topicIndex: number | null = null;
  let daily = false;
  let render = false;
  let list = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topic' && args[i + 1]) {
      topicIndex = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--daily') {
      daily = true;
    } else if (args[i] === '--render') {
      render = true;
    } else if (args[i] === '--list') {
      list = true;
    }
  }

  return { topicIndex, daily, render, list };
}

async function main() {
  const { topicIndex, daily, render, list } = parseArgs();

  if (list) {
    console.log('\n=== Debate Topics ===\n');
    for (let i = 0; i < DEBATE_TOPICS.length; i++) {
      const t = DEBATE_TOPICS[i];
      console.log(`  ${i}: ${t.a} vs ${t.b} (${t.category})`);
    }
    console.log(`\nTotal: ${DEBATE_TOPICS.length} topics`);
    console.log('Usage: npx tsx scripts/debate-generator.ts --topic 0 --render\n');
    return;
  }

  let debate: DebateScript;

  if (daily) {
    debate = getDailyDebate(new Date());
    console.log(`Daily debate for ${new Date().toISOString().slice(0, 10)}`);
  } else if (topicIndex !== null) {
    debate = generateDebate(topicIndex);
  } else {
    console.log('Usage:');
    console.log('  npx tsx scripts/debate-generator.ts --topic 0          # preview');
    console.log('  npx tsx scripts/debate-generator.ts --topic 0 --render  # render');
    console.log('  npx tsx scripts/debate-generator.ts --daily             # daily pick');
    console.log('  npx tsx scripts/debate-generator.ts --list              # list topics');
    return;
  }

  console.log(`\n=== Debate: ${debate.title} ===`);
  console.log(`  Category: ${debate.category}`);
  console.log(`  Hook: "${debate.hookText.replace('\n', ' ')}"`);
  console.log(`  Spoken Hook: "${debate.spokenHook}"`);
  console.log('');

  for (let i = 0; i < debate.exchanges.length; i++) {
    const ex = debate.exchanges[i];
    console.log(
      `  [${ex.speaker}] (${ex.speaker === 'A' ? debate.topicA : debate.topicB} -- ${ex.voice}):`
    );
    console.log(`     "${ex.text}"`);
    console.log('');
  }

  console.log(`  Winner: ${debate.winner}`);
  console.log(`  Declaration: "${debate.winnerDeclaration}"`);

  if (render) {
    await renderDebate(debate);
  } else {
    console.log('\n  Add --render to generate the video\n');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
