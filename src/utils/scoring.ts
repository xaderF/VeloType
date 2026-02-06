export interface RoundStats {
  wpm: number;
  rawWpm: number;
  accuracy: number; // 0-1 ratio
  consistency: number; // 0-1 score based on WPM variance
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

export function calculatePerformanceScore({
  wpm,
  accuracy,
  consistency,
}: Pick<RoundStats, 'wpm' | 'accuracy' | 'consistency'>): number {
  const accuracyFactor = 0.6 + 0.4 * accuracy;
  const consistencyFactor = 0.7 + 0.3 * consistency;
  return wpm * accuracyFactor * consistencyFactor;
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
