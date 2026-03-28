import { interpolate, Easing, spring } from 'remotion';

export const fadeIn = (frame: number, startFrame: number, duration = 30) =>
  interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

export const fadeOut = (frame: number, startFrame: number, duration = 30) =>
  interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

export const slideUp = (frame: number, startFrame: number, distance = 100, duration = 45) =>
  interpolate(frame, [startFrame, startFrame + duration], [distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

export const slideIn = (frame: number, startFrame: number, distance = 200, duration = 45) =>
  interpolate(frame, [startFrame, startFrame + duration], [-distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

export const scaleIn = (frame: number, startFrame: number, duration = 30) =>
  interpolate(frame, [startFrame, startFrame + duration], [0.85, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

export const typewriter = (text: string, frame: number, startFrame: number, charsPerFrame = 0.8) => {
  const elapsed = Math.max(0, frame - startFrame);
  const chars = Math.floor(elapsed * charsPerFrame);
  return text.slice(0, chars);
};

export const stagger = (index: number, baseDelay: number, perItemDelay = 10) =>
  baseDelay + index * perItemDelay;

// Spring-based animations for more natural motion
export const springIn = (frame: number, startFrame: number, fps: number = 30) =>
  spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.8 },
  });

export const bounceIn = (frame: number, startFrame: number, fps: number = 30) =>
  spring({
    frame: Math.max(0, frame - startFrame),
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });

export const springScale = (frame: number, startFrame: number, fps: number = 30) =>
  interpolate(
    spring({
      frame: Math.max(0, frame - startFrame),
      fps,
      config: { damping: 10, stiffness: 150, mass: 0.6 },
    }),
    [0, 1],
    [0.7, 1],
  );

export const wiggle = (frame: number, startFrame: number, amplitude = 4, speed = 0.5) => {
  const elapsed = Math.max(0, frame - startFrame);
  const decay = Math.max(0, 1 - elapsed / 30);
  return Math.sin(elapsed * speed) * amplitude * decay;
};
