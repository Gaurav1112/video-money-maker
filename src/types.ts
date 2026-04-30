export type SceneType = 'title' | 'text' | 'code' | 'diagram' | 'table' | 'interview' | 'review' | 'summary';
export type VideoFormat = 'long' | 'short' | 'thumb' | 'vertical';

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
  audioFile?: string;
  wordTimestamps?: WordTimestamp[];
  animationCues?: AnimationCue[];
  sfxTriggers?: SfxTrigger[];
  /** Per-scene visualization variant — drives unique animation states per scene */
  vizVariant?: string;
  /** Visual beats computed from narration — each beat = one sentence = one visual element */
  visualBeats?: VisualBeat[];
  /** Quiz options for review scenes (correct answer + 3 distractors) */
  quizOptions?: string[];
  /** Visual template ID selected by VisualMapper */
  templateId?: string;
  /** Template variant selected by content keywords */
  templateVariant?: string;
  /** Pre-rendered D2 SVG string (generated during storyboard phase, rendered in browser) */
  d2Svg?: string;
  /**
   * Offset (in seconds) where this scene's audio begins in the master audio track.
   * Used by CaptionOverlay to sync subtitles to the actual audio position rather than
   * the visual scene startFrame (which includes breathing room + transition padding).
   * -1 means no audio for this scene.
   */
  audioOffsetSeconds?: number;
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
  /** Optional background music file path (relative to public/) */
  bgmFile?: string;
  /** Next topic name for end-of-session teaser */
  nextTopic?: string;
  sceneOffsets?: number[];
  allSfxTriggers?: SfxTrigger[];
  /** Rhubarb lip sync mouth cues for avatar animation */
  mouthCues?: Array<{ start: number; end: number; value: string }>;
  /** Total sessions in the topic (for series progress display) */
  totalSessions?: number;
  /** Part metadata — set by createPartStoryboard for multi-part renders */
  partHookText?: string;
  partCtaText?: string;
  partNumber?: number;
  totalParts?: number;
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

export interface WordTimestamp {
  word: string;
  start: number;  // seconds relative to scene audio start
  end: number;    // seconds relative to scene audio start
}

export interface AnimationCue {
  wordIndex: number;
  action: string;
  target?: string | number;
}

export interface SfxTrigger {
  sceneIndex: number;
  wordIndex: number;
  effect: string;
  volume?: number;
}

export interface SyncState {
  currentWord: string;
  wordIndex: number;
  sceneProgress: number;
  phraseBoundaries: number[];
  isNarrating: boolean;
  wordsSpoken: number;
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

export interface VisualBeat {
  startTime: number;
  endTime: number;
  text: string;
  beatIndex: number;
  totalBeats: number;
  keywords: string[];
}
