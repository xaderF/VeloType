// game.ts
// type definitions for game logic and state, including player, match, and round types.

import { Rank, RoundStats } from '@/utils/scoring';

export interface Player {
  id: string;
  username: string;
  rating: number;
  rank: Rank;
  hp: number;
  maxHp: number;
}

export interface RoundResult {
  roundNumber: number;
  playerStats: RoundStats;
  opponentStats: RoundStats;
  playerScore: number;
  opponentScore: number;
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
  winner: 'player' | 'opponent' | 'draw' | null;
  textSeed: number;
  textSettings: {
    punctuation: boolean;
  };
}

export type GamePhase = 
  | 'home'
  | 'queue'
  | 'match_found'
  | 'countdown'
  | 'playing'
  | 'round_end'
  | 'match_end'
  | 'results'
  | 'practice'
  | 'practice_results';
