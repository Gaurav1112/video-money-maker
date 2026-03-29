import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const OUTPUT_DIR = path.resolve(__dirname, '../../../output');

// GET /api/schedule — optimal posting schedule
router.get('/', (_req, res) => {
  // Find all rendered videos
  const rendered: Array<{ topic: string; session: number; path: string }> = [];

  if (fs.existsSync(OUTPUT_DIR)) {
    const dirs = fs.readdirSync(OUTPUT_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'shorts');

    for (const dir of dirs) {
      const topicDir = path.join(OUTPUT_DIR, dir.name);
      const mp4s = fs.readdirSync(topicDir).filter(f => f.endsWith('.mp4'));
      for (const mp4 of mp4s) {
        const match = mp4.match(/s(\d+)\.mp4/);
        if (match) {
          rendered.push({
            topic: dir.name,
            session: parseInt(match[1]),
            path: path.join(topicDir, mp4),
          });
        }
      }
    }
  }

  // Generate optimal schedule
  const schedule: any[] = [];
  const now = new Date();
  let dayOffset = 0;

  // Best posting times (IST)
  const YOUTUBE_TIMES = ['09:00', '14:00']; // Mon/Wed/Fri
  const SHORTS_TIME = '12:00'; // Daily
  const REELS_TIME = '18:00'; // Daily

  for (const video of rendered) {
    const postDate = new Date(now);
    postDate.setDate(postDate.getDate() + dayOffset);
    const dateStr = postDate.toISOString().split('T')[0];

    // YouTube long-form
    schedule.push({
      date: dateStr,
      time: YOUTUBE_TIMES[dayOffset % 2],
      platform: 'youtube',
      type: 'long-form',
      topic: video.topic,
      session: video.session,
      action: `Upload ${video.topic} S${video.session} to YouTube`,
      checklist: [
        'Upload video to YouTube Studio',
        'Set title and description from metadata',
        'Add tags',
        'Set thumbnail',
        'Add end screen (last 20s)',
        'Pin comment from metadata',
        'Post community post',
      ],
    });

    // YouTube Shorts (same day noon)
    schedule.push({
      date: dateStr,
      time: SHORTS_TIME,
      platform: 'youtube',
      type: 'short',
      topic: video.topic,
      session: video.session,
      action: `Upload ${video.topic} Short #1`,
      checklist: [
        'Upload short to YouTube Studio',
        'Set title from shorts metadata',
        'Set description with guru-sishya.in link',
        'Add #shorts tag',
      ],
    });

    // Instagram Reel (same day evening)
    schedule.push({
      date: dateStr,
      time: REELS_TIME,
      platform: 'instagram',
      type: 'reel',
      topic: video.topic,
      session: video.session,
      action: `Upload ${video.topic} Reel #1 to Instagram`,
      checklist: [
        'Upload reel via Instagram app',
        'Copy caption from metadata',
        'Set cover image from cover text',
        'Add to Interview Prep highlight',
        'Update link in bio to guru-sishya.in',
      ],
    });

    dayOffset++;
  }

  res.json({ schedule, totalVideos: rendered.length });
});

export default router;
