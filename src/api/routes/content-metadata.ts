import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const CONTENT_DIR = path.resolve(PROJECT_ROOT, '../guru-sishya/public/content');

// ── Constants ────────────────────────────────────────────────────────────────

const SITE_URL = 'https://www.guru-sishya.in';
const CHANNEL_NAME = 'Guru Sishya';
const CHANNEL_HANDLE = '@gurusishya';
const INSTAGRAM_HANDLE = '@guru_sishya.in';

const UNIVERSAL_TAGS = [
  'guru sishya',                        // brand
  'coding interview prep',              // universal
  'system design interview',            // universal
  'DSA tutorial',                       // universal
  'FAANG interview',                    // universal
  'interview prep',                     // universal
  'software engineer interview',        // universal
  'tech interview',                     // universal
  'programming',                        // universal
  'computer science',                   // universal
];

// Topic tag lookup for hashtags (exactly 3 shown above title)
const TOPIC_HASHTAG_MAP: Record<string, string> = {
  'load balancing': '#SystemDesign',
  'caching': '#SystemDesign',
  'microservices': '#SystemDesign',
  'database': '#Database',
  'api': '#SystemDesign',
  'docker': '#DevOps',
  'kubernetes': '#DevOps',
  'kafka': '#SystemDesign',
  'redis': '#Database',
  'hash': '#DSA',
  'tree': '#DSA',
  'graph': '#DSA',
  'array': '#DSA',
  'linked list': '#DSA',
  'stack': '#DSA',
  'queue': '#DSA',
  'sort': '#DSA',
  'search': '#DSA',
  'dynamic programming': '#DSA',
  'recursion': '#DSA',
  'java': '#Java',
  'python': '#Python',
  'javascript': '#JavaScript',
  'react': '#React',
  'design pattern': '#CleanCode',
};

function getTopicHashtag(topicName: string): string {
  const lower = topicName.toLowerCase();
  for (const [key, tag] of Object.entries(TOPIC_HASHTAG_MAP)) {
    if (lower.includes(key)) return tag;
  }
  return '#CodingInterview';
}

// Rotating title formulas for SEO (keyword-first, under 60 chars, power words)
const TITLE_FORMULAS = [
  (keyword: string, hook: string) => `${keyword} Explained — ${hook} | Guru Sishya`,
  (keyword: string, _hook: string, topic: string, n: number) => `Why ${keyword} Matters — ${topic} #${n}`,
  (keyword: string, _hook: string, topic: string) => `${keyword} in Minutes | ${topic} Tutorial`,
  (keyword: string) => `5 ${keyword} Mistakes That KILL Your Interview`,
  (keyword: string) => `${keyword} — What Interviewers ACTUALLY Ask`,
];

function extractKeyword(sessionTitle: string): string {
  return sessionTitle.split(/\s+/).slice(0, 3).join(' ');
}

function generateHook(topicName: string): string {
  const lower = topicName.toLowerCase();
  if (lower.includes('system design') || lower.includes('load') || lower.includes('caching'))
    return 'ace system design';
  if (lower.includes('dsa') || lower.includes('sort') || lower.includes('tree') || lower.includes('graph'))
    return 'crack DSA rounds';
  return 'nail your interview';
}

// DALL-E thumbnail prompts by category
const THUMBNAIL_PROMPTS: Record<string, string> = {
  'system-design': 'Dark background #0C0A15, glowing server architecture diagram, neon teal (#1DD1A1) connection lines, futuristic minimal style, no text, 1280x720',
  'dsa': 'Dark navy background, glowing data structure visualization, saffron (#E85D26) nodes with gold edges, minimal clean style, no text, 1280x720',
  'behavioral': 'Dark background, professional interview setting silhouette, gold (#FDB813) accent glow, clean minimal, no text, 1280x720',
  'language': 'Dark background #0C0A15, clean code editor with syntax highlighting, neon teal (#1DD1A1) cursor glow, minimal style, no text, 1280x720',
  'default': 'Dark background #0C0A15, abstract code visualization with neon accents, futuristic tech aesthetic, no text, 1280x720',
};

function getThumbnailCategory(topicName: string): string {
  const lower = topicName.toLowerCase();
  if (lower.includes('system design') || lower.includes('load') || lower.includes('caching') || lower.includes('microservice') || lower.includes('database') || lower.includes('api') || lower.includes('kafka'))
    return 'system-design';
  if (lower.includes('dsa') || lower.includes('tree') || lower.includes('graph') || lower.includes('sort') || lower.includes('hash') || lower.includes('array') || lower.includes('stack') || lower.includes('queue') || lower.includes('linked'))
    return 'dsa';
  if (lower.includes('behavioral') || lower.includes('star'))
    return 'behavioral';
  if (lower.includes('java') || lower.includes('python') || lower.includes('javascript') || lower.includes('typescript'))
    return 'language';
  return 'default';
}

// ── Skip files that are not video-worthy topics ──────────────────────────────

const SKIP_FILES = new Set([
  'daily-questions',
  'default-flashcards',
  'premium-emails',
  'star-questions',
  'star-stories',
  'interview-framework',
  'estimation',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function extractTitleFromMarkdown(markdown: string): string | null {
  if (typeof markdown !== 'string') return null;
  const match = markdown.match(/^##\s+(.+)/m);
  return match ? match[1].trim() : null;
}

function topicSpecificTags(topicName: string): string[] {
  const lower = topicName.toLowerCase();
  const tags: string[] = [topicName.toLowerCase()];

  // Add domain-specific tags
  if (lower.includes('java')) tags.push('java', 'java interview', 'java programming', 'jvm');
  if (lower.includes('python')) tags.push('python', 'python interview', 'python programming');
  if (lower.includes('javascript') || lower.includes('js')) tags.push('javascript', 'js', 'frontend interview');
  if (lower.includes('react') || lower.includes('nextjs') || lower.includes('next.js')) tags.push('react', 'nextjs', 'frontend', 'web development');
  if (lower.includes('node')) tags.push('nodejs', 'backend', 'server side javascript');
  if (lower.includes('sql') || lower.includes('rdbms') || lower.includes('database')) tags.push('sql', 'database', 'rdbms', 'postgresql', 'mysql');
  if (lower.includes('nosql') || lower.includes('mongo')) tags.push('nosql', 'mongodb', 'dynamodb');
  if (lower.includes('kafka')) tags.push('apache kafka', 'message queue', 'event streaming', 'distributed systems');
  if (lower.includes('docker') || lower.includes('k8s') || lower.includes('kubernetes')) tags.push('docker', 'kubernetes', 'devops', 'containers');
  if (lower.includes('aws') || lower.includes('cloud')) tags.push('aws', 'cloud computing', 'amazon web services');
  if (lower.includes('system design')) tags.push('system design interview', 'high level design', 'low level design', 'architecture');
  if (lower.includes('dsa') || lower.includes('data structure') || lower.includes('algo')) tags.push('dsa', 'leetcode', 'competitive programming');
  if (lower.includes('design pattern')) tags.push('design patterns', 'oop', 'solid principles', 'clean code');
  if (lower.includes('spring') || lower.includes('boot')) tags.push('spring boot', 'spring framework', 'microservices', 'java backend');
  if (lower.includes('html') || lower.includes('css')) tags.push('html', 'css', 'web development', 'frontend');
  if (lower.includes('load balancing')) tags.push('load balancer', 'nginx', 'haproxy', 'scalability');
  if (lower.includes('hash')) tags.push('hash map', 'hash table', 'data structures');

  return Array.from(new Set(tags));
}

function generatePlaylistMeta(topicName: string, slug: string, sessionCount: number) {
  const topicTags = topicSpecificTags(topicName);

  return {
    title: `${topicName} — Complete Interview Prep Series | ${CHANNEL_NAME}`,
    description: [
      `Master ${topicName} for FAANG interviews with this complete ${sessionCount}-part series.`,
      `Each session covers concepts with Java + Python code, real interview questions, and expert tips.`,
      '',
      `Free interview prep platform: ${SITE_URL}/app/topics`,
      `Topic page: ${SITE_URL}/app/topic/${slug}`,
      '',
      `Subscribe for daily interview prep: ${CHANNEL_HANDLE}`,
      `Instagram: ${INSTAGRAM_HANDLE}`,
      '',
      `#${topicName.replace(/\s+/g, '')} #InterviewPrep #FAANG #${CHANNEL_NAME.replace(/\s+/g, '')}`,
    ].join('\n'),
    tags: [...topicTags, ...UNIVERSAL_TAGS].slice(0, 30),
    thumbnailPrompt: [
      `Create a bold, dark-themed YouTube playlist thumbnail for "${topicName} Interview Prep Series".`,
      `Background: deep dark purple (#0C0A15) with subtle grid lines.`,
      `Center: large glowing saffron (#E85D26) icon representing ${topicName} (e.g., server nodes for system design, hash symbol for hash maps, tree for DSA).`,
      `Text: "${topicName}" in large white bold font at top, "Complete Series" in gold (#FDB813) below.`,
      `Bottom: "${sessionCount} Sessions" badge in teal (#1DD1A1).`,
      `Style: modern, clean, tech/coding aesthetic, 1280x720.`,
    ].join(' '),
  };
}

function generateVideoMeta(
  topicName: string,
  topicSlug: string,
  sessionTitle: string,
  sessionNumber: number,
  totalSessions: number,
) {
  const topicTags = topicSpecificTags(topicName);
  const sessionSlug = slugify(sessionTitle);
  const topicUrl = `${SITE_URL}/app/topic/${topicSlug}`;

  // ── Title: SEO-optimized, keyword-first, under 60 chars, rotating formulas ──
  const keyword = extractKeyword(sessionTitle);
  const hook = generateHook(topicName);
  const formulaIndex = (sessionNumber - 1) % TITLE_FORMULAS.length;
  let title = TITLE_FORMULAS[formulaIndex](keyword, hook, topicName, sessionNumber);
  if (title.length > 60) {
    title = title.slice(0, 59).trimEnd() + '…';
  }

  // ── Description: first 150 chars are unique + contain primary keyword ──
  const description = [
    `${sessionTitle} — master this for your FAANG interview. FREE practice with 1,988 questions at guru-sishya.in/${topicSlug}`,
    '',
    `Part ${sessionNumber} of ${totalSessions} in the ${topicName} series. Java + Python code, visual diagrams, and real interview questions.`,
    '',
    '⏱️ Timestamps:',
    '0:00 Introduction',
    '0:30 Core Concepts',
    '// [Add timestamps after rendering]',
    '',
    `📚 Free interactive prep: ${topicUrl}`,
    `🌐 Full platform: ${SITE_URL}`,
    `📸 Instagram: ${INSTAGRAM_HANDLE}`,
    '',
    `▶️ Full ${topicName} playlist: [playlist link]`,
    `▶️ Subscribe for daily videos: ${CHANNEL_HANDLE}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    `Tags: ${topicTags.slice(0, 8).join(', ')}`,
    '',
    `${getTopicHashtag(topicName)} #CodingInterview #GuruSishya`,
  ].join('\n');

  // ── Tags: 15-20, priority ordered (exact match → long-tail → universal → brand) ──
  const tags = [
    sessionTitle,                                    // exact match
    `${topicName} explained`,                        // topic variation
    `${topicName} interview questions`,              // long-tail
    `${topicName} tutorial`,                         // tutorial keyword
    `coding interview ${topicName}`,                 // audience keyword
    `${topicName} system design`,                    // related
    `FAANG interview ${topicName}`,                  // FAANG
    'guru sishya',                                   // brand
    'coding interview prep',                         // universal
    'system design interview',                       // universal
    `${topicName} python`,                           // language
    `${topicName} java`,                             // language
    `${topicName} for beginners`,                    // level
    `${topicName} advanced`,                         // level
    'DSA tutorial',                                  // universal
    ...topicTags.slice(0, 5),                        // topic-specific extras
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 20);

  // ── Hashtags: exactly 3, shown above title ──
  const topicTag = getTopicHashtag(topicName);
  const hashtags = [topicTag, '#CodingInterview', '#GuruSishya'];

  // Instagram caption
  const igCaption = [
    `${sessionTitle} 🔥`,
    '',
    `Part ${sessionNumber}/${totalSessions} of our ${topicName} series.`,
    `Java + Python code included!`,
    '',
    `Save this for your interview prep 📌`,
    `Full video on YouTube — link in bio!`,
    '',
    `Free platform: ${SITE_URL}`,
  ].join('\n');

  const igHashtags = [
    `#${topicName.replace(/\s+/g, '')}`,
    '#CodingInterview', '#FAANG', '#SystemDesign', '#Programming',
    '#SoftwareEngineer', '#TechInterview', '#InterviewPrep',
    '#GuruSishya', '#LearnToCode',
  ].join(' ');

  // ── Pinned comment: engagement-driving question ──
  const pinnedComment = [
    `Want to practice ${topicName} with real interview questions? I built a FREE platform with 1,988 questions → guru-sishya.in/${topicSlug}`,
    '',
    `Which part of ${topicName} do you find hardest? Drop it below — I'll cover it in the next video! 👇`,
  ].join('\n');

  // ── Thumbnail DALL-E prompt: category-aware ──
  const thumbCategory = getThumbnailCategory(topicName);
  const thumbnailPrompt = THUMBNAIL_PROMPTS[thumbCategory] || THUMBNAIL_PROMPTS['default'];

  // ── Community post: poll format for engagement ──
  const communityPost = [
    `🔥 New video: ${title}`,
    '',
    `What should I cover next?`,
    `□ ${topicName} Advanced Patterns`,
    `□ ${topicName} Interview Questions`,
    `□ System Design with ${topicName}`,
    `□ Something else (comment below!)`,
    '',
    `Free practice: ${topicUrl}`,
  ].join('\n');

  return {
    sessionNumber,
    title,
    description,
    tags,
    hashtags,
    igCaption,
    igHashtags,
    pinnedComment,
    thumbnailPrompt,
    communityPost,
    urls: {
      topicPage: topicUrl,
      platform: SITE_URL,
      instagram: `https://instagram.com/guru_sishya.in`,
      youtube: `https://youtube.com/${CHANNEL_HANDLE}`,
    },
  };
}

// ── Parse content files into topics + sessions ───────────────────────────────

interface ParsedSession {
  number: number;
  title: string;
  contentPreview: string;
}

interface ParsedTopic {
  slug: string;
  sourceFile: string;
  name: string;
  sessions: ParsedSession[];
}

function parseContentFile(file: string): ParsedTopic[] {
  const filePath = path.join(CONTENT_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const slug = file.replace('.json', '');
  const topics: ParsedTopic[] = [];

  if (Array.isArray(data)) {
    const firstItem = data[0];
    if (!firstItem) return topics;

    if (firstItem.sessions && typeof firstItem.sessions === 'object' && !Array.isArray(firstItem.sessions)) {
      // Nested format: [{ topic, sessions: { "1": "md", "2": "md" }, quizBank }]
      for (const topicObj of data) {
        if (!topicObj.sessions || typeof topicObj.sessions !== 'object') continue;
        const sessionKeys = Object.keys(topicObj.sessions).sort((a, b) => Number(a) - Number(b));
        const topicName = topicObj.topic || topicObj.title || topicObj.name || slug;
        const topicSlug = slugify(topicName);

        const sessions: ParsedSession[] = sessionKeys.map((key) => {
          const content = topicObj.sessions[key];
          const title = (typeof content === 'string' ? extractTitleFromMarkdown(content) : null)
            || `${topicName} — Session ${key}`;
          return {
            number: Number(key),
            title,
            contentPreview: typeof content === 'string' ? content.slice(0, 200) : '',
          };
        });

        topics.push({ slug: topicSlug, sourceFile: slug, name: topicName, sessions });
      }
    } else {
      // Flat format: [{ topic, cheatSheet, lesson, ... }] — each item = 1 session
      // Group by topic name if items have different topics
      const byTopic = new Map<string, { items: any[]; indices: number[] }>();

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const topicName = item.topic || item.category || item.question?.slice(0, 60) || slug;
        if (!byTopic.has(topicName)) {
          byTopic.set(topicName, { items: [], indices: [] });
        }
        byTopic.get(topicName)!.items.push(item);
        byTopic.get(topicName)!.indices.push(i);
      }

      // If all items share the same topic name, treat the whole file as one topic
      if (byTopic.size === 1 || data.length > 50) {
        const topicName = data[0].topic || data[0].category || slug;
        const sessions: ParsedSession[] = data.map((item: any, i: number) => {
          const content = item.cheatSheet || item.lesson || item.answer || '';
          const title = (typeof content === 'string' ? extractTitleFromMarkdown(content) : null)
            || item.topic || item.question?.slice(0, 80) || `Session ${i + 1}`;
          return {
            number: i + 1,
            title,
            contentPreview: typeof content === 'string' ? content.slice(0, 200) : '',
          };
        });

        topics.push({ slug, sourceFile: slug, name: topicName, sessions });
      } else {
        // Multiple distinct topics in one file — group them
        for (const [topicName, { items }] of Array.from(byTopic.entries())) {
          const topicSlug = slugify(topicName);
          const sessions: ParsedSession[] = items.map((item: any, i: number) => {
            const content = item.cheatSheet || item.lesson || item.answer || '';
            const title = (typeof content === 'string' ? extractTitleFromMarkdown(content) : null)
              || item.topic || `Session ${i + 1}`;
            return {
              number: i + 1,
              title,
              contentPreview: typeof content === 'string' ? content.slice(0, 200) : '',
            };
          });

          topics.push({ slug: topicSlug, sourceFile: slug, name: topicName, sessions });
        }
      }
    }
  } else if (data.plan?.sessions && Array.isArray(data.plan.sessions)) {
    // Object with plan.sessions array
    const topicName = data.plan.topic || data.topic || slug;
    const sessions: ParsedSession[] = data.plan.sessions.map((s: any, i: number) => ({
      number: i + 1,
      title: s.title || `Session ${i + 1}`,
      contentPreview: (s.content || s.lesson || '').slice(0, 200),
    }));
    topics.push({ slug, sourceFile: slug, name: topicName, sessions });
  } else if (data.sessions && typeof data.sessions === 'object') {
    // Single topic object with sessions map
    const topicName = data.topic || data.title || data.name || slug;
    const sessionKeys = Object.keys(data.sessions).sort((a, b) => Number(a) - Number(b));
    const sessions: ParsedSession[] = sessionKeys.map((key) => {
      const content = data.sessions[key];
      const title = (typeof content === 'string' ? extractTitleFromMarkdown(content) : null)
        || `${topicName} — Session ${key}`;
      return {
        number: Number(key),
        title,
        contentPreview: typeof content === 'string' ? content.slice(0, 200) : '',
      };
    });
    topics.push({ slug, sourceFile: slug, name: topicName, sessions });
  } else if (data.questions && Array.isArray(data.questions)) {
    // QA format: { questions: [...] } — batch into sessions of 10
    const topicName = data.title || data.name || slug;
    const batchSize = 10;
    const sessions: ParsedSession[] = [];
    for (let i = 0; i < data.questions.length; i += batchSize) {
      const batch = data.questions.slice(i, i + batchSize);
      const sessionNum = Math.floor(i / batchSize) + 1;
      sessions.push({
        number: sessionNum,
        title: `${topicName} — Questions ${i + 1}-${i + batch.length}`,
        contentPreview: batch[0]?.question || batch[0]?.q || '',
      });
    }
    topics.push({ slug, sourceFile: slug, name: topicName, sessions });
  }

  return topics;
}

// ── GET /api/content-metadata ────────────────────────────────────────────────

router.get('/', (_req, res) => {
  try {
    if (!fs.existsSync(CONTENT_DIR)) {
      return res.status(404).json({
        error: 'Content directory not found',
        path: CONTENT_DIR,
        hint: 'Ensure guru-sishya repo is at the expected location',
      });
    }

    const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'));
    const allTopics: any[] = [];
    let totalSessions = 0;
    let totalVideos = 0;

    for (const file of files) {
      const slug = file.replace('.json', '');
      if (SKIP_FILES.has(slug)) continue;

      try {
        const parsedTopics = parseContentFile(file);

        for (const topic of parsedTopics) {
          const playlist = generatePlaylistMeta(topic.name, topic.slug, topic.sessions.length);

          const videos = topic.sessions.map((session) =>
            generateVideoMeta(
              topic.name,
              topic.slug,
              session.title,
              session.number,
              topic.sessions.length,
            )
          );

          totalSessions += topic.sessions.length;
          totalVideos += videos.length;

          allTopics.push({
            slug: topic.slug,
            sourceFile: topic.sourceFile,
            name: topic.name,
            sessionCount: topic.sessions.length,
            playlist,
            videos,
          });
        }
      } catch {
        // Skip malformed files silently
      }
    }

    // Sort alphabetically by topic name
    allTopics.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      generated: new Date().toISOString(),
      channel: {
        name: CHANNEL_NAME,
        handle: CHANNEL_HANDLE,
        instagram: INSTAGRAM_HANDLE,
        website: SITE_URL,
      },
      stats: {
        totalTopics: allTopics.length,
        totalSessions,
        totalVideos,
        sourceFiles: files.length - SKIP_FILES.size,
      },
      topics: allTopics,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 3) });
  }
});

// ── GET /api/content-metadata/:slug — single topic metadata ──────────────────

router.get('/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    if (!fs.existsSync(CONTENT_DIR)) {
      return res.status(404).json({ error: 'Content directory not found' });
    }

    const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const fileSlug = file.replace('.json', '');
      if (SKIP_FILES.has(fileSlug)) continue;

      try {
        const parsedTopics = parseContentFile(file);
        const match = parsedTopics.find(
          t => t.slug === slug || t.sourceFile === slug
        );

        if (match) {
          const playlist = generatePlaylistMeta(match.name, match.slug, match.sessions.length);
          const videos = match.sessions.map((session) =>
            generateVideoMeta(
              match.name,
              match.slug,
              session.title,
              session.number,
              match.sessions.length,
            )
          );

          return res.json({
            slug: match.slug,
            sourceFile: match.sourceFile,
            name: match.name,
            sessionCount: match.sessions.length,
            playlist,
            videos,
          });
        }
      } catch { /* skip */ }
    }

    res.status(404).json({ error: `Topic not found: ${slug}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/content-metadata/export/bulk — flat CSV-friendly export ─────────

router.get('/export/bulk', (_req, res) => {
  try {
    if (!fs.existsSync(CONTENT_DIR)) {
      return res.status(404).json({ error: 'Content directory not found' });
    }

    const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'));
    const rows: any[] = [];

    for (const file of files) {
      const fileSlug = file.replace('.json', '');
      if (SKIP_FILES.has(fileSlug)) continue;

      try {
        const parsedTopics = parseContentFile(file);
        for (const topic of parsedTopics) {
          for (const session of topic.sessions) {
            const meta = generateVideoMeta(
              topic.name, topic.slug, session.title, session.number, topic.sessions.length,
            );
            rows.push({
              topic: topic.name,
              topicSlug: topic.slug,
              sourceFile: topic.sourceFile,
              sessionNumber: session.number,
              videoTitle: meta.title,
              tags: meta.tags.join(', '),
              hashtags: meta.hashtags.join(' '),
              igHashtags: meta.igHashtags,
            });
          }
        }
      } catch { /* skip */ }
    }

    res.json({
      generated: new Date().toISOString(),
      totalRows: rows.length,
      rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
