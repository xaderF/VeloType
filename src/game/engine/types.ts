export type TypingMode = 'time' | 'text';

export type TypingStatus = 'idle' | 'running' | 'finished';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface TypingOptions {
  mode: TypingMode;
  limit: number;
  length?: number;
  difficulty?: Difficulty;
}

export interface TypingState {
  target: string;
  typed: string;
  cursor: number;
  status: TypingStatus;
  startedAtMs: number | null;
  endedAtMs: number | null;
  mode: TypingMode;
  limit: number;
  errors: number;
  samples: number[];
  lastSampleMs: number | null;
}

export type TypingAction =
  | { type: 'INIT'; payload: { seed: string | number; options: TypingOptions } }
  | { type: 'TYPE_CHAR'; payload: { char: string; nowMs: number } }
  | { type: 'BACKSPACE'; payload: { nowMs: number } }
  | { type: 'TICK'; payload: { nowMs: number } }
  | { type: 'FINISH'; payload: { nowMs: number } }
  | { type: 'RESET'; payload?: { target?: string; options?: TypingOptions } };
