/**
 * Stock-footage pipeline types.
 *
 * Replaces the empty Remotion render pipeline that produced 70% blank
 * frames. We now download real B-roll from Coverr / Mixkit / Pexels /
 * Pixabay (all royalty-free, commercial-use, no attribution required),
 * cache it on disk, and composite our voice + captions on top via ffmpeg.
 */

export type StockProvider = 'coverr' | 'mixkit' | 'pexels' | 'pixabay' | 'synthetic';

export interface StockClip {
  /** Stable provider-scoped id. */
  id: string;
  provider: StockProvider;
  /** Direct CDN URL of the mp4 we will download. */
  url: string;
  /** Lower-case tag list used by the picker. */
  tags: string[];
  durationSec: number;
  width: number;
  height: number;
  /** Free-form license string (e.g. "CC0", "Coverr License", "Pexels License"). */
  license: string;
  /** Public reference page (for the description-bottom credits block). */
  pageUrl?: string;
  /** Optional credit / author — most providers don't require it but we surface anyway. */
  credit?: string;
}

export interface ClipQuery {
  /** Ordered keywords to search for. Earlier keywords weighted higher. */
  keywords: string[];
  /** Minimum clip duration in seconds (we trim, but never loop awkwardly). */
  minDurationSec: number;
  /** Prefer portrait (true) for Shorts, false for landform. */
  portrait: boolean;
  /** Already-used clip ids — dedup across scenes. */
  excludeIds?: string[];
}

export interface StockSearchProvider {
  readonly name: StockProvider;
  search(query: ClipQuery): Promise<StockClip[]>;
}

export interface PickedClip {
  clip: StockClip;
  score: number;
  /** Which keyword(s) matched, in match order. */
  matchedTags: string[];
}

/** Minimal scene shape used by the stock pipeline (subset of src/types.ts Scene). */
export interface StockScene {
  sceneIndex: number;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  type: string;
  narration: string;
  templateId?: string;
  wordTimestamps?: Array<{ word: string; startMs: number; endMs: number }>;
}

/** Minimal storyboard shape used by the stock pipeline (loadable from any storyboard JSON). */
export interface StockStoryboard {
  fps: number;
  width: number;
  height: number;
  topic: string;
  audioFile?: string;
  durationInFrames: number;
  scenes: StockScene[];
  /**
   * Per-session metadata (Panel-23 user-request: each video should map to
   * a specific guru-sishya.in session of the topic). All fields optional —
   * legacy single-video-per-topic storyboards remain valid.
   *
   * `session` is the 1-based session number (1..10). `siteTopicSlug` and
   * `siteSessionSlug` are the URL slugs used to deep-link to the actual
   * guru-sishya.in lesson page: `/topics/{siteTopicSlug}/sessions/{siteSessionSlug}`.
   * `siteSessionTitle` is the human-readable session title (e.g. "Round
   * Robin & Weighted Round Robin"). `siteSessionFocus` is a one-line gist
   * of what that session covers, used in the description body.
   */
  session?: number;
  totalSessions?: number;
  siteTopicSlug?: string;
  siteSessionSlug?: string;
  siteSessionTitle?: string;
  siteSessionFocus?: string;
}
