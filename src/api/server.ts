import express from 'express';
import path from 'path';
import { initDatabase } from './db';
import queueRoutes from './routes/queue';
import renderRoutes from './routes/render';
import { listAvailableTopics, loadTopicContent, extractSession, getDemoSession } from '../pipeline/content-loader';
import { generateScript } from '../pipeline/script-generator';

const app = express();
const PORT = process.env.API_PORT || 3000;

app.use(express.json());

// Serve static files from public/
app.use(express.static(path.join(__dirname, '../../public')));

// Routes
app.use('/api/queue', queueRoutes);
app.use('/api/render', renderRoutes);

// Health check
app.get('/api/status', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/topics — List all available topics
app.get('/api/topics', (_req, res) => {
  const topics = listAvailableTopics();
  res.json({ topics, count: topics.length });
});

// POST /api/preview — Generate scene preview without rendering
app.post('/api/preview', (req, res) => {
  const { topic, language = 'python', sessionIndex = 0 } = req.body;

  let session;
  if (topic === 'demo') {
    session = getDemoSession();
  } else {
    try {
      const content = loadTopicContent(topic);
      session = extractSession(content, sessionIndex);
    } catch (e) {
      // fallback to demo
    }
  }

  if (!session) {
    session = getDemoSession();
  }

  const script = generateScript(session, { language });
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
  });
});

// Initialize
initDatabase();

app.listen(PORT, () => {
  console.log(`Video Pipeline API running on port ${PORT}`);
});

export default app;
