import { RoundResult } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function performanceScore({ wpm, accuracy, consistency }: Pick<RoundResult, 'wpm' | 'accuracy' | 'consistency'>): number {
  const accuracyFactor = 0.6 + 0.4 * accuracy;
  const consistencyFactor = 0.7 + 0.3 * consistency;
  return wpm * accuracyFactor * consistencyFactor;
}

export function damageFromScores(scoreA: number, scoreB: number, maxDamagePerRound = 35): number {
  const delta = scoreA - scoreB;
  return clamp(Math.round(Math.max(0, delta)), 0, maxDamagePerRound);
}
