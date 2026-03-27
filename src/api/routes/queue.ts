import { Router } from 'express';
import { getNextPending, updateQueueStatus, getQueueStats, seedQueue } from '../db';

const router = Router();

// GET /api/queue/next — fetch next unpublished video
router.get('/next', (_req, res) => {
  const next = getNextPending();
  if (!next) {
    res.json({ message: 'No pending videos in queue' });
    return;
  }
  res.json(next);
});

// POST /api/queue/publish — mark video as published
router.post('/publish', (req, res) => {
  const { id, youtube_id, instagram_id } = req.body;
  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  updateQueueStatus(id, 'published', {
    youtube_id,
    instagram_id,
    published_at: new Date().toISOString(),
  });
  res.json({ success: true });
});

// GET /api/queue/stats — queue statistics
router.get('/stats', (_req, res) => {
  const stats = getQueueStats();
  res.json(stats);
});

// POST /api/queue/seed — seed the queue with topics
router.post('/seed', (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items)) {
    res.status(400).json({ error: 'items array is required' });
    return;
  }
  seedQueue(items);
  res.json({ success: true, count: items.length });
});

export default router;
