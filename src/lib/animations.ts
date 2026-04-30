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

// Zoom into an element (simulates camera movement)
export const zoomIn = (frame: number, startFrame: number, scale: number = 1.2, duration: number = 45) =>
  interpolate(frame, [startFrame, startFrame + duration], [1, scale], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

// Zoom out from an element
export const zoomOut = (frame: number, startFrame: number, scale: number = 1.2, duration: number = 45) =>
  interpolate(frame, [startFrame, startFrame + duration], [scale, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

// Spotlight effect — returns opacity for a dark overlay (dims everything except center)
export const spotlight = (frame: number, startFrame: number, duration: number = 30) => ({
  opacity: interpolate(frame, [startFrame, startFrame + duration], [0, 0.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }),
});

// Ken Burns slow drift — subtle scale + position shift for cinematic feel
export const kenBurns = (frame: number, startFrame: number, duration: number = 300) => {
  const progress = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return {
    scale: 1 + progress * 0.08,
    x: progress * -15,
    y: progress * -8,
  };
};

// Pulse glow effect — oscillates between two opacity values
export const pulseGlow = (frame: number, speed: number = 0.08, min: number = 0.3, max: number = 0.8) =>
  interpolate(Math.sin(frame * speed), [-1, 1], [min, max]);

// Zoom pulse — subtle oscillation 1.0 -> maxScale -> 1.0 with phase offset
export const zoomPulse = (
  frame: number,
  cycleDurationFrames: number = 120,
  maxScale: number = 1.02,
  phaseOffset: number = 0,
) => {
  const progress = ((frame + phaseOffset) % cycleDurationFrames) / cycleDurationFrames;
  const wave = Math.sin(progress * Math.PI * 2);
  return interpolate(wave, [-1, 1], [1.0, maxScale]);
};

// Slide from left with fade — for bullet point entrances
export const slideFromLeft = (frame: number, startFrame: number, distance: number = 40, duration: number = 20) => ({
  x: interpolate(frame, [startFrame, startFrame + duration], [-distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  }),
  opacity: interpolate(frame, [startFrame, startFrame + duration * 0.7], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }),
});

// Sweep underline — grows width from 0 to target with glow
export const sweepUnderline = (frame: number, startFrame: number, maxWidth: number = 300, duration: number = 25) =>
  interpolate(frame, [startFrame, startFrame + duration], [0, maxWidth], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
