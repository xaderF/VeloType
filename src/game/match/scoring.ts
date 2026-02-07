// scoring.ts
// implements scoring algorithms for matches, including rating calculations, round stats, and rank determination.
// used in resultsscreen and engine.

import { RoundResult } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Score = wpm × accuracy² × consistencyBonus
 *
 * Accuracy is squared so errors are penalised steeply (MonkeyType-style).
 * Consistency adds a small 0.9–1.0 multiplier.
 */
export function performanceScore({ wpm, accuracy, consistency }: Pick<RoundResult, 'wpm' | 'accuracy' | 'consistency'>): number {
  const accuracyPenalty = accuracy * accuracy; // 0–1, squared
  const consistencyBonus = 0.9 + 0.1 * consistency; // 0.9–1.0
  return wpm * accuracyPenalty * consistencyBonus;
}

export function damageFromScores(scoreA: number, scoreB: number, maxDamagePerRound = 35): number {
  const delta = scoreA - scoreB;
  return clamp(Math.round(Math.max(0, delta)), 0, maxDamagePerRound);
}
