#!/usr/bin/env npx tsx
/**
 * Export dialogue with timestamps from a rendered storyboard.
 *
 * Outputs:
 * 1. A .txt file with full narration text (for ElevenLabs/TTS input)
 * 2. A .srt file with timestamped subtitles (for syncing)
 * 3. A .json file with word-level timestamps (for precise caption sync)
 *
 * Usage:
 *   npx tsx scripts/export-dialogue.ts --props output/test-props-s1.json
 *   npx tsx scripts/export-dialogue.ts --props output/test-props-s1.json --output ~/Documents/guru-sishya/api-gateway/session-1/
 */

import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const propsPath = getArg('--props') || 'output/test-props-s1.json';
const outputDir = getArg('--output') || path.dirname(propsPath);

if (!fs.existsSync(propsPath)) {
  console.error(`Props file not found: ${propsPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(propsPath, 'utf-8'));
const storyboard = data.storyboard || data;
const scenes = storyboard.scenes || [];
const topic = storyboard.topic || 'unknown';
const sessionNumber = storyboard.sessionNumber || 1;

console.log(`Topic: ${topic}, Session: ${sessionNumber}`);
console.log(`Scenes: ${scenes.length}`);

// ── 1. Full narration text (.txt) ──────────────────────────────────────────
// This is the input for ElevenLabs — just the text, clean, ready to speak
const fullNarration: string[] = [];
const sceneDialogues: Array<{
  sceneIndex: number;
  type: string;
  heading: string;
  narration: string;
  audioOffsetSeconds: number;
  durationSeconds: number;
  wordTimestamps: Array<{ word: string; start: number; end: number }>;
}> = [];

scenes.forEach((scene: any, idx: number) => {
  if (!scene.narration || !scene.narration.trim()) return;

  fullNarration.push(scene.narration.trim());

  sceneDialogues.push({
    sceneIndex: idx,
    type: scene.type,
    heading: scene.heading || '',
    narration: scene.narration.trim(),
    audioOffsetSeconds: scene.audioOffsetSeconds ?? -1,
    durationSeconds: scene.duration || 0,
    wordTimestamps: scene.wordTimestamps || [],
  });
});

// ── Write .txt (full script for ElevenLabs) ──
const txtPath = path.join(outputDir, `dialogue-${topic.replace(/[^a-z0-9]/gi, '-')}-s${sessionNumber}.txt`);
const txtContent = `# ${topic} — Session ${sessionNumber}\n# Full narration script for TTS generation\n# Scenes: ${sceneDialogues.length}\n\n` +
  sceneDialogues.map((d, i) => {
    return `## Scene ${d.sceneIndex + 1} [${d.type}] — ${d.heading}\n${d.narration}\n`;
  }).join('\n');

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(txtPath, txtContent, 'utf-8');
console.log(`\n✓ Script: ${txtPath}`);

// ── 2. SRT subtitles (.srt) ──────────────────────────────────────────────
// Standard SRT format that any video editor / ElevenLabs can use
const srtLines: string[] = [];
let srtIndex = 1;

sceneDialogues.forEach((d) => {
  if (d.wordTimestamps.length === 0) return;

  const audioOffset = d.audioOffsetSeconds >= 0 ? d.audioOffsetSeconds : 0;

  // Group words into subtitle chunks (8-12 words per chunk)
  const words = d.wordTimestamps;
  for (let i = 0; i < words.length; i += 8) {
    const chunk = words.slice(i, i + 8);
    const startSec = audioOffset + chunk[0].start;
    const endSec = audioOffset + chunk[chunk.length - 1].end;
    const text = chunk.map(w => w.word).join(' ');

    srtLines.push(`${srtIndex}`);
    srtLines.push(`${formatSrtTime(startSec)} --> ${formatSrtTime(endSec)}`);
    srtLines.push(text);
    srtLines.push('');
    srtIndex++;
  }
});

const srtPath = path.join(outputDir, `dialogue-${topic.replace(/[^a-z0-9]/gi, '-')}-s${sessionNumber}.srt`);
fs.writeFileSync(srtPath, srtLines.join('\n'), 'utf-8');
console.log(`✓ SRT:    ${srtPath} (${srtIndex - 1} subtitle blocks)`);

// ── 3. JSON with word-level timestamps (.json) ──────────────────────────
// For precise caption sync after replacing audio
const jsonPath = path.join(outputDir, `dialogue-${topic.replace(/[^a-z0-9]/gi, '-')}-s${sessionNumber}.json`);
const jsonContent = {
  topic,
  sessionNumber,
  totalScenes: sceneDialogues.length,
  totalWords: sceneDialogues.reduce((sum, d) => sum + d.wordTimestamps.length, 0),
  totalDurationSeconds: sceneDialogues.reduce((sum, d) => {
    const wt = d.wordTimestamps;
    if (wt.length === 0) return sum;
    const offset = d.audioOffsetSeconds >= 0 ? d.audioOffsetSeconds : 0;
    return Math.max(sum, offset + wt[wt.length - 1].end);
  }, 0),
  scenes: sceneDialogues,
};

fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2), 'utf-8');
console.log(`✓ JSON:   ${jsonPath} (${jsonContent.totalWords} words)`);

// ── 4. Summary ──────────────────────────────────────────────────────────
console.log(`\n=== Summary ===`);
console.log(`Total scenes with narration: ${sceneDialogues.length}`);
console.log(`Total words: ${jsonContent.totalWords}`);
console.log(`Total duration: ${jsonContent.totalDurationSeconds.toFixed(1)}s (${(jsonContent.totalDurationSeconds / 60).toFixed(1)} min)`);
console.log(`\nFiles created:`);
console.log(`  .txt  — Full script (paste into ElevenLabs)`);
console.log(`  .srt  — Subtitles with timestamps`);
console.log(`  .json — Word-level timestamps for caption sync`);

// ── Helpers ─────────────────────────────────────────────────────────────
function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}
