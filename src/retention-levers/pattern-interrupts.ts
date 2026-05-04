/**
 * LEVER 3: Pattern Interrupt Generator
 * Creates visual + audio interrupts every 5 seconds
 */

export type InterruptType = 'SFX' | 'graphic' | 'cut' | 'color-flash' | 'text-overlay' | 'zoom';

export interface PatternInterrupt {
  time: number;  // milliseconds
  type: InterruptType;
  duration: number;
  effect: string;
}

export function generatePatternInterrupts(videoDurationMs: number): PatternInterrupt[] {
  const interrupts: PatternInterrupt[] = [];
  const interruptInterval = 5000; // Every 5 seconds

  const sfxSequence: InterruptType[] = ['SFX', 'graphic', 'cut', 'color-flash', 'text-overlay', 'zoom'];
  let typeIndex = 0;

  for (let time = 0; time < videoDurationMs; time += interruptInterval) {
    interrupts.push({
      time,
      type: sfxSequence[typeIndex % sfxSequence.length],
      duration: 300, // 300ms interrupt
      effect: `pattern-interrupt-${typeIndex}`
    });
    typeIndex++;
  }

  return interrupts;
}

export const SFX_LIBRARY = {
  attention: '/audio/sfx/ding-attention.mp3',
  transition: '/audio/sfx/whoosh-transition.mp3',
  reveal: '/audio/sfx/reveal-pop.mp3',
  notification: '/audio/sfx/notification-alert.mp3',
  success: '/audio/sfx/success-chime.mp3',
};

export const GRAPHIC_EFFECTS = {
  textOverlay: { type: 'text', duration: 2000 },
  highlighting: { type: 'highlight', duration: 1500 },
  shapeTransition: { type: 'shape', duration: 800 },
  colorFlash: { type: 'color', duration: 300 },
};
