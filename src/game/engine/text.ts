// text.ts
// handles text generation and manipulation for typing matches.
// uses make_rng from seed.ts and difficulty/type definitions.
// provides curated word lists and generates random text based on seed, length, and difficulty.
// used in typingdisplay and engine.

import { makeRng } from './seed';
import { Difficulty } from './types';

export interface GenerateTextOptions {
  seed: string | number;
  length?: number;
  difficulty?: Difficulty;
}

// Curated list of competitive-friendly words
export const wordList = [
  'velocity', 'precision', 'battle', 'arena', 'typing', 'rhythm', 'focus', 'momentum', 'resolve',
  'victory', 'accuracy', 'consistency', 'tempo', 'dexterity', 'agility', 'strategy', 'control',
  'balance', 'practice', 'challenge', 'competition', 'duel', 'energy', 'timing', 'swift', 'rapid',
  'steady', 'calm', 'storm', 'lightning', 'keyboard', 'layout', 'custom', 'skill', 'mastery',
  'mindset', 'clarity', 'discipline', 'patience', 'training', 'muscle', 'memory', 'flow', 'stream',
  'pattern', 'combo', 'attack', 'defense', 'impact', 'charge', 'result', 'ranked', 'ladder', 'season',
  'player', 'opponent', 'winner', 'loser', 'match', 'round', 'seeded', 'fairness', 'deterministic',
  'damage', 'health', 'score', 'rating', 'elo', 'speed', 'accuracy', 'consistency', 'streak', 'moment',
  'focus', 'intent', 'action', 'reaction', 'counter', 'burst', 'glide', 'strike', 'forge', 'ascend'
];

function injectPunctuation(words: string[], rng: () => number, difficulty: Difficulty): string {
  const result: string[] = [];
  const punctuationRate = difficulty === 'easy' ? 0.08 : difficulty === 'hard' ? 0.2 : 0.12;
  const sentenceEndRate = difficulty === 'hard' ? 0.15 : 0.1;

  for (let i = 0; i < words.length; i += 1) {
    let word = words[i];
    const nextIsEnd = rng() < sentenceEndRate;
    const shouldPunctuate = rng() < punctuationRate;

    if (shouldPunctuate && !nextIsEnd) {
      const marks = [',', ';', ':'];
      const mark = marks[Math.floor(rng() * marks.length)];
      word = `${word}${mark}`;
    }

    result.push(word);

    if (nextIsEnd && i < words.length - 1) {
      result.push('. '); // Add space after period
    }
  }

  let text = result.join(' ');
  // Ensure text ends with a period and space
  text = text.replace(/\.\s*$/, '. ');
  if (!text.endsWith('. ')) {
    text = `${text.trim()}. `;
  }
  return text.trim();
}

export function generateText({ seed, length = 200, difficulty = 'medium' }: GenerateTextOptions): string {
  const rng = makeRng(seed);
  const words: string[] = [];
  let currentLength = 0;

  while (currentLength < length) {
    const index = Math.floor(rng() * wordList.length);
    const word = wordList[index];
    words.push(word);
    currentLength += word.length + 1;
  }

  const punctuated = injectPunctuation(words, rng, difficulty);
  return punctuated.slice(0, length).trim();
}
