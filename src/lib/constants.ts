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
