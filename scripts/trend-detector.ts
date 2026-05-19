#!/usr/bin/env npx tsx
/**
 * trend-detector.ts — Monitor HackerNews + Reddit for trending tech topics,
 * auto-generate quiz Short templates for rapid reaction content.
 *
 * When a major tech event happens (AWS outage, security breach, new release),
 * this script detects it and generates a quiz Short you can record and render
 * within hours — catching the viral wave.
 *
 * Usage:
 *   npx tsx scripts/trend-detector.ts              # Check for trends
 *   npx tsx scripts/trend-detector.ts --generate    # Generate quiz template for recording
 *   npx tsx scripts/trend-detector.ts --render      # Auto-render top trend with TTS
 *   npx tsx scripts/trend-detector.ts --min-score 5 # Lower the threshold (default 8)
 *   npx tsx scripts/trend-detector.ts --limit 5     # Show top N trends (default 10)
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrendStory {
  title: string;
  url: string;
  source: 'hackernews' | 'reddit';
  subreddit?: string;
  score: number;           // upvotes on the platform
  trendScore: number;      // our computed trend-worthiness score
  commentsCount: number;
  postedAt: Date;
  id: string;
}

interface QuizTemplate {
  topic: string;
  hookText: string;
  spokenHook: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  twist: string;
  endQuestion: string;
  title: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceScore: number;
  sourceOrigin: string;
  generatedAt: string;
}

// ─── Scoring Keywords ────────────────────────────────────────────────────────

const HIGH_IMPACT_KEYWORDS = [
  'outage', 'crash', 'breach', 'vulnerability', 'down', 'hack', 'fired',
  'lawsuit', 'acquired', 'deprecated', 'dead', 'billion', 'million',
  'shutdown', 'banned', 'exploit', 'leaked', 'broken', 'compromised',
  'incident', 'zero-day', 'ransomware', 'layoff', 'bankrupt',
];

const TECH_BRAND_KEYWORDS = [
  'kubernetes', 'docker', 'aws', 'google', 'microsoft', 'meta', 'apple',
  'cloudflare', 'github', 'openai', 'rust', 'go', 'python', 'javascript',
  'typescript', 'react', 'linux', 'android', 'chrome', 'firefox', 'nginx',
  'redis', 'postgres', 'kafka', 'terraform', 'vercel', 'supabase',
  'anthropic', 'gemini', 'llama', 'chatgpt', 'copilot', 'nvidia',
  'amazon', 'azure', 'gcp', 'oracle', 'samsung', 'intel', 'amd',
];

// ─── Fetch Helpers ───────────────────────────────────────────────────────────

const USER_AGENT = 'video-pipeline-trend-detector/1.0 (educational content)';

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.json();
}

// ─── HackerNews ──────────────────────────────────────────────────────────────

async function fetchHackerNewsTop(limit: number = 30): Promise<TrendStory[]> {
  console.log('  Fetching HackerNews top stories...');
  const ids: number[] = await fetchJSON(
    'https://hacker-news.firebaseio.com/v0/topstories.json',
  );

  const topIds = ids.slice(0, limit);
  const stories: TrendStory[] = [];

  // Fetch in batches of 10 to avoid overwhelming the API
  for (let i = 0; i < topIds.length; i += 10) {
    const batch = topIds.slice(i, i + 10);
    const items = await Promise.all(
      batch.map((id) =>
        fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`),
      ),
    );

    for (const item of items) {
      if (!item || item.type !== 'story' || !item.title) continue;

      stories.push({
        title: item.title,
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        source: 'hackernews',
        score: item.score || 0,
        trendScore: 0,
        commentsCount: item.descendants || 0,
        postedAt: new Date((item.time || 0) * 1000),
        id: `hn-${item.id}`,
      });
    }
  }

  console.log(`    Found ${stories.length} HN stories`);
  return stories;
}

// ─── Reddit ──────────────────────────────────────────────────────────────────

async function fetchRedditHot(subreddit: string, limit: number = 25): Promise<TrendStory[]> {
  console.log(`  Fetching Reddit r/${subreddit} hot posts...`);

  const data = await fetchJSON(
    `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`,
  );

  const stories: TrendStory[] = [];

  for (const child of data?.data?.children || []) {
    const post = child.data;
    if (!post || post.stickied) continue;

    stories.push({
      title: post.title,
      url: post.url || `https://reddit.com${post.permalink}`,
      source: 'reddit',
      subreddit,
      score: post.ups || 0,
      trendScore: 0,
      commentsCount: post.num_comments || 0,
      postedAt: new Date((post.created_utc || 0) * 1000),
      id: `reddit-${post.id}`,
    });
  }

  console.log(`    Found ${stories.length} r/${subreddit} posts`);
  return stories;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function scoreTrend(story: TrendStory): number {
  const titleLower = story.title.toLowerCase();
  let score = 0;

  // High impact keywords: +10 each
  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (titleLower.includes(kw)) {
      score += 10;
    }
  }

  // Tech brand keywords: +5 each
  for (const kw of TECH_BRAND_KEYWORDS) {
    if (titleLower.includes(kw)) {
      score += 5;
    }
  }

  // Platform engagement
  if (story.source === 'hackernews' && story.score > 200) {
    score += 3;
  }
  if (story.source === 'hackernews' && story.score > 500) {
    score += 3;
  }
  if (story.source === 'reddit' && story.score > 500) {
    score += 3;
  }
  if (story.source === 'reddit' && story.score > 2000) {
    score += 3;
  }

  // High comment count is a strong signal for controversy/engagement
  if (story.commentsCount > 200) {
    score += 2;
  }
  if (story.commentsCount > 500) {
    score += 2;
  }

  // Recency bonus — stories from last 6 hours score higher
  const hoursAgo = (Date.now() - story.postedAt.getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 6) {
    score += 3;
  } else if (hoursAgo < 12) {
    score += 1;
  }

  return score;
}

// ─── Quiz Generation ─────────────────────────────────────────────────────────

function extractTechSubject(title: string): string {
  const titleLower = title.toLowerCase();

  // Try to find the main tech brand/product mentioned
  for (const kw of TECH_BRAND_KEYWORDS) {
    if (titleLower.includes(kw)) {
      return kw.charAt(0).toUpperCase() + kw.slice(1);
    }
  }

  // Fall back to first few meaningful words
  const words = title.split(/\s+/).slice(0, 3).join(' ');
  return words;
}

function detectEventType(title: string): string {
  const titleLower = title.toLowerCase();

  if (/outage|down|crash|incident/.test(titleLower)) return 'outage';
  if (/breach|hack|vulnerability|exploit|zero-day|leaked|compromised/.test(titleLower)) return 'security';
  if (/acquired|billion|million|deal/.test(titleLower)) return 'acquisition';
  if (/deprecated|dead|shutdown|end.of.life/.test(titleLower)) return 'deprecation';
  if (/fired|layoff|bankrupt|lawsuit/.test(titleLower)) return 'corporate';
  if (/release|launch|announc|introduc|new/.test(titleLower)) return 'release';
  if (/vs|compar|better|switch|migrat/.test(titleLower)) return 'comparison';
  return 'general';
}

const QUIZ_TEMPLATES: Record<string, {
  questionTemplate: (subject: string) => string;
  options: (subject: string) => string[];
  correctIndex: number;
  explanationHint: string;
  twistTemplate: (subject: string) => string;
}> = {
  outage: {
    questionTemplate: (s) => `What is the most common root cause of ${s} outages?`,
    options: (s) => [`DDoS attack`, `A single config change`, `Hardware failure`],
    correctIndex: 1,
    explanationHint: 'Historically, most major outages trace back to a config push or deployment gone wrong — not external attacks.',
    twistTemplate: (s) => `The scariest part: YOUR app probably depends on ${s} and you did not even know`,
  },
  security: {
    questionTemplate: (s) => `When ${s} gets breached, what is the #1 thing attackers go after?`,
    options: (s) => [`Source code`, `API keys and secrets`, `User databases`],
    correctIndex: 1,
    explanationHint: 'API keys and secrets are the fastest path to lateral movement. Source code is secondary.',
    twistTemplate: (s) => `Most devs have ${s} credentials in at least 3 places they have forgotten about`,
  },
  acquisition: {
    questionTemplate: (s) => `When a tech giant acquires a product, what happens to the API first?`,
    options: (s) => [`It gets better`, `Pricing changes within 6 months`, `Nothing changes`],
    correctIndex: 1,
    explanationHint: 'Acquisitions almost always lead to pricing changes as the new parent monetizes the user base.',
    twistTemplate: (s) => `If you built on ${s}, your migration clock just started ticking`,
  },
  deprecation: {
    questionTemplate: (s) => `When ${s} gets deprecated, what breaks first?`,
    options: (s) => [`Your CI/CD pipeline`, `Security patches stop`, `Nothing — it keeps working`],
    correctIndex: 1,
    explanationHint: 'The most dangerous thing about deprecation is silent security rot — no more patches.',
    twistTemplate: (s) => `50% of production systems still run deprecated versions of something critical`,
  },
  corporate: {
    questionTemplate: (s) => `What happens to open-source projects when the backing company has layoffs?`,
    options: (s) => [`Community takes over`, `Maintenance slows to a crawl`, `Nothing changes`],
    correctIndex: 1,
    explanationHint: 'Most "community" open-source projects depend on paid maintainers. When they leave, PRs pile up.',
    twistTemplate: (s) => `Check your package.json — at least one dep is maintained by exactly ONE person`,
  },
  release: {
    questionTemplate: (s) => `What is the biggest risk of adopting ${s} early?`,
    options: (s) => [`Bugs everywhere`, `Breaking changes in next version`, `Documentation is wrong`],
    correctIndex: 1,
    explanationHint: 'Early adoption means your code becomes a migration project when v2 ships with breaking changes.',
    twistTemplate: (s) => `The best time to adopt ${s} is 6 months after everyone else stops complaining`,
  },
  comparison: {
    questionTemplate: (s) => `What matters more than which tech stack you choose?`,
    options: (s) => [`Performance benchmarks`, `How well your team knows it`, `GitHub stars`],
    correctIndex: 1,
    explanationHint: 'Team familiarity beats theoretical performance in almost every real-world project.',
    twistTemplate: (s) => `The "best" tool is the one your team can debug at 3 AM during an outage`,
  },
  general: {
    questionTemplate: (s) => `What do most developers get wrong about ${s}?`,
    options: (s) => [`They over-engineer it`, `They skip the fundamentals`, `They follow trends blindly`],
    correctIndex: 1,
    explanationHint: 'The fundamentals are boring but they prevent 80% of production incidents.',
    twistTemplate: (s) => `The next time ${s} trends on HackerNews, ask yourself: do I actually understand the basics?`,
  },
};

function generateQuizFromTrend(story: TrendStory): QuizTemplate {
  const subject = extractTechSubject(story.title);
  const eventType = detectEventType(story.title);
  const template = QUIZ_TEMPLATES[eventType] || QUIZ_TEMPLATES.general;

  // Build hook text — two lines, punchy, uses the actual headline
  const shortTitle = story.title.length > 40
    ? story.title.slice(0, 40).replace(/\s+\S*$/, '...')
    : story.title;

  const hookText = `${subject} just made headlines\nand most devs missed WHY`;
  const spokenHook = `${subject} is all over the news right now, and most developers are missing the real story.`;

  return {
    topic: subject.toLowerCase().replace(/\s+/g, '-'),
    hookText,
    spokenHook,
    question: template.questionTemplate(subject),
    options: template.options(subject),
    correctIndex: template.correctIndex,
    explanation: `The answer is ${String.fromCharCode(65 + template.correctIndex)}. ${template.explanationHint}`,
    twist: template.twistTemplate(subject),
    endQuestion: `What is your take? Comment below.`,
    title: `${shortTitle} | ${subject} explained in 45 seconds`,
    sourceUrl: story.url,
    sourceTitle: story.title,
    sourceScore: story.score,
    sourceOrigin: story.source === 'hackernews'
      ? `HackerNews (score: ${story.score})`
      : `Reddit r/${story.subreddit} (${story.score} upvotes)`,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Output Formatting ──────────────────────────────────────────────────────

function printTrend(story: TrendStory, rank: number): void {
  const sourceLabel = story.source === 'hackernews'
    ? `HN (score: ${story.score})`
    : `r/${story.subreddit} (${story.score} up)`;
  const age = Math.round((Date.now() - story.postedAt.getTime()) / (1000 * 60 * 60));

  console.log(`  #${rank} [trend-score: ${story.trendScore}] ${sourceLabel} (${age}h ago)`);
  console.log(`     ${story.title}`);
  console.log(`     ${story.url}`);
  console.log('');
}

function printQuizTemplate(quiz: QuizTemplate): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== TRENDING TOPIC ===`);
  console.log(`Source: ${quiz.sourceOrigin}`);
  console.log(`Title:  "${quiz.sourceTitle}"`);
  console.log(`URL:    ${quiz.sourceUrl}`);
  console.log(`${'='.repeat(60)}`);

  console.log(`\n=== AUTO-GENERATED QUIZ ===`);
  console.log(`Hook:       "${quiz.hookText}"`);
  console.log(`Spoken:     "${quiz.spokenHook}"`);
  console.log(`Question:   "${quiz.question}"`);
  console.log(`Options:    A) ${quiz.options[0]}  B) ${quiz.options[1]}  C) ${quiz.options[2]}`);
  console.log(`Correct:    ${String.fromCharCode(65 + quiz.correctIndex)}) ${quiz.options[quiz.correctIndex]}`);
  console.log(`Explanation: ${quiz.explanation}`);
  console.log(`Twist:      "${quiz.twist}"`);
  console.log(`End CTA:    "${quiz.endQuestion}"`);
  console.log(`Title:      "${quiz.title}"`);
  console.log('');
}

// ─── CLI Args ────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let generate = false;
  let render = false;
  let minScore = 8;
  let limit = 10;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--generate') generate = true;
    else if (args[i] === '--render') render = true;
    else if (args[i] === '--min-score' && args[i + 1]) {
      minScore = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { generate, render, minScore, limit };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { generate, render, minScore, limit } = parseArgs();
  const PROJECT_ROOT = path.resolve(__dirname, '..');

  console.log(`\n=== Trend Detector ===`);
  console.log(`Threshold: trend-score >= ${minScore}`);
  console.log(`Mode: ${render ? 'RENDER' : generate ? 'GENERATE' : 'SCAN'}\n`);

  // ── Step 1: Fetch from all sources ──
  console.log('[1/3] Fetching trending stories...\n');

  let allStories: TrendStory[] = [];
  const errors: string[] = [];

  // Fetch HackerNews and Reddit in parallel
  const results = await Promise.allSettled([
    fetchHackerNewsTop(30),
    fetchRedditHot('programming', 25),
    fetchRedditHot('technology', 25),
  ]);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allStories.push(...result.value);
    } else {
      errors.push(result.reason?.message || 'Unknown fetch error');
    }
  }

  if (errors.length > 0) {
    console.log(`  Warnings: ${errors.length} source(s) failed:`);
    for (const err of errors) {
      console.log(`    - ${err}`);
    }
    console.log('');
  }

  if (allStories.length === 0) {
    console.error('No stories fetched from any source. Check your network connection.');
    process.exit(1);
  }

  console.log(`  Total stories fetched: ${allStories.length}\n`);

  // ── Step 2: Score and filter ──
  console.log('[2/3] Scoring stories for trend-worthiness...\n');

  for (const story of allStories) {
    story.trendScore = scoreTrend(story);
  }

  // Deduplicate by similar titles (same story on HN + Reddit)
  const seen = new Set<string>();
  const deduped: TrendStory[] = [];
  for (const story of allStories) {
    const key = story.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .slice(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(story);
    }
  }

  // Sort by trend score descending, then by platform score
  deduped.sort((a, b) => b.trendScore - a.trendScore || b.score - a.score);

  const trending = deduped.filter((s) => s.trendScore >= minScore);
  const topStories = deduped.slice(0, limit);

  console.log(`  Trend-worthy (score >= ${minScore}): ${trending.length}`);
  console.log(`  Showing top ${Math.min(limit, topStories.length)}:\n`);

  for (let i = 0; i < topStories.length; i++) {
    printTrend(topStories[i], i + 1);
  }

  if (trending.length === 0) {
    console.log(`\n  No stories met the threshold (score >= ${minScore}).`);
    console.log(`  Try --min-score ${Math.max(1, minScore - 3)} to see more.\n`);
    return;
  }

  // ── Step 3: Generate or Render ──
  if (!generate && !render) {
    console.log(`\n  Run with --generate to create quiz templates`);
    console.log(`  Run with --render to auto-render the top trend\n`);
    return;
  }

  console.log('[3/3] Generating quiz templates...\n');

  const quizzes: QuizTemplate[] = [];
  const targets = render ? trending.slice(0, 1) : trending.slice(0, 3);

  for (const story of targets) {
    const quiz = generateQuizFromTrend(story);
    quizzes.push(quiz);
    printQuizTemplate(quiz);
  }

  // Write quiz templates to output
  const outputDir = path.join(PROJECT_ROOT, 'output', 'trends');
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().slice(0, 10);
  const trendsPath = path.join(outputDir, `trends-${timestamp}.json`);
  fs.writeFileSync(trendsPath, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    threshold: minScore,
    trendingCount: trending.length,
    quizzes,
    allTrending: trending.map((s) => ({
      title: s.title,
      url: s.url,
      source: s.source,
      score: s.score,
      trendScore: s.trendScore,
    })),
  }, null, 2));

  console.log(`  Saved trends: ${trendsPath}`);

  // ── Render mode: auto-render top trend ──
  if (render && quizzes.length > 0) {
    const quiz = quizzes[0];
    console.log(`\n=== Auto-Rendering Top Trend ===`);
    console.log(`  Topic: ${quiz.sourceTitle}\n`);

    // Write props for QuizShort composition
    const propsPath = path.join(outputDir, `trend-quiz-props.json`);
    const quizProps = {
      quiz: {
        topic: quiz.topic,
        hookText: quiz.hookText,
        spokenHook: quiz.spokenHook,
        question: quiz.question,
        options: quiz.options,
        correctIndex: quiz.correctIndex,
        explanation: quiz.explanation,
        twist: quiz.twist,
        endQuestion: quiz.endQuestion,
        title: quiz.title,
      },
    };
    fs.writeFileSync(propsPath, JSON.stringify(quizProps, null, 2));
    console.log(`  Props: ${propsPath}`);

    // Generate TTS audio
    console.log(`  Generating TTS audio...`);

    // Dynamic import to avoid loading heavy deps in scan mode
    const { generateSceneAudios } = await import('../src/pipeline/tts-engine');
    const { generateStoryboard } = await import('../src/pipeline/storyboard');

    const fullNarration = `${quiz.spokenHook} ${quiz.question} ${quiz.explanation} ${quiz.twist}`;

    const audioResults = await generateSceneAudios(
      [{ narration: fullNarration, type: 'text' }],
      'en-IN-PrabhatNeural',
      'indian-english',
      { text: '+10%' },
    );

    // Build storyboard for audio stitching
    const audioDuration = audioResults[0]?.duration ?? 38;
    const quizScene = {
      type: 'text' as const,
      content: fullNarration,
      narration: fullNarration,
      duration: audioDuration,
      startFrame: 0,
      endFrame: Math.round(audioDuration * 30),
    };

    const storyboard = generateStoryboard([quizScene], audioResults, {
      topic: quiz.topic,
      sessionNumber: 0,
      fps: 30,
      width: 1080,
      height: 1920,
      format: 'vertical',
    });

    // Update props with audio info
    const updatedProps = {
      ...quizProps,
      audioFile: storyboard.audioFile ? path.basename(storyboard.audioFile) : undefined,
    };
    fs.writeFileSync(propsPath, JSON.stringify(updatedProps, null, 2));

    // Render via Remotion
    console.log(`  Rendering video via Remotion...`);
    const videoOutput = path.join(outputDir, `trend-${quiz.topic}-${timestamp}.mp4`);

    const renderCmd = [
      'npx', 'remotion', 'render',
      'src/compositions/index.tsx',
      'QuizShort',
      videoOutput,
      `--props=${propsPath}`,
      '--codec=h264',
      '--crf=18',
      '--audio-bitrate=192K',
      `--concurrency=${process.env.CI ? '1' : '4'}`,
      '--timeout=180000',
    ].join(' ');

    execSync(renderCmd, { stdio: 'inherit', cwd: PROJECT_ROOT });

    const fileSize = fs.statSync(videoOutput).size;
    console.log(`\n=== Trend Short Rendered ===`);
    console.log(`  Video:    ${videoOutput} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
    console.log(`  Props:    ${propsPath}`);
    console.log(`  Title:    ${quiz.title}`);
    console.log(`  Source:   ${quiz.sourceUrl}`);
    console.log('');
  }

  // ── Generate mode: output recording script ──
  if (generate && !render) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== RECORDING SCRIPT ===`);
    console.log(`${'='.repeat(60)}`);

    for (let i = 0; i < quizzes.length; i++) {
      const q = quizzes[i];
      console.log(`\n--- Quiz #${i + 1}: ${q.topic} ---`);
      console.log(`\nHOOK (display on screen):`);
      console.log(`  "${q.hookText}"`);
      console.log(`\nHOOK (speak this):`);
      console.log(`  "${q.spokenHook}"`);
      console.log(`\nQUESTION (read aloud):`);
      console.log(`  "${q.question}"`);
      console.log(`\nOPTIONS (pause 3 seconds after reading):`);
      q.options.forEach((o, j) =>
        console.log(`  ${String.fromCharCode(65 + j)}) ${o}`),
      );
      console.log(`\nREVEAL (with energy):`);
      console.log(`  "${q.explanation}"`);
      console.log(`\nTWIST (lean in, lower voice):`);
      console.log(`  "${q.twist}"`);
      console.log(`\nCTA (end screen):`);
      console.log(`  "${q.endQuestion}"`);
      console.log(`\nYOUTUBE TITLE:`);
      console.log(`  ${q.title}`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`To render after recording:`);
    console.log(`  npx tsx scripts/trend-detector.ts --render`);
    console.log(`${'='.repeat(60)}\n`);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
