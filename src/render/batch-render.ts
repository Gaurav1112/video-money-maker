import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { Storyboard, VideoFormat } from '../types';

const execFileAsync = promisify(execFile);
const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';

interface RenderOptions {
  concurrency?: number;
  crf?: number;
  codec?: string;
}

export async function renderVideo(
  storyboard: Storyboard,
  format: VideoFormat,
  options: RenderOptions = {}
): Promise<string> {
  const { concurrency = 2, crf = 18, codec = 'h264' } = options;

  const compositionId = format === 'short' ? 'ShortVideo' : format === 'thumb' ? 'Thumbnail' : 'LongVideo';
  const dimensions = getDimensions(format);
  const safeTopic = storyboard.topic.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const outputDir = path.join(OUTPUT_DIR, safeTopic);
  fs.mkdirSync(outputDir, { recursive: true });

  const extension = format === 'thumb' ? 'png' : 'mp4';
  const outputPath = path.join(
    outputDir,
    `${safeTopic}-s${storyboard.sessionNumber}-${format}.${extension}`
  );

  // Write storyboard to temp file for Remotion to read
  const propsPath = path.join(outputDir, `${format}-props.json`);
  fs.writeFileSync(propsPath, JSON.stringify({ storyboard }));

  try {
    if (format === 'thumb') {
      const args = [
        'remotion', 'still',
        'src/compositions/index.tsx',
        compositionId,
        outputPath,
        `--props=${propsPath}`,
        `--width=${dimensions.width}`,
        `--height=${dimensions.height}`,
      ];

      console.log(`Rendering thumbnail: ${outputPath}`);
      await execFileAsync('npx', args, { cwd: process.cwd(), timeout: 120000 });
    } else {
      const args = [
        'remotion', 'render',
        'src/compositions/index.tsx',
        compositionId,
        outputPath,
        `--props=${propsPath}`,
        `--width=${dimensions.width}`,
        `--height=${dimensions.height}`,
        `--fps=${storyboard.fps}`,
        `--codec=${codec}`,
        `--crf=${crf}`,
        `--concurrency=${concurrency}`,
        '--log=warn',
      ];

      console.log(`Rendering ${format} video: ${outputPath}`);
      await execFileAsync('npx', args, { cwd: process.cwd(), timeout: 600000 }); // 10 min timeout
    }
  } finally {
    if (fs.existsSync(propsPath)) {
      fs.unlinkSync(propsPath);
    }
  }

  return outputPath;
}

export async function renderAllFormats(
  storyboard: Storyboard,
  options: RenderOptions = {}
): Promise<{ long: string; short: string; thumb: string }> {
  console.log(`\nRendering all formats for: ${storyboard.topic} Session ${storyboard.sessionNumber}`);
  console.log(`Total frames: ${storyboard.durationInFrames} (${(storyboard.durationInFrames / storyboard.fps).toFixed(1)}s)`);

  // Render sequentially to avoid overloading the machine
  const long = await renderVideo(storyboard, 'long', options);
  const short = await renderVideo(storyboard, 'short', options);
  const thumb = await renderVideo(storyboard, 'thumb', options);

  console.log('\nRender complete:');
  console.log(`  Long:  ${long}`);
  console.log(`  Short: ${short}`);
  console.log(`  Thumb: ${thumb}`);

  return { long, short, thumb };
}

function getDimensions(format: VideoFormat): { width: number; height: number } {
  switch (format) {
    case 'long': return { width: 1920, height: 1080 };
    case 'short': return { width: 1080, height: 1920 };
    case 'thumb': return { width: 1280, height: 720 };
  }
}

export function estimateRenderTime(storyboard: Storyboard): {
  perFormat: number;
  total: number;
  formatted: string;
} {
  const videoSeconds = storyboard.durationInFrames / storyboard.fps;
  const perFormat = videoSeconds * 10;
  const total = perFormat * 3;
  const minutes = Math.ceil(total / 60);

  return {
    perFormat,
    total,
    formatted: `~${minutes} minutes for all 3 formats`,
  };
}
