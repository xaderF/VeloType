import { calculatePlacementRating } from '../placement.js';

function rankLabel(mmr: number): string {
  if (mmr < 100) return 'Iron 1';
  if (mmr < 200) return 'Iron 2';
  if (mmr < 300) return 'Iron 3';
  if (mmr < 400) return 'Bronze 1';
  if (mmr < 500) return 'Bronze 2';
  if (mmr < 600) return 'Bronze 3';
  if (mmr < 700) return 'Silver 1';
  if (mmr < 800) return 'Silver 2';
  if (mmr < 900) return 'Silver 3';
  if (mmr < 1000) return 'Gold 1';
  if (mmr < 1100) return 'Gold 2';
  if (mmr < 1200) return 'Gold 3';
  if (mmr < 1300) return 'Platinum 1';
  if (mmr < 1400) return 'Platinum 2';
  if (mmr < 1500) return 'Platinum 3';
  if (mmr < 1600) return 'Diamond 1';
  if (mmr < 1700) return 'Diamond 2';
  if (mmr < 1800) return 'Diamond 3';
  if (mmr < 1900) return 'Velocity 1';
  if (mmr < 2000) return 'Velocity 2';
  if (mmr < 2100) return 'Velocity 3';
  return 'Velocity 3 (capped)';
}

const scenarios: [number, number, number, number, number | null, string][] = [
  [20,  0.70, 0.3, 0, null,  'Beginner, bad acc, 0 wins'],
  [25,  0.80, 0.4, 1, null,  'Beginner, 1 win'],
  [30,  0.85, 0.5, 1, null,  'Slow, 1 win'],
  [35,  0.88, 0.5, 2, null,  'Below avg, 2 wins'],
  [40,  0.90, 0.6, 2, null,  'Casual, 2 wins'],
  [45,  0.90, 0.6, 2, 600,   'Casual vs Silver'],
  [50,  0.92, 0.7, 3, null,  'Average, 3 wins'],
  [50,  0.92, 0.7, 3, 700,   'Average vs Silver 2'],
  [55,  0.93, 0.7, 3, null,  'Avg+, 3 wins'],
  [60,  0.94, 0.75, 3, null, 'Decent, 3 wins'],
  [60,  0.94, 0.75, 3, 900,  'Decent vs Gold 1'],
  [65,  0.95, 0.75, 3, 800,  'Good, 3 wins'],
  [70,  0.95, 0.8, 4, null,  'Good, 4 wins'],
  [70,  0.95, 0.8, 4, 1000,  'Good vs Gold 2'],
  [75,  0.96, 0.8, 4, null,  'Solid, 4 wins'],
  [80,  0.96, 0.8, 4, null,  'Fast, 4 wins'],
  [80,  0.96, 0.8, 4, 1000,  'Fast vs Gold 2'],
  [85,  0.97, 0.85, 4, 1000, 'Very fast vs Gold 2'],
  [90,  0.97, 0.85, 4, 1000, 'Excellent, 4 wins'],
  [90,  0.97, 0.85, 5, 1100, 'Excellent 5-0 vs Gold 3'],
  [95,  0.97, 0.85, 5, 1200, 'Strong vs Plat 1'],
  [100, 0.98, 0.85, 5, 1200, 'Pro vs Plat 1'],
  [100, 0.98, 0.9,  5, 1300, 'Pro vs Plat 2'],
  [110, 0.98, 0.9,  5, 1300, 'Elite vs Plat 2'],
  [120, 0.98, 0.9,  5, 1400, 'Top-tier vs Plat 3'],
  [130, 0.99, 0.9,  5, 1500, 'Near-pro vs Diamond 1'],
  [140, 0.99, 0.95, 5, 1600, 'Insane vs Diamond 2'],
  [150, 0.99, 0.95, 5, 1700, 'World-class vs Diamond 3'],
];

console.log('');
console.log('Full Placement Table');
console.log('====================');
console.log('');
console.log(
  'WPM'.padStart(3) + ' | ' +
  'Acc%'.padStart(4) + ' | ' +
  'Cons'.padStart(4) + ' | ' +
  'W/L  ' + ' | ' +
  'Opp Rating'.padStart(10) + ' | ' +
  'MMR'.padStart(4) + ' | ' +
  'Rank'.padEnd(20) + ' | ' +
  'Description'
);
console.log('-'.repeat(105));

for (const [wpm, acc, cons, wins, oppR, label] of scenarios) {
  const games = Array.from({ length: 5 }, (_, i) => ({
    wpm,
    accuracy: acc,
    consistency: cons,
    won: i < wins,
    opponentRating: oppR,
  }));
  const mmr = calculatePlacementRating(games);
  const l = 5 - wins;
  const oppStr = oppR == null ? 'Unranked' : String(oppR);
  console.log(
    String(wpm).padStart(3) + ' | ' +
    String(Math.round(acc * 100)).padStart(3) + '% | ' +
    cons.toFixed(1).padStart(4) + ' | ' +
    (wins + 'W/' + l + 'L').padEnd(5) + ' | ' +
    oppStr.padStart(10) + ' | ' +
    String(mmr).padStart(4) + ' | ' +
    rankLabel(mmr).padEnd(20) + ' | ' +
    label
  );
}

console.log('');
console.log('Note: Max placement MMR is 2099 (cannot place into Apex).');
console.log('      Apex requires MMR >= 2100 AND top 1500 leaderboard position.');
console.log('      Paragon requires MMR >= 2400 AND top 500 leaderboard position.');
console.log('');
