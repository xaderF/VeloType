import { calculatePlacementProgressRating, calculatePlacementRating } from '../placement.js';
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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`  ✗ ${name}: ${message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log('\nPlacement Algorithm Tests\n');

test('returns base rating for empty games array', () => {
  assert(calculatePlacementRating([]) === 1050, `Expected 1050, got ${calculatePlacementRating([])}`);
});

test('slow/inaccurate losses reduce placement rating below base', () => {
  const games = Array.from({ length: 5 }, () =>
    game({ wpm: 25, accuracy: 0.80, consistency: 0.3, won: false }),
  );
  const mmr = calculatePlacementRating(games);
  assert(mmr < 1050, `Expected below base, got ${mmr}`);
  console.log(`    → MMR: ${mmr}`);
});

test('terrible inputs stay clamped above 0', () => {
  const games = Array.from({ length: 5 }, () =>
    game({ wpm: 5, accuracy: 0.3, consistency: 0.1, won: false }),
  );
  const mmr = calculatePlacementRating(games);
  assert(mmr >= 0, `Expected non-negative rating, got ${mmr}`);
  console.log(`    → MMR: ${mmr}`);
});

test('wins > losses at same skill', () => {
  const base = { wpm: 60, accuracy: 0.94, consistency: 0.8 } as const;
  const wMmr = calculatePlacementRating(Array.from({ length: 5 }, () => game({ ...base, won: true })));
  const lMmr = calculatePlacementRating(Array.from({ length: 5 }, () => game({ ...base, won: false })));
  assert(wMmr > lMmr, `Wins ${wMmr} should beat losses ${lMmr}`);
  console.log(`    → Wins: ${wMmr}, Losses: ${lMmr}`);
});

test('better typing performance at same outcomes yields higher rating', () => {
  const lowPerf = calculatePlacementRating(Array.from({ length: 5 }, () =>
    game({ wpm: 45, accuracy: 0.88, consistency: 0.6, won: true, opponentRating: 1050 }),
  ));
  const highPerf = calculatePlacementRating(Array.from({ length: 5 }, () =>
    game({ wpm: 85, accuracy: 0.98, consistency: 0.9, won: true, opponentRating: 1050 }),
  ));
  assert(highPerf > lowPerf, `High perf ${highPerf} should beat low perf ${lowPerf}`);
  console.log(`    → Low perf: ${lowPerf}, High perf: ${highPerf}`);
});

test('opponent strength bonus for facing rated opponents', () => {
  const base = { wpm: 70, accuracy: 0.95, consistency: 0.8, won: true } as const;
  const unrated = calculatePlacementRating(Array.from({ length: 5 }, () => game({ ...base })));
  const strong = calculatePlacementRating(Array.from({ length: 5 }, () => game({ ...base, opponentRating: 1400 })));
  assert(strong > unrated, `Strong ${strong} should beat unrated ${unrated}`);
  console.log(`    → Vs Unrated: ${unrated}, Vs Strong: ${strong}`);
});

test('progress estimate has lower confidence before game 5', () => {
  const oneGame = [game({ wpm: 90, accuracy: 0.98, consistency: 0.9, won: true, opponentRating: 1200 })];
  const fiveGames = Array.from({ length: 5 }, () => oneGame[0]);
  const oneGameEstimate = calculatePlacementProgressRating(oneGame);
  const fiveGameEstimate = calculatePlacementProgressRating(fiveGames);
  assert(Math.abs(fiveGameEstimate - 1050) > Math.abs(oneGameEstimate - 1050), `Expected 5-game estimate to move more. one=${oneGameEstimate} five=${fiveGameEstimate}`);
  console.log(`    → One game: ${oneGameEstimate}, Five games: ${fiveGameEstimate}`);
});

test('trend bonus does not punish improvement', () => {
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
  assert(improvingMmr >= flatMmr, `Improving ${improvingMmr} should be >= flat ${flatMmr}`);
  console.log(`    → Improving: ${improvingMmr}, Flat: ${flatMmr}`);
});

test('placement result stays under the hard cap', () => {
  const games = Array.from({ length: 5 }, () =>
    game({ wpm: 200, accuracy: 1.0, consistency: 1.0, won: true, opponentRating: 2200 }),
  );
  const rating = calculatePlacementRating(games);
  assert(rating <= 2099, `Expected <= 2099, got ${rating}`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
