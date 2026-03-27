export type SceneType = 'title' | 'text' | 'code' | 'diagram' | 'table' | 'interview' | 'review' | 'summary';
export type VideoFormat = 'long' | 'short' | 'thumb';

export interface Scene {
  type: SceneType;
  content: string;
  narration: string;
  duration: number;
  startFrame: number;
  endFrame: number;
  language?: string;
  highlightLines?: number[];
  bullets?: string[];
  heading?: string;
}

export interface Storyboard {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  scenes: Scene[];
  audioFile: string;
  topic: string;
  sessionNumber: number;
}

export interface SessionInput {
  topic: string;
  sessionNumber: number;
  title: string;
  content: string;
  objectives: string[];
  reviewQuestions: string[];
}

export interface TTSResult {
  audioPath: string;
  wordTimestamps: Array<{ word: string; start: number; end: number }>;
  duration: number;
}

export interface RenderJob {
  id: string;
  storyboard: Storyboard;
  format: VideoFormat;
  status: 'queued' | 'rendering' | 'complete' | 'error';
  progress: number;
  outputPath?: string;
  error?: string;
}
