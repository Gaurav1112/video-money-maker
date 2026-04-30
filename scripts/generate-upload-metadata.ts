#!/usr/bin/env npx tsx
/**
 * generate-upload-metadata.ts — Deterministic metadata generation for all uploads
 *
 * Generates metadata JSON files for the long-form video + 3 vertical short parts.
 * All output is 100% deterministic: same inputs always produce the same metadata.
 * No Math.random(), no Date.now(), no network calls.
 *
 * Usage:
 *   npx tsx scripts/generate-upload-metadata.ts <topic-slug> <session-number>
 *   npx tsx scripts/generate-upload-metadata.ts kafka 2
 *   npx tsx scripts/generate-upload-metadata.ts load-balancing 1 --dry-run
 *
 * Outputs (written to ~/Documents/guru-sishya/<topic>/session-<N>/):
 *   metadata.json                 — Long-form YouTube metadata
 *   vertical-parts/part1-metadata.json — Short Part 1
 *   vertical-parts/part2-metadata.json — Short Part 2
 *   vertical-parts/part3-metadata.json — Short Part 3
 *
 * Also writes to output/ for convenience:
 *   <topic>-s<N>-metadata.json
 *   <topic>-s<N>-part1-metadata.json
 *   <topic>-s<N>-part2-metadata.json
 *   <topic>-s<N>-part3-metadata.json
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  generateYouTubeMetadata,
  generateShortsMetadataFromStoryboard,
  generateInstagramCaption,
  generatePinnedComment,
  generateCommunityPost,
} from '../src/pipeline/metadata-generator';
import { getTopicExample } from '../src/lib/topic-examples';
import type { Storyboard } from '../src/types';

// ─── Paths ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');
const HOME = process.env.HOME || '~';
const GURU_SISHYA_BASE = path.join(HOME, 'Documents', 'guru-sishya');

// ─── Deterministic Seeding (copied from metadata-generator.ts) ──────────

function seededIndex(topic: string, sessionNumber: number, salt: number, max: number): number {
  let hash = salt;
  const key = `${topic}:${sessionNumber}:${salt}`;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % max;
}

// ─── MetadataFile interface (matches auto-publish.ts + upload-youtube.ts) ─

interface MetadataFile {
  youtube: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    chapters: string;
  };
  instagramCaption?: string;
  thumbnailText?: string;
}

// ─── Topic Name Resolution ──────────────────────────────────────────────────

const TOPIC_NAME_MAP: Record<string, string> = {
  'caching': 'Caching',
  'load-balancing': 'Load Balancing',
  'api-gateway': 'API Gateway',
  'kafka': 'Kafka',
  'database': 'Database Design',
  'microservices': 'Microservices',
  'distributed': 'Distributed Systems',
  'message-queue': 'Message Queue',
  'authentication': 'Authentication',
  'rate-limiting': 'Rate Limiting',
  'monitoring': 'Monitoring',
  'consistent-hashing': 'Consistent Hashing',
  'cdn': 'CDN',
  'dns': 'DNS',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'sql': 'SQL',
  'nosql': 'NoSQL',
  'ci-cd': 'CI/CD',
  'redis': 'Redis',
  'graphql': 'GraphQL',
  'grpc': 'gRPC',
  'websocket': 'WebSocket',
  'sharding': 'Database Sharding',
  'indexing': 'Database Indexing',
  'binary-search': 'Binary Search',
  'sorting': 'Sorting Algorithms',
  'dynamic-programming': 'Dynamic Programming',
  'trees': 'Trees',
  'graphs': 'Graphs',
  'arrays': 'Arrays',
  'linked-list': 'Linked List',
  'hash-map': 'HashMap',
  'rest-api': 'REST API',
  'http': 'HTTP',
  'tcp': 'TCP',
  'networking': 'Networking',
  'scalability': 'Scalability',
};

function resolveTopicName(slug: string): string {
  const lower = slug.toLowerCase().replace(/\s+/g, '-');
  if (TOPIC_NAME_MAP[lower]) return TOPIC_NAME_MAP[lower];
  // Convert slug to title case
  return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Company References (deterministic per topic) ───────────────────────────

function getCompanyReferences(topic: string, sessionNumber: number): string[] {
  const example = getTopicExample(topic);
  const primaryCompany = example.company;

  // Deterministic set of companies per session
  const allCompanies = [
    primaryCompany,
    'Amazon', 'Google', 'Netflix', 'Uber', 'Flipkart',
    'Swiggy', 'Razorpay', 'PhonePe', 'Zerodha', 'CRED',
    'Meta', 'Microsoft', 'Hotstar', 'Paytm', 'Zomato',
  ];

  // Pick 4 companies deterministically, always including the primary
  const companies = [primaryCompany];
  const seen = new Set([primaryCompany]);
  for (let salt = 0; companies.length < 4; salt++) {
    const idx = seededIndex(topic, sessionNumber, 200 + salt, allCompanies.length);
    const c = allCompanies[idx];
    if (!seen.has(c)) {
      seen.add(c);
      companies.push(c);
    }
  }

  return companies;
}

// ─── Chapter Generation from Storyboard ─────────────────────────────────────

function generateChaptersFromScenes(
  scenes: Array<{ type: string; heading?: string; startFrame: number }>,
  fps: number,
): string {
  const seen = new Set<string>();
  const chapters: string[] = [];

  for (const scene of scenes) {
    const label = scene.heading || scene.type.charAt(0).toUpperCase() + scene.type.slice(1);
    if (seen.has(label) || label.length > 60 || label === 'text') continue;
    seen.add(label);

    const seconds = Math.floor(scene.startFrame / fps);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    chapters.push(`${mins}:${String(secs).padStart(2, '0')} ${label}`);
  }

  return chapters.join('\n');
}

// ─── Session Label (deterministic per session number) ───────────────────────

const SESSION_LABELS: Record<number, string> = {
  1: 'Architecture & Fundamentals',
  2: 'Deep Dive with Code',
  3: 'Advanced Patterns & Interview',
  4: 'Production Patterns',
  5: 'Performance & Optimization',
  6: 'Failure Modes & Recovery',
  7: 'Security & Best Practices',
  8: 'Integration Patterns',
  9: 'Monitoring & Observability',
  10: 'Complete Interview Masterclass',
  11: 'Real-World Case Studies',
  12: 'System Design Round Simulation',
};

function getSessionLabel(sessionNumber: number): string {
  return SESSION_LABELS[sessionNumber] || `Session ${sessionNumber}`;
}

// ─── Long-Form Description Builder ─────────────────────────────────────────

function buildLongFormDescription(
  topic: string,
  topicSlug: string,
  sessionNumber: number,
  totalSessions: number,
  chapters: string,
  companies: string[],
  durationMins: number,
): string {
  const example = getTopicExample(topic);
  const sessionLabel = getSessionLabel(sessionNumber);

  // First 150 chars: unique, keyword-rich, drives clicks from search
  const openLine = `${topic} (${sessionLabel}) — master this for your FAANG interview. FREE practice with 5,800+ questions at guru-sishya.in/${topicSlug}`;

  // Company interview references
  const companyLines = companies.map(c => {
    const roleTemplates = [
      `${c} SDE-2 System Design Round`,
      `${c} Backend Engineering Interview`,
      `${c} Platform Team HLD Round`,
      `${c} Senior Engineer Interview`,
    ];
    const idx = seededIndex(topic, sessionNumber, c.length * 7, roleTemplates.length);
    return `\u2022 ${roleTemplates[idx]}`;
  });

  // Series navigation
  const navLines: string[] = [];
  for (let i = Math.max(1, sessionNumber - 1); i <= Math.min(totalSessions, sessionNumber + 1); i++) {
    if (i === sessionNumber) {
      navLines.push(`\u2605 Session ${i}: ${getSessionLabel(i)} (You are here)`);
    } else if (i < sessionNumber) {
      navLines.push(`\u2190 Session ${i}: ${getSessionLabel(i)}`);
    } else {
      navLines.push(`\u2192 Session ${i}: ${getSessionLabel(i)}`);
    }
  }

  // Hashtags — exactly the format that worked for kafka-s2
  const hashtags = [
    `#${topic.replace(/\s+/g, '')}`,
    '#SystemDesign', '#InterviewPrep', '#FAANG', '#CodingInterview',
    '#DistributedSystems', '#TechInterview', '#PlacementPrep',
    '#SystemDesignInterview', `#${topic.replace(/\s+/g, '')}Tutorial`,
    '#JavaInterview', '#SoftwareEngineering', '#BackendDevelopment',
    '#Microservices', '#EventDriven', '#MessageQueue',
    '#DataEngineering', '#BigData', '#InterviewQuestions',
    '#DSA', '#CompetitiveProgramming', '#SDE',
    '#GoogleInterview', '#AmazonInterview', '#FlipkartInterview',
    '#IndianTech', '#GuruSishya',
  ];

  return `${openLine}

\ud83d\udd25 What you'll learn:
\u2022 ${topic} ${sessionLabel.toLowerCase()} — end to end
\u2022 Real-world example: ${example.company} ${example.useCase}
\u2022 Interview answer template for ${durationMins}-minute explanation
\u2022 Code walkthrough + architecture diagrams

\u23f1 Timestamps:
${chapters}

\ud83d\udcda Practice 5,800+ interview questions: guru-sishya.in/${topicSlug}
\ud83d\udd14 New videos every Tue, Thu, Sat at 7:15 PM IST

\ud83d\udcbc This exact topic was asked in:
${companyLines.join('\n')}

\ud83d\udccc Part of the ${topic} Complete Series (${totalSessions} sessions)
${navLines.join('\n')}

${hashtags.join(' ')}`;
}

// ─── Short Part Description Builder ─────────────────────────────────────────

function buildShortDescription(
  topic: string,
  topicSlug: string,
  sessionNumber: number,
  partNumber: number,
  totalParts: number,
  longFormYouTubeUrl: string,
  partSegment: string,
): string {
  const example = getTopicExample(topic);

  return `${partSegment} \u2014 ${topic} explained in 60 seconds.

Part ${partNumber}/${totalParts} of Session ${sessionNumber}.

\ud83c\udfac Full ${topic} deep dive: ${longFormYouTubeUrl}
\ud83d\udcda FREE prep: https://guru-sishya.in/${topicSlug}

\ud83d\udcbc Real interview question from ${example.company}

#Shorts #Coding #SystemDesign #InterviewPrep #FAANG #${topic.replace(/\s+/g, '')} #CodingInterview #TechInterview #SDE #GuruSishya`;
}

// ─── Short Part Title Templates ─────────────────────────────────────────────

const PART_TITLE_TEMPLATES: string[][] = [
  // Part 1 titles (hook / intro)
  [
    '{topic} in 60 seconds \u26a1 #Shorts',
    'Wait, THIS is how {company} uses {topic}?! \ud83e\udd2f #Shorts',
    '90% of devs get {topic} wrong \ud83d\ude33 #Shorts',
    'The {topic} secret that gets you hired \ud83e\udd2b #Shorts',
    '{topic} \u2014 what they don\'t teach you #Shorts',
    'This {topic} trick saved my interview \ud83e\udd2f #Shorts',
  ],
  // Part 2 titles (core content)
  [
    '{topic} with code \u2014 stop memorizing! \ud83e\udde0 #Shorts',
    'I coded {topic} from scratch \ud83d\udd25 #Shorts',
    'The {topic} pattern that gets you hired \ud83c\udfaf #Shorts',
    'Senior vs Junior: {topic} answer \u2694\ufe0f #Shorts',
    '{topic} deep dive in 60 seconds \ud83d\udca1 #Shorts',
    'Google asked THIS {topic} question \ud83d\udc40 #Shorts',
  ],
  // Part 3 titles (conclusion / interview)
  [
    'The {topic} interview answer that works \ud83c\udfaf #Shorts',
    '{topic} complete \u2014 save this for interviews \u26a1 #Shorts',
    'Know {topic} or fail your interview \ud83d\udc80 #Shorts',
    'The {topic} insight that changes everything \ud83d\udca1 #Shorts',
    'FAANG interview: {topic} in 60s \ud83d\ude80 #Shorts',
    'If you don\'t know {topic}, you\'re cooked \ud83d\udd25 #Shorts',
  ],
];

function generatePartTitle(
  topic: string,
  sessionNumber: number,
  partNumber: number,
  company: string,
): string {
  const partIdx = Math.min(partNumber - 1, 2);
  const templates = PART_TITLE_TEMPLATES[partIdx];
  const idx = seededIndex(topic, sessionNumber * 10 + partNumber, 89, templates.length);

  let title = templates[idx]
    .replace(/{topic}/g, topic)
    .replace(/{company}/g, company);

  // Ensure under 100 chars
  if (title.length > 100) {
    // Remove everything after the last emoji before the hash
    const shortsIdx = title.lastIndexOf('#Shorts');
    if (shortsIdx > 0) {
      title = title.slice(0, 90).trimEnd() + ' #Shorts';
    } else {
      title = title.slice(0, 99).trimEnd() + '\u2026';
    }
  }

  return title;
}

// ─── Short Part Segment Names ───────────────────────────────────────────────

const PART_SEGMENTS: string[][] = [
  // Session-type based segment names
  ['The Problem', 'The Architecture', 'The Interview Answer'],
  ['Key Concept', 'Implementation', 'Trade-offs'],
  ['Why It Matters', 'How It Works', 'The Senior Answer'],
  ['The Hook', 'Deep Dive', 'Complete Picture'],
];

function getPartSegments(topic: string, sessionNumber: number): string[] {
  const idx = seededIndex(topic, sessionNumber, 113, PART_SEGMENTS.length);
  return PART_SEGMENTS[idx];
}

// ─── Main Generation ────────────────────────────────────────────────────────

function generateAllMetadata(
  topicSlug: string,
  sessionNumber: number,
  storyboard: Storyboard,
): {
  longForm: MetadataFile;
  parts: MetadataFile[];
} {
  const topic = storyboard.topic;
  const fps = storyboard.fps;
  const totalSessions = storyboard.totalSessions || 12;
  const durationSecs = Math.round(storyboard.durationInFrames / fps);
  const durationMins = Math.round(durationSecs / 60);
  const companies = getCompanyReferences(topic, sessionNumber);
  const example = getTopicExample(topic);

  // Generate chapters from storyboard scenes
  const chapters = generateChaptersFromScenes(storyboard.scenes, fps);

  // Use the existing metadata-generator for the full YouTube metadata
  const ytMeta = generateYouTubeMetadata(storyboard, 'Python');

  // Build description in the exact format that worked for kafka-s2
  const description = buildLongFormDescription(
    topic,
    topicSlug,
    sessionNumber,
    totalSessions,
    chapters,
    companies,
    durationMins,
  );

  // ─── Long-form metadata ─────────────────────────────────────────────
  const longForm: MetadataFile = {
    youtube: {
      title: ytMeta.title,
      description,
      tags: ytMeta.tags,
      categoryId: '27',
      chapters,
    },
    thumbnailText: ytMeta.thumbnailText,
    instagramCaption: generateInstagramCaption(topic, 'Python', sessionNumber),
  };

  // ─── Short parts metadata ──────────────────────────────────────────
  // Placeholder URL for long-form (will be replaced after upload)
  const longFormUrlPlaceholder = `https://www.youtube.com/@GuruSishya-India`;
  const partSegments = getPartSegments(topic, sessionNumber);
  const totalParts = 3;

  const parts: MetadataFile[] = [];
  for (let p = 1; p <= totalParts; p++) {
    const segment = partSegments[p - 1] || `Part ${p}`;
    const partTitle = generatePartTitle(topic, sessionNumber, p, example.company);

    const partDescription = buildShortDescription(
      topic,
      topicSlug,
      sessionNumber,
      p,
      totalParts,
      longFormUrlPlaceholder,
      segment,
    );

    // Short-specific tags: subset of long-form tags + shorts-specific
    const partTags = [
      ...ytMeta.tags.slice(0, 12),
      'shorts',
      `${topic.toLowerCase()} shorts`,
      'short video',
      '60 seconds',
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 20);

    const partMeta: MetadataFile = {
      youtube: {
        title: partTitle,
        description: partDescription,
        tags: partTags,
        categoryId: '27',
        chapters: '', // Shorts don't have chapters
      },
      thumbnailText: ytMeta.thumbnailText,
      instagramCaption: `${segment} \u2014 ${topic} in 60 seconds \ud83d\udd25\n\nPart ${p}/${totalParts} of Session ${sessionNumber}.\n\n\ud83d\udcda guru-sishya.in/${topicSlug}\n\n#${topic.replace(/\s+/g, '').toLowerCase()} #systemdesign #interviewprep #coding #tech #faang #placement #sde #engineering #backend`,
    };

    parts.push(partMeta);
  }

  return { longForm, parts };
}

// ─── File I/O ───────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeMetadata(filePath: string, metadata: MetadataFile, dryRun: boolean): void {
  if (dryRun) {
    console.log(`\n[DRY RUN] Would write: ${filePath}`);
    console.log(`  Title: ${metadata.youtube.title}`);
    console.log(`  Tags: ${metadata.youtube.tags.slice(0, 5).join(', ')}...`);
    console.log(`  Description: ${metadata.youtube.description.slice(0, 100)}...`);
    return;
  }

  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2) + '\n');
  console.log(`  Written: ${filePath}`);
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length < 2) {
    console.log(`
generate-upload-metadata.ts — Deterministic metadata generation for all uploads

Usage:
  npx tsx scripts/generate-upload-metadata.ts <topic-slug> <session-number>
  npx tsx scripts/generate-upload-metadata.ts kafka 2
  npx tsx scripts/generate-upload-metadata.ts load-balancing 1 --dry-run

Outputs:
  output/<topic>-s<N>-metadata.json          Long-form YouTube
  output/<topic>-s<N>-part1-metadata.json     Short Part 1
  output/<topic>-s<N>-part2-metadata.json     Short Part 2
  output/<topic>-s<N>-part3-metadata.json     Short Part 3

Also writes to ~/Documents/guru-sishya/<topic>/session-<N>/:
  metadata.json                              Long-form (for auto-publish)
  vertical-parts/part1-metadata.json         Short Part 1
  vertical-parts/part2-metadata.json         Short Part 2
  vertical-parts/part3-metadata.json         Short Part 3

Flags:
  --dry-run    Preview metadata without writing files
  --props <path>  Use a specific props file (default: output/test-props-s<N>.json)
`);
    process.exit(0);
  }

  const topicSlug = args[0];
  const sessionNumber = parseInt(args[1], 10);
  const dryRun = args.includes('--dry-run');

  if (!topicSlug || isNaN(sessionNumber) || sessionNumber < 1) {
    console.error('Error: Invalid topic slug or session number.');
    console.error('Usage: npx tsx scripts/generate-upload-metadata.ts <topic-slug> <session-number>');
    process.exit(1);
  }

  // Find props file
  const propsIdx = args.indexOf('--props');
  const propsPath = propsIdx >= 0
    ? path.resolve(args[propsIdx + 1])
    : path.join(OUTPUT_DIR, `test-props-s${sessionNumber}.json`);

  if (!fs.existsSync(propsPath)) {
    console.error(`Error: Props file not found: ${propsPath}`);
    console.error(`Generate it first: npx tsx scripts/render-session.ts ${topicSlug} ${sessionNumber}`);
    process.exit(1);
  }

  console.log(`Loading storyboard from: ${propsPath}`);
  const propsRaw = JSON.parse(fs.readFileSync(propsPath, 'utf-8'));

  // Props file may wrap storyboard under a "storyboard" key or be the storyboard itself
  const storyboard: Storyboard = propsRaw.storyboard || propsRaw;

  // Validate storyboard has required fields
  if (!storyboard.topic || !storyboard.scenes || !storyboard.fps) {
    console.error('Error: Props file missing required fields (topic, scenes, fps).');
    console.error('  Expected keys: topic, scenes, fps, durationInFrames');
    console.error('  Found keys:', Object.keys(storyboard).join(', '));
    process.exit(1);
  }

  // Override session number if it differs (props might be from a different session)
  if (storyboard.sessionNumber !== sessionNumber) {
    console.warn(`Warning: Props file has sessionNumber=${storyboard.sessionNumber}, using ${sessionNumber} from CLI.`);
    storyboard.sessionNumber = sessionNumber;
  }

  const topicName = resolveTopicName(topicSlug);
  console.log(`Generating metadata for: ${topicName} — Session ${sessionNumber}`);
  console.log(`  Topic slug: ${topicSlug}`);
  console.log(`  Scenes: ${storyboard.scenes.length}`);
  console.log(`  Duration: ${Math.round(storyboard.durationInFrames / storyboard.fps)}s (~${Math.round(storyboard.durationInFrames / storyboard.fps / 60)} min)`);

  // Generate all metadata
  const { longForm, parts } = generateAllMetadata(topicSlug, sessionNumber, storyboard);

  // Write output files
  console.log('\nWriting metadata files:');

  // 1. output/ directory (for convenience / testing)
  writeMetadata(
    path.join(OUTPUT_DIR, `${topicSlug}-s${sessionNumber}-metadata.json`),
    longForm,
    dryRun,
  );
  for (let i = 0; i < parts.length; i++) {
    writeMetadata(
      path.join(OUTPUT_DIR, `${topicSlug}-s${sessionNumber}-part${i + 1}-metadata.json`),
      parts[i],
      dryRun,
    );
  }

  // 2. Session directory (for auto-publish to discover)
  const sessionDir = path.join(GURU_SISHYA_BASE, topicSlug, `session-${sessionNumber}`);
  writeMetadata(
    path.join(sessionDir, 'metadata.json'),
    longForm,
    dryRun,
  );
  for (let i = 0; i < parts.length; i++) {
    writeMetadata(
      path.join(sessionDir, 'vertical-parts', `part${i + 1}-metadata.json`),
      parts[i],
      dryRun,
    );
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Long-form title:  ${longForm.youtube.title}`);
  console.log(`Thumbnail text:   ${longForm.thumbnailText}`);
  console.log(`Tags:             ${longForm.youtube.tags.length}`);
  console.log(`Chapters:         ${longForm.youtube.chapters.split('\n').length}`);
  for (let i = 0; i < parts.length; i++) {
    console.log(`Part ${i + 1} title:    ${parts[i].youtube.title}`);
  }

  if (!dryRun) {
    console.log(`\nAll ${1 + parts.length} metadata files written successfully.`);
    console.log(`Run auto-publish to upload: npx tsx scripts/auto-publish.ts --topic ${topicSlug} --session ${sessionNumber}`);
  }
}

main();
