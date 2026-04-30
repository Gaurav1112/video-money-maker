import { Router } from 'express';
import { exec } from 'child_process';
import * as path from 'path';

const router = Router();
const activeRenders = new Map<string, { status: string; progress: number; error?: string }>();

// POST /api/batch-render — start rendering selected topics/sessions
router.post('/', (req, res) => {
  const { topics, quality = 'full' } = req.body;
  // topics: [{ slug: "load-balancing", sessions: [1, 2, 3] }]

  if (!topics?.length) {
    res.status(400).json({ error: 'No topics selected' });
    return;
  }

  const jobs: Array<{ slug: string; session: number }> = [];
  for (const t of topics) {
    for (const s of t.sessions) {
      const jobId = `${t.slug}-s${s}`;
      jobs.push({ slug: t.slug, session: s });
      activeRenders.set(jobId, { status: 'queued', progress: 0 });
    }
  }

  // Start rendering in background
  const fastFlag = quality === 'fast' ? '--fast' : '';
  for (const job of jobs) {
    const jobId = `${job.slug}-s${job.session}`;
    activeRenders.set(jobId, { status: 'rendering', progress: 10 });

    const cmd = `npx tsx scripts/render-session.ts ${job.slug} ${job.session} ${fastFlag}`.trim();
    exec(cmd, { cwd: path.resolve(__dirname, '../../..') }, (error) => {
      if (error) {
        activeRenders.set(jobId, { status: 'failed', progress: 0, error: error.message.slice(0, 200) });
      } else {
        activeRenders.set(jobId, { status: 'complete', progress: 100 });
      }
    });
  }

  res.json({ message: `Started ${jobs.length} render jobs`, jobs: jobs.map(j => `${j.slug}-s${j.session}`) });
});

// GET /api/batch-render/status — current status of all render jobs
router.get('/status', (_req, res) => {
  const status: Record<string, any> = {};
  activeRenders.forEach((v, k) => { status[k] = v; });
  res.json(status);
});

export default router;
