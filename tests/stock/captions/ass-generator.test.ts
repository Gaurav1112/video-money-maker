import { describe, it, expect } from 'vitest';
import { generateAssSubtitles } from '../../../src/stock/captions/ass-generator.js';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(__dirname, '_ass-test-out.ass');

describe('generateAssSubtitles', () => {
  it('creates ASS file with Script Info header', async () => {
    await generateAssSubtitles({
      narration: 'Hello world test',
      wordTimestamps: [
        { word: 'Hello', startMs: 0, endMs: 400 },
        { word: 'world', startMs: 410, endMs: 800 },
        { word: 'test', startMs: 810, endMs: 1100 },
      ],
      outputPath: OUT,
    });
    expect(existsSync(OUT)).toBe(true);
    const content = readFileSync(OUT, 'utf8');
    expect(content).toContain('[Script Info]');
  });

  it('contains MarginV=480 in styles', async () => {
    const content = readFileSync(OUT, 'utf8');
    expect(content).toContain('MarginV');
    expect(content).toContain('480');
  });

  it('has at least one Dialogue line', async () => {
    const content = readFileSync(OUT, 'utf8');
    expect(content).toContain('Dialogue:');
  });

  it('emits per-word karaoke {\\kf} fill tags so libass actually highlights', async () => {
    // Without these tags the SecondaryColour highlight never fires;
    // captions render as static white text. This was the silent
    // panel-6 retention regression that dropped Ret3 to 3.0/10.
    const content = readFileSync(OUT, 'utf8');
    const dialogueLines = content.split('\n').filter((l) => l.startsWith('Dialogue:'));
    expect(dialogueLines.length).toBeGreaterThan(0);
    for (const line of dialogueLines) {
      expect(line).toMatch(/\{\\kf\d+\}/);
    }
  });

  it('uses DejaVu Sans (not Inter) so libass finds the font on stock CI runners', async () => {
    const content = readFileSync(OUT, 'utf8');
    expect(content).toMatch(/Style:\s*Default,\s*DejaVu Sans/);
    expect(content).not.toContain('Inter,80');
  });

  it('PrimaryColour is yellow (highlighted), SecondaryColour is white (pre-cursor)', async () => {
    const content = readFileSync(OUT, 'utf8');
    // BGR ordering in ASS: 00 00 FF FF = #FFFF00 yellow
    expect(content).toContain('&H0000FFFF,&H00FFFFFF,');
  });

  it('applies sceneStartMs offset to every dialogue start/end', async () => {
    const offsetOut = join(__dirname, '_ass-offset.ass');
    await generateAssSubtitles({
      narration: 'one two',
      wordTimestamps: [
        { word: 'one', startMs: 0, endMs: 500 },
        { word: 'two', startMs: 500, endMs: 1000 },
      ],
      outputPath: offsetOut,
      sceneStartMs: 5000,
    });
    const content = readFileSync(offsetOut, 'utf8');
    // 5000ms → 0:00:05.00 ; 6000ms → 0:00:06.00
    expect(content).toMatch(/Dialogue:\s*0,0:00:05\.00,0:00:06\.00,/);
    rmSync(offsetOut);
  });

  it('escapes literal { } in word text so they are not parsed as override blocks', async () => {
    const escapeOut = join(__dirname, '_ass-escape.ass');
    await generateAssSubtitles({
      narration: 'test {evil}',
      wordTimestamps: [
        { word: 'test', startMs: 0, endMs: 300 },
        { word: '{evil}', startMs: 300, endMs: 600 },
      ],
      outputPath: escapeOut,
    });
    const content = readFileSync(escapeOut, 'utf8');
    expect(content).toContain('\\{evil\\}');
    rmSync(escapeOut);
  });

  it('cleans up', () => {
    if (existsSync(OUT)) rmSync(OUT);
  });
});
