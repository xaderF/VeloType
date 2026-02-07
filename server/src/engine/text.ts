// text.ts — server-side copy of client engine text generation
// Must produce byte-identical output to the client for the same seed

import { makeRng } from './seed.js';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GenerateTextOptions {
  seed: string | number;
  length?: number;
  difficulty?: Difficulty;
  includePunctuation?: boolean;
}

export const wordList = [
  'velocity', 'precision', 'battle', 'arena', 'typing', 'rhythm', 'focus', 'momentum', 'resolve',
  'victory', 'accuracy', 'consistency', 'tempo', 'dexterity', 'agility', 'strategy', 'control',
  'balance', 'practice', 'challenge', 'competition', 'duel', 'energy', 'timing', 'swift', 'rapid',
  'steady', 'calm', 'storm', 'lightning', 'keyboard', 'layout', 'custom', 'skill', 'mastery',
  'mindset', 'clarity', 'discipline', 'patience', 'training', 'muscle', 'memory', 'flow', 'stream',
  'pattern', 'combo', 'attack', 'defense', 'impact', 'charge', 'result', 'ranked', 'ladder', 'season',
  'player', 'opponent', 'winner', 'loser', 'match', 'round', 'seeded', 'fairness', 'deterministic',
  'damage', 'health', 'score', 'rating', 'elo', 'speed', 'accuracy', 'consistency', 'streak', 'moment',
  'focus', 'intent', 'action', 'reaction', 'counter', 'burst', 'glide', 'strike', 'forge', 'ascend',
];

function injectPunctuation(words: string[], rng: () => number, difficulty: Difficulty): string {
  const result: string[] = [];
  const punctuationRate = difficulty === 'easy' ? 0.08 : difficulty === 'hard' ? 0.2 : 0.12;
  const sentenceEndRate = difficulty === 'hard' ? 0.15 : 0.1;

  for (let i = 0; i < words.length; i += 1) {
    let token = words[i];
    const sentenceEnd = i < words.length - 1 && rng() < sentenceEndRate;
    const shouldPunctuate = rng() < punctuationRate && !sentenceEnd;

    if (shouldPunctuate) {
      const marks = [',', ';', ':'];
      const mark = marks[Math.floor(rng() * marks.length)];
      token = `${token}${mark}`;
    }

    if (sentenceEnd) {
      token = `${token}.`;
    }

    result.push(token);
  }

  return result.join(' ');
}

export function generateText({ seed, length = 200, difficulty = 'medium', includePunctuation = false }: GenerateTextOptions): string {
  const rng = makeRng(seed);
  const words: string[] = [];
  let currentLength = 0;

  while (currentLength < length) {
    const index = Math.floor(rng() * wordList.length);
    const word = wordList[index];
    words.push(word);
    currentLength += word.length + 1;
  }

  const base = words.join(' ');
  const text = includePunctuation ? injectPunctuation(words, rng, difficulty) : base;
  return text.slice(0, length).trim();
}
