export const VIDEO_FORMATS = {
  long: { width: 1920, height: 1080, aspect: '16:9' as const },
  short: { width: 1080, height: 1920, aspect: '9:16' as const },
  thumb: { width: 1280, height: 720, aspect: '16:9' as const },
} as const;

export const TIMING = {
  fps: 30,
  secondsToFrames: (seconds: number) => Math.round(seconds * 30),
  framesToSeconds: (frames: number) => frames / 30,
} as const;

export const NARRATION_SPEEDS = {
  text: 150,
  code: 130,
  interview: 145,
  diagram: 140,
  normal: 140,
} as const;

export const SCENE_DEFAULTS = {
  titleDuration: 10,
  codeDuration: 15,
  textDuration: 8,
  diagramDuration: 10,
  interviewDuration: 8,
  summaryDuration: 8,
  reviewQuestionDuration: 10,
} as const;

// Shorts/Reels: 50-60% of long-form durations for faster pacing
export const SHORT_SCENE_DEFAULTS = {
  titleDuration: 3,        // was 5
  textDuration: 5,         // was 8-10
  codeDuration: 6,         // was 10
  tableDuration: 4,        // was 6
  interviewDuration: 5,    // was 8
  reviewQuestionDuration: 5, // was 10
  summaryDuration: 4,      // was 8
} as const;

export const MAX_SHORT_DURATION_FRAMES = 1800; // 60 seconds at 30fps
export const MAX_REEL_DURATION_FRAMES = 2700;  // 90 seconds at 30fps

export const INTRO_DURATION = 90; // frames (3 seconds — hook text + voice start)
export const OUTRO_DURATION = 150; // frames (5 seconds)
/** @deprecated Use getTransitionDuration() from video-styles.ts instead. Kept as fallback only. */
export const TRANSITION_DURATION = 15; // frames (0.5 seconds) — replaced by style-driven values
