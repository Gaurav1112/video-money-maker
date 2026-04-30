import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const OUTPUT_DIR = path.resolve(__dirname, '../../../output');

// GET /api/metadata/:topic/:session — full metadata for a rendered video
router.get('/:topic/:session', (req, res) => {
  const { topic, session } = req.params;
  const topicDir = path.join(OUTPUT_DIR, topic);

  // Check for video file
  const videoPath = path.join(topicDir, `s${session}.mp4`);
  const propsPath = path.join(topicDir, `props-s${session}.json`);
  const metadataPath = path.join(topicDir, `metadata-s${session}.json`);

  const result: any = {
    topic,
    session: parseInt(session),
    video: null,
    metadata: null,
    shorts: [],
  };

  // Video info
  if (fs.existsSync(videoPath)) {
    const stats = fs.statSync(videoPath);
    result.video = {
      path: videoPath,
      filename: `s${session}.mp4`,
      size: `${(stats.size / 1024 / 1024).toFixed(1)} MB`,
      sizeBytes: stats.size,
    };
  }

  // Metadata
  if (fs.existsSync(metadataPath)) {
    result.metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  }

  // Props (for storyboard info)
  if (fs.existsSync(propsPath)) {
    try {
      const props = JSON.parse(fs.readFileSync(propsPath, 'utf-8'));
      const sb = props.storyboard;
      if (sb) {
        result.duration = `${Math.round((sb.durationInFrames || 0) / 30)}s`;
        result.scenes = sb.scenes?.length || 0;
      }
    } catch { /* skip */ }
  }

  // Shorts — check per-topic/session first, then global
  const shortsDir = path.join(OUTPUT_DIR, 'shorts');
  const topicShortsDir = path.join(shortsDir, topic);
  const sessionShortsMetadata = path.join(topicShortsDir, `s${session}-shorts.json`);
  const globalShortsMetadata = path.join(shortsDir, 'metadata.json');

  if (fs.existsSync(sessionShortsMetadata)) {
    try {
      const shortsData = JSON.parse(fs.readFileSync(sessionShortsMetadata, 'utf-8'));
      result.shorts = shortsData;
      result.shortsGenerated = true;
    } catch { /* skip */ }
  } else if (fs.existsSync(globalShortsMetadata)) {
    try {
      const allShorts = JSON.parse(fs.readFileSync(globalShortsMetadata, 'utf-8'));
      // Filter to this topic/session if the global file has structured data
      if (Array.isArray(allShorts)) {
        result.shorts = allShorts.filter((s: any) => s.topic === topic && s.session === parseInt(session));
      } else {
        result.shorts = allShorts;
      }
      result.shortsGenerated = (result.shorts?.clips?.length > 0) || (Array.isArray(result.shorts) && result.shorts.length > 0);
    } catch { /* skip */ }
  } else {
    result.shortsGenerated = false;
  }

  // Also check for short clip video files
  if (fs.existsSync(topicShortsDir)) {
    const clipFiles = fs.readdirSync(topicShortsDir).filter(f => f.startsWith(`s${session}-short-`) && f.endsWith('.mp4'));
    result.shortsClipCount = clipFiles.length;
  }

  res.json(result);
});

export default router;
