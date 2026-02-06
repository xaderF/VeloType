export interface RoundStats {
  wpm: number;
  accuracy: number;
  errors: number;
  charactersTyped: number;
  correctCharacters: number;
}

export interface MatchResult {
  winner: 'player' | 'opponent' | 'draw';
  playerStats: RoundStats;
  opponentStats: RoundStats;
  damageDealt: number;
  damageTaken: number;
}

// Calculate WPM from characters and time
export function calculateWPM(characters: number, timeSeconds: number): number {
  if (timeSeconds === 0) return 0;
  // Standard: 5 characters = 1 word
  const words = characters / 5;
  const minutes = timeSeconds / 60;
  return Math.round(words / minutes);
}

// Calculate net WPM (accounting for errors)
export function calculateNetWPM(
  correctCharacters: number,
  errors: number,
  timeSeconds: number
): number {
  if (timeSeconds === 0) return 0;
  const netCharacters = Math.max(0, correctCharacters - errors);
  const words = netCharacters / 5;
  const minutes = timeSeconds / 60;
  return Math.round(words / minutes);
}

// Calculate accuracy percentage
export function calculateAccuracy(correct: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((correct / total) * 100);
}

// Calculate score for damage calculation
export function calculateScore(wpm: number, accuracy: number): number {
  return wpm * (accuracy / 100);
}

// Calculate damage dealt in a round
export function calculateDamage(
  attackerScore: number,
  defenderScore: number,
  maxDamage: number = 35
): number {
  const rawDamage = Math.max(0, attackerScore - defenderScore);
  return Math.min(maxDamage, Math.round(rawDamage));
}

// ELO rating calculation
export function calculateEloChange(
  playerRating: number,
  opponentRating: number,
  won: boolean,
  kFactor: number = 32
): number {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const actualScore = won ? 1 : 0;
  return Math.round(kFactor * (actualScore - expectedScore));
}

// Get rank from ELO rating
export type Rank = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface RankInfo {
  rank: Rank;
  name: string;
  minRating: number;
  maxRating: number;
  color: string;
}

export const RANKS: RankInfo[] = [
  { rank: 'bronze', name: 'Bronze', minRating: 0, maxRating: 999, color: 'rank-bronze' },
  { rank: 'silver', name: 'Silver', minRating: 1000, maxRating: 1199, color: 'rank-silver' },
  { rank: 'gold', name: 'Gold', minRating: 1200, maxRating: 1399, color: 'rank-gold' },
  { rank: 'platinum', name: 'Platinum', minRating: 1400, maxRating: 1599, color: 'rank-platinum' },
  { rank: 'diamond', name: 'Diamond', minRating: 1600, maxRating: 9999, color: 'rank-diamond' },
];

export function getRankFromRating(rating: number): RankInfo {
  return RANKS.find(r => rating >= r.minRating && rating <= r.maxRating) || RANKS[0];
}

export function getProgressToNextRank(rating: number): number {
  const currentRank = getRankFromRating(rating);
  const nextRankIndex = RANKS.findIndex(r => r.rank === currentRank.rank) + 1;
  
  if (nextRankIndex >= RANKS.length) return 100; // Already max rank
  
  const progress = ((rating - currentRank.minRating) / (currentRank.maxRating - currentRank.minRating + 1)) * 100;
  return Math.min(100, Math.max(0, progress));
}
