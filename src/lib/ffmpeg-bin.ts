/**
 * Single source of truth for the ffmpeg/ffprobe binaries used by the
 * render pipeline. We use the `ffmpeg-static` and `ffprobe-static` npm
 * packages so the binaries are version-pinned in `package-lock.json`
 * and identical on every CI runner and every dev machine — a
 * non-negotiable for byte-deterministic output (Eng4 Panel-5 P0).
 *
 * Override hierarchy:
 *   1. `FFMPEG_PATH` / `FFPROBE_PATH` env (e.g. CI debugging)
 *   2. `ffmpeg-static` / `ffprobe-static` npm binary (default)
 *   3. system PATH lookup (local sandboxes where postinstall failed)
 */
import ffmpegStatic from 'ffmpeg-static';
// `ffprobe-static` ships untyped; declare a minimal module shape so we
// can import it without pulling @types/ffprobe-static.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - upstream package has no .d.ts
import ffprobeStaticPkg from 'ffprobe-static';

const ffmpegEnv = process.env.FFMPEG_PATH;
const ffprobeEnv = process.env.FFPROBE_PATH;

export const FFMPEG_BIN: string =
  ffmpegEnv && ffmpegEnv.trim().length > 0
    ? ffmpegEnv
    : (ffmpegStatic as string | null) ?? 'ffmpeg';

export const FFPROBE_BIN: string =
  ffprobeEnv && ffprobeEnv.trim().length > 0
    ? ffprobeEnv
    : (ffprobeStaticPkg as { path?: string } | undefined)?.path ?? 'ffprobe';
