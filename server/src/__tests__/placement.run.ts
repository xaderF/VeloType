import { calculatePlacementRating } from '../placement.js';
import type { PlacementGameResult } from '../placement.js';

function game(overrides: Partial<PlacementGameResult> = {}): PlacementGameResult {
  return { wpm: 50, accuracy: 0.95, consistency: 0.85, won: true, opponentRating: null, ...overrides };
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log('\nPlacement Algorithm Tests\n');

test('returns 0 for empty games array', () => {
  assert(calculatePlacementRating([]) === 0, 'Expected 0');
});

test('places slow/inaccurate typist in Iron (<300)', () => {
  const games = Array.from({ length: 5 }, () =>
    game({ wpm: 25, accuracy: 0.80, consistency: 0.3, won: false }),
  );
  const mmr = calculatePlacementRating(games);
  assert(mmr >= 0 && mmr < 300, `Got ${mmr}`);
  console.log(`    → MMR: ${mmr}`);
});

test('places average typist in Silver/Gold (600-1200)', () => {
  const games = Array.from({ length: 5 }, () =>
    game({ wpm: 50, accuracy: 0.92, consistency: 0.7, won: true }),
  );
  const mmr = calculatePlacementRating(games);
  assert(mmr >= 600 && mmr < 1200, `Got ${mmr}`);
  console.log(`    → MMR: ${mmr}`);
});

test('places good typist in Plat/Diamond (1200-1800)', () => {
  const games = Array.from({ length: 5 }, () =>
    game({ wpm: 90, accuracy: 0.97, consistency: 0.8, won: true, opponentRating: 1000 }),
  );
  const mmr = calculatePlacementRating(games);
  assert(mmr >= 1200 && mmr < 1800, `Got ${mmr}`);
  console.log(`    → MMR: ${mmr}`);
});

test('places elite typist in Velocity (1800-2099)', () => {
  const games = Array.from({ length: 5 }, () =>
    game({ wpm: 130, accuracy: 0.99, consistency: 0.9, won: true, opponentRating: 1500 }),
  );
  const mmr = calculatePlacementRating(games);
  assert(mmr >= 1800 && mmr <= 2099, `Got ${mmr}`);
  console.log(`    → MMR: ${mmr}`);
});

test('caps at 2099 (cannot place into Apex)', () => {
  const games = Array.from({ length: 5 }, () =>
    game({ wpm: 200, accuracy: 1.0, consistency: 1.0, won: true, opponentRating: 2000 }),
  );
  assert(calculatePlacementRating(games) === 2099, `Got ${calculatePlacementRating(games)}`);
});

test('places terrible typist in Iron', () => {
  const games = Array.from({ length: 5 }, () =>
    game({ wpm: 5, accuracy: 0.3, consistency: 0.1, won: false }),
  );
  const mmr = calculatePlacementRating(games);
  assert(mmr >= 0 && mmr < 300, `Got ${mmr}`);
  console.log(`    → MMR: ${mmr}`);
});

test('wins > losses at same skill', () => {
  const base = { wpm: 60, accuracy: 0.94, consistency: 0.8 } as const;
  const wMmr = calculatePlacementRating(Array.from({ length: 5 }, () => game({ ...base, won: true })));
  const lMmr = calculatePlacementRating(Array.from({ length: 5 }, () => game({ ...base, won: false })));
  assert(wMmr > lMmr, `Wins ${wMmr} should beat losses ${lMmr}`);
  console.log(`    → Wins: ${wMmr}, Losses: ${lMmr}`);
});

test('opponent strength bonus for facing rated opponents', () => {
  const base = { wpm: 70, accuracy: 0.95, consistency: 0.8, won: true } as const;
  const unrated = calculatePlacementRating(Array.from({ length: 5 }, () => game({ ...base })));
  const strong = calculatePlacementRating(Array.from({ length: 5 }, () => game({ ...base, opponentRating: 1400 })));
  assert(strong > unrated, `Strong ${strong} should beat unrated ${unrated}`);
  console.log(`    → Vs Unrated: ${unrated}, Vs Strong: ${strong}`);
});

test('trend bonus for improvement across games', () => {
  const improving: PlacementGameResult[] = [
    game({ wpm: 40, accuracy: 0.88, consistency: 0.6, won: false }),
    game({ wpm: 45, accuracy: 0.90, consistency: 0.65, won: false }),
    game({ wpm: 55, accuracy: 0.93, consistency: 0.75, won: true }),
    game({ wpm: 65, accuracy: 0.95, consistency: 0.80, won: true }),
    game({ wpm: 70, accuracy: 0.96, consistency: 0.85, won: true }),
  ];
  const flat: PlacementGameResult[] = [
    game({ wpm: 55, accuracy: 0.924, consistency: 0.73, won: true }),
    game({ wpm: 55, accuracy: 0.924, consistency: 0.73, won: true }),
    game({ wpm: 55, accuracy: 0.924, consistency: 0.73, won: true }),
    game({ wpm: 55, accuracy: 0.924, consistency: 0.73, won: false }),
    game({ wpm: 55, accuracy: 0.924, consistency: 0.73, won: false }),
  ];
  const improvingMmr = calculatePlacementRating(improving);
  const flatMmr = calculatePlacementRating(flat);
  assert(improvingMmr > flatMmr, `Improving ${improvingMmr} should beat flat ${flatMmr}`);
  console.log(`    → Improving: ${improvingMmr}, Flat: ${flatMmr}`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
