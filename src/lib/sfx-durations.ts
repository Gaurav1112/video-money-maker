/** Duration in frames (at 30fps) for each SFX file */
export const SFX_DURATIONS: Record<string, number> = {
  'whoosh-in': 12,      // 0.4s
  'whoosh-out': 9,      // 0.3s
  'swoosh': 9,          // 0.3s
  'pop': 6,             // 0.2s
  'click': 3,           // 0.1s
  'soft-tap': 5,        // 0.15s
  'keyboard-click': 5,  // 0.15s
  'keyboard-burst': 15, // 0.5s
  'ding': 15,           // 0.5s
  'chime': 24,          // 0.8s
  'shimmer': 18,        // 0.6s
  'success-chime': 36,  // 1.2s
  'level-up': 45,       // 1.5s
  'subtle-pulse': 12,   // 0.4s
  'tension-build': 30,  // 1.0s
};

export function sfxDuration(effect: string): number {
  return SFX_DURATIONS[effect] || 15; // default 0.5s
}
