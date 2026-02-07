// textSeed.ts
// utility functions for text seed generation, used in reproducible matches.

import { generateText } from '@/game/engine';

export interface SeededTextOptions {
  length?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  includePunctuation?: boolean;
}

export function getSeededText(seed: string | number, options: SeededTextOptions = {}): string {
  const { length = 200, difficulty = 'medium', includePunctuation = false } = options;
  return generateText({ seed, length, difficulty, includePunctuation });
}

export function generateMatchSeed(): number {
  const entropy = `${Date.now()}-${Math.random() * 1_000_000}`;
  const hash = Array.from(entropy).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Math.abs(hash % 10_000);
}
