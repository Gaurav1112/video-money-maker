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

function groupWords(words: WordTimestamp[]): Array<{ words: WordTimestamp[]; text: string }> {
  const groups: Array<{ words: WordTimestamp[]; text: string }> = [];
  let current: WordTimestamp[] = [];
  let currentText = '';

  for (const w of words) {
    const newText = currentText ? `${currentText} ${w.word}` : w.word;
    if (current.length >= 3 || newText.length > 30) {
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
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,80,&H0000FFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,6,2,10,10,480,1

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
