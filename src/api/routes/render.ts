import { Router } from 'express';
import { createRenderJob, getRenderJob, updateRenderJob } from '../db';
import { generateScript } from '../../pipeline/script-generator';
import { generateSceneAudios } from '../../pipeline/tts-engine';
import { generateStoryboard } from '../../pipeline/storyboard';
import { renderAllFormats } from '../../render/batch-render';
import { getDemoSession } from '../../pipeline/content-loader';
import crypto from 'crypto';

const router = Router();

// POST /api/render — trigger a render job
router.post('/', (req, res) => {
  const { queue_id, topic, session_number, language } = req.body;
  const jobId = `job_${crypto.randomUUID().slice(0, 8)}`;

  createRenderJob(jobId, queue_id || 0);

  // Run pipeline in background (don't block response)
  setImmediate(async () => {
    try {
      updateRenderJob(jobId, { status: 'processing', progress: 10 });

      // 1. Load content (use demo for now)
      const session = getDemoSession();
      updateRenderJob(jobId, { progress: 20 });

      // 2. Generate script
      const script = generateScript(session, { language: language || 'python' });
      updateRenderJob(jobId, { progress: 40 });

      // 3. Generate TTS audio
      const audioResults = await generateSceneAudios(
        script.map(s => ({ narration: s.narration, type: s.type }))
      );
      updateRenderJob(jobId, { progress: 60 });

      // 4. Generate storyboard
      const storyboard = generateStoryboard(script, audioResults, {
        topic: session.topic,
        sessionNumber: session.sessionNumber,
      });
      updateRenderJob(jobId, { progress: 80 });

      // 5. Render all formats
      const paths = await renderAllFormats(storyboard);
      updateRenderJob(jobId, {
        status: 'complete',
        progress: 100,
        long_path: paths.long,
        short_path: paths.short,
        thumb_path: paths.thumb,
        completed_at: new Date().toISOString(),
      });
    } catch (error) {
      updateRenderJob(jobId, {
        status: 'error',
        error: String(error),
      });
    }
  });

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
