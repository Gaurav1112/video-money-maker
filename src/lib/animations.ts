import { interpolate, Easing } from 'remotion';

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
