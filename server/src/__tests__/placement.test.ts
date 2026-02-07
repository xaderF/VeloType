import { describe, it, expect } from 'vitest';
import { calculatePlacementRating, type PlacementGameResult } from '../placement.js';

// Helper to make a game result with defaults
function game(overrides: Partial<PlacementGameResult> = {}): PlacementGameResult {
  return {
    wpm: 50,
    accuracy: 0.95,
    consistency: 0.85,
    won: true,
    opponentRating: null,
    ...overrides,
  };
}

describe('calculatePlacementRating', () => {
  it('returns 0 for an empty games array', () => {
    expect(calculatePlacementRating([])).toBe(0);
  });

  it('places a slow/inaccurate typist in Iron', () => {
    // ~25 WPM, 80% accuracy → perfScore ≈ 25 * 0.64 * ~0.93 ≈ 14.9 → MMR ≈ 479 (with +300 offset - 25 losses)
    const games = Array.from({ length: 5 }, () =>
      game({ wpm: 25, accuracy: 0.80, consistency: 0.3, won: false, opponentRating: null }),
    );
    const mmr = calculatePlacementRating(games);
    expect(mmr).toBeGreaterThanOrEqual(0);
    expect(mmr).toBeLessThan(300); // Iron range
  });

  it('places an average typist in Silver/Gold', () => {
    const games = Array.from({ length: 5 }, () =>
      game({ wpm: 50, accuracy: 0.92, consistency: 0.7, won: true }),
    );
    const mmr = calculatePlacementRating(games);
    expect(mmr).toBeGreaterThanOrEqual(600);
    expect(mmr).toBeLessThan(1200); // Silver–Gold range
  });

  it('places a good typist in Plat/Diamond', () => {
    const games = Array.from({ length: 5 }, () =>
      game({ wpm: 90, accuracy: 0.97, consistency: 0.8, won: true, opponentRating: 1000 }),
    );
    const mmr = calculatePlacementRating(games);
    expect(mmr).toBeGreaterThanOrEqual(1200);
    expect(mmr).toBeLessThan(1800); // Plat–Diamond range
  });

  it('places an elite typist in Velocity', () => {
    const games = Array.from({ length: 5 }, () =>
      game({ wpm: 130, accuracy: 0.99, consistency: 0.9, won: true, opponentRating: 1500 }),
    );
    const mmr = calculatePlacementRating(games);
    expect(mmr).toBeGreaterThanOrEqual(1800);
    expect(mmr).toBeLessThanOrEqual(2099); // Velocity, never Apex
  });

  it('never exceeds 2099 (cannot place into Apex)', () => {
    const games = Array.from({ length: 5 }, () =>
      game({ wpm: 200, accuracy: 1.0, consistency: 1.0, won: true, opponentRating: 2000 }),
    );
    const mmr = calculatePlacementRating(games);
    expect(mmr).toBe(2099);
  });

  it('places a terrible typist in Iron', () => {
    const games = Array.from({ length: 5 }, () =>
      game({ wpm: 5, accuracy: 0.3, consistency: 0.1, won: false, opponentRating: null }),
    );
    const mmr = calculatePlacementRating(games);
    expect(mmr).toBeGreaterThanOrEqual(0);
    expect(mmr).toBeLessThan(300); // Iron range
  });

  it('rewards wins over losses at the same skill level', () => {
    const base = { wpm: 60, accuracy: 0.94, consistency: 0.8 } as const;
    const allWins = Array.from({ length: 5 }, () => game({ ...base, won: true }));
    const allLosses = Array.from({ length: 5 }, () => game({ ...base, won: false }));
    const winMmr = calculatePlacementRating(allWins);
    const lossMmr = calculatePlacementRating(allLosses);
    expect(winMmr).toBeGreaterThan(lossMmr);
  });

  it('awards opponent-strength bonus for facing rated opponents', () => {
    const base = { wpm: 70, accuracy: 0.95, consistency: 0.8, won: true } as const;
    const vsUnrated = Array.from({ length: 5 }, () => game({ ...base, opponentRating: null }));
    const vsStrong = Array.from({ length: 5 }, () => game({ ...base, opponentRating: 1400 }));
    const unratedMmr = calculatePlacementRating(vsUnrated);
    const strongMmr = calculatePlacementRating(vsStrong);
    expect(strongMmr).toBeGreaterThan(unratedMmr);
  });

  it('awards a trend bonus when the player improves across games', () => {
    // Improving: start weak, end strong
    const improving: PlacementGameResult[] = [
      game({ wpm: 40, accuracy: 0.88, consistency: 0.6, won: false }),
      game({ wpm: 45, accuracy: 0.90, consistency: 0.65, won: false }),
      game({ wpm: 55, accuracy: 0.93, consistency: 0.75, won: true }),
      game({ wpm: 65, accuracy: 0.95, consistency: 0.80, won: true }),
      game({ wpm: 70, accuracy: 0.96, consistency: 0.85, won: true }),
    ];
    // Flat: same stats every game
    const flat: PlacementGameResult[] = [
      game({ wpm: 55, accuracy: 0.924, consistency: 0.73, won: true }),
      game({ wpm: 55, accuracy: 0.924, consistency: 0.73, won: true }),
      game({ wpm: 55, accuracy: 0.924, consistency: 0.73, won: true }),
      game({ wpm: 55, accuracy: 0.924, consistency: 0.73, won: false }),
      game({ wpm: 55, accuracy: 0.924, consistency: 0.73, won: false }),
    ];
    const improvingMmr = calculatePlacementRating(improving);
    const flatMmr = calculatePlacementRating(flat);
    expect(improvingMmr).toBeGreaterThan(flatMmr);
  });
});
