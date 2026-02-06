import { Rank, RoundStats } from '@/utils/scoring';

export interface Player {
  id: string;
  username: string;
  rating: number;
  rank: Rank;
  hp: number;
  maxHp: number;
}

export interface TypingState {
  text: string;
  currentIndex: number;
  errors: number;
  correctChars: number;
  startTime: number | null;
  endTime: number | null;
  isComplete: boolean;
}

export interface RoundResult {
  roundNumber: number;
  playerStats: RoundStats;
  opponentStats: RoundStats;
  winner: 'player' | 'opponent' | 'draw';
  damageDealt: number;
  damageTaken: number;
}

export interface MatchState {
  id: string;
  player: Player;
  opponent: Player;
  currentRound: number;
  maxRounds: number;
  roundResults: RoundResult[];
  roundTimeSeconds: number;
  status: 'waiting' | 'countdown' | 'typing' | 'round_end' | 'match_end';
  winner: 'player' | 'opponent' | null;
  textSeed: number;
}

export type GamePhase = 
  | 'home'
  | 'queue'
  | 'match_found'
  | 'countdown'
  | 'playing'
  | 'round_end'
  | 'match_end'
  | 'results';
