/**
 * types.ts — shared prop type for all HookOpener sub-components
 */

export interface HookOpenerProps {
  /** Topic slug or display name, e.g. "Load Balancing" */
  topic: string;
  /** Primary hook text derived from the session content */
  hookText: string;
  /** Current Remotion frame number */
  frame: number;
  /** Video frames-per-second (typically 30) */
  fps: number;
}
