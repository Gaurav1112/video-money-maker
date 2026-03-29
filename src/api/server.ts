import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDatabase } from './db';
import queueRoutes from './routes/queue';
import renderRoutes from './routes/render';
import topicsRouter from './routes/topics';
import batchRenderRouter from './routes/batch-render';
import metadataRouter from './routes/metadata';
import scheduleRouter from './routes/schedule';
import contentMetadataRouter from './routes/content-metadata';
import { listAvailableTopics, loadTopicContent, extractSession, getDemoSession } from '../pipeline/content-loader';
import { generateFromPrompt, generateFromContent } from '../pipeline/content-generator';
import { generateScript } from '../pipeline/script-generator';
import { SessionInput } from '../types';

const app = express();
const PORT = process.env.API_PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Studio frontend (served from src/studio/)
app.use('/studio', express.static(path.join(__dirname, '../studio')));

// API Routes (must come BEFORE static file serving)
app.use('/api/queue', queueRoutes);
app.use('/api/render', renderRoutes);
app.use('/api/topics', topicsRouter);
app.use('/api/batch-render', batchRenderRouter);
app.use('/api/metadata', metadataRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/content-metadata', contentMetadataRouter);

// Health check
app.get('/api/status', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/convert-shorts — render viral shorts/reels from a storyboard
app.post('/api/convert-shorts', async (req, res) => {
  const { topic, session } = req.body;
  if (!topic || !session) {
    return res.status(400).json({ error: 'topic and session required' });
  }

  const { exec } = require('child_process');
  const cmd = `npx tsx scripts/render-viral-shorts.ts --topic "${topic}" --session ${session}`;

  exec(cmd, { cwd: path.resolve(__dirname, '../..'), timeout: 300000 }, (error: any, stdout: string, stderr: string) => {
    if (error) {
      return res.json({ success: false, error: error.message.slice(0, 500), output: stderr.slice(0, 500) });
    }
    res.json({ success: true, output: stdout });
  });
});

// Note: /api/topics is now handled by topicsRouter (routes/topics.ts)
// with full session counts, render status, and slug info.

// POST /api/preview — Generate scene preview without rendering
// Accepts three input modes (same as /api/render):
//   1. { prompt: "Explain Load Balancing" }
//   2. { content: "# My Lesson\n\nMarkdown..." }
//   3. { topic: "load-balancing", sessionIndex }
app.post('/api/preview', (req, res) => {
  const {
    topic,
    language = 'python',
    sessionIndex = 0,
    // New fields for universal generation
    prompt,
    content,
    duration = 'medium',
    style = 'fireship',
    secondary_language = 'java',
  } = req.body;

  let session: SessionInput | null = null;

  if (prompt) {
    // Mode 1: Generate from prompt
    session = generateFromPrompt(prompt, {
      language: language as any,
      secondaryLanguage: secondary_language as any,
      duration: duration as any,
      style: style as any,
      sessionNumber: sessionIndex + 1,
    });
  } else if (content) {
    // Mode 2: Generate from raw content/markdown
    session = generateFromContent(content, {
      language: language as any,
      sessionNumber: sessionIndex + 1,
    });
  } else if (topic === 'demo') {
    session = getDemoSession();
  } else if (topic) {
    // Mode 3: Load from guru-sishya JSON content
    try {
      const topicData = loadTopicContent(topic);
      session = extractSession(topicData, sessionIndex);
    } catch (e) {
      // fallback to demo
    }
  }

  if (!session) {
    session = getDemoSession();
  }

  const script = generateScript(session, { language, sessionNumber: session.sessionNumber });
  const totalDuration = script.reduce((sum, s) => sum + s.duration, 0);

  res.json({
    topic: session.topic,
    title: session.title,
    language,
    scenes: script.map(s => ({
      type: s.type,
      heading: s.heading,
      narration: s.narration.slice(0, 200),
      duration: s.duration,
    })),
    sceneCount: script.length,
    estimatedDuration: `${Math.floor(totalDuration / 60)}:${String(Math.floor(totalDuration % 60)).padStart(2, '0')}`,
    estimatedDurationSeconds: totalDuration,
    generatedFrom: prompt ? 'prompt' : content ? 'content' : 'topic',
  });
});

// Serve static files from public/ (AFTER API routes)
app.use(express.static(path.join(__dirname, '../../public')));

// Initialize
initDatabase();

app.listen(PORT, () => {
  console.log(`Video Pipeline API running on port ${PORT}`);
});

export default app;
