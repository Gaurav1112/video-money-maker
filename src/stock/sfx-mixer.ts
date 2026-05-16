/**
 * SFX Mixer - generates ffmpeg amix arguments to layer SFX at scene boundaries.
 */

export interface SfxEntry {
  id: string;
  url: string;
  durationSec: number;
}

export interface SceneBoundary {
  sceneIndex: number;
  startSec: number;
}

export interface SfxMixOptions {
  sceneBoundaries: SceneBoundary[];
  sfxClips: SfxEntry[];
  totalDurationSec: number;
}

export interface SfxMixResult {
  filterComplex: string;
  inputArgs: string[];
}

/**
 * Generates ffmpeg amix filter_complex string for layering SFX at scene boundaries.
 * Returns empty strings if no SFX clips available.
 */
export function buildSfxMix(options: SfxMixOptions): SfxMixResult {
  const { sceneBoundaries, sfxClips, totalDurationSec } = options;
  if (!sfxClips.length || !sceneBoundaries.length) {
    return { filterComplex: '', inputArgs: [] };
  }

  const inputArgs: string[] = [];
  const delayFilters: string[] = [];
  const mixInputs: string[] = ['[0:a]'];

  const boundaries = sceneBoundaries.slice(1); // skip first (no SFX at t=0)

  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    const sfx = sfxClips[i % sfxClips.length];
    const delayMs = Math.round(boundary.startSec * 1000);
    const inputIndex = i + 1;

    inputArgs.push('-i', sfx.url);
    delayFilters.push(
      `[${inputIndex}:a]adelay=${delayMs}|${delayMs},apad=whole_dur=${totalDurationSec}[sfx${i}]`
    );
    mixInputs.push(`[sfx${i}]`);
  }

  if (delayFilters.length === 0) {
    return { filterComplex: '', inputArgs: [] };
  }

  const filterComplex = [
    ...delayFilters,
    `${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=2[amixed]`,
  ].join(';');

  return { filterComplex, inputArgs };
}
