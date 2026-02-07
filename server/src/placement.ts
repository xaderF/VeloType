/**
 * placement.ts — Placement Algorithm
 *
 * New accounts start UNRANKED. After completing 5 placement games the system
 * assigns an initial MMR (and therefore a rank + tier).
 *
 * ---------------------------------------------------------------------------
 * HOW IT WORKS:
 * ---------------------------------------------------------------------------
 *
 * 1. During placement the player's rating row has `rating = null` and
 *    `placementGamesPlayed` increments after each match (0 → 5).
 *
 * 2. Match stats (WPM, accuracy, consistency, win/loss, opponent rating) are
 *    already stored in the MatchPlayer table. After the 5th game the server
 *    queries the last 5 games and feeds them to `calculatePlacementRating()`.
 *
 * 3. Once `placementGamesPlayed === 5`, the algorithm produces an initial MMR.
 *    That value is written to `rating` — the player is now ranked and the
 *    normal ELO system takes over.
 *
 * ---------------------------------------------------------------------------
 * ALGORITHM — Performance-Score Linear Map (Approach A):
 * ---------------------------------------------------------------------------
 *
 *   1. Per-game performance score  = wpm × accuracy² × (0.9 + 0.1 × consistency)
 *      This is the same formula used for server-authoritative scoring.
 *
 *   2. Base MMR = average(performanceScore) × PERF_TO_MMR_FACTOR (15)
 *      The higher factor (vs 12 without Iron) spreads MMR across 7 ranks:
 *        ~30 WPM / 90% acc  →  perfScore ≈ 23  →  MMR ≈  345 (Bronze 1)
 *        ~60 WPM / 95% acc  →  perfScore ≈ 51  →  MMR ≈  765 (Silver 2)
 *       ~100 WPM / 98% acc  →  perfScore ≈ 93  →  MMR ≈ 1395 (Plat 2)
 *       ~140 WPM / 99% acc  →  perfScore ≈ 134 →  MMR ≈ 2010 (Velocity 2)
 *
 *   3. Win/loss modifier (opponent-rating sensitive):
 *        Each game's win/loss value scales with opponent strength:
 *        Win  vs rated → base 15 + (oppMMR / 100), capped at +30
 *          e.g. beat Bronze (300)  → +18, beat Gold (800) → +23,
 *               beat Diamond (1300) → +28, beat Velocity (1600) → +30
 *        Win  vs unrated → +15 (flat, no signal)
 *        Loss vs rated → -(5 + oppMMR / 200), capped at -15
 *          e.g. lose to Bronze → -7, lose to Diamond → -12
 *        Loss vs unrated → -5 (flat, lenient)
 *
 *   4. Opponent-strength bonus:
 *        Each rated opponent contributes a per-game bonus based on their MMR:
 *        bonus per game = oppMMR / 60, capped at 30 per game.
 *        This stacks across all rated games (max ~150 total).
 *        Beating OR losing to strong opponents both signal you belong at
 *        a higher level than someone who only played unranked opponents.
 *
 *   5. Trend bonus:
 *        Compare the performance score of the last 2 games to the first 2.
 *        If improving → up to +50 bonus.
 *        If declining → up to −25 penalty. Rewards trajectory.
 *
 *   6. Clamp result to [0, 2099] — cannot place directly into Apex.
 *
 * ---------------------------------------------------------------------------
 * RANK SCALE REFERENCE (100 pts per tier):
 * ---------------------------------------------------------------------------
 *   Iron 1:      0–99     Bronze 1:  300–399   Silver 1:   600–699
 *   Iron 2:    100–199    Bronze 2:  400–499   Silver 2:   700–799
 *   Iron 3:    200–299    Bronze 3:  500–599   Silver 3:   800–899
 *   Gold 1:    900–999    Plat 1:   1200–1299  Diamond 1: 1500–1599
 *   Gold 2:   1000–1099   Plat 2:   1300–1399  Diamond 2: 1600–1699
 *   Gold 3:   1100–1199   Plat 3:   1400–1499  Diamond 3: 1700–1799
 *   Velocity 1: 1800–1899 Velocity 2: 1900–1999 Velocity 3: 2000–2099
 *   Apex:     hidden MMR >= 2100 AND leaderboard top 1500  (shows Competitive ELO)
 *   Paragon:  hidden MMR >= 2400 AND leaderboard top 500   (shows Competitive ELO)
 *
 * ---------------------------------------------------------------------------
 * COMPETITIVE ELO (separate from hidden MMR):
 * ---------------------------------------------------------------------------
 *   - Stored as `competitiveElo` in the Rating table (nullable Int).
 *   - Remains null until a player is promoted to Apex.
 *   - Promotion to Apex requires: hidden MMR >= 2100 AND leaderboard top 1500.
 *   - Starts at 0 the moment a player first enters Apex.
 *   - Same ELO delta is applied to BOTH hidden MMR and competitive ELO each match.
 *   - If hidden MMR drops below 2100, competitive ELO is nulled (demotion).
 *   - Hidden MMR (`rating`) continues to track true skill for matchmaking
 *     and leaderboard position determination.
 *   - Only displayed for Apex and Paragon players in their badge.
 */

export interface PlacementGameResult {
  wpm: number;
  accuracy: number;       // 0–1
  consistency: number;    // 0–1
  won: boolean;
  opponentRating: number | null; // null if opponent was also unranked
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Multiplier to convert average performance score into MMR. */
const PERF_TO_MMR_FACTOR = 15;

/** Maximum placement MMR — cannot place into Apex (requires 2100+ and top 1500). */
const MAX_PLACEMENT_MMR = 2099;

/** Win/loss MMR modifiers — base values for unrated opponents. */
const WIN_VS_UNRATED  =  15;
const LOSS_VS_UNRATED =  -5;

/** Win vs rated: base + oppMMR/100, capped at this. */
const WIN_RATED_BASE  =  15;
const WIN_RATED_CAP   =  30;

/** Loss vs rated: -(base + oppMMR/200), capped at this magnitude. */
const LOSS_RATED_BASE =   5;
const LOSS_RATED_CAP  =  15;

/** Per-game opponent strength bonus: oppMMR / divisor, capped per game. */
const OPP_STRENGTH_DIVISOR  = 60;
const OPP_STRENGTH_PER_GAME_CAP = 30;

/** Maximum trend bonus / penalty. */
const MAX_TREND_BONUS   =  50;
const MAX_TREND_PENALTY = -25;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Per-game performance score — same formula as server-authoritative scoring.
 * score = wpm × accuracy² × (0.9 + 0.1 × consistency)
 */
function gamePerformanceScore(wpm: number, accuracy: number, consistency: number): number {
  const accPenalty = accuracy * accuracy;
  const consistencyBonus = 0.9 + 0.1 * consistency;
  return wpm * accPenalty * consistencyBonus;
}

/**
 * Calculate the trend modifier by comparing the first and last portion
 * of placement games. Positive = improving, negative = declining.
 */
function trendModifier(perfScores: number[]): number {
  if (perfScores.length < 4) return 0;

  // Compare average of first 2 vs last 2
  const earlyAvg = (perfScores[0] + perfScores[1]) / 2;
  const lateAvg = (perfScores[perfScores.length - 2] + perfScores[perfScores.length - 1]) / 2;

  if (earlyAvg <= 0) return 0;

  // Ratio: > 1 means improving, < 1 means declining
  const ratio = lateAvg / earlyAvg;

  if (ratio >= 1) {
    // Improving: scale 1.0–1.5+ → 0–MAX_TREND_BONUS
    const improvement = Math.min(ratio - 1, 0.5); // cap at 50% improvement
    return Math.round((improvement / 0.5) * MAX_TREND_BONUS);
  } else {
    // Declining: scale 0.5–1.0 → MAX_TREND_PENALTY–0
    const decline = Math.min(1 - ratio, 0.5); // cap at 50% decline
    return Math.round((decline / 0.5) * MAX_TREND_PENALTY);
  }
}

/**
 * Calculate the win/loss modifier from placement results.
 * Scales with opponent rating — beating a Diamond player is worth far more
 * than beating an unranked player. Losing to a strong player is lenient.
 */
function winLossModifier(games: PlacementGameResult[]): number {
  let modifier = 0;
  for (const game of games) {
    if (game.won) {
      if (game.opponentRating != null) {
        // Win vs rated: 15 + oppMMR/100 → e.g. 300→18, 800→23, 1300→28, capped 30
        modifier += Math.min(WIN_RATED_BASE + game.opponentRating / 100, WIN_RATED_CAP);
      } else {
        modifier += WIN_VS_UNRATED;
      }
    } else {
      if (game.opponentRating != null) {
        // Loss vs rated: -(5 + oppMMR/200) → e.g. 300→-7, 800→-9, 1300→-12, capped -15
        modifier -= Math.min(LOSS_RATED_BASE + game.opponentRating / 200, LOSS_RATED_CAP);
      } else {
        modifier += LOSS_VS_UNRATED;
      }
    }
  }
  return modifier;
}

/**
 * Calculate a bonus for playing against rated opponents.
 * Each rated opponent contributes oppMMR / 60 (capped at 30 per game).
 * Playing against stronger opponents — win OR lose — signals you belong higher.
 */
function opponentStrengthBonus(games: PlacementGameResult[]): number {
  let bonus = 0;
  for (const game of games) {
    if (game.opponentRating != null && game.opponentRating > 0) {
      bonus += Math.min(game.opponentRating / OPP_STRENGTH_DIVISOR, OPP_STRENGTH_PER_GAME_CAP);
    }
  }
  return Math.round(bonus);
}

// ---------------------------------------------------------------------------
// Main placement function
// ---------------------------------------------------------------------------

/**
 * Called after the 5th placement game.
 * Returns an initial MMR (integer, 0–2099).
 *
 * @param games — array of placement game results (oldest first, typically 5)
 * @returns initial MMR
 */
export function calculatePlacementRating(games: PlacementGameResult[]): number {
  if (games.length === 0) return 0;

  // 1. Per-game performance scores
  const perfScores = games.map((g) =>
    gamePerformanceScore(g.wpm, g.accuracy, g.consistency),
  );

  // 2. Base MMR from average performance score
  const avgPerf = perfScores.reduce((a, b) => a + b, 0) / perfScores.length;
  const baseMmr = avgPerf * PERF_TO_MMR_FACTOR;

  // 3. Win/loss modifier
  const wlMod = winLossModifier(games);

  // 4. Opponent strength bonus
  const oppBonus = opponentStrengthBonus(games);

  // 5. Trend modifier (improvement / decline)
  const trend = trendModifier(perfScores);

  // 6. Sum and clamp
  const rawMmr = baseMmr + wlMod + oppBonus + trend;
  return Math.max(0, Math.min(MAX_PLACEMENT_MMR, Math.round(rawMmr)));
}
