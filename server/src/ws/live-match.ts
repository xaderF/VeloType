import type { FastifyInstance, FastifyRequest, FastifyBaseLogger } from 'fastify';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import { z } from 'zod';
import { getBearerToken, verifyAuthToken } from '../auth.js';
import { prisma } from '../db.js';
import { wsRateLimitAllow } from './ws-rate-limit.js';

// Module-level logger — initialised when the plugin registers
let log: FastifyBaseLogger;
import { generateText } from '../engine/text.js';
import {
  computeServerMetrics,
  roundCombatScore,
  damageFromScores,
  calculateEloChange,
} from '../engine/metrics.js';
import {
  calculatePlacementRating,
  type PlacementGameResult,
  PLACEMENT_GAMES_REQUIRED,
} from '../placement.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RoomMembers = Map<string, WebSocket>;

interface SocketContext {
  matchId: string;
  userId: string;
}

export interface MatchConfig {
  matchId: string;
  seed: string;
  playerIds: string[];
  mode: string;
  limit: number; // seconds (e.g. 30)
  difficulty: string;
  textLength: number;
  includePunctuation: boolean;
  startAt: number; // epoch ms (typing start for round 1)
  maxRounds?: number;
  prepSeconds?: number;
  countdownSeconds?: number;
  breakSeconds?: number;
  playerRatings?: Record<string, number | null>;
}

interface PlayerSubmission {
  typed: string;
  samples: number[];
  submitTime: number; // epoch ms
  totalErrors?: number; // cumulative errors incl. corrected (from client)
  totalKeystrokes?: number; // total forward keystrokes (from client)
}

interface PlayerRoundStats {
  wpm: number;
  accuracy: number;
  consistency: number;
  score: number;
  correctChars: number;
  totalTyped: number;
  errors: number;
  rawWpm: number;
  damageDealt: number;
  damageTaken: number;
  hp: number;
}

interface PlayerAggregate {
  roundsPlayed: number;
  wpmTotal: number;
  accuracyTotal: number;
  consistencyTotal: number;
  scoreTotal: number;
  correctCharsTotal: number;
  totalTypedTotal: number;
  errorsTotal: number;
  rawWpmTotal: number;
  damageDealtTotal: number;
  damageTakenTotal: number;
  progressSamples: number[];
}

interface RuntimeMatchState {
  matchId: string;
  currentRound: number;
  maxRounds: number;
  roundStartAt: number; // current round typing start timestamp
  breakSeconds: number;
  countdownSeconds: number;
  playerHp: Map<string, number>;
  roundWins: Map<string, number>;
  aggregates: Map<string, PlayerAggregate>;
  overtimeActive: boolean;
  drawWindowOpen: boolean;
  drawAccepted: boolean;
  drawVotes: Map<string, 'draw' | 'continue'>;
  winnerUserId: string | null;
  forfeitedUserId: string | null;
}

interface DisconnectedPlayer {
  matchId: string;
  userId: string;
  disconnectedAt: number;
}

// ---------------------------------------------------------------------------
// In-memory state – keyed by matchId
// ---------------------------------------------------------------------------

const rooms = new Map<string, RoomMembers>();
const socketContexts = new WeakMap<WebSocket, SocketContext>();

/** Match configs pushed here by matchmaking when MATCH_FOUND fires */
export const activeMatchConfigs = new Map<string, MatchConfig>();

/** Current round submissions */
const matchSubmissions = new Map<string, Map<string, PlayerSubmission>>();

/** Current round per-second progress samples */
const matchProgressSamples = new Map<string, Map<string, number[]>>();

/** Latest progress snapshot per player (for reconnect recovery) */
const latestProgress = new Map<string, Map<string, {
  progressIndex: number;
  typedLength: number;
  mistakesCount: number;
  elapsedMs: number;
}>>();

/** Runtime state for round-based online matches */
const runtimeMatches = new Map<string, RuntimeMatchState>();

/** Players who disconnected mid-match; kept for reconnect grace */
const disconnectedPlayers = new Map<string, DisconnectedPlayer>(); // keyed by `${matchId}:${userId}`

const RECONNECT_GRACE_MS = 30_000;
const SUBMIT_GRACE_MS = 30_000;
const DEFAULT_MAX_ROUNDS = 6;
const DEFAULT_BREAK_SECONDS = 7;
const DEFAULT_COUNTDOWN_SECONDS = 3;
const OVERTIME_TRIGGER_WINS = 3;
const REGULATION_ROUNDS = 6;
const POINTS_PER_TIER = 100;
const MAX_MMR_TIER_INDEX = 20; // Velocity 3
const OVERPERFORM_GAMES_WINDOW = 10;
const OVERPERFORM_MIN_GAMES = 6;
const OVERPERFORM_MIN_AVG_ACCURACY = 0.9;
const OVERPERFORM_SCORE_THRESHOLD = 82; // "higher-rank level" average performance

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function ratingToTierIndex(rating: number): number {
  return Math.max(0, Math.min(MAX_MMR_TIER_INDEX, Math.floor(rating / POINTS_PER_TIER)));
}

function tierIndexToRatingMid(tierIndex: number): number {
  const clamped = Math.max(0, Math.min(MAX_MMR_TIER_INDEX, tierIndex));
  return clamped * POINTS_PER_TIER + 50;
}

function inferTierIndexFromAverages(avgWpm: number, avgAccuracy: number): number {
  let inferredTier = 0;

  for (let tierIdx = 0; tierIdx <= MAX_MMR_TIER_INDEX; tierIdx += 1) {
    const tierRating = tierIdx * POINTS_PER_TIER + 50;
    const score = roundCombatScore(avgWpm, avgAccuracy, tierRating);
    if (score >= OVERPERFORM_SCORE_THRESHOLD) {
      inferredTier = tierIdx;
    }
  }

  return inferredTier;
}

async function resolveOverperformPromotionRating(
  userId: string,
  currentRating: number,
): Promise<number | null> {
  if (!prisma) return null;

  const recent = await prisma.matchPlayer.findMany({
    where: {
      userId,
      wpm: { not: null },
      accuracy: { not: null },
      result: { in: ['win', 'loss', 'draw'] },
    },
    orderBy: { createdAt: 'desc' },
    take: OVERPERFORM_GAMES_WINDOW,
    select: {
      wpm: true,
      accuracy: true,
    },
  });

  if (recent.length < OVERPERFORM_MIN_GAMES) return null;

  const avgWpm = recent.reduce((sum, row) => sum + (row.wpm ?? 0), 0) / recent.length;
  const avgAccuracy = recent.reduce((sum, row) => sum + (row.accuracy ?? 0), 0) / recent.length;

  if (avgAccuracy < OVERPERFORM_MIN_AVG_ACCURACY) return null;

  const currentTier = ratingToTierIndex(currentRating);
  const inferredTier = inferTierIndexFromAverages(avgWpm, avgAccuracy);

  if (inferredTier < currentTier + 2) return null;

  const promotedTier = Math.min(currentTier + 2, inferredTier, MAX_MMR_TIER_INDEX);
  const promotedRating = tierIndexToRatingMid(promotedTier);

  return promotedRating > currentRating ? promotedRating : null;
}

function createInitialAggregate(): PlayerAggregate {
  return {
    roundsPlayed: 0,
    wpmTotal: 0,
    accuracyTotal: 0,
    consistencyTotal: 0,
    scoreTotal: 0,
    correctCharsTotal: 0,
    totalTypedTotal: 0,
    errorsTotal: 0,
    rawWpmTotal: 0,
    damageDealtTotal: 0,
    damageTakenTotal: 0,
    progressSamples: [],
  };
}

function getOrCreateRuntimeState(matchId: string): RuntimeMatchState | null {
  const existing = runtimeMatches.get(matchId);
  if (existing) return existing;

  const config = activeMatchConfigs.get(matchId);
  if (!config) return null;

  const state: RuntimeMatchState = {
    matchId,
    currentRound: 1,
    maxRounds: config.maxRounds ?? DEFAULT_MAX_ROUNDS,
    roundStartAt: config.startAt,
    breakSeconds: config.breakSeconds ?? DEFAULT_BREAK_SECONDS,
    countdownSeconds: config.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS,
    playerHp: new Map(config.playerIds.map((id) => [id, 100])),
    roundWins: new Map(config.playerIds.map((id) => [id, 0])),
    aggregates: new Map(config.playerIds.map((id) => [id, createInitialAggregate()])),
    overtimeActive: false,
    drawWindowOpen: false,
    drawAccepted: false,
    drawVotes: new Map(),
    winnerUserId: null,
    forfeitedUserId: null,
  };

  runtimeMatches.set(matchId, state);
  return state;
}

function clearDisconnected(matchId: string, userId: string) {
  disconnectedPlayers.delete(`${matchId}:${userId}`);
}

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function removeSocketFromRoom(socket: WebSocket) {
  const context = socketContexts.get(socket);
  if (!context) return;

  const room = rooms.get(context.matchId);
  if (!room) return;

  room.delete(context.userId);
  socketContexts.delete(socket);

  const config = activeMatchConfigs.get(context.matchId);
  const state = runtimeMatches.get(context.matchId);
  if (config && state && !state.winnerUserId) {
    markDisconnected(context.matchId, context.userId);
  }

  if (room.size === 0) {
    rooms.delete(context.matchId);
    return;
  }

  room.forEach((memberSocket) => {
    send(memberSocket, {
      type: 'opponent_left',
      matchId: context.matchId,
      userId: context.userId,
    });
  });
}

async function isPlayerInMatch(matchId: string, userId: string) {
  if (!prisma) {
    const config = activeMatchConfigs.get(matchId);
    return !!config?.playerIds.includes(userId);
  }

  const row = await prisma.matchPlayer.findFirst({
    where: { matchId, userId },
    select: { id: true },
  });
  return !!row;
}

function cleanupMatchState(matchId: string) {
  activeMatchConfigs.delete(matchId);
  runtimeMatches.delete(matchId);
  matchSubmissions.delete(matchId);
  matchProgressSamples.delete(matchId);
  latestProgress.delete(matchId);

  for (const [key] of disconnectedPlayers) {
    if (key.startsWith(`${matchId}:`)) disconnectedPlayers.delete(key);
  }
}

function markDisconnected(matchId: string, userId: string) {
  const key = `${matchId}:${userId}`;
  disconnectedPlayers.set(key, { matchId, userId, disconnectedAt: Date.now() });

  setTimeout(() => {
    const entry = disconnectedPlayers.get(key);
    if (!entry) return;
    disconnectedPlayers.delete(key);

    const config = activeMatchConfigs.get(matchId);
    const state = runtimeMatches.get(matchId);
    if (!config || !state || state.winnerUserId) return;

    // If a player stays disconnected beyond grace, end the match as a forfeit.
    const opponentId = config.playerIds.find((id) => id !== userId) ?? null;
    if (!opponentId) return;

    state.playerHp.set(userId, 0);
    state.winnerUserId = opponentId;
    state.forfeitedUserId = userId;
    void finaliseMatch(matchId);
  }, RECONNECT_GRACE_MS);
}

// ---------------------------------------------------------------------------
// Placement resolution — queries last N games and runs the placement algo
// ---------------------------------------------------------------------------

async function resolvePlacementRating(
  userId: string,
  requiredGames: number,
): Promise<number | null> {
  if (!prisma) return null;

  const recentMatchPlayers = await prisma.matchPlayer.findMany({
    where: {
      userId,
      wpm: { not: null },
      result: { in: ['win', 'loss'] },
    },
    orderBy: { createdAt: 'desc' },
    take: requiredGames,
    include: {
      match: {
        include: {
          players: {
            where: { userId: { not: userId } },
            include: {
              user: {
                include: { rating: true },
              },
            },
          },
        },
      },
    },
  });

  if (recentMatchPlayers.length < requiredGames) {
    return null;
  }

  const games: PlacementGameResult[] = recentMatchPlayers
    .reverse()
    .map((mp) => {
      const opponent = mp.match.players[0];
      const opponentRating = opponent?.user?.rating?.rating ?? null;

      return {
        wpm: mp.wpm ?? 0,
        accuracy: mp.accuracy ?? 0,
        consistency: mp.consistency ?? 0,
        won: mp.result === 'win',
        opponentRating,
      };
    });

  return calculatePlacementRating(games);
}

function getRoundSeed(seed: string, roundNumber: number): string {
  return `${seed}-${roundNumber}`;
}

function getPlayerIds(config: MatchConfig): [string, string] {
  const [p1, p2] = config.playerIds;
  return [p1, p2];
}

function buildRoundStats(
  matchId: string,
  config: MatchConfig,
  state: RuntimeMatchState,
  submissions: Map<string, PlayerSubmission>,
): Map<string, Omit<PlayerRoundStats, 'damageDealt' | 'damageTaken' | 'hp'>> {
  const targetText = generateText({
    seed: getRoundSeed(config.seed, state.currentRound),
    length: config.textLength,
    difficulty: (config.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium',
    includePunctuation: config.includePunctuation,
  });

  const roundStats = new Map<string, Omit<PlayerRoundStats, 'damageDealt' | 'damageTaken' | 'hp'>>();

  for (const pid of config.playerIds) {
    const sub = submissions.get(pid) ?? {
      typed: '',
      samples: [],
      submitTime: Date.now(),
      totalErrors: 0,
      totalKeystrokes: 0,
    };

    const matchTimeLimitMs = config.limit * 1000;
    const elapsedMs = Math.min(
      Math.max(sub.submitTime - state.roundStartAt, 1),
      matchTimeLimitMs,
    );

    // Allow high-end typing speeds while still guarding against impossible payload spikes.
    const maxPlausibleChars = Math.ceil((matchTimeLimitMs / 1000) * 45);
    const typedClamped = sub.typed.length > maxPlausibleChars
      ? sub.typed.slice(0, maxPlausibleChars)
      : sub.typed;

    const progressSamples = matchProgressSamples.get(matchId)?.get(pid) ?? sub.samples;
    const metrics = computeServerMetrics(
      targetText,
      typedClamped,
      elapsedMs,
      progressSamples,
      matchTimeLimitMs,
      sub.totalErrors,
      sub.totalKeystrokes,
    );

    // Keep "performanceScore" for placement/analytics systems elsewhere,
    // but use normalized 0-100 combat score for round damage.
    const score = roundCombatScore(
      metrics.wpm,
      metrics.accuracy,
      config.playerRatings?.[pid] ?? null,
    );

    roundStats.set(pid, {
      wpm: round2(metrics.wpm),
      accuracy: round4(metrics.accuracy),
      consistency: round4(metrics.consistency),
      score: round2(score),
      correctChars: metrics.correctChars,
      totalTyped: metrics.totalTyped,
      errors: metrics.errors,
      rawWpm: round2(metrics.rawWpm),
    });

    const aggregate = state.aggregates.get(pid) ?? createInitialAggregate();
    aggregate.roundsPlayed += 1;
    aggregate.wpmTotal += metrics.wpm;
    aggregate.accuracyTotal += metrics.accuracy;
    aggregate.consistencyTotal += metrics.consistency;
    aggregate.scoreTotal += score;
    aggregate.correctCharsTotal += metrics.correctChars;
    aggregate.totalTypedTotal += metrics.totalTyped;
    aggregate.errorsTotal += metrics.errors;
    aggregate.rawWpmTotal += metrics.rawWpm;
    aggregate.progressSamples.push(...progressSamples);
    state.aggregates.set(pid, aggregate);
  }

  return roundStats;
}

async function finaliseMatch(matchId: string) {
  const config = activeMatchConfigs.get(matchId);
  const state = runtimeMatches.get(matchId);
  if (!config || !state) return;

  const [p1, p2] = getPlayerIds(config);
  const agg1 = state.aggregates.get(p1) ?? createInitialAggregate();
  const agg2 = state.aggregates.get(p2) ?? createInitialAggregate();

  const rounds1 = Math.max(agg1.roundsPlayed, 1);
  const rounds2 = Math.max(agg2.roundsPlayed, 1);

  const r1 = {
    wpm: round2(agg1.wpmTotal / rounds1),
    accuracy: round4(agg1.accuracyTotal / rounds1),
    consistency: round4(agg1.consistencyTotal / rounds1),
    score: round2(agg1.scoreTotal / rounds1),
    correctChars: agg1.correctCharsTotal,
    totalTyped: agg1.totalTypedTotal,
    errors: agg1.errorsTotal,
    rawWpm: round2(agg1.rawWpmTotal / rounds1),
  };

  const r2 = {
    wpm: round2(agg2.wpmTotal / rounds2),
    accuracy: round4(agg2.accuracyTotal / rounds2),
    consistency: round4(agg2.consistencyTotal / rounds2),
    score: round2(agg2.scoreTotal / rounds2),
    correctChars: agg2.correctCharsTotal,
    totalTyped: agg2.totalTypedTotal,
    errors: agg2.errorsTotal,
    rawWpm: round2(agg2.rawWpmTotal / rounds2),
  };

  const p1Hp = state.playerHp.get(p1) ?? 0;
  const p2Hp = state.playerHp.get(p2) ?? 0;

  let p1Result: 'win' | 'loss' | 'draw';
  let p2Result: 'win' | 'loss' | 'draw';

  if (state.drawAccepted) {
    p1Result = 'draw';
    p2Result = 'draw';
  } else if (state.winnerUserId === p1) {
    p1Result = 'win';
    p2Result = 'loss';
  } else if (state.winnerUserId === p2) {
    p1Result = 'loss';
    p2Result = 'win';
  } else if (p1Hp > p2Hp) {
    p1Result = 'win';
    p2Result = 'loss';
  } else if (p2Hp > p1Hp) {
    p1Result = 'loss';
    p2Result = 'win';
  } else {
    p1Result = 'draw';
    p2Result = 'draw';
  }

  const p1Damage = agg1.damageDealtTotal;
  const p2Damage = agg2.damageDealtTotal;

  let p1RatingDelta = 0;
  let p2RatingDelta = 0;
  let p1NewRating: number | null = null;
  let p2NewRating: number | null = null;
  let p1CompetitiveElo: number | null = null;
  let p2CompetitiveElo: number | null = null;

  if (prisma) {
    const p1Samples = agg1.progressSamples;
    const p2Samples = agg2.progressSamples;

    try {
      await prisma.$transaction([
        prisma.matchPlayer.updateMany({
          where: { matchId, userId: p1 },
          data: {
            wpm: r1.wpm,
            accuracy: r1.accuracy,
            consistency: r1.consistency,
            score: r1.score,
            result: p1Result,
            damageDealt: p1Damage,
            damageTaken: p2Damage,
            rawWpm: r1.rawWpm,
            errors: r1.errors,
            correctChars: r1.correctChars,
            totalTyped: r1.totalTyped,
            progressSamples: p1Samples,
          },
        }),
        prisma.matchPlayer.updateMany({
          where: { matchId, userId: p2 },
          data: {
            wpm: r2.wpm,
            accuracy: r2.accuracy,
            consistency: r2.consistency,
            score: r2.score,
            result: p2Result,
            damageDealt: p2Damage,
            damageTaken: p1Damage,
            rawWpm: r2.rawWpm,
            errors: r2.errors,
            correctChars: r2.correctChars,
            totalTyped: r2.totalTyped,
            progressSamples: p2Samples,
          },
        }),
        prisma.match.update({
          where: { id: matchId },
          data: { status: 'completed' },
        }),
      ]);

      const [rating1, rating2] = await Promise.all([
        prisma.rating.findUnique({ where: { userId: p1 } }),
        prisma.rating.findUnique({ where: { userId: p2 } }),
      ]);

      // Always compute and store a per-match ELO delta for history rows.
      // If a player is still unranked, use a provisional matchmaking MMR.
      const PROVISIONAL_MMR = 1050;
      const p1EffectiveRating = rating1?.rating ?? config.playerRatings?.[p1] ?? PROVISIONAL_MMR;
      const p2EffectiveRating = rating2?.rating ?? config.playerRatings?.[p2] ?? PROVISIONAL_MMR;

      p1RatingDelta = calculateEloChange({
        playerRating: p1EffectiveRating,
        opponentRating: p2EffectiveRating,
        result: p1Result,
        playerScore: agg1.scoreTotal,
        opponentScore: agg2.scoreTotal,
        playerHp: p1Hp,
        opponentHp: p2Hp,
        forfeited: state.forfeitedUserId === p1,
      });
      p2RatingDelta = calculateEloChange({
        playerRating: p2EffectiveRating,
        opponentRating: p1EffectiveRating,
        result: p2Result,
        playerScore: agg2.scoreTotal,
        opponentScore: agg1.scoreTotal,
        playerHp: p2Hp,
        opponentHp: p1Hp,
        forfeited: state.forfeitedUserId === p2,
      });

      const p1Ranked = rating1?.rating != null;
      const p2Ranked = rating2?.rating != null;

      if (p1Ranked) p1NewRating = Math.max(0, (rating1?.rating ?? 0) + p1RatingDelta);
      if (p2Ranked) p2NewRating = Math.max(0, (rating2?.rating ?? 0) + p2RatingDelta);

      // Overperformance accelerator:
      // if recent 6-7 game averages are consistently at a higher-tier level,
      // promote by up to 2 tiers and land at +50 in that promoted tier.
      if (p1Ranked && p1NewRating != null) {
        const promoted = await resolveOverperformPromotionRating(p1, p1NewRating);
        if (promoted != null && promoted > p1NewRating) {
          p1RatingDelta += promoted - p1NewRating;
          p1NewRating = promoted;
        }
      }
      if (p2Ranked && p2NewRating != null) {
        const promoted = await resolveOverperformPromotionRating(p2, p2NewRating);
        if (promoted != null && promoted > p2NewRating) {
          p2RatingDelta += promoted - p2NewRating;
          p2NewRating = promoted;
        }
      }

      if (p1Ranked || p2Ranked) {
        const APEX_MMR = 2100;
        const countAbove = async (mmr: number) =>
          prisma!.rating.count({ where: { rating: { gt: mmr } } });

        const resolveCompElo = async (
          currentCompElo: number | null,
          newMmr: number,
          delta: number,
        ): Promise<number | null> => {
          if (newMmr < APEX_MMR) return null;
          if (currentCompElo != null) return Math.max(0, currentCompElo + delta);
          const above = await countAbove(newMmr);
          const position = above + 1;
          if (position <= 1500) return 0;
          return null;
        };

        const tx: ReturnType<typeof prisma.rating.update>[] = [];

        if (p1Ranked && rating1 && p1NewRating != null) {
          const p1NewCompElo = await resolveCompElo(rating1.competitiveElo, p1NewRating, p1RatingDelta);
          p1CompetitiveElo = p1NewCompElo;
          tx.push(prisma.rating.update({
            where: { userId: p1 },
            data: {
              rating: p1NewRating,
              competitiveElo: p1NewCompElo,
            },
          }));
        }

        if (p2Ranked && rating2 && p2NewRating != null) {
          const p2NewCompElo = await resolveCompElo(rating2.competitiveElo, p2NewRating, p2RatingDelta);
          p2CompetitiveElo = p2NewCompElo;
          tx.push(prisma.rating.update({
            where: { userId: p2 },
            data: {
              rating: p2NewRating,
              competitiveElo: p2NewCompElo,
            },
          }));
        }

        if (tx.length) {
          await prisma.$transaction(tx);
        }
      }

      if (!p1Ranked || !p2Ranked) {
        const placementPlayers: { userId: string; newCount: number }[] = [];

        if (rating1 && rating1.rating == null) {
          placementPlayers.push({ userId: p1, newCount: rating1.placementGamesPlayed + 1 });
        }
        if (rating2 && rating2.rating == null) {
          placementPlayers.push({ userId: p2, newCount: rating2.placementGamesPlayed + 1 });
        }

        if (placementPlayers.length) {
          await prisma.$transaction(
            placementPlayers.map((pp) =>
              prisma!.rating.update({
                where: { userId: pp.userId },
                data: { placementGamesPlayed: pp.newCount },
              }),
            ),
          );
        }

        for (const pp of placementPlayers) {
          if (pp.newCount >= PLACEMENT_GAMES_REQUIRED) {
            const initialMmr = await resolvePlacementRating(pp.userId, PLACEMENT_GAMES_REQUIRED);
            if (initialMmr != null) {
              await prisma!.rating.update({
                where: { userId: pp.userId },
                data: { rating: initialMmr },
              });

              if (pp.userId === p1) p1NewRating = initialMmr;
              if (pp.userId === p2) p2NewRating = initialMmr;
            }
          }
        }
      }

      await prisma.$transaction([
        prisma.matchPlayer.updateMany({
          where: { matchId, userId: p1 },
          data: {
            ratingBefore: rating1?.rating ?? null,
            ratingAfter: p1NewRating,
            ratingDelta: p1RatingDelta,
          },
        }),
        prisma.matchPlayer.updateMany({
          where: { matchId, userId: p2 },
          data: {
            ratingBefore: rating2?.rating ?? null,
            ratingAfter: p2NewRating,
            ratingDelta: p2RatingDelta,
          },
        }),
      ]);
    } catch (err) {
      log.error({ err, matchId }, 'Failed to persist match results');
    }
  }

  const room = rooms.get(matchId);
  if (room) {
    const payload = {
      type: 'match_complete',
      matchId,
      players: {
        [p1]: {
          ...r1,
          result: p1Result,
          damageDealt: p1Damage,
          damageTaken: p2Damage,
          ratingDelta: p1RatingDelta,
          newRating: p1NewRating,
          competitiveElo: p1CompetitiveElo,
        },
        [p2]: {
          ...r2,
          result: p2Result,
          damageDealt: p2Damage,
          damageTaken: p1Damage,
          ratingDelta: p2RatingDelta,
          newRating: p2NewRating,
          competitiveElo: p2CompetitiveElo,
        },
      },
    };
    room.forEach((sock) => send(sock, payload));
  }

  cleanupMatchState(matchId);
}

function applyRoundDamageAndWinner(
  config: MatchConfig,
  state: RuntimeMatchState,
  baseStats: Map<string, Omit<PlayerRoundStats, 'damageDealt' | 'damageTaken' | 'hp'>>,
): {
  roundPayloadPlayers: Record<string, PlayerRoundStats>;
  roundWinner: string | 'draw';
  roundWins: Record<string, number>;
  overtimeActive: boolean;
  drawWindowOpen: boolean;
  matchEnded: boolean;
  nextRoundStartAt: number | null;
} {
  const [p1, p2] = getPlayerIds(config);
  const s1 = baseStats.get(p1)!;
  const s2 = baseStats.get(p2)!;

  let p1Damage = 0;
  let p2Damage = 0;
  if (s1.score > s2.score) {
    p1Damage = damageFromScores(s1.score, s2.score);
  } else if (s2.score > s1.score) {
    p2Damage = damageFromScores(s2.score, s1.score);
  }

  const p1Hp = Math.max(0, (state.playerHp.get(p1) ?? 100) - p2Damage);
  const p2Hp = Math.max(0, (state.playerHp.get(p2) ?? 100) - p1Damage);
  state.playerHp.set(p1, p1Hp);
  state.playerHp.set(p2, p2Hp);

  const p1Agg = state.aggregates.get(p1);
  const p2Agg = state.aggregates.get(p2);
  if (p1Agg) {
    p1Agg.damageDealtTotal += p1Damage;
    p1Agg.damageTakenTotal += p2Damage;
  }
  if (p2Agg) {
    p2Agg.damageDealtTotal += p2Damage;
    p2Agg.damageTakenTotal += p1Damage;
  }

  let roundWinner: string | 'draw' = 'draw';
  if (p1Damage > p2Damage) {
    roundWinner = p1;
    state.roundWins.set(p1, (state.roundWins.get(p1) ?? 0) + 1);
  } else if (p2Damage > p1Damage) {
    roundWinner = p2;
    state.roundWins.set(p2, (state.roundWins.get(p2) ?? 0) + 1);
  }

  const p1Wins = state.roundWins.get(p1) ?? 0;
  const p2Wins = state.roundWins.get(p2) ?? 0;

  if (
    !state.overtimeActive &&
    ((p1Wins >= OVERTIME_TRIGGER_WINS && p2Wins >= OVERTIME_TRIGGER_WINS) || state.currentRound >= REGULATION_ROUNDS)
  ) {
    state.overtimeActive = true;
  }

  const p1KnockedOut = p1Hp <= 0;
  const p2KnockedOut = p2Hp <= 0;
  const matchEnded = p1KnockedOut || p2KnockedOut;

  if (matchEnded) {
    if (p1KnockedOut && !p2KnockedOut) {
      state.winnerUserId = p2;
    } else if (p2KnockedOut && !p1KnockedOut) {
      state.winnerUserId = p1;
    } else if (roundWinner === p1 || roundWinner === p2) {
      state.winnerUserId = roundWinner;
    } else {
      state.winnerUserId = null;
    }
    state.drawWindowOpen = false;
    state.drawVotes.clear();
  } else {
    const roundsDone = state.currentRound;
    const drawWindowOpen =
      state.overtimeActive &&
      roundsDone > REGULATION_ROUNDS &&
      (roundsDone - REGULATION_ROUNDS) % 2 === 0;
    state.drawWindowOpen = drawWindowOpen;
    state.drawVotes.clear();
  }

  const nextRoundStartAt = matchEnded
    ? null
    : Date.now() + (state.breakSeconds + state.countdownSeconds) * 1000;

  const roundPayloadPlayers: Record<string, PlayerRoundStats> = {
    [p1]: {
      ...s1,
      damageDealt: p1Damage,
      damageTaken: p2Damage,
      hp: p1Hp,
    },
    [p2]: {
      ...s2,
      damageDealt: p2Damage,
      damageTaken: p1Damage,
      hp: p2Hp,
    },
  };

  return {
    roundPayloadPlayers,
    roundWinner,
    roundWins: {
      [p1]: state.roundWins.get(p1) ?? 0,
      [p2]: state.roundWins.get(p2) ?? 0,
    },
    overtimeActive: state.overtimeActive,
    drawWindowOpen: state.drawWindowOpen,
    matchEnded,
    nextRoundStartAt,
  };
}

async function resolveCurrentRound(matchId: string) {
  const config = activeMatchConfigs.get(matchId);
  const state = runtimeMatches.get(matchId);
  const submissions = matchSubmissions.get(matchId);
  if (!config || !state || !submissions || state.winnerUserId) return;

  const baseStats = buildRoundStats(matchId, config, state, submissions);
  const {
    roundPayloadPlayers,
    roundWinner,
    roundWins,
    overtimeActive,
    drawWindowOpen,
    matchEnded,
    nextRoundStartAt,
  } = applyRoundDamageAndWinner(config, state, baseStats);

  const room = rooms.get(matchId);
  if (room) {
    room.forEach((sock) => {
      send(sock, {
        type: 'round_end',
        matchId,
        roundNumber: state.currentRound,
        maxRounds: state.maxRounds,
        winner: roundWinner,
        players: roundPayloadPlayers,
        roundWins,
        overtimeActive,
        drawWindowOpen,
        breakSeconds: state.breakSeconds,
        countdownSeconds: state.countdownSeconds,
        nextRoundStartAt,
      });
    });
  }

  matchSubmissions.delete(matchId);
  matchProgressSamples.delete(matchId);
  latestProgress.delete(matchId);

  if (matchEnded) {
    await finaliseMatch(matchId);
    return;
  }

  if (nextRoundStartAt) {
    state.currentRound += 1;
    state.roundStartAt = nextRoundStartAt;
  }
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const progressSchema = z.object({
  type: z.literal('progress'),
  progressIndex: z.number().int().min(0),
  typedLength: z.number().int().min(0),
  mistakesCount: z.number().int().min(0),
  elapsedMs: z.number().int().min(0),
});

const resultSchema = z.object({
  type: z.literal('result'),
  typed: z.string().max(10_000),
  samples: z.array(z.number()).max(300).default([]),
  totalErrors: z.number().int().nonnegative().optional(),
  totalKeystrokes: z.number().int().nonnegative().optional(),
});

const forfeitSchema = z.object({
  type: z.literal('forfeit'),
});

const drawVoteSchema = z.object({
  type: z.literal('draw_vote'),
  vote: z.enum(['draw', 'continue']),
});

// ---------------------------------------------------------------------------
// WebSocket handler
// ---------------------------------------------------------------------------

export async function liveMatchWs(app: FastifyInstance) {
  log = app.log;

  app.get('/ws/match', { websocket: true }, (connection, request: FastifyRequest) => {
    const socket = connection instanceof WebSocket
      ? connection
      : (connection as unknown as { socket: WebSocket }).socket;

    send(socket, { type: 'welcome', message: 'live match connected' });

    socket.on('message', (data: RawData) => {
      // Per-connection rate limit: 30 burst, 10/sec refill
      if (!wsRateLimitAllow(socket)) {
        send(socket, { type: 'error', message: 'rate limited — slow down' });
        return;
      }

      void (async () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(data.toString());
        } catch {
          send(socket, { type: 'error', message: 'invalid json' });
          return;
        }

        if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
          send(socket, { type: 'error', message: 'invalid message' });
          return;
        }

        const message = parsed as Record<string, unknown>;

        if (message.type === 'join') {
          const joinPayload = z.object({
            type: z.literal('join'),
            matchId: z.string().uuid(),
            token: z.string().min(10).optional(),
          }).safeParse(message);

          if (!joinPayload.success) {
            send(socket, { type: 'error', message: 'invalid join payload' });
            return;
          }

          const token = joinPayload.data.token ?? getBearerToken(request.headers.authorization ?? undefined);
          const authUser = token ? verifyAuthToken(token) : null;
          if (!authUser) {
            send(socket, { type: 'error', message: 'unauthorized' });
            return;
          }

          const canJoin = await isPlayerInMatch(joinPayload.data.matchId, authUser.id);
          if (!canJoin) {
            send(socket, { type: 'error', message: 'user is not in this match' });
            return;
          }

          const room = rooms.get(joinPayload.data.matchId) ?? new Map<string, WebSocket>();
          const existingSocket = room.get(authUser.id);
          if (existingSocket && existingSocket !== socket) {
            existingSocket.close();
          }

          room.set(authUser.id, socket);
          rooms.set(joinPayload.data.matchId, room);
          socketContexts.set(socket, { matchId: joinPayload.data.matchId, userId: authUser.id });

          const config = activeMatchConfigs.get(joinPayload.data.matchId);
          const runtime = getOrCreateRuntimeState(joinPayload.data.matchId);

          clearDisconnected(joinPayload.data.matchId, authUser.id);

          const isReconnect = runtime ? Date.now() > runtime.roundStartAt : (config ? Date.now() > config.startAt : false);

          send(socket, {
            type: 'joined',
            matchId: joinPayload.data.matchId,
            userId: authUser.id,
            config: config && runtime ? {
              seed: config.seed,
              mode: config.mode,
              limit: config.limit,
              difficulty: config.difficulty,
              textLength: config.textLength,
              includePunctuation: config.includePunctuation,
              startAt: runtime.roundStartAt,
              roundNumber: runtime.currentRound,
              maxRounds: runtime.maxRounds,
              roundWins: Object.fromEntries(runtime.roundWins.entries()),
              overtimeActive: runtime.overtimeActive,
              drawWindowOpen: runtime.drawWindowOpen,
              breakSeconds: runtime.breakSeconds,
              countdownSeconds: runtime.countdownSeconds,
              prepSeconds: config.prepSeconds ?? 10,
            } : null,
          });

          if (isReconnect && runtime) {
            const matchProgress = latestProgress.get(joinPayload.data.matchId);
            const opponentProgressData: Record<string, {
              progressIndex: number;
              typedLength: number;
              mistakesCount: number;
              elapsedMs: number;
            }> = {};
            const opponentFinishedList: string[] = [];

            if (matchProgress) {
              for (const [uid, prog] of matchProgress.entries()) {
                if (uid !== authUser.id) {
                  opponentProgressData[uid] = prog;
                }
              }
            }

            const subs = matchSubmissions.get(joinPayload.data.matchId);
            if (subs) {
              for (const [uid] of subs.entries()) {
                if (uid !== authUser.id) opponentFinishedList.push(uid);
              }
            }

            const hp: Record<string, number> = {};
            runtime.playerHp.forEach((value, key) => {
              hp[key] = value;
            });

            send(socket, {
              type: 'match_state_recovery',
              matchId: joinPayload.data.matchId,
              serverTime: Date.now(),
              opponentProgress: opponentProgressData,
              opponentFinished: opponentFinishedList,
              roundNumber: runtime.currentRound,
              roundStartAt: runtime.roundStartAt,
              maxRounds: runtime.maxRounds,
              roundWins: Object.fromEntries(runtime.roundWins.entries()),
              overtimeActive: runtime.overtimeActive,
              drawWindowOpen: runtime.drawWindowOpen,
              hp,
            });
          }

          room.forEach((memberSocket, userId) => {
            if (userId !== authUser.id) {
              send(memberSocket, {
                type: 'opponent_joined',
                matchId: joinPayload.data.matchId,
                userId: authUser.id,
              });
            }
          });
          return;
        }

        const context = socketContexts.get(socket);
        if (!context) {
          // Ignore out-of-order match events until the client has joined.
          return;
        }

        if (message.type === 'progress') {
          const payload = progressSchema.safeParse(message);
          if (!payload.success) {
            send(socket, { type: 'error', message: 'invalid progress payload' });
            return;
          }

          if (!matchProgressSamples.has(context.matchId)) {
            matchProgressSamples.set(context.matchId, new Map());
          }
          const matchSamples = matchProgressSamples.get(context.matchId)!;
          if (!matchSamples.has(context.userId)) {
            matchSamples.set(context.userId, []);
          }
          matchSamples.get(context.userId)!.push(payload.data.typedLength);

          if (!latestProgress.has(context.matchId)) {
            latestProgress.set(context.matchId, new Map());
          }
          latestProgress.get(context.matchId)!.set(context.userId, {
            progressIndex: payload.data.progressIndex,
            typedLength: payload.data.typedLength,
            mistakesCount: payload.data.mistakesCount,
            elapsedMs: payload.data.elapsedMs,
          });

          const room = rooms.get(context.matchId);
          if (!room) return;
          room.forEach((memberSocket, userId) => {
            if (userId !== context.userId) {
              send(memberSocket, {
                type: 'opponent_progress',
                matchId: context.matchId,
                userId: context.userId,
                progressIndex: payload.data.progressIndex,
                typedLength: payload.data.typedLength,
                mistakesCount: payload.data.mistakesCount,
                elapsedMs: payload.data.elapsedMs,
              });
            }
          });
          return;
        }

        if (message.type === 'result') {
          const payload = resultSchema.safeParse(message);
          if (!payload.success) {
            send(socket, { type: 'error', message: 'invalid result payload' });
            return;
          }

          const config = activeMatchConfigs.get(context.matchId);
          const state = getOrCreateRuntimeState(context.matchId);
          if (!config || !state) {
            // Match already ended / cleaned up; ignore stale late submissions.
            return;
          }

          const now = Date.now();
          const deadline = state.roundStartAt + config.limit * 1000 + SUBMIT_GRACE_MS;
          if (now > deadline) {
            send(socket, { type: 'error', message: 'submission past deadline' });
            return;
          }

          if (!matchSubmissions.has(context.matchId)) {
            matchSubmissions.set(context.matchId, new Map());
          }
          const subs = matchSubmissions.get(context.matchId)!;
          if (subs.has(context.userId)) {
            send(socket, { type: 'error', message: 'already submitted' });
            return;
          }

          subs.set(context.userId, {
            typed: payload.data.typed,
            samples: payload.data.samples,
            submitTime: now,
            totalErrors: payload.data.totalErrors,
            totalKeystrokes: payload.data.totalKeystrokes,
          });

          send(socket, { type: 'result_received', matchId: context.matchId });

          const room = rooms.get(context.matchId);
          if (room) {
            room.forEach((memberSocket, userId) => {
              if (userId !== context.userId) {
                send(memberSocket, {
                  type: 'opponent_finished',
                  matchId: context.matchId,
                  userId: context.userId,
                });
              }
            });
          }

          if (subs.size >= config.playerIds.length) {
            await resolveCurrentRound(context.matchId);
          }
          return;
        }

        if (message.type === 'forfeit') {
          const payload = forfeitSchema.safeParse(message);
          if (!payload.success) {
            send(socket, { type: 'error', message: 'invalid forfeit payload' });
            return;
          }

          const config = activeMatchConfigs.get(context.matchId);
          const state = getOrCreateRuntimeState(context.matchId);
          if (!config || !state) return;

          const opponentId = config.playerIds.find((id) => id !== context.userId) ?? null;
          state.playerHp.set(context.userId, 0);
          state.winnerUserId = opponentId;
          state.forfeitedUserId = context.userId;

          await finaliseMatch(context.matchId);
          return;
        }

        if (message.type === 'draw_vote') {
          const payload = drawVoteSchema.safeParse(message);
          if (!payload.success) {
            send(socket, { type: 'error', message: 'invalid draw vote payload' });
            return;
          }

          const config = activeMatchConfigs.get(context.matchId);
          const state = getOrCreateRuntimeState(context.matchId);
          if (!config || !state || !state.drawWindowOpen || state.winnerUserId) return;

          state.drawVotes.set(context.userId, payload.data.vote);

          if (payload.data.vote === 'continue') {
            state.drawWindowOpen = false;
            state.drawVotes.clear();
            return;
          }

          const allPlayersVotedDraw = config.playerIds.every((id) => state.drawVotes.get(id) === 'draw');
          if (allPlayersVotedDraw) {
            state.drawAccepted = true;
            state.drawWindowOpen = false;
            state.drawVotes.clear();
            state.winnerUserId = null;
            await finaliseMatch(context.matchId);
          }
          return;
        }

        if (message.type === 'ping') {
          const clientTs = typeof message.clientTs === 'number' ? message.clientTs : 0;
          send(socket, {
            type: 'pong',
            clientTs,
            serverTs: Date.now(),
          });
          return;
        }

        send(socket, { type: 'error', message: 'unknown message type' });
      })().catch((err: unknown) => {
        log.error({ err, matchId: (socket as unknown as { __ctx?: SocketContext }).__ctx?.matchId }, 'live-match message handler error');
        send(socket, { type: 'error', message: 'internal error' });
      });
    });

    socket.on('close', () => {
      removeSocketFromRoom(socket);
    });
  });
}
