export type PlayerId = string;
export type MatchSeed = string | number;

export interface RoundResult {
  wpm: number;
  accuracy: number;
  consistency: number;
  score: number;
}

export interface MatchState {
  seed: MatchSeed;
  round: number;
  players: PlayerId[];
  status: 'pending' | 'in_progress' | 'completed';
}
