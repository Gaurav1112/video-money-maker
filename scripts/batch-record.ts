#!/usr/bin/env npx tsx
/**
 * batch-record.ts — Generate recording scripts for multiple quizzes at once
 *
 * Usage:
 *   npx tsx scripts/batch-record.ts --from 0 --to 9
 *   npx tsx scripts/batch-record.ts --from 0 --to 9 --output scripts.txt
 *
 * Outputs a single document the creator can read in one sitting (~30 min for 10).
 * After recording, split audio per quiz and run batch-render-quizzes.ts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getQuizByIndex, QUIZ_BANK } from '../src/lib/quiz-content';
import { formatRecordingScript } from './record-workflow';

// ─── CLI Args ───────────────────────────────────────────────────────────────

interface CliArgs {
  from: number;
  to: number;
  outputFile: string | null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let from = 0;
  let to = 9;
  let outputFile: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) {
      from = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--to' && args[i + 1]) {
      to = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputFile = args[i + 1];
      i++;
    }
  }

  return { from, to, outputFile };
}

// ─── Timing Estimation ──────────────────────────────────────────────────────

function estimateTotalReadTime(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.ceil(words / 3);
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const { from, to, outputFile } = parseArgs();
  const count = to - from + 1;

  const lines: string[] = [];

  lines.push(`================================================================`);
  lines.push(`  BATCH RECORDING SESSION`);
  lines.push(`  Quizzes: ${from} to ${to} (${count} total)`);
  lines.push(`  Bank size: ${QUIZ_BANK.length} quizzes`);
  lines.push(`  Date: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`================================================================`);
  lines.push(``);
  lines.push(`INSTRUCTIONS:`);
  lines.push(`- Record in a quiet room, consistent distance from mic`);
  lines.push(`- Follow the tone markers: [HOOK] = urgent, [QUESTION] = clear, [ANSWER] = confident`);
  lines.push(`- Pause 5 seconds between quizzes (or record them as separate files)`);
  lines.push(`- Save individual files as: voice-recordings/quiz-0.mp3, quiz-1.mp3, etc.`);
  lines.push(``);

  let totalEstimatedTime = 0;

  for (let i = from; i <= to; i++) {
    const quizIndex = i % QUIZ_BANK.length;
    const quiz = getQuizByIndex(i);

    const quizNum = i - from + 1;

    lines.push(`========================================`);
    lines.push(`QUIZ ${quizNum} of ${count}: ${quiz.title}`);
    lines.push(`Record to: voice-recordings/quiz-${i}.mp3`);
    lines.push(`========================================`);
    lines.push(``);

    // Format using the shared function but extract just the script parts
    const hookTime = estimateTotalReadTime(quiz.spokenHook);
    const questionTime = estimateTotalReadTime(quiz.question);
    const correctLetter = String.fromCharCode(65 + quiz.correctIndex);
    const answerText = `The answer is ${correctLetter} — ${quiz.options[quiz.correctIndex]}. ${quiz.explanation}`;
    const explanationTime = estimateTotalReadTime(answerText);
    const twistTime = estimateTotalReadTime(quiz.twist);
    const quizTotalTime = hookTime + questionTime + 1 + explanationTime + twistTime;
    totalEstimatedTime += quizTotalTime + 5; // +5s pause between quizzes

    lines.push(`[HOOK - ${hookTime}s, speak with urgency]`);
    lines.push(`"${quiz.spokenHook}"`);
    lines.push(``);
    lines.push(`[QUESTION - ${questionTime}s, clear and slow]`);
    lines.push(`"${quiz.question}"`);
    lines.push(``);
    lines.push(`[PAUSE - 1 second of silence]`);
    lines.push(``);
    lines.push(`[ANSWER - ${explanationTime}s, confident tone]`);
    lines.push(`"${answerText}"`);
    lines.push(``);
    lines.push(`[TWIST - ${twistTime}s, dramatic]`);
    lines.push(`"${quiz.twist}"`);
    lines.push(``);
    lines.push(`Read time: ~${quizTotalTime}s`);
    lines.push(``);

    if (i < to) {
      lines.push(`--- PAUSE 5 SECONDS BEFORE NEXT ---`);
      lines.push(``);
    }
  }

  lines.push(`================================================================`);
  lines.push(`  SESSION COMPLETE`);
  lines.push(`  Total estimated recording time: ~${Math.ceil(totalEstimatedTime / 60)} minutes`);
  lines.push(`  Quizzes recorded: ${count}`);
  lines.push(`================================================================`);
  lines.push(``);
  lines.push(`NEXT STEPS:`);
  lines.push(`1. Split audio into individual files (if recorded as one take):`);
  lines.push(`   voice-recordings/quiz-${from}.mp3 through quiz-${to}.mp3`);
  lines.push(``);
  lines.push(`2. Render all quizzes with your voice:`);
  lines.push(`   npx tsx scripts/batch-render-quizzes.ts --from ${from} --to ${to} --audio-dir voice-recordings/`);
  lines.push(``);

  const output = lines.join('\n');

  if (outputFile) {
    const resolvedOutput = path.isAbsolute(outputFile)
      ? outputFile
      : path.resolve(process.cwd(), outputFile);
    fs.writeFileSync(resolvedOutput, output);
    console.log(`Recording scripts saved to: ${resolvedOutput}`);
    console.log(`${count} quizzes, ~${Math.ceil(totalEstimatedTime / 60)} minutes total`);
  } else {
    console.log(output);
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

main();
