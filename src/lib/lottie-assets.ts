export interface LottieAsset {
  id: string;
  file: string;
  category: 'status' | 'action' | 'data' | 'ui';
  durationSec: number;
}

/**
 * Registry of pre-downloaded Lottie JSON files in public/lottie/.
 * Download these from LottieFiles (verify free commercial license per file).
 */
export const LOTTIE_ASSETS: LottieAsset[] = [
  { id: 'loading-spinner', file: 'lottie/loading-spinner.json', category: 'status', durationSec: 2 },
  { id: 'success-check', file: 'lottie/success-check.json', category: 'status', durationSec: 1.5 },
  { id: 'error-alert', file: 'lottie/error-alert.json', category: 'status', durationSec: 1 },
  { id: 'warning-triangle', file: 'lottie/warning-triangle.json', category: 'status', durationSec: 1.5 },
  { id: 'data-flow', file: 'lottie/data-flow.json', category: 'data', durationSec: 3 },
  { id: 'server-pulse', file: 'lottie/server-pulse.json', category: 'action', durationSec: 2 },
  { id: 'database-write', file: 'lottie/database-write.json', category: 'action', durationSec: 2 },
  { id: 'lock-unlock', file: 'lottie/lock-unlock.json', category: 'action', durationSec: 1.5 },
  { id: 'rocket-launch', file: 'lottie/rocket-launch.json', category: 'action', durationSec: 2 },
  { id: 'fire', file: 'lottie/fire.json', category: 'ui', durationSec: 2 },
  { id: 'confetti', file: 'lottie/confetti.json', category: 'ui', durationSec: 2 },
  { id: 'typing-cursor', file: 'lottie/typing-cursor.json', category: 'ui', durationSec: 1 },
  { id: 'search-magnify', file: 'lottie/search-magnify.json', category: 'ui', durationSec: 1.5 },
  { id: 'refresh-cycle', file: 'lottie/refresh-cycle.json', category: 'ui', durationSec: 1.5 },
  { id: 'network-ping', file: 'lottie/network-ping.json', category: 'action', durationSec: 2 },
];

export function getLottieAsset(id: string): LottieAsset | null {
  return LOTTIE_ASSETS.find(a => a.id === id) || null;
}

export function getLottieByCategory(category: LottieAsset['category']): LottieAsset[] {
  return LOTTIE_ASSETS.filter(a => a.category === category);
}
