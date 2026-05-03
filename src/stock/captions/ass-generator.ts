/**
 * ASS subtitle generator for stock footage captions.
 * Groups word timestamps into 1-3 word chunks (≤30 chars per line).
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

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Inter,80,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,6,2,10,10,480,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const groups = groupWords(wordTimestamps);
  const lines: string[] = [];

  for (const group of groups) {
    const start = group.words[0].startMs + sceneStartMs;
    const end = group.words[group.words.length - 1].endMs + sceneStartMs;
    lines.push(`Dialogue: 0,${msToAss(start)},${msToAss(end)},Default,,0,0,0,,${group.text}`);
  }

  await writeFile(outputPath, header + lines.join('\n') + '\n', 'utf8');
}
