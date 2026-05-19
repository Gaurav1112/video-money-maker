#!/usr/bin/env npx tsx
/**
 * challenge-generator.ts -- "Can X handle Y?" challenge Short generator
 *
 * Generates escalation-style challenge scripts that test a system's limits,
 * scaling from 100 users to 1 billion with breakdowns at each level.
 *
 * Usage:
 *   npx tsx scripts/challenge-generator.ts --challenge 0              # preview
 *   npx tsx scripts/challenge-generator.ts --challenge 0 --render      # render
 *   npx tsx scripts/challenge-generator.ts --daily                     # today's pick
 *   npx tsx scripts/challenge-generator.ts --list                      # list all
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import type { Scene, Storyboard } from '../src/types';

// ---- Types -----------------------------------------------------------------

interface Challenge {
  system: string;
  scale: string;
  verdict: 'works' | 'fails';
  why: string;
}

interface ScaleStep {
  level: string;
  description: string;
  breaks: boolean;
  fix?: string;
}

interface ChallengeScript {
  title: string;
  system: string;
  scale: string;
  verdict: 'works' | 'fails';
  why: string;
  hookText: string;
  spokenHook: string;
  steps: ScaleStep[];
  verdictText: string;
  spokenVerdict: string;
  generatedAt: string;
}

// ---- Challenges ------------------------------------------------------------

const CHALLENGES: Challenge[] = [
  { system: 'SQLite', scale: '1 million concurrent users', verdict: 'fails', why: 'single writer lock' },
  { system: 'a single Raspberry Pi', scale: 'a Kubernetes cluster', verdict: 'works', why: 'K3s exists' },
  { system: 'a $5/month VPS', scale: '1 million requests per day', verdict: 'works', why: 'with proper caching' },
  { system: 'MongoDB', scale: 'a banking system', verdict: 'fails', why: 'no ACID transactions by default' },
  { system: 'Redis', scale: 'a primary database', verdict: 'works', why: 'with persistence and replication' },
  { system: 'a single PostgreSQL', scale: '10 million rows', verdict: 'works', why: 'with proper indexing' },
  { system: 'a monolith', scale: '100 million users', verdict: 'works', why: 'Shopify does it' },
  { system: 'JavaScript', scale: 'a real-time trading system', verdict: 'fails', why: 'garbage collection pauses' },
  { system: 'WebSockets', scale: '1 million simultaneous connections', verdict: 'works', why: 'with proper epoll and load balancing' },
  { system: 'a single MySQL instance', scale: 'a billion-row table', verdict: 'fails', why: 'queries slow to crawl without partitioning' },
  { system: 'Kubernetes', scale: 'a 2-person startup', verdict: 'fails', why: 'operational overhead exceeds the team size' },
  { system: 'a CDN alone', scale: 'a dynamic e-commerce site', verdict: 'fails', why: 'dynamic content needs origin servers' },
  { system: 'GraphQL', scale: 'a public API', verdict: 'fails', why: 'query complexity attacks without rate limiting' },
  { system: 'Docker Compose', scale: 'production deployment', verdict: 'works', why: 'for small to medium workloads with proper health checks' },
  { system: 'a serverless function', scale: 'a video processing pipeline', verdict: 'fails', why: 'timeout limits and cold starts kill throughput' },
  { system: 'Nginx', scale: '10 million requests per second', verdict: 'works', why: 'with proper tuning and multiple workers' },
  { system: 'a REST API', scale: 'real-time chat', verdict: 'fails', why: 'polling wastes bandwidth, no push capability' },
  { system: 'React', scale: 'a 500-page app', verdict: 'works', why: 'with code splitting and lazy loading' },
  { system: 'a free-tier cloud account', scale: 'a startup MVP', verdict: 'works', why: 'AWS and GCP free tiers are surprisingly generous' },
  { system: 'Excel', scale: 'a production database', verdict: 'fails', why: 'no concurrency, no ACID, 1 million row limit' },
];

// ---- Scale Steps Generator -------------------------------------------------

function generateScaleSteps(challenge: Challenge): ScaleStep[] {
  const steps: ScaleStep[] = [];

  if (challenge.verdict === 'works') {
    steps.push({
      level: '100 users',
      description: `${challenge.system} handles this easily. No sweat.`,
      breaks: false,
    });
    steps.push({
      level: '1,000 users',
      description: `Still fine. Basic setup works. Maybe add some caching.`,
      breaks: false,
      fix: 'add basic caching',
    });
    steps.push({
      level: '10,000 users',
      description: `Starting to feel the pressure. Connection pooling becomes important.`,
      breaks: false,
      fix: 'connection pooling and query optimization',
    });
    steps.push({
      level: '100,000 users',
      description: `This is where most people think it breaks. But it does not.`,
      breaks: false,
      fix: 'horizontal scaling and read replicas',
    });
    steps.push({
      level: '1 million users',
      description: `Serious engineering required. But ${challenge.system} can still do it.`,
      breaks: false,
      fix: challenge.why,
    });
    steps.push({
      level: '1 billion users',
      description: `OK, now we are pushing it. But the architecture patterns exist.`,
      breaks: true,
      fix: 'sharding, CDN, and multi-region deployment',
    });
  } else {
    steps.push({
      level: '100 users',
      description: `${challenge.system} handles this fine. Everything looks good.`,
      breaks: false,
    });
    steps.push({
      level: '1,000 users',
      description: `Still working. No visible issues. You feel confident.`,
      breaks: false,
    });
    steps.push({
      level: '10,000 users',
      description: `First cracks appear. Response times start climbing.`,
      breaks: false,
      fix: 'add monitoring',
    });
    steps.push({
      level: '100,000 users',
      description: `Things are getting ugly. ${challenge.why}. The cracks become canyons.`,
      breaks: true,
    });
    steps.push({
      level: '1 million users',
      description: `Complete failure. ${challenge.system} was never designed for this.`,
      breaks: true,
    });
    steps.push({
      level: 'The verdict',
      description: `${challenge.system} fails at scale because ${challenge.why}. You need a different tool.`,
      breaks: true,
    });
  }

  return steps;
}

// ---- Generate Challenge Script ---------------------------------------------

export function generateChallenge(index: number): ChallengeScript {
  const challenge = CHALLENGES[index % CHALLENGES.length];
  const steps = generateScaleSteps(challenge);

  const hookText = `Can ${challenge.system} handle\n${challenge.scale}?`;
  const spokenHook = `Can ${challenge.system} actually handle ${challenge.scale}? Let us find out by scaling from 100 users to 1 billion.`;

  const verdictEmoji = challenge.verdict === 'works' ? 'YES' : 'NO';
  const verdictText = `${verdictEmoji}: ${challenge.system} ${challenge.verdict === 'works' ? 'CAN' : 'CANNOT'} handle ${challenge.scale}`;
  const spokenVerdict = challenge.verdict === 'works'
    ? `The answer is YES. ${challenge.system} can handle ${challenge.scale}, ${challenge.why}. Most people underestimate it.`
    : `The answer is NO. ${challenge.system} cannot handle ${challenge.scale}. The reason: ${challenge.why}. Use the right tool for the job.`;

  const titleVariants = [
    `Can ${challenge.system} handle ${challenge.scale}?`,
    `I tested ${challenge.system} at EXTREME scale`,
    `${challenge.system} vs ${challenge.scale} -- the TRUTH`,
    `Everyone thinks ${challenge.system} ${challenge.verdict === 'works' ? 'fails' : 'works'} at scale. They are WRONG.`,
  ];

  return {
    title: titleVariants[index % titleVariants.length],
    system: challenge.system,
    scale: challenge.scale,
    verdict: challenge.verdict,
    why: challenge.why,
    hookText,
    spokenHook,
    steps,
    verdictText,
    spokenVerdict,
    generatedAt: new Date().toISOString(),
  };
}

export function getDailyChallenge(date: Date): ChallengeScript {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return generateChallenge(dayOfYear % CHALLENGES.length);
}

// ---- Render ----------------------------------------------------------------

async function renderChallenge(script: ChallengeScript): Promise<void> {
  const PROJECT_ROOT = path.resolve(__dirname, '..');
  const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'challenges');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const slug = `${script.system}-${script.scale}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  console.log(`\n=== Rendering Challenge: ${script.title} ===\n`);

  // 1. Generate TTS audio
  console.log('[1/3] Generating TTS audio...');

  const { generateSceneAudios } = await import('../src/pipeline/tts-engine');
  const { generateStoryboard } = await import('../src/pipeline/storyboard');

  // Build narration from all parts
  const narrationParts = [
    script.spokenHook,
    ...script.steps.map((s) => `${s.level}. ${s.description}${s.fix ? ` Fix: ${s.fix}.` : ''}`),
    script.spokenVerdict,
  ];

  const sceneInputs = narrationParts.map((text) => ({
    narration: text,
    type: 'text' as const,
  }));

  const audioResults = await generateSceneAudios(
    sceneInputs,
    'en-US-AndrewMultilingualNeural',
    'english',
    { text: '+20%' },
  );

  const totalAudioDuration = audioResults.reduce((s, r) => s + r.duration, 0);
  console.log(`  Total audio: ${totalAudioDuration.toFixed(1)}s across ${audioResults.length} segments`);

  // 2. Build scenes
  console.log('\n[2/3] Building storyboard...');

  const FPS = 30;
  const scenes: Scene[] = [];

  // Hook scene
  scenes.push({
    type: 'title',
    content: script.hookText,
    narration: script.spokenHook,
    heading: `Can ${script.system} handle ${script.scale}?`,
    duration: audioResults[0]?.duration ?? 5,
    startFrame: 0,
    endFrame: Math.round((audioResults[0]?.duration ?? 5) * FPS),
    wordTimestamps: audioResults[0]?.wordTimestamps,
    audioFile: audioResults[0]?.audioPath,
  });

  // Scale step scenes
  for (let i = 0; i < script.steps.length; i++) {
    const step = script.steps[i];
    const audioIdx = i + 1;
    const dur = audioResults[audioIdx]?.duration ?? 5;
    scenes.push({
      type: 'text',
      content: `${step.level}: ${step.description}`,
      narration: narrationParts[audioIdx],
      heading: step.level,
      duration: dur,
      startFrame: 0,
      endFrame: Math.round(dur * FPS),
      wordTimestamps: audioResults[audioIdx]?.wordTimestamps,
      audioFile: audioResults[audioIdx]?.audioPath,
    });
  }

  // Verdict scene
  const verdictIdx = narrationParts.length - 1;
  scenes.push({
    type: 'summary',
    content: script.verdictText,
    narration: script.spokenVerdict,
    heading: script.verdict === 'works' ? 'IT WORKS' : 'IT FAILS',
    duration: audioResults[verdictIdx]?.duration ?? 5,
    startFrame: 0,
    endFrame: Math.round((audioResults[verdictIdx]?.duration ?? 5) * FPS),
    wordTimestamps: audioResults[verdictIdx]?.wordTimestamps,
    audioFile: audioResults[verdictIdx]?.audioPath,
  });

  // Generate storyboard (handles audio stitching + frame offsets)
  const storyboard = generateStoryboard(scenes, audioResults, {
    topic: slug,
    sessionNumber: 0,
    fps: FPS,
    width: 1080,
    height: 1920,
    format: 'vertical',
  });

  storyboard.bgmFile = 'audio/bgm/warm-ambient.mp3';

  // Write props
  const propsPath = path.join(OUTPUT_DIR, `${slug}-props.json`);
  fs.writeFileSync(propsPath, JSON.stringify({ storyboard }, null, 2));
  console.log(`  Props: ${propsPath}`);

  // 3. Render via Remotion ViralShort
  console.log('\n[3/3] Rendering via ViralShort...');
  const videoOutput = path.join(OUTPUT_DIR, `${slug}.mp4`);

  const renderCmd = [
    'npx', 'remotion', 'render',
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
    title: script.title,
    system: script.system,
    scale: script.scale,
    verdict: script.verdict,
    youtube: {
      title: script.title,
      description: [
        script.hookText.replace('\n', ' '),
        '',
        `I scaled ${script.system} from 100 users to 1 billion.`,
        `Verdict: ${script.verdict === 'works' ? 'IT WORKS' : 'IT FAILS'} -- ${script.why}.`,
        '',
        'Would you trust it at scale? Comment below!',
        '',
        'Full courses: guru-sishya.in',
        '',
        `#systemdesign #scaling #${script.system.replace(/[^a-zA-Z0-9]/g, '')} #coding #shorts`,
      ].join('\n'),
      tags: [script.system, 'scaling', 'system design', 'challenge', 'coding'],
      categoryId: '27',
    },
    instagram: {
      caption: [
        script.hookText.replace('\n', ' '),
        '',
        `Verdict: ${script.verdict === 'works' ? 'IT WORKS' : 'IT FAILS'}`,
        '',
        '#coding #systemdesign #scaling #gurusishya #shorts',
      ].join('\n'),
    },
    x_post: {
      text: `Can ${script.system} handle ${script.scale}?\n\nI tested it from 100 to 1 billion users. The answer might surprise you.`,
    },
    generatedAt: script.generatedAt,
  };

  const metadataPath = path.join(OUTPUT_DIR, `${slug}-metadata.json`);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  const fileSize = fs.statSync(videoOutput).size;
  console.log(`\n=== Challenge Rendered ===`);
  console.log(`  Video:    ${videoOutput} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  Metadata: ${metadataPath}`);
  console.log(`  Title:    ${script.title}`);
  console.log(`  Verdict:  ${script.verdict === 'works' ? 'WORKS' : 'FAILS'} -- ${script.why}`);
  console.log('');
}

// ---- CLI -------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let challengeIndex: number | null = null;
  let daily = false;
  let render = false;
  let list = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--challenge' && args[i + 1]) {
      challengeIndex = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--daily') {
      daily = true;
    } else if (args[i] === '--render') {
      render = true;
    } else if (args[i] === '--list') {
      list = true;
    }
  }

  return { challengeIndex, daily, render, list };
}

async function main() {
  const { challengeIndex, daily, render, list } = parseArgs();

  if (list) {
    console.log('\n=== Challenge Topics ===\n');
    for (let i = 0; i < CHALLENGES.length; i++) {
      const c = CHALLENGES[i];
      const emoji = c.verdict === 'works' ? 'WORKS' : 'FAILS';
      console.log(`  ${i}: Can ${c.system} handle ${c.scale}? ${emoji} (${c.why})`);
    }
    console.log(`\nTotal: ${CHALLENGES.length} challenges`);
    console.log('Usage: npx tsx scripts/challenge-generator.ts --challenge 0 --render\n');
    return;
  }

  let script: ChallengeScript;

  if (daily) {
    script = getDailyChallenge(new Date());
    console.log(`Daily challenge for ${new Date().toISOString().slice(0, 10)}`);
  } else if (challengeIndex !== null) {
    script = generateChallenge(challengeIndex);
  } else {
    console.log('Usage:');
    console.log('  npx tsx scripts/challenge-generator.ts --challenge 0          # preview');
    console.log('  npx tsx scripts/challenge-generator.ts --challenge 0 --render  # render');
    console.log('  npx tsx scripts/challenge-generator.ts --daily                 # daily pick');
    console.log('  npx tsx scripts/challenge-generator.ts --list                  # list all');
    return;
  }

  console.log(`\n=== Challenge: ${script.title} ===`);
  console.log(`  System: ${script.system}`);
  console.log(`  Scale: ${script.scale}`);
  console.log(`  Hook: "${script.hookText.replace('\n', ' ')}"`);
  console.log('');

  for (const step of script.steps) {
    const status = step.breaks ? 'BREAKS' : 'OK';
    console.log(`  [${status}] ${step.level}: ${step.description}`);
    if (step.fix) console.log(`         Fix: ${step.fix}`);
  }

  console.log(`\n  Verdict: ${script.verdict === 'works' ? 'WORKS' : 'FAILS'} -- ${script.why}`);
  console.log(`  "${script.spokenVerdict}"`);

  if (render) {
    await renderChallenge(script);
  } else {
    console.log('\n  Add --render to generate the video\n');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
