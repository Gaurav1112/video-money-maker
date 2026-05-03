/**
 * tests/format/longform.test.ts
 *
 * SKIPPED: This test imports `src/story/story-engine` and a longform-builder
 * which were never landed. Tracked in MASTER-GAP-LIST under Tier C — restore
 * once the modules exist.
 *
 * Original intent: assert long-form composition props are 1920x1080 and
 * durationInFrames >= 300 (10s minimum). Re-enable after buildLongformProps()
 * lands in src/compositions/episode1/longform-builder.ts.
 */
import { describe, it } from 'vitest';

describe.skip('long-form composition props (DISABLED — missing modules)', () => {
  it('should validate width=1920, height=1080, durationInFrames>=300', () => {
    // TODO: re-enable after src/story/story-engine and longform-builder land
  });
});
