import { Router } from 'express';
import { createRenderJob, getRenderJob, updateRenderJob } from '../db';
import { generateScript } from '../../pipeline/script-generator';
import { generateSceneAudios } from '../../pipeline/tts-engine';
import { generateStoryboard } from '../../pipeline/storyboard';
import { renderAllFormats } from '../../render/batch-render';
import { getDemoSession, loadTopicContent, extractSession } from '../../pipeline/content-loader';
import { generateFromPrompt, generateFromContent } from '../../pipeline/content-generator';
import { SessionInput } from '../../types';
import crypto from 'crypto';

const router = Router();

// POST /api/render — trigger a render job
// Accepts three input modes:
//   1. { prompt: "Explain Load Balancing" }       — generates content from topic prompt
//   2. { content: "# My Lesson\n\nMarkdown..." }  — converts raw text/markdown
//   3. { topic: "load-balancing", session_number } — loads from guru-sishya JSON files
router.post('/', (req, res) => {
  const {
    queue_id,
    topic,
    session_number,
    language = 'python',
    // New fields for universal generation
    prompt,
    content,
    duration = 'medium',
    style = 'fireship',
    secondary_language = 'java',
  } = req.body;

  const jobId = `job_${crypto.randomUUID().slice(0, 8)}`;

  createRenderJob(jobId, queue_id || 0);

  // Run pipeline in background (don't block response)
  setImmediate(async () => {
    try {
      updateRenderJob(jobId, { status: 'processing', progress: 10 });

      // 1. Resolve content to a SessionInput
      let session: SessionInput | null = null;

      if (prompt) {
        // Mode 1: Generate from prompt
        session = generateFromPrompt(prompt, {
          language: language as any,
          secondaryLanguage: secondary_language as any,
          duration: duration as any,
          style: style as any,
          sessionNumber: session_number || 1,
        });
      } else if (content) {
        // Mode 2: Generate from raw content/markdown
        session = generateFromContent(content, {
          language: language as any,
          sessionNumber: session_number || 1,
        });
      } else if (topic && topic !== 'demo') {
        // Mode 3: Load from guru-sishya JSON content
        try {
          const topicData = loadTopicContent(topic);
          session = extractSession(topicData, (session_number || 1) - 1);
        } catch (e) {
          console.warn('Failed to load topic content, using demo:', e);
        }
      }

      if (!session) {
        session = getDemoSession();
      }
      updateRenderJob(jobId, { progress: 20 });

      // 2. Generate script
      const script = generateScript(session, { language });
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
