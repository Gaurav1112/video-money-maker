import { Router } from 'express';
import { createRenderJob, getRenderJob, updateRenderJob } from '../db';
import crypto from 'crypto';

const router = Router();

// POST /api/render — trigger a render job
router.post('/', (req, res) => {
  const { queue_id } = req.body;
  const jobId = `job_${crypto.randomUUID().slice(0, 8)}`;

  createRenderJob(jobId, queue_id || 0);

  // TODO: Actually trigger rendering pipeline in background
  // For now, just create the job record
  updateRenderJob(jobId, { status: 'queued' });

  res.json({ jobId, status: 'queued' });
});

// GET /api/render/:jobId — check render status
router.get('/:jobId', (req, res) => {
  const job = getRenderJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json(job);
});

export default router;
