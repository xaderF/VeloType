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

  // Use keystroke-level accuracy when totalErrors/totalKeystrokes are available
  // so corrected mistakes still count against accuracy (MonkeyType-style).
  // Fall back to the simple position-level accuracy otherwise.
  let accuracy: number;
  if (totalKeystrokes != null && totalKeystrokes > 0 && totalErrors != null) {
    // Sanity: totalKeystrokes must be >= typed.length, totalErrors must be reasonable
    const sanitizedKeystrokes = Math.max(totalKeystrokes, totalTyped);
    const sanitizedTotalErrors = Math.min(totalErrors, sanitizedKeystrokes);
    accuracy = computeAccuracy(sanitizedKeystrokes - sanitizedTotalErrors, sanitizedKeystrokes);
  } else {
    accuracy = computeAccuracy(correctChars, totalTyped);
  }

  // Use the full time window for WPM so early-submitters aren't rewarded.
  // Fall back to actual elapsed if no limit is provided (e.g. text mode).
  const wpmTimeMs = matchTimeLimitMs ?? elapsedMs;
  const rawWpm = computeRawWpm(totalTyped, wpmTimeMs);
  const wpm = computeWpm(correctChars, wpmTimeMs);
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
export function calculateEloChange(
  playerRating: number,
  opponentRating: number,
  result: 'win' | 'loss' | 'draw',
  kFactor: number = 32,
): number {
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  let actual = 0;
  if (result === 'win') actual = 1;
  else if (result === 'draw') actual = 0.25; // 25 % of win value
  return Math.round(kFactor * (actual - expected));
}

export function damageFromScores(scoreA: number, scoreB: number, maxDamage = 35): number {
  const delta = scoreA - scoreB;
  return clamp(Math.round(Math.max(0, delta)), 0, maxDamage);
}
