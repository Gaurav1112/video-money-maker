import React from 'react';
import { Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import { SyncTimeline } from '../lib/sync-engine';

/**
 * Available BGM tracks — soothing, warm ambient pads at 192kbps, 3-minute loops.
 * Designed to be barely audible — study music that never distracts.
 */
export const BGM_TRACKS = [
  { file: 'audio/bgm/warm-ambient.mp3', mood: 'warm' as const, label: 'Warm Ambient' },
  { file: 'audio/bgm/gentle-drone.mp3', mood: 'gentle' as const, label: 'Gentle Drone' },
  { file: 'audio/bgm/study-pad.mp3', mood: 'study' as const, label: 'Study Pad' },
] as const;

export type BgmMood = (typeof BGM_TRACKS)[number]['mood'];

/** Pick a BGM track deterministically from a string seed. */
export function pickBgmTrack(seed: string): string {
  const hash = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return BGM_TRACKS[hash % BGM_TRACKS.length].file;
}

/** Number of frames for smooth ducking transitions */
const DUCK_TRANSITION_FRAMES = 15;

interface BgmLayerProps {
  syncTimeline: SyncTimeline;
  /** Path to BGM file relative to public/ (e.g. 'audio/bgm/warm-ambient.mp3') */
  bgmFile?: string;
  /** Alternative: pick by mood instead of explicit file */
  mood?: BgmMood;
  /** Volume during narration (default 0.04 — barely a whisper beneath speech) */
  duckVolume?: number;
  /** Volume when no narration (default 0.10 — subtle ambient fill) */
  baseVolume?: number;
  /** Array of BGM track paths for rotation (relative to public/) */
  tracks?: string[];
  /** Seconds between track changes (default 120) */
  trackChangeInterval?: number;
}

export const BgmLayer: React.FC<BgmLayerProps> = (props) => {
  const {
    syncTimeline,
    bgmFile,
    mood,
    duckVolume = 0.04,
    baseVolume = 0.10,
  } = props;
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // Resolve which file to play
  const resolvedFile = React.useMemo(() => {
    if (bgmFile) return bgmFile;
    if (mood) {
      const track = BGM_TRACKS.find((t) => t.mood === mood);
      return track ? track.file : BGM_TRACKS[0].file;
    }
    // Default to warm ambient
    return BGM_TRACKS[0].file;
  }, [bgmFile, mood]);

  const trackChangeInterval = props.trackChangeInterval ?? 120;
  const trackList = props.tracks ?? [resolvedFile];

  // Pre-compute which track plays at which frame range
  const segments = React.useMemo(() => {
    if (trackList.length <= 1) return null; // single track — use existing loop behavior

    const intervalFrames = trackChangeInterval * fps;
    const crossfadeFrames = 3 * fps; // 3s crossfade
    const segs: Array<{ trackFile: string; startFrame: number; endFrame: number }> = [];
    let f = 0;
    let trackIdx = 0;

    while (f < durationInFrames) {
      segs.push({
        trackFile: trackList[trackIdx % trackList.length],
        startFrame: f,
        endFrame: Math.min(f + intervalFrames + crossfadeFrames, durationInFrames),
      });
      f += intervalFrames;
      trackIdx++;
    }
    return segs;
  }, [trackList, trackChangeInterval, fps, durationInFrames]);

  // Pre-compute narration state for smooth ducking transitions
  const duckingVolumes = React.useMemo(() => {
    const volumes = new Float32Array(durationInFrames);
    for (let f = 0; f < durationInFrames; f++) {
      volumes[f] = syncTimeline.isFrameInNarration(f) ? duckVolume : baseVolume;
    }
    // Smooth transitions over DUCK_TRANSITION_FRAMES
    const smoothed = new Float32Array(volumes);
    for (let f = 1; f < durationInFrames; f++) {
      if (Math.abs(volumes[f] - volumes[f - 1]) > 0.001) {
        // Transition detected — smooth over next DUCK_TRANSITION_FRAMES
        const startVol = smoothed[f - 1];
        const endVol = volumes[f];
        for (let t = 0; t < DUCK_TRANSITION_FRAMES && f + t < durationInFrames; t++) {
          const progress = (t + 1) / DUCK_TRANSITION_FRAMES;
          // Ease in-out for natural feel
          const eased = progress * progress * (3 - 2 * progress);
          smoothed[f + t] = startVol + (endVol - startVol) * eased;
        }
        f += DUCK_TRANSITION_FRAMES - 1;
      }
    }
    return smoothed;
  }, [syncTimeline, durationInFrames, duckVolume, baseVolume]);

  const fadeInFrames = Math.round(fps * 3); // 3 second fade-in
  const fadeOutFrames = Math.round(fps * 4); // 4 second fade-out

  const volume = React.useCallback(
    (f: number) => {
      // Fade in over first 3 seconds
      const fadeIn = interpolate(f, [0, fadeInFrames], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

      // Fade out over last 4 seconds
      const fadeOut = interpolate(
        f,
        [durationInFrames - fadeOutFrames, durationInFrames],
        [1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
      );

      // Smoothly ducked volume from pre-computed array
      const ducked = f < duckingVolumes.length ? duckingVolumes[f] : duckVolume;

      return fadeIn * fadeOut * ducked;
    },
    [durationInFrames, fadeInFrames, fadeOutFrames, duckingVolumes, duckVolume],
  );

  // Multi-track crossfade rendering
  if (segments && segments.length > 1) {
    const crossfadeFrames = 3 * fps;
    return (
      <>
        {segments.map((seg, i) => (
          <Sequence key={`bgm-${i}`} from={seg.startFrame} durationInFrames={seg.endFrame - seg.startFrame}>
            <Audio
              src={staticFile(seg.trackFile)}
              volume={(f) => {
                const localFrame = f;
                const segDuration = seg.endFrame - seg.startFrame;
                // Fade in over crossfade period
                const fadeIn = interpolate(localFrame, [0, crossfadeFrames], [0, 1], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                });
                // Fade out over crossfade period at end
                const fadeOut = interpolate(localFrame, [segDuration - crossfadeFrames, segDuration], [1, 0], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                });
                // Ducking from pre-computed array
                const absFrame = seg.startFrame + localFrame;
                const ducked = absFrame < duckingVolumes.length ? duckingVolumes[absFrame] : duckVolume;
                return fadeIn * fadeOut * ducked;
              }}
            />
          </Sequence>
        ))}
      </>
    );
  }

  // Single-track fallback (loop)
  return (
    <Audio
      src={staticFile(resolvedFile)}
      volume={volume}
      loop
    />
  );
};
