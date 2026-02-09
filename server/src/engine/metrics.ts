// metrics.ts — server-side metrics computation
// Mirrors client engine metrics for server-authoritative scoring

export interface ServerMetrics {
  correctChars: number;
  totalTyped: number;
  errors: number;
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
  return (correct / 5) / (elapsedMs / 60_000);
}

export function computeRawWpm(totalTyped: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return (totalTyped / 5) / (elapsedMs / 60_000);
}

export function computeConsistency(samples: number[]): number {
  if (!samples.length) return 1;
  if (samples.length === 1) return 1;
  const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
  const variance = samples.reduce((sum, v) => {
    const diff = v - mean;
    return sum + diff * diff;
  }, 0) / samples.length;
  const stdDev = Math.sqrt(variance);
  return 1 / (1 + stdDev);
}

/**
 * Compute server-authoritative metrics.
 *
 * @param matchTimeLimitMs - The full match time limit in ms (e.g. 30_000).
 *   In timed mode WPM is always calculated against this window — identical to
 *   how MonkeyType works — so a player who stops typing early does NOT get an
 *   inflated WPM; they simply have fewer correct chars in the same window.
 * @param totalErrors - Cumulative errors including corrected ones (from client).
 *   When provided, accuracy includes the penalty for corrected mistakes.
 * @param totalKeystrokes - Total forward keystrokes (from client).
 *   When provided alongside totalErrors, used for MonkeyType-style keystroke accuracy.
 */
export function computeServerMetrics(
  target: string,
  typed: string,
  elapsedMs: number,
  samples: number[],
  matchTimeLimitMs?: number,
  totalErrors?: number,
  totalKeystrokes?: number,
): ServerMetrics {
  const correctChars = countCorrectChars(target, typed);
  const totalTyped = typed.length;
  const errors = totalTyped - correctChars;
  const fallbackTotalErrors = Math.max(0, errors);
  const sanitizedTotalErrors = totalErrors != null
    ? Math.max(0, totalErrors)
    : fallbackTotalErrors;
  const sanitizedKeystrokes = totalKeystrokes != null
    ? Math.max(totalKeystrokes, totalTyped)
    : Math.max(totalTyped, correctChars + sanitizedTotalErrors);

  // Use keystroke-level accuracy when totalErrors/totalKeystrokes are available
  // so corrected mistakes still count against accuracy (MonkeyType-style).
  // Fall back to the simple position-level accuracy otherwise.
  const boundedErrors = Math.min(sanitizedTotalErrors, sanitizedKeystrokes);
  let accuracy: number;
  if (sanitizedKeystrokes > 0) {
    accuracy = computeAccuracy(sanitizedKeystrokes - boundedErrors, sanitizedKeystrokes);
  } else {
    accuracy = computeAccuracy(correctChars, totalTyped);
  }

  // Use the full time window for speed metrics so early-submitters aren't rewarded.
  // Fall back to actual elapsed if no limit is provided (e.g. text mode).
  const wpmTimeMs = matchTimeLimitMs ?? elapsedMs;
  const rawWpm = computeRawWpm(sanitizedKeystrokes, wpmTimeMs);

  // Game rule: every 3 corrected mistakes contributes +1 WPM (integer steps).
  // corrected mistakes = cumulative mistakes - currently visible mistakes.
  const correctedErrors = Math.max(0, boundedErrors - fallbackTotalErrors);
  const wpmBonusFromErrors = Math.floor(correctedErrors / 3);
  const wpm = computeWpm(correctChars, wpmTimeMs) + wpmBonusFromErrors;
  const consistency = computeConsistency(samples);

  return { correctChars, totalTyped, errors, accuracy, rawWpm, wpm, consistency, elapsedMs };
}

/**
 * Performance score for damage / winner calculation.
 *
 * Modelled after MonkeyType's approach — the score is primarily driven by
 * correct-chars-per-minute (WPM) penalised heavily by errors / low accuracy.
 *
 *   score = wpm × accuracy²
 *
 * Squaring accuracy means 95 % acc keeps ~90 % of your WPM score,
 * while 80 % acc drops you to 64 % — a steep penalty that rewards clean
 * typing over raw speed.  Consistency adds a small bonus/penalty on top.
 */
export function performanceScore(wpm: number, accuracy: number, consistency: number): number {
  const accuracyPenalty = accuracy * accuracy; // 0–1 range, squared
  const consistencyBonus = 0.9 + 0.1 * consistency; // 0.9–1.0 range
  return wpm * accuracyPenalty * consistencyBonus;
}

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
 * Rank-to-WPM reference used for round combat scoring.
 * A player reaches score 100 at: 100% accuracy AND WPM >= (maxWpm + 10).
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

function getRankWpmBand(rating: number | null | undefined): RankWpmBand {
  const effective = rating == null ? 300 : Math.max(0, rating);
  return RANK_WPM_BANDS.find((band) => effective >= band.minRating && effective <= band.maxRating)
    ?? RANK_WPM_BANDS[RANK_WPM_BANDS.length - 1];
}

/**
 * Combat round score in [0, 100].
 *
 * GeoGuessr-style intent: damage is the direct difference between two
 * normalized scores. Score 100 means "perfect" for your rank band:
 *  - accuracy = 100%
 *  - WPM >= rank max WPM + 10
 */
export function roundCombatScore(
  wpm: number,
  accuracy: number,
  rating: number | null | undefined,
): number {
  const band = getRankWpmBand(rating);
  const perfectWpm = band.maxWpm + 10;
  const wpmRatio = clamp(wpm / Math.max(1, perfectWpm), 0, 1);
  const accRatio = clamp(accuracy, 0, 1);
  return clamp(Math.round(wpmRatio * accRatio * 100), 0, 100);
}

// ---------------------------------------------------------------------------
// ELO rating change — standard formula with configurable K-factor.
// ---------------------------------------------------------------------------

/**
 * Calculate the ELO rating change for a player after a match.
 *
 * @param playerRating  Current MMR of the player
 * @param opponentRating  Current MMR of the opponent
 * @param result  'win', 'loss', or 'draw'
 * @param kFactor  K-factor (default 32)
 * @returns Integer delta to apply (positive = gain, negative = loss)
 */
export interface EloComputationInput {
  playerRating: number;
  opponentRating: number;
  result: 'win' | 'loss' | 'draw';
  playerScore: number;
  opponentScore: number;
  playerHp: number;
  opponentHp: number;
  forfeited?: boolean;
  kFactor?: number;
}

export function calculateEloChange(input: EloComputationInput): number {
  const {
    playerRating,
    opponentRating,
    result,
    playerScore,
    opponentScore,
    playerHp,
    opponentHp,
    forfeited = false,
    kFactor = 40,
  } = input;

  if (result === 'draw') return 0;

  // Core expected-result model: underdog wins gain more, favorite losses lose more.
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const BASE_DELTA = result === 'win' ? 20 : -20;
  const expectedAdj = Math.round((0.5 - expected) * 14); // approx -7..+7

  // Rank-dependent volatility: lower ranks move slightly faster than top ranks.
  const rankVolatility = playerRating < 900
    ? 1.1
    : playerRating < 1500
      ? 1.0
      : playerRating < 2100
        ? 0.9
        : 0.82;

  // Performance adjustment from final aggregate stats (independent per player).
  const totalScore = Math.max(1, playerScore + opponentScore);
  const scoreShare = playerScore / totalScore; // 0..1
  const hpShare = clamp(playerHp / Math.max(1, playerHp + opponentHp), 0, 1);

  let perfAdj = 0;
  if (result === 'win') {
    // Better winner performance yields slightly more gain.
    perfAdj = Math.round(clamp((scoreShare - 0.5) * 10 + (hpShare - 0.5) * 4, -2, 6));
  } else {
    // Bad losses (stomped) lose more; close losses lose less.
    perfAdj = Math.round(clamp((scoreShare - 0.5) * 8 + (hpShare - 0.5) * 6, -6, 2));
  }

  let delta = Math.round((BASE_DELTA + expectedAdj + perfAdj) * rankVolatility);

  // Prevent tiny decisive gains/losses.
  if (result === 'win') delta = Math.max(10, delta);
  if (result === 'loss') delta = Math.min(-10, delta);

  if (forfeited && result === 'loss') {
    // Apply forfeit penalty after Elo calculation.
    delta = Math.floor(delta * 1.25);
    delta = Math.min(-1, delta);
  }

  return clamp(delta, -64, 64);
}

export function damageFromScores(scoreA: number, scoreB: number, maxDamage = 70): number {
  const delta = scoreA - scoreB;
  return clamp(Math.round(Math.max(0, delta)), 0, maxDamage);
}
