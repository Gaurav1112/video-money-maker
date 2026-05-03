/**
 * script-generator.ts PATCH — Fix #26
 *
 * Adds retention beat injection into the script generation pass.
 *
 * HOW TO APPLY:
 *   1. In `src/pipeline/script-generator.ts`, find the function that returns
 *      the final Scene[] array (typically `generateScript` or `buildScript`).
 *   2. Import `insertRetentionBeats` from `../lib/retention-engine`.
 *   3. Convert your Scene[] to ScriptSegment[] format (see adapter below).
 *   4. Call `insertRetentionBeats(segments, topic)` to get enriched segments.
 *   5. Convert back to Scene[] and return.
 *
 * This patch file shows the exact diff to apply. It is a drop-in patch — do
 * not modify the existing scene generation logic, only add the retention pass
 * at the end of the function.
 *
 * DETERMINISTIC: insertRetentionBeats is a pure function. Same script → same
 * output every time. No randomness introduced.
 */

// ─── DIFF: Add to top of script-generator.ts ──────────────────────────────────

// + import {
// +   insertRetentionBeats,
// +   formatBeatSchedule,
// +   type ScriptSegment,
// + } from '../lib/retention-engine';

// ─── DIFF: Add adapter utilities (once, at module scope) ──────────────────────

// /**
//  * Converts the pipeline's Scene type to the ScriptSegment type expected by
//  * the retention engine.
//  *
//  * This mapping is conservative: it marks 'diagram' and 'code' scenes as
//  * hard-concept segments, and maps the pipeline's CTA scene type correctly.
//  */
// function sceneToSegment(scene: Scene, index: number, totalScenes: number): ScriptSegment {
//   // Compute approximate timestamps from scene position in array
//   // (If your pipeline already has timestamps, use those directly.)
//   const avgSceneDuration = 30; // seconds — adjust per your scene durations
//   const startSeconds = index * avgSceneDuration;
//   const endSeconds = startSeconds + avgSceneDuration;
//
//   const typeMap: Record<string, ScriptSegment['type']> = {
//     title:     'hook',
//     text:      'content',
//     code:      'code',
//     diagram:   'content',
//     table:     'content',
//     interview: 'content',
//     review:    'review',
//     summary:   'summary',
//     cta:       'cta',
//   };
//
//   return {
//     id: `scene_${index}_${scene.type}`,
//     type: typeMap[scene.type] ?? 'content',
//     startSeconds,
//     endSeconds,
//     text: scene.heading ?? scene.narration ?? '',
//     isHardConcept: scene.type === 'diagram' || scene.type === 'code',
//   };
// }
//
// /**
//  * Converts a RetentionBeat back to a Scene that the pipeline can render.
//  * The pipeline renders these as 'text' scenes with the retention beat text.
//  */
// function beatToScene(beat: ScriptSegment): Scene {
//   return {
//     type: 'text',
//     heading: '',
//     narration: beat.text,
//     // Tag the scene so the Remotion composition can apply the right visual treatment
//     metadata: {
//       retentionBeat: true,
//       beatType: beat.conceptLabel,
//     },
//   } as Scene;
// }

// ─── DIFF: Replace return statement at end of generateScript() ────────────────
//
// BEFORE:
//   return scenes;
//
// AFTER:
//   return injectRetentionBeats(scenes, sessionInput.topic);
//

// /**
//  * Retention pass — wraps the existing scene array.
//  * Call this instead of `return scenes` at the end of generateScript().
//  */
// function injectRetentionBeats(scenes: Scene[], topic: string): Scene[] {
//   // Convert to ScriptSegment[]
//   const segments = scenes.map((scene, i) =>
//     sceneToSegment(scene, i, scenes.length)
//   );
//
//   // Run the retention engine
//   const output = insertRetentionBeats(segments, topic);
//
//   // Log the beat schedule (visible in GHA logs)
//   console.log('\n' + formatBeatSchedule(output) + '\n');
//
//   // Warn if open loops are unbalanced
//   if (output.openLoopBalance.opened > output.openLoopBalance.closed) {
//     console.warn(
//       `[retention-engine] Warning: ${output.openLoopBalance.opened} open loops opened, ` +
//       `${output.openLoopBalance.closed} closed. Karen X. Cheng: unclosed loops = viewer feels cheated.`
//     );
//   }
//
//   // Convert back to Scene[] — retention beats are inserted as text scenes
//   const enrichedScenes: Scene[] = [];
//   for (const seg of output.segments) {
//     if (seg.type === 'retention_beat') {
//       enrichedScenes.push(beatToScene(seg));
//     } else {
//       // Re-map back to original scene by ID (index-based)
//       const originalIndex = parseInt(seg.id.split('_')[1], 10);
//       if (!isNaN(originalIndex) && scenes[originalIndex]) {
//         enrichedScenes.push(scenes[originalIndex]);
//       }
//     }
//   }
//
//   return enrichedScenes;
// }

// ─── TypeScript-compilable adapter (for testing) ──────────────────────────────

import {
  insertRetentionBeats,
  formatBeatSchedule,
  type ScriptSegment,
  type RetentionEngineOutput,
} from '../lib/retention-engine';

/** Minimal Scene interface matching the pipeline's type */
export interface SceneLike {
  type: string;
  heading?: string;
  narration?: string;
  isHardConcept?: boolean;
  metadata?: Record<string, unknown>;
}

export function sceneToSegment(
  scene: SceneLike,
  index: number,
  avgSceneDurationSeconds = 30,
): ScriptSegment {
  const typeMap: Record<string, ScriptSegment['type']> = {
    title: 'hook',
    text: 'content',
    code: 'code',
    diagram: 'content',
    table: 'content',
    interview: 'content',
    review: 'review',
    summary: 'summary',
    cta: 'cta',
    retention_beat: 'retention_beat',
  };

  const startSeconds = index * avgSceneDurationSeconds;
  const endSeconds = startSeconds + avgSceneDurationSeconds;

  return {
    id: `scene_${index}_${scene.type}`,
    type: typeMap[scene.type] ?? 'content',
    startSeconds,
    endSeconds,
    text: scene.heading ?? scene.narration ?? '',
    isHardConcept:
      scene.isHardConcept === true ||
      scene.type === 'diagram' ||
      scene.type === 'code',
  };
}

export function segmentToScene(seg: ScriptSegment): SceneLike {
  return {
    type: 'text',
    heading: '',
    narration: seg.text,
    metadata: {
      retentionBeat: true,
      beatType: seg.conceptLabel,
    },
  };
}

/**
 * Main injection function — call at the end of generateScript().
 *
 * @param scenes  The Scene[] array produced by the existing pipeline
 * @param topic   The topic string (e.g. "Apache Kafka", "API Gateway")
 * @param avgSceneDurationSeconds  Average scene duration for timestamp estimation
 * @returns       Enriched Scene[] with retention beats woven in
 */
export function injectRetentionBeatsIntoScript(
  scenes: SceneLike[],
  topic: string,
  avgSceneDurationSeconds = 30,
): SceneLike[] {
  const segments = scenes.map((s, i) =>
    sceneToSegment(s, i, avgSceneDurationSeconds),
  );

  const output: RetentionEngineOutput = insertRetentionBeats(segments, topic);

  // Log beat schedule to console (visible in GHA)
  console.log('\n' + formatBeatSchedule(output) + '\n');

  if (output.openLoopBalance.opened > output.openLoopBalance.closed) {
    console.warn(
      `[retention-engine] ⚠️ ${output.openLoopBalance.opened} open loops opened, ` +
        `${output.openLoopBalance.closed} closed. ` +
        `Karen X. Cheng: unclosed loops = viewer feels cheated.`,
    );
  }

  // Reconstruct scene array from sorted segments
  const enriched: SceneLike[] = [];
  for (const seg of output.segments) {
    if (seg.type === 'retention_beat') {
      enriched.push(segmentToScene(seg));
    } else {
      const originalIndex = parseInt(seg.id.split('_')[1], 10);
      if (!isNaN(originalIndex) && scenes[originalIndex]) {
        enriched.push(scenes[originalIndex]);
      }
    }
  }

  return enriched;
}
