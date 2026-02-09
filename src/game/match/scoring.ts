// scoring.ts
// implements scoring algorithms for matches, including rating calculations, round stats, and rank determination.
// used in resultsscreen and engine.

import { RoundResult } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface RankWpmBand {
  rank: 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'velocity' | 'apex' | 'paragon';
  minRating: number;
  maxRating: number;
  maxWpm: number;
}

/**
 * Rank-to-WPM reference used for combat score normalization.
 * Score 100 is reached at 100% accuracy and WPM >= rank max + 10.
 */
export const RANK_WPM_BANDS: RankWpmBand[] = [
  { rank: 'iron', minRating: 0, maxRating: 299, maxWpm: 43 },
  { rank: 'bronze', minRating: 300, maxRating: 599, maxWpm: 51 },
  { rank: 'silver', minRating: 600, maxRating: 899, maxWpm: 59 },
  { rank: 'gold', minRating: 900, maxRating: 1199, maxWpm: 67 },
  { rank: 'platinum', minRating: 1200, maxRating: 1499, maxWpm: 75 },
  { rank: 'diamond', minRating: 1500, maxRating: 1799, maxWpm: 85 },
  { rank: 'velocity', minRating: 1800, maxRating: 2099, maxWpm: 97 },
  { rank: 'apex', minRating: 2100, maxRating: 2399, maxWpm: 110 },
  { rank: 'paragon', minRating: 2400, maxRating: 99999, maxWpm: 125 },
];

function getRankWpmBand(rating?: number | null): RankWpmBand {
  const effective = rating == null ? 300 : Math.max(0, rating);
  return RANK_WPM_BANDS.find((band) => effective >= band.minRating && effective <= band.maxRating)
    ?? RANK_WPM_BANDS[RANK_WPM_BANDS.length - 1];
}

/**
 * Combat round score in [0, 100].
 * This is used for round winner/damage and mirrors server logic.
 */
export function performanceScore(
  { wpm, accuracy }: Pick<RoundResult, 'wpm' | 'accuracy' | 'consistency'>,
  rating?: number | null,
): number {
  const band = getRankWpmBand(rating);
  const perfectWpm = band.maxWpm + 10;
  const wpmRatio = clamp(wpm / Math.max(1, perfectWpm), 0, 1);
  const accRatio = clamp(accuracy, 0, 1);
  return clamp(Math.round(wpmRatio * accRatio * 100), 0, 100);
}

export function damageFromScores(scoreA: number, scoreB: number, maxDamagePerRound = 70): number {
  const delta = scoreA - scoreB;
  return clamp(Math.round(Math.max(0, delta)), 0, maxDamagePerRound);
}
