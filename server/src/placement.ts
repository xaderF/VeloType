/**
 * placement.ts — Placement rating calibration
 *
 * Goals:
 * - Use win/loss as the primary placement signal.
 * - Adjust by opponent strength (expected-result model).
 * - Include typing performance (WPM + accuracy + consistency) as a secondary signal.
 * - Support in-progress placement estimates (for matchmaking before game 5).
 */

export interface PlacementGameResult {
  wpm: number;
  accuracy: number; // 0..1
  consistency: number; // 0..1
  won: boolean;
  opponentRating: number | null;
}

interface RankWpmBand {
  minRating: number;
  maxRating: number;
  maxWpm: number;
}

const RANK_WPM_BANDS: RankWpmBand[] = [
  { minRating: 0, maxRating: 299, maxWpm: 43 },
  { minRating: 300, maxRating: 599, maxWpm: 51 },
  { minRating: 600, maxRating: 899, maxWpm: 59 },
  { minRating: 900, maxRating: 1199, maxWpm: 67 },
  { minRating: 1200, maxRating: 1499, maxWpm: 75 },
  { minRating: 1500, maxRating: 1799, maxWpm: 85 },
  { minRating: 1800, maxRating: 2099, maxWpm: 97 },
  { minRating: 2100, maxRating: 2399, maxWpm: 110 },
  { minRating: 2400, maxRating: 99999, maxWpm: 125 },
];

/** Number of placement games required before a final rank is assigned. */
export const PLACEMENT_GAMES_REQUIRED = 5;

/** Seed MMR used for fresh placement accounts (centers population near Gold). */
const PLACEMENT_BASE_MMR = 1050;
const MAX_PLACEMENT_MMR = 2099; // cannot place directly into Apex/Paragon

/** Outcome swing size (Elo-like expected model). */
const PLACEMENT_K_FACTOR = 40;

/** Secondary performance-based swing (kept smaller than outcome). */
const PERFORMANCE_DELTA_SPAN = 22; // approximately -10 .. +11
const CONSISTENCY_DELTA_SPAN = 4; // approximately -2 .. +2

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function expectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

function getRankWpmBand(rating: number): RankWpmBand {
  return RANK_WPM_BANDS.find((band) => rating >= band.minRating && rating <= band.maxRating)
    ?? RANK_WPM_BANDS[RANK_WPM_BANDS.length - 1];
}

function performanceSignal(game: PlacementGameResult, referenceRating: number): number {
  const band = getRankWpmBand(referenceRating);
  const perfectWpm = band.maxWpm + 10;

  const wpmNorm = clamp(game.wpm / Math.max(1, perfectWpm), 0, 1);
  const accNorm = clamp(game.accuracy, 0, 1);
  const consistencyNorm = clamp(game.consistency, 0, 1);

  // Heavier weight on speed+accuracy, lighter on consistency.
  return (wpmNorm * 0.7) + (accNorm * 0.25) + (consistencyNorm * 0.05);
}

function applyPlacementGame(currentRating: number, game: PlacementGameResult): number {
  const opponent = game.opponentRating ?? currentRating;
  const expected = expectedScore(currentRating, opponent);
  const actual = game.won ? 1 : 0;

  const outcomeDelta = PLACEMENT_K_FACTOR * (actual - expected);
  const perf = performanceSignal(game, opponent);
  const perfDelta = (perf - 0.5) * PERFORMANCE_DELTA_SPAN;
  const consistencyDelta = (clamp(game.consistency, 0, 1) - 0.5) * CONSISTENCY_DELTA_SPAN;

  const next = currentRating + outcomeDelta + perfDelta + consistencyDelta;
  return clamp(next, 0, MAX_PLACEMENT_MMR);
}

/**
 * In-progress placement estimate (0..5 games) used by matchmaking.
 * Uses confidence smoothing so game 1 does not overreact.
 */
export function calculatePlacementProgressRating(
  games: PlacementGameResult[],
  baseRating: number = PLACEMENT_BASE_MMR,
): number {
  if (games.length === 0) return baseRating;

  let estimate = baseRating;
  for (const game of games) {
    estimate = applyPlacementGame(estimate, game);
  }

  const confidence = clamp(games.length / PLACEMENT_GAMES_REQUIRED, 0, 1);
  const smoothed = baseRating + ((estimate - baseRating) * confidence);
  return Math.round(clamp(smoothed, 0, MAX_PLACEMENT_MMR));
}

/**
 * Final placement MMR after required placement games.
 * Uses the same model as progress mode, with full confidence at game 5.
 */
export function calculatePlacementRating(games: PlacementGameResult[]): number {
  return calculatePlacementProgressRating(games, PLACEMENT_BASE_MMR);
}
