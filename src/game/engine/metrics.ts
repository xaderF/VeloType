// metrics.ts
// calculates game metrics such as correct characters, total typed, errors, accuracy, raw wpm, wpm, consistency, and elapsed time.
// provides functions for counting correct characters and building metrics from typing state. used by reducer and scoring modules.

import { TypingState } from './types';

export interface TypingMetrics {
  correctChars: number;
  totalTyped: number;
  errors: number;
  /** Cumulative errors including corrected ones */
  totalErrors: number;
  /** Total keystrokes ever typed (not counting backspace) */
  totalKeystrokes: number;
  accuracy: number;
  rawWpm: number;
  wpm: number;
  consistency: number;
  elapsedMs: number;
}

export function countCorrectChars(target: string, typed: string): number {
  const limit = Math.min(target.length, typed.length);
  let correct = 0;

  for (let i = 0; i < limit; i += 1) {
    if (typed[i] === target[i]) correct += 1;
  }

  return correct;
}

export function computeAccuracy(correct: number, total: number): number {
  return correct / Math.max(1, total);
}

export function computeWpm(correct: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (correct / 5) / (elapsedMs / 60000);
}

export function computeRawWpm(totalTyped: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (totalTyped / 5) / (elapsedMs / 60000);
}

export function computeConsistency(samples: number[]): number {
  if (!samples.length) return 1;
  if (samples.length === 1) return 1;

  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const variance = samples.reduce((sum, value) => {
    const diff = value - mean;
    return sum + diff * diff;
  }, 0) / samples.length;

  const stdDev = Math.sqrt(variance);
  return 1 / (1 + stdDev);
}

export function buildMetrics(state: TypingState, nowMs: number): TypingMetrics {
  const elapsedMs = state.startedAtMs !== null
    ? (state.endedAtMs ?? nowMs) - state.startedAtMs
    : 0;
  const correctChars = countCorrectChars(state.target, state.typed);
  const totalTyped = state.typed.length;
  const sanitizedTotalErrors = Math.max(0, state.totalErrors);
  const sanitizedKeystrokes = Math.max(state.totalKeystrokes, totalTyped);

  // Accuracy uses keystroke-level accounting so corrected mistakes still count
  // against accuracy (MonkeyType-style behavior).
  const accuracy = sanitizedKeystrokes > 0
    ? computeAccuracy(sanitizedKeystrokes - sanitizedTotalErrors, sanitizedKeystrokes)
    : computeAccuracy(correctChars, totalTyped);

  // Raw speed reflects every typed key (including wrong keys that were fixed).
  const rawWpm = computeRawWpm(sanitizedKeystrokes, elapsedMs);

  // Game rule: every 3 corrected mistakes contributes +1 WPM (integer steps),
  // while all mistakes still reduce accuracy.
  const correctedErrors = Math.max(0, sanitizedTotalErrors - state.errors);
  const wpm = computeWpm(correctChars, elapsedMs) + Math.floor(correctedErrors / 3);
  const consistency = computeConsistency(state.samples);

  return {
    correctChars,
    totalTyped,
    errors: state.errors,
    totalErrors: state.totalErrors,
    totalKeystrokes: state.totalKeystrokes,
    accuracy,
    rawWpm,
    wpm,
    consistency,
    elapsedMs,
  };
}
