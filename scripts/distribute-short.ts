#!/usr/bin/env npx tsx
/**
 * distribute-short.ts — Generate platform-specific assets from a rendered Short
 *
 * Takes a rendered Short video + its metadata JSON and produces ready-to-upload
 * files for YouTube Shorts, Instagram Reels, TikTok, LinkedIn, Twitter/X, and Reddit.
 *
 * Usage:
 *   npx tsx scripts/distribute-short.ts output/daily-short/caching-short-0.mp4
 *   npx tsx scripts/distribute-short.ts output/daily-short/caching-short-0.mp4 --platforms youtube,instagram,tiktok
 *   npx tsx scripts/distribute-short.ts output/daily-short/caching-short-0.mp4 --out output/distribute
 *
 * Output structure:
 *   output/distribute/<short-id>/
 *   ├── youtube/   (video + metadata.json)
 *   ├── instagram/ (video + caption.txt)
 *   ├── tiktok/    (video + caption.txt)
 *   ├── linkedin/  (video + post.txt)
 *   ├── twitter/   (tweet.txt)
 *   └── reddit/    (post-titles.json)
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ShortMetadata {
  youtube: {
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    playlistTitle: string;
  };
}

type Platform = 'youtube' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter' | 'reddit';

const ALL_PLATFORMS: Platform[] = ['youtube', 'instagram', 'tiktok', 'linkedin', 'twitter', 'reddit'];

// ─── Hashtag Banks ──────────────────────────────────────────────────────────

const INSTAGRAM_HASHTAGS_BASE = [
  '#programming', '#coding', '#developer', '#softwareengineering', '#tech',
  '#coder', '#webdev', '#devlife', '#computerscience', '#learntocode',
  '#programmingmemes', '#techcommunity', '#softwaredeveloper', '#codinglife',
  '#programminghumor', '#100daysofcode', '#techtips', '#codingtips',
  '#systemdesign', '#interviewprep',
];

const TIKTOK_HASHTAGS_BASE = [
  '#techtok', '#codingtok', '#learnontiktok', '#programming', '#tech',
];

const LINKEDIN_HASHTAGS_BASE = [
  '#SoftwareEngineering', '#TechCareers', '#SystemDesign',
];

// ─── Topic → Niche Hashtags ────────────────────────────────────────────────

function getTopicHashtags(topic: string): { ig: string[]; tiktok: string[]; linkedin: string[] } {
  const topicLower = topic.toLowerCase();

  const mapping: Record<string, { ig: string[]; tiktok: string[]; linkedin: string[] }> = {
    caching: {
      ig: ['#caching', '#redis', '#performance', '#scalability', '#backend', '#webperformance'],
      tiktok: ['#caching', '#redis', '#backend'],
      linkedin: ['#Caching', '#Performance'],
    },
    cdn: {
      ig: ['#cdn', '#cloudflare', '#networking', '#webperformance', '#latency', '#cloud'],
      tiktok: ['#cdn', '#cloudflare', '#webdev'],
      linkedin: ['#CDN', '#CloudComputing'],
    },
    microservices: {
      ig: ['#microservices', '#architecture', '#distributed', '#api', '#kubernetes', '#docker'],
      tiktok: ['#microservices', '#kubernetes', '#devops'],
      linkedin: ['#Microservices', '#Architecture'],
    },
    'system-design': {
      ig: ['#systemdesign', '#scalability', '#architecture', '#faang', '#interview'],
      tiktok: ['#systemdesign', '#faang', '#techinterview'],
      linkedin: ['#SystemDesign', '#TechInterviews'],
    },
    databases: {
      ig: ['#databases', '#sql', '#nosql', '#postgresql', '#mongodb', '#dataengineering'],
      tiktok: ['#databases', '#sql', '#dataengineering'],
      linkedin: ['#Databases', '#DataEngineering'],
    },
    kubernetes: {
      ig: ['#kubernetes', '#k8s', '#devops', '#docker', '#cloudnative', '#containerization'],
      tiktok: ['#kubernetes', '#devops', '#docker'],
      linkedin: ['#Kubernetes', '#DevOps'],
    },
    docker: {
      ig: ['#docker', '#containers', '#devops', '#cloudnative', '#deployment'],
      tiktok: ['#docker', '#devops', '#containers'],
      linkedin: ['#Docker', '#DevOps'],
    },
    aws: {
      ig: ['#aws', '#cloud', '#cloudcomputing', '#serverless', '#lambda', '#devops'],
      tiktok: ['#aws', '#cloud', '#serverless'],
      linkedin: ['#AWS', '#CloudComputing'],
    },
  };

  // Find matching topic
  for (const [key, val] of Object.entries(mapping)) {
    if (topicLower.includes(key)) return val;
  }

  // Generic fallback
  return {
    ig: ['#coding', '#softwaredev', '#techexplained', '#learnprogramming'],
    tiktok: ['#coding', '#softwaredev'],
    linkedin: ['#Technology', '#Learning'],
  };
}

// ─── Platform Generators ────────────────────────────────────────────────────

function generateInstagramCaption(meta: ShortMetadata, topic: string): string {
  const title = meta.youtube.title;
  const desc = meta.youtube.description.split('\n')[0]; // First line
  const topicTags = getTopicHashtags(topic);

  // Build caption: hook + value prop + CTA + hashtags
  const lines = [
    `🔥 ${title}`,
    '',
    desc,
    '',
    '💡 Save this for your next interview prep session!',
    '📌 Follow @guru.sishya for daily tech breakdowns',
    '',
    '👇 Drop a "🧠" if you learned something new!',
    '',
    '🔗 Link in bio for the full breakdown + free cheat sheet',
    '',
    '---',
    '',
  ];

  // Combine hashtags: topic-specific + base (aim for 25-30)
  const allHashtags = [
    ...topicTags.ig,
    ...INSTAGRAM_HASHTAGS_BASE,
    '#reels', '#reelsinstagram', '#explorepage', '#viral',
    '#techreels', '#codingchallenge', '#engineeringlife',
  ];

  // Deduplicate and limit to 30
  const uniqueTags = [...new Set(allHashtags)].slice(0, 30);
  lines.push(uniqueTags.join(' '));

  const caption = lines.join('\n');

  // Instagram limit is 2200 chars
  if (caption.length > 2200) {
    return caption.substring(0, 2197) + '...';
  }
  return caption;
}

function generateTikTokCaption(meta: ShortMetadata, topic: string): string {
  const title = meta.youtube.title.replace(/—.*$/, '').trim(); // Shorter title
  const topicTags = getTopicHashtags(topic);

  // TikTok: casual, short, punchy
  const hooks = [
    `POV: you finally understand ${topic.replace(/-/g, ' ')} 🤯`,
    `${topic.replace(/-/g, ' ')} explained in 45 seconds 🧠`,
    `This is what they don't teach in bootcamps 👀`,
    `Your interviewer when you explain ${topic.replace(/-/g, ' ')} like this 😏`,
    `${title} — save this for later 📌`,
  ];

  // Pick hook based on title hash for determinism
  const hash = title.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hook = hooks[hash % hooks.length];

  const allTags = [...topicTags.tiktok, ...TIKTOK_HASHTAGS_BASE];
  const uniqueTags = [...new Set(allTags)].slice(0, 5);
  const tagStr = uniqueTags.join(' ');

  const caption = `${hook}\n\n${tagStr}`;

  // TikTok limit is 300 chars
  if (caption.length > 300) {
    return caption.substring(0, 297) + '...';
  }
  return caption;
}

function generateLinkedInPost(meta: ShortMetadata, topic: string): string {
  const title = meta.youtube.title;
  const desc = meta.youtube.description;
  const topicTags = getTopicHashtags(topic);
  const topicName = topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const lines = [
    `${title}`,
    '',
    `Understanding ${topicName} is one of the skills that separates senior engineers from the rest.`,
    '',
    `In this 45-second breakdown, I cover:`,
    ...meta.youtube.tags.slice(0, 4).map(t => `→ ${t.charAt(0).toUpperCase() + t.slice(1)}`),
    '',
    `Whether you're preparing for system design interviews or building production systems, these fundamentals matter.`,
    '',
    `The best engineers I've worked with can explain complex concepts simply. That's what this series is about — one concept, 45 seconds, no fluff.`,
    '',
    `Full course + free cheat sheets: guru-sishya.in`,
    '',
    topicTags.linkedin.join(' ') + ' #Engineering #CareerGrowth',
    '',
    `What concept should I break down next? 👇`,
  ];

  return lines.join('\n');
}

function generateTweet(meta: ShortMetadata, topic: string): string {
  const topicName = topic.replace(/-/g, ' ');

  // Multiple tweet templates for variety
  const templates = [
    `${meta.youtube.title}\n\nWatch the full breakdown:\n\n${topicName} → guru-sishya.in`,
    `Most devs can't explain ${topicName} in 45 seconds.\n\nHere's the breakdown 🧵👇`,
    `${topicName} — finally explained simply.\n\n45 seconds. No BS.\n\nguru-sishya.in`,
    `Your interviewer: "Explain ${topicName}"\n\nYou after watching this: 🤝\n\nFull series → guru-sishya.in`,
  ];

  const hash = meta.youtube.title.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const tweet = templates[hash % templates.length];

  // Twitter limit is 280 chars
  if (tweet.length > 280) {
    return tweet.substring(0, 277) + '...';
  }
  return tweet;
}

function generateRedditTitles(meta: ShortMetadata, topic: string): Record<string, { title: string; subreddit: string; flair?: string }> {
  const topicName = topic.replace(/-/g, ' ');
  const title = meta.youtube.title.replace(/—.*$/, '').trim();

  return {
    'r/programming': {
      title: `${title} — 45-second visual explanation [OC]`,
      subreddit: 'programming',
      flair: 'Video',
    },
    'r/systemdesign': {
      title: `[Video] ${topicName.charAt(0).toUpperCase() + topicName.slice(1)} explained visually in 45 seconds — interview-ready breakdown`,
      subreddit: 'systemdesign',
      flair: 'Resource',
    },
    'r/cscareerquestions': {
      title: `Made a 45-second animated breakdown of ${topicName} for interview prep — feedback welcome`,
      subreddit: 'cscareerquestions',
      flair: 'Interview Prep',
    },
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

function parseArgs(): { videoPath: string; platforms: Platform[]; outDir: string } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Usage: npx tsx scripts/distribute-short.ts <video-path> [options]

Options:
  --platforms <list>   Comma-separated platforms (default: all)
                       Options: youtube,instagram,tiktok,linkedin,twitter,reddit
  --out <dir>          Output directory (default: output/distribute)

Example:
  npx tsx scripts/distribute-short.ts output/daily-short/caching-short-0.mp4
  npx tsx scripts/distribute-short.ts output/daily-short/caching-short-0.mp4 --platforms instagram,tiktok
`);
    process.exit(0);
  }

  const videoPath = path.resolve(args[0]);
  let platforms: Platform[] = ALL_PLATFORMS;
  let outDir = path.resolve('output/distribute');

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--platforms' && args[i + 1]) {
      platforms = args[i + 1].split(',').map(p => p.trim() as Platform);
      i++;
    } else if (args[i] === '--out' && args[i + 1]) {
      outDir = path.resolve(args[i + 1]);
      i++;
    }
  }

  return { videoPath, platforms, outDir };
}

function extractTopicFromFilename(filename: string): string {
  // e.g. "caching-short-0.mp4" → "caching"
  // e.g. "cdn-short-2.mp4" → "cdn"
  // e.g. "microservices-short-0.mp4" → "microservices"
  const base = path.basename(filename, '.mp4');
  const match = base.match(/^(.+)-short-\d+$/);
  return match ? match[1] : base;
}

function main() {
  const { videoPath, platforms, outDir } = parseArgs();

  // Validate video exists
  if (!fs.existsSync(videoPath)) {
    console.error(`ERROR: Video not found: ${videoPath}`);
    process.exit(1);
  }

  // Find metadata JSON (same name with -metadata.json suffix)
  const videoDir = path.dirname(videoPath);
  const videoBase = path.basename(videoPath, '.mp4');
  const metadataPath = path.join(videoDir, `${videoBase}-metadata.json`);

  if (!fs.existsSync(metadataPath)) {
    console.error(`ERROR: Metadata not found: ${metadataPath}`);
    console.error(`Expected alongside video file. Run render-daily-short.ts first.`);
    process.exit(1);
  }

  // Load metadata
  const metadata: ShortMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  const topic = extractTopicFromFilename(videoPath);
  const shortId = videoBase;

  console.log(`\n📦 Distributing: ${shortId}`);
  console.log(`   Topic: ${topic}`);
  console.log(`   Platforms: ${platforms.join(', ')}`);
  console.log(`   Output: ${outDir}/${shortId}/\n`);

  // Create output directories
  const baseOutDir = path.join(outDir, shortId);

  for (const platform of platforms) {
    const platformDir = path.join(baseOutDir, platform);
    fs.mkdirSync(platformDir, { recursive: true });

    switch (platform) {
      case 'youtube': {
        // Pass through — copy video + metadata
        fs.copyFileSync(videoPath, path.join(platformDir, `${shortId}.mp4`));
        fs.writeFileSync(
          path.join(platformDir, 'metadata.json'),
          JSON.stringify(metadata.youtube, null, 2)
        );
        console.log(`   ✓ YouTube Shorts — video + metadata.json`);
        break;
      }

      case 'instagram': {
        fs.copyFileSync(videoPath, path.join(platformDir, `${shortId}.mp4`));
        const caption = generateInstagramCaption(metadata, topic);
        fs.writeFileSync(path.join(platformDir, 'caption.txt'), caption);
        console.log(`   ✓ Instagram Reels — video + caption.txt (${caption.length} chars)`);
        break;
      }

      case 'tiktok': {
        fs.copyFileSync(videoPath, path.join(platformDir, `${shortId}.mp4`));
        const caption = generateTikTokCaption(metadata, topic);
        fs.writeFileSync(path.join(platformDir, 'caption.txt'), caption);
        console.log(`   ✓ TikTok — video + caption.txt (${caption.length} chars)`);
        break;
      }

      case 'linkedin': {
        fs.copyFileSync(videoPath, path.join(platformDir, `${shortId}.mp4`));
        const post = generateLinkedInPost(metadata, topic);
        fs.writeFileSync(path.join(platformDir, 'post.txt'), post);
        console.log(`   ✓ LinkedIn — video + post.txt (${post.length} chars)`);
        break;
      }

      case 'twitter': {
        const tweet = generateTweet(metadata, topic);
        fs.writeFileSync(path.join(platformDir, 'tweet.txt'), tweet);
        console.log(`   ✓ Twitter/X — tweet.txt (${tweet.length} chars)`);
        break;
      }

      case 'reddit': {
        const titles = generateRedditTitles(metadata, topic);
        fs.writeFileSync(
          path.join(platformDir, 'post-titles.json'),
          JSON.stringify(titles, null, 2)
        );
        console.log(`   ✓ Reddit — post-titles.json (${Object.keys(titles).length} subreddits)`);
        break;
      }
    }
  }

  // Write a summary manifest
  const manifest = {
    shortId,
    topic,
    videoPath,
    metadataPath,
    generatedAt: new Date().toISOString(),
    platforms: platforms.map(p => ({
      platform: p,
      directory: path.join(baseOutDir, p),
    })),
  };

  fs.writeFileSync(
    path.join(baseOutDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n✅ Distribution package ready at: ${baseOutDir}/`);
  console.log(`   Manifest: ${baseOutDir}/manifest.json\n`);

  // Print quick post commands
  console.log(`── Quick Post Commands ──────────────────────────────────`);
  if (platforms.includes('youtube')) {
    console.log(`   YouTube:   npx tsx scripts/render-and-upload-short.ts (already uploaded)`);
  }
  if (platforms.includes('reddit')) {
    console.log(`   Reddit:    bash scripts/post-to-platforms.sh reddit ${baseOutDir}/reddit/post-titles.json ${videoPath}`);
  }
  if (platforms.includes('twitter')) {
    console.log(`   Twitter:   bash scripts/post-to-platforms.sh twitter ${baseOutDir}/twitter/tweet.txt`);
  }
  if (platforms.includes('linkedin')) {
    console.log(`   LinkedIn:  bash scripts/post-to-platforms.sh linkedin ${baseOutDir}/linkedin/post.txt ${videoPath}`);
  }
  console.log('');
}

main();
