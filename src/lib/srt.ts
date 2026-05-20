export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface SrtOptions {
  wordsPerCue?: number;
}

function fmtTime(t: number): string {
  const ms = Math.round(t * 1000);
  const hh = String(Math.floor(ms / 3_600_000)).padStart(2, '0');
  const mm = String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0');
  const mmm = String(ms % 1000).padStart(3, '0');
  return `${hh}:${mm}:${ss},${mmm}`;
}

export function wordTimestampsToSrt(
  words: WordTimestamp[],
  opts: SrtOptions = {},
): string {
  if (words.length === 0) return '';
  const wordsPerCue = opts.wordsPerCue ?? 6;
  const cues: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerCue) {
    const group = words.slice(i, i + wordsPerCue);
    const start = group[0].start;
    const end = group[group.length - 1].end;
    const text = group.map(w => w.word).join(' ');
    const idx = cues.length + 1;
    cues.push(`${idx}\n${fmtTime(start)} --> ${fmtTime(end)}\n${text}\n`);
  }
  return cues.join('\n') + '\n';
}
