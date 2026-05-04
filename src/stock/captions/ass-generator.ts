/**
 * ASS subtitle generator for stock footage captions.
 *
 * Renders narration as karaoke-style chunks of 1-3 words (≤30 chars per
 * line) with the actively-spoken word highlighted in yellow. The visual
 * cadence — word turning bright at the exact moment the voice-over hits
 * it — is the single highest-leverage retention lever per the Ret panel.
 *
 * Karaoke implementation:
 *   • PrimaryColour  = highlighted/sung   (bright yellow #FFFF00)
 *   • SecondaryColour = unsung / pre-cursor (white)
 *   • Each Dialogue line uses {\kf<centisec>}word per word; libass
 *     transitions the fill from SecondaryColour → PrimaryColour over
 *     the karaoke duration.
 *
 * Fonts:
 *   We use "DejaVu Sans" — preinstalled on ubuntu-latest GHA runners,
 *   macOS via Homebrew, and most Linux distros. Inter (used previously)
 *   is NOT on stock runners; libass silently degrades to Sans, which
 *   ships an unpredictable system fallback.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface WordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
}

export interface AssGeneratorOptions {
  narration: string;
  wordTimestamps: WordTimestamp[];
  outputPath: string;
  sceneStartMs?: number;
}

function msToAss(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const centisec = Math.floor((ms % 1000) / 10);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(centisec).padStart(2, '0')}`;
}

/** Escape a word for safe inclusion inside an ASS Dialogue Text field. */
function escapeAssText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}');
}

// Panel-17 Retention P1 (Robbins): pure char-count + word-count
// grouping breaks mid-clause after connector words ("is/a/the/ka/ki
// /ko/se/ne") which read as broken-English on a karaoke caption.
// We never end a group on one of these connectors — defer the break
// to the next word so phrase-level integrity is preserved.
const CONNECTOR_STOP_LIST = new Set<string>([
  // English articles / linking verbs / prepositions
  'is', 'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for',
  'and', 'or', 'but', 'with', 'as', 'so',
  // Hindi/Hinglish post-positions + common connectors that break
  // sentences mid-clause when broken on the wrong side
  'ka', 'ki', 'ko', 'se', 'ne', 'me', 'mein', 'par', 'bhi', 'hi',
  'aur', 'ya', 'jo', 'ke', 'tak', 'tha', 'thi', 'hai', 'hain', 'ho',
]);

function isConnector(word: string): boolean {
  return CONNECTOR_STOP_LIST.has(word.toLowerCase().replace(/[^a-z]/gi, ''));
}

function groupWords(words: WordTimestamp[]): Array<{ words: WordTimestamp[]; text: string }> {
  const groups: Array<{ words: WordTimestamp[]; text: string }> = [];
  let current: WordTimestamp[] = [];
  let currentText = '';

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const newText = currentText ? `${currentText} ${w.word}` : w.word;
    const wantBreak = current.length >= 3 || newText.length > 30;

    // Panel-17 Retention P1 (Robbins): if the *current* group ends on
    // a connector ("is", "a", "ka", "ki", ...), defer the break so the
    // connector groups with what follows it instead of dangling at
    // the end of a karaoke line. Also: never start a new group on a
    // connector — pull the connector into the previous group.
    const lastWord = current.length > 0 ? current[current.length - 1].word : '';
    const breakWouldDangle = wantBreak && current.length > 0 && isConnector(lastWord);

    if (wantBreak && !breakWouldDangle) {
      if (current.length > 0) {
        groups.push({ words: current, text: currentText });
      }
      current = [w];
      currentText = w.word;
    } else {
      current.push(w);
      currentText = newText;
    }
  }
  if (current.length > 0) {
    groups.push({ words: current, text: currentText });
  }
  return groups;
}

export async function generateAssSubtitles(options: AssGeneratorOptions): Promise<void> {
  const { wordTimestamps, outputPath, sceneStartMs = 0 } = options;

  await mkdir(dirname(outputPath), { recursive: true });

  // PrimaryColour   = &H0000FFFF (BGR for #FFFF00, bright yellow — highlighted/sung)
  // SecondaryColour = &H00FFFFFF (white — pre-cursor/inactive)
  // OutlineColour   = &H00000000 (black — strong outline for legibility on B-roll)
  // BackColour      = &H80000000 (50% black drop shadow)
  // Panel-10 Ret P1 (Linus): Fontsize=80 = 4.2% of PlayResY=1920 — below
  // the mobile-shorts legibility sweet spot (5-6%). Bumped to 96 (5.0%)
  // — large enough that captions read at arm's-length on a 6" phone
  // without crowding the 480-pixel margin-V band.
  // Panel-14 Ret P1 (Linus): MarginV 480 → 560 to deconflict the
  // karaoke band from composer.ts's captionText/endCardText drawtext
  // overlays. The 80px lift puts the active-word strip above the
  // bigText shelf, eliminating the visual collision when both fire
  // on the same scene.
  // Panel-15 Ret P1 (Linus): MarginV 560 → 600. With fontsize=96 the
  // glyph cap-height is ~80px, so MarginV=560 leaves only ~20px gap
  // above the drawtext shelf at y=h-text_h-580. Bumping to 600 lifts
  // the karaoke baseline to PlayResY-600=1320, glyph top ~1240 — a
  // clean ~60px gap above the shelf for visual breathing room without
  // pushing captions into the bigText hook band (top of bigText sits
  // around y=420).
  // Panel-18 Eng P0 (Torvalds/Hejlsberg): the comment block above used
  // to live INSIDE the template literal and shipped verbatim into every
  // rendered .ass file as 16 stray lines between Format: and Style:.
  // libass tolerates them but it was build-artifact pollution and made
  // the test `expect(content).toContain('480')` pass for the wrong
  // reason (the stale "480-pixel margin-V band" comment text rather
  // than the actual MarginV field, which is 600). Comments are now
  // outside the template; tests assert the field directly.
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,96,&H0000FFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,6,2,10,10,600,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const groups = groupWords(wordTimestamps);
  const lines: string[] = [];

  for (const group of groups) {
    const groupStart = group.words[0]!.startMs + sceneStartMs;
    const groupEnd = group.words[group.words.length - 1]!.endMs + sceneStartMs;

    // Build per-word karaoke run. {\kf<cs>} fills the next token from
    // SecondaryColour to PrimaryColour over <cs> centiseconds; if the
    // first word does not start at groupStart, prepend an unspoken
    // delay so the highlight aligns with the actual voice cursor.
    const parts: string[] = [];
    let cursorMs = group.words[0]!.startMs;
    for (let i = 0; i < group.words.length; i++) {
      const w = group.words[i]!;
      // Gap between previous word's end and this word's start (silence
      // inside the chunk) — render as a `{\k<cs>}` no-op so timing
      // stays in lockstep with audio, then the colored fill {\kf}
      // covers the spoken duration of this word.
      const gapMs = Math.max(0, w.startMs - cursorMs);
      const wordDurMs = Math.max(1, w.endMs - w.startMs);
      const gapCs = Math.round(gapMs / 10);
      const wordCs = Math.max(1, Math.round(wordDurMs / 10));
      if (gapCs > 0) parts.push(`{\\k${gapCs}}`);
      const sep = i < group.words.length - 1 ? ' ' : '';
      parts.push(`{\\kf${wordCs}}${escapeAssText(w.word)}${sep}`);
      cursorMs = w.endMs;
    }
    const text = parts.join('');

    lines.push(`Dialogue: 0,${msToAss(groupStart)},${msToAss(groupEnd)},Default,,0,0,0,,${text}`);
  }

  await writeFile(outputPath, header + lines.join('\n') + '\n', 'utf8');
}
