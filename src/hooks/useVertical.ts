import { useVideoConfig } from 'remotion';
import { VERTICAL, SAFE_ZONE, VERTICAL_SIZES, CODE_LIMITS, COMPONENT_DIMS, REGIONS } from '../lib/vertical-layouts';

export interface VerticalState {
  isVertical: boolean;
  width: number;
  height: number;
  safeZone: typeof SAFE_ZONE;
  sizes: typeof VERTICAL_SIZES;
  codeLimits: typeof CODE_LIMITS;
  regions: typeof REGIONS;
  dims: typeof COMPONENT_DIMS;
}

/**
 * Hook that detects if the current composition is vertical (9:16)
 * and provides layout constants for component adaptation.
 *
 * Usage in any component:
 *   const { isVertical, sizes, dims } = useVertical();
 *   const fontSize = isVertical ? sizes.heading1 : SIZES.heading1;
 */
export function useVertical(): VerticalState {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;

  return {
    isVertical,
    width,
    height,
    safeZone: SAFE_ZONE,
    sizes: VERTICAL_SIZES,
    codeLimits: CODE_LIMITS,
    regions: REGIONS,
    dims: COMPONENT_DIMS,
  };
}
