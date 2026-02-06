import { generateText } from '@/game/engine';

export interface SeededTextOptions {
  length?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export function getSeededText(seed: string | number, options: SeededTextOptions = {}): string {
  const { length = 200, difficulty = 'medium' } = options;
  return generateText({ seed, length, difficulty });
}

export function generateMatchSeed(): number {
  const entropy = `${Date.now()}-${Math.random() * 1_000_000}`;
  const hash = Array.from(entropy).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Math.abs(hash % 10_000);
}
