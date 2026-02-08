// scoring.ts
// utility functions for scoring, including rating calculations and rank determination.

export interface WpmHistoryPoint {
  second: number;
  wpm: number;
  raw: number;
  errors: number;
}

export interface RoundStats {
  wpm: number;
  rawWpm: number;
  accuracy: number; // 0-1 ratio
  consistency: number; // 0-1 score based on WPM variance
  errors: number;
  /** Cumulative errors including corrected ones */
  totalErrors: number;
  charactersTyped: number;
  correctCharacters: number;
  wpmHistory?: WpmHistoryPoint[];
}

export interface MatchResult {
  winner: 'player' | 'opponent' | 'draw';
  playerStats: RoundStats;
  opponentStats: RoundStats;
  damageDealt: number;
  damageTaken: number;
}

export function calculateWPM(characters: number, timeSeconds: number): number {
  if (timeSeconds <= 0) return 0;
  return (characters / 5) / (timeSeconds / 60);
}

export function calculateNetWPM(
  correctCharacters: number,
  errors: number,
  timeSeconds: number
): number {
  if (timeSeconds <= 0) return 0;
  const netCharacters = Math.max(0, correctCharacters - errors);
  return (netCharacters / 5) / (timeSeconds / 60);
}

export function calculateAccuracy(correct: number, total: number): number {
  return correct / Math.max(1, total);
}

/**
 * Score = wpm × accuracy² × consistencyBonus
 *
 * Accuracy is squared so errors are penalised steeply (MonkeyType-style).
 * Consistency adds a small 0.9–1.0 multiplier.
 */
export function calculatePerformanceScore({
  wpm,
  accuracy,
  consistency,
}: Pick<RoundStats, 'wpm' | 'accuracy' | 'consistency'>): number {
  const accuracyPenalty = accuracy * accuracy; // 0–1, squared
  const consistencyBonus = 0.9 + 0.1 * consistency; // 0.9–1.0
  return wpm * accuracyPenalty * consistencyBonus;
}

export function calculateDamage(
  attackerScore: number,
  defenderScore: number,
  maxDamage: number = 35
): number {
  const rawDamage = Math.max(0, attackerScore - defenderScore);
  return Math.min(maxDamage, Math.round(rawDamage));
}

export function calculateEloChange(
  playerRating: number,
  opponentRating: number,
  result: 'win' | 'loss' | 'draw',
  kFactor: number = 32
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  let actualScore = 0;
  if (result === 'win') actualScore = 1;
  else if (result === 'draw') actualScore = 0.25; // 25% of win value
  else actualScore = 0;
  return Math.round(kFactor * (actualScore - expectedScore));
}

// ---------------------------------------------------------------------------
// Rank system — each tier = 100 MMR, 3 tiers per rank.
// Apex & Paragon are leaderboard-based (not fixed MMR thresholds).
//
//   Iron 1:      0–99     Bronze 1:  300–399   Silver 1:   600–699
//   Iron 2:    100–199    Bronze 2:  400–499   Silver 2:   700–799
//   Iron 3:    200–299    Bronze 3:  500–599   Silver 3:   800–899
//   Gold 1:    900–999    Plat 1:   1200–1299  Diamond 1: 1500–1599
//   Gold 2:   1000–1099   Plat 2:   1300–1399  Diamond 2: 1600–1699
//   Gold 3:   1100–1199   Plat 3:   1400–1499  Diamond 3: 1700–1799
//   Velocity 1: 1800–1899 Velocity 2: 1900–1999 Velocity 3: 2000–2099
//
//   Apex:     hidden MMR ≥ 2100 AND leaderboard top 1500 — shows competitive ELO
//   Paragon:  hidden MMR ≥ 2400 AND leaderboard top 500  — shows competitive ELO
//
//   Velocity 3 is the only tier that doesn't auto-promote at 100 pts.
//   After 2100+ MMR you must also reach top 1500 to enter Apex.
// ---------------------------------------------------------------------------

export type Rank = 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'velocity' | 'apex' | 'paragon';

export interface RankInfo {
  rank: Rank;
  name: string;
  minRating: number;
  maxRating: number;
  color: string;
  /** If true, this rank is determined by leaderboard position, not MMR alone. */
  leaderboardBased?: boolean;
}

/** Number of placement games required before a rank is assigned. */
export const PLACEMENT_GAMES_REQUIRED = 5;

/** Points per tier (e.g. Bronze 1 → Bronze 2 = 100). */
export const POINTS_PER_TIER = 100;

/**
 * Fixed MMR-based ranks (Bronze → Velocity).
 * Apex and Paragon are leaderboard-determined — they are NOT in this array
 * because `getRankFromRating` cannot determine them from MMR alone.
 * The server assigns apex/paragon based on leaderboard position.
 */
export const RANKS: RankInfo[] = [
  { rank: 'iron',     name: 'Iron',     minRating: 0,    maxRating: 299,  color: 'rank-iron' },
  { rank: 'bronze',   name: 'Bronze',   minRating: 300,  maxRating: 599,  color: 'rank-bronze' },
  { rank: 'silver',   name: 'Silver',   minRating: 600,  maxRating: 899,  color: 'rank-silver' },
  { rank: 'gold',     name: 'Gold',     minRating: 900,  maxRating: 1199, color: 'rank-gold' },
  { rank: 'platinum', name: 'Platinum', minRating: 1200, maxRating: 1499, color: 'rank-platinum' },
  { rank: 'diamond',  name: 'Diamond',  minRating: 1500, maxRating: 1799, color: 'rank-diamond' },
  { rank: 'velocity', name: 'Velocity', minRating: 1800, maxRating: 2099, color: 'rank-velocity' },
];

/** Leaderboard rank definitions (server-assigned). */
export const LEADERBOARD_RANKS: RankInfo[] = [
  { rank: 'apex',    name: 'Apex',    minRating: 2100, maxRating: 99999, color: 'rank-apex',    leaderboardBased: true },
  { rank: 'paragon', name: 'Paragon', minRating: 2400, maxRating: 99999, color: 'rank-paragon', leaderboardBased: true },
];

/** Leaderboard position thresholds. */
export const APEX_TOP = 1500;    // positions 501–1500
export const PARAGON_TOP = 500;  // positions 1–500

/** Minimum hidden MMR required to qualify for leaderboard ranks. */
export const APEX_MIN_MMR = 2100;     // must exceed Velocity 3 (2000–2099)
export const PARAGON_MIN_MMR = 2400;  // APEX_MIN_MMR + 300

/**
 * Get rank info from MMR alone (Iron → Velocity).
 * Cannot determine Apex/Paragon — use `getRankWithLeaderboard` for that.
 * Players above Velocity 3 (2100+) are capped at Velocity.
 */
export function getRankFromRating(rating: number): RankInfo {
  return RANKS.find(r => rating >= r.minRating && rating <= r.maxRating)
    || RANKS[RANKS.length - 1]; // cap at Velocity for 1800+
}

/**
 * Get rank info considering leaderboard position AND minimum MMR requirements.
 *
 * Apex requires:   hidden MMR ≥ 2100  AND  leaderboard position ≤ 1500
 * Paragon requires: hidden MMR ≥ 2400  AND  leaderboard position ≤ 500
 *
 * If a player meets the leaderboard threshold but not the MMR floor they
 * remain in their MMR-based rank (Velocity).
 */
export function getRankWithLeaderboard(
  rating: number,
  leaderboardPosition?: number | null,
): RankInfo {
  if (typeof leaderboardPosition === 'number' && leaderboardPosition > 0) {
    if (leaderboardPosition <= PARAGON_TOP && rating >= PARAGON_MIN_MMR) {
      return LEADERBOARD_RANKS[1]; // Paragon
    }
    if (leaderboardPosition <= APEX_TOP && rating >= APEX_MIN_MMR) {
      return LEADERBOARD_RANKS[0]; // Apex
    }
  }
  return getRankFromRating(rating);
}

/**
 * Returns the tier within the current rank (1, 2, or 3).
 * Each tier = 100 points.
 * Apex/Paragon have no tiers — returns 0.
 */
export function getRankTier(rating: number, rankOverride?: Rank): number {
  const rank = rankOverride ?? getRankFromRating(rating).rank;
  if (rank === 'apex' || rank === 'paragon') return 0;
  const rankInfo = RANKS.find(r => r.rank === rank);
  if (!rankInfo) return 0;
  const offsetInRank = Math.max(0, rating - rankInfo.minRating);
  return Math.min(Math.floor(offsetInRank / POINTS_PER_TIER) + 1, 3);
}

/**
 * Returns a display string like "Silver 3", "Velocity 1", or "Apex 42" / "Paragon 310".
 *
 * For Apex/Paragon the number shown is the **competitive ELO** (a separate
 * value that starts at 0 when a player first enters Apex), NOT the hidden MMR.
 */
export function getRankTierName(
  rating: number,
  leaderboardPosition?: number | null,
  competitiveElo?: number | null,
): string {
  const rankInfo = getRankWithLeaderboard(rating, leaderboardPosition);
  if (rankInfo.rank === 'apex' || rankInfo.rank === 'paragon') {
    return `${rankInfo.name} ${competitiveElo ?? 0}`;
  }
  return `${rankInfo.name} ${getRankTier(rating)}`;
}

/**
 * Progress within the current 100-point tier (0–99).
 * Apex/Paragon return 100 (no tier progress).
 */
export function getTierProgress(
  rating: number,
  leaderboardPosition?: number | null,
): number {
  const rankInfo = getRankWithLeaderboard(rating, leaderboardPosition);
  if (rankInfo.rank === 'apex' || rankInfo.rank === 'paragon') return 100;
  const offsetInTier = (rating - rankInfo.minRating) % POINTS_PER_TIER;
  return offsetInTier; // 0–99
}

/** @deprecated Use getTierProgress instead — kept for backward compat. */
export function getProgressToNextRank(rating: number): number {
  return getTierProgress(rating);
}
