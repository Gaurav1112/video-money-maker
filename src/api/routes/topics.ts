import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
// Use absolute paths since tsx runs from source directly
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const CONTENT_DIR = path.resolve(PROJECT_ROOT, '../guru-sishya/public/content');
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, 'output');

// GET /api/topics — list all topics with session counts and render status
// Guru-sishya content JSONs are arrays of topic objects:
//   - Flat: [{ topic, cheatSheet, lesson, ... }] → each item = 1 session
//   - Nested: [{ topic, sessions: { "1": "md", "2": "md" } }] → each key = 1 session
router.get('/', (_req, res) => {
  try {
    const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'));
    const topics: any[] = [];

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8'));
        const slug = file.replace('.json', '');

        // Check rendered videos in output/ (both flat and folder structures)
        const renderedSessions: number[] = [];
        const topicDir = path.join(OUTPUT_DIR, slug);
        if (fs.existsSync(topicDir)) {
          fs.readdirSync(topicDir).filter(f => f.endsWith('.mp4')).forEach(f => {
            const match = f.match(/s(\d+)\.mp4/);
            if (match) renderedSessions.push(parseInt(match[1]));
          });
        }
        // Also check flat output like: output/slug-s1.mp4
        if (fs.existsSync(OUTPUT_DIR)) {
          fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith(slug) && f.endsWith('.mp4')).forEach(f => {
            const match = f.match(/s(\d+)\.mp4/);
            if (match && !renderedSessions.includes(parseInt(match[1]))) {
              renderedSessions.push(parseInt(match[1]));
            }
          });
        }

        if (Array.isArray(data)) {
          // Flat array: each item is a topic/session
          const firstItem = data[0];
          if (!firstItem) continue;

          if (firstItem.sessions && typeof firstItem.sessions === 'object') {
            // Nested: array of topics with sessions map
            for (const topicObj of data) {
              if (!topicObj.sessions || typeof topicObj.sessions !== 'object') continue;
              const sessionCount = Object.keys(topicObj.sessions).length;
              const topicSlug = (topicObj.topic || slug).toLowerCase().replace(/[^a-z0-9]+/g, '-');
              topics.push({
                slug: topicSlug,
                sourceFile: slug,
                name: topicObj.topic || slug,
                totalSessions: sessionCount,
                renderedSessions: renderedSessions.sort((a, b) => a - b),
                status: renderedSessions.length >= sessionCount ? 'complete' :
                        renderedSessions.length > 0 ? 'partial' : 'pending',
              });
            }
          } else {
            // Flat: entire array is sessions for this file
            topics.push({
              slug,
              sourceFile: slug,
              name: firstItem.topic || firstItem.category || slug,
              totalSessions: data.length,
              renderedSessions: renderedSessions.sort((a, b) => a - b),
              status: renderedSessions.length >= data.length ? 'complete' :
                      renderedSessions.length > 0 ? 'partial' : 'pending',
            });
          }
        } else if (data.plan?.sessions) {
          // Object with plan.sessions (original expected format)
          topics.push({
            slug,
            sourceFile: slug,
            name: data.plan.topic || data.topic || slug,
            totalSessions: data.plan.sessions.length,
            renderedSessions: renderedSessions.sort((a, b) => a - b),
            status: renderedSessions.length >= data.plan.sessions.length ? 'complete' :
                    renderedSessions.length > 0 ? 'partial' : 'pending',
          });
        }
      } catch { /* skip malformed files */ }
    }

    res.json({ topics: topics.sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (err: any) {
    res.status(500).json({ error: err.message, contentDir: CONTENT_DIR });
  }
});

export default router;
