// Typing test text seeds - curated for competitive typing
const textSeeds = [
  "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump.",
  "Speed and precision are the hallmarks of a champion. Every keystroke matters in the arena. Focus your mind and let your fingers fly.",
  "In the digital colosseum, words become weapons. Type with purpose, strike with accuracy. Victory belongs to the swift and precise.",
  "The keyboard warrior rises at dawn, practicing until every key feels like an extension of their soul. Mastery demands dedication.",
  "Lightning fast reflexes combined with unwavering accuracy create the perfect typist. Balance speed and precision to dominate.",
  "Champions are not born, they are forged through countless hours of practice. Every mistake is a lesson, every success a stepping stone.",
  "The arena awaits those brave enough to enter. Your fingers dance across the keys as opponents fall before your superior speed.",
  "Muscle memory transforms chaos into symphony. Each word flows naturally as your training takes over. Trust your instincts.",
  "Competition breeds excellence. Push beyond your limits and discover what you are truly capable of achieving in this arena.",
  "Focus is the key to victory. Block out distractions, center your mind, and let the words flow through you like water.",
];

// Get a random text seed
export function getRandomText(): string {
  return textSeeds[Math.floor(Math.random() * textSeeds.length)];
}

// Get a seeded text (for multiplayer sync)
export function getSeededText(seed: number): string {
  return textSeeds[seed % textSeeds.length];
}

// Generate a match seed
export function generateMatchSeed(): number {
  return Math.floor(Math.random() * 10000);
}
