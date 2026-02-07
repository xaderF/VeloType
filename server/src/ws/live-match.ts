import type { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import { z } from 'zod';
import { getBearerToken, verifyAuthToken } from '../auth.js';
import { prisma } from '../db.js';
import { generateText } from '../engine/text.js';
import {
  computeServerMetrics,
  performanceScore,
  damageFromScores,
  calculateEloChange,
} from '../engine/metrics.js';
import { calculatePlacementRating, type PlacementGameResult } from '../placement.js';

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
  limit: number;        // seconds (e.g. 30)
  difficulty: string;
  textLength: number;
  includePunctuation: boolean;
  startAt: number;       // epoch ms
}

interface PlayerSubmission {
  typed: string;
  samples: number[];
  submitTime: number;    // epoch ms
}

// ---------------------------------------------------------------------------
// In-memory state – keyed by matchId
// ---------------------------------------------------------------------------

const rooms = new Map<string, RoomMembers>();
const socketContexts = new WeakMap<WebSocket, SocketContext>();

/** Match configs pushed here by matchmaking when MATCH_FOUND fires */
export const activeMatchConfigs = new Map<string, MatchConfig>();

/** Submissions received; once both players submit the server finalises */
const matchSubmissions = new Map<string, Map<string, PlayerSubmission>>();

/** Per-second progress samples stored during the match for consistency */
const matchProgressSamples = new Map<string, Map<string, number[]>>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Placement resolution — queries last N games and runs the placement algo
// ---------------------------------------------------------------------------

async function resolvePlacementRating(
  userId: string,
  requiredGames: number,
): Promise<number | null> {
  if (!prisma) return null;

  // Fetch the player's last N completed matches with their stats + opponent info
  const recentMatchPlayers = await prisma.matchPlayer.findMany({
    where: {
      userId,
      wpm: { not: null },       // only completed games
      result: { not: null },
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
    // Not enough completed games yet — shouldn't happen but safety check
    return null;
  }

  // Build PlacementGameResult array (oldest first)
  const games: PlacementGameResult[] = recentMatchPlayers
    .reverse() // DB returned newest-first, algo expects oldest-first
    .map((mp) => {
      const opponent = mp.match.players[0]; // the other player in this match
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

// ---------------------------------------------------------------------------
// Server-authoritative match finalisation
// ---------------------------------------------------------------------------

const SUBMIT_GRACE_MS = 5_000; // 5 s grace after time limit

async function finaliseMatch(matchId: string) {
  const config = activeMatchConfigs.get(matchId);
  const subs = matchSubmissions.get(matchId);
  if (!config || !subs) return;

  // Regenerate the target text server-side (deterministic from seed)
  const targetText = generateText({
    seed: config.seed,
    length: config.textLength,
    difficulty: (config.difficulty as 'easy' | 'medium' | 'hard') ?? 'medium',
    includePunctuation: config.includePunctuation,
  });

  const playerIds = [...subs.keys()];
  const results = new Map<string, {
    wpm: number;
    accuracy: number;
    consistency: number;
    score: number;
    correctChars: number;
    totalTyped: number;
    errors: number;
    rawWpm: number;
  }>();

  for (const pid of playerIds) {
    const sub = subs.get(pid)!;

    // Elapsed time clamped to match limit
    const matchTimeLimitMs = config.limit * 1000;
    const elapsedMs = Math.min(
      sub.submitTime - config.startAt,
      matchTimeLimitMs,
    );

    // Plausibility: max ~20 chars/sec (≈240 WPM) — catches teleporting
    const maxPlausibleChars = Math.ceil((matchTimeLimitMs / 1000) * 20);
    const typedClamped = sub.typed.length > maxPlausibleChars
      ? sub.typed.slice(0, maxPlausibleChars)
      : sub.typed;

    // Per-second samples collected during the match
    const progressSamples = matchProgressSamples.get(matchId)?.get(pid) ?? sub.samples;

    // Use the full match time limit for WPM so early-submitters aren't rewarded
    const metrics = computeServerMetrics(
      targetText,
      typedClamped,
      Math.max(elapsedMs, 1),
      progressSamples,
      matchTimeLimitMs,
    );

    const pScore = performanceScore(metrics.wpm, metrics.accuracy, metrics.consistency);

    results.set(pid, {
      wpm: Math.round(metrics.wpm * 100) / 100,
      accuracy: Math.round(metrics.accuracy * 10000) / 10000,
      consistency: Math.round(metrics.consistency * 10000) / 10000,
      score: Math.round(pScore * 100) / 100,
      correctChars: metrics.correctChars,
      totalTyped: metrics.totalTyped,
      errors: metrics.errors,
      rawWpm: Math.round(metrics.rawWpm * 100) / 100,
    });
  }

  // Determine winner
  const [p1, p2] = playerIds;
  const r1 = results.get(p1)!;
  const r2 = results.get(p2)!;

  let p1Result: string;
  let p2Result: string;
  let p1Damage = 0;
  let p2Damage = 0;

  if (r1.score > r2.score) {
    p1Result = 'win';
    p2Result = 'loss';
    p1Damage = damageFromScores(r1.score, r2.score);
  } else if (r2.score > r1.score) {
    p1Result = 'loss';
    p2Result = 'win';
    p2Damage = damageFromScores(r2.score, r1.score);
  } else {
    p1Result = 'draw';
    p2Result = 'draw';
  }

  // Rating change tracking (populated below when DB is available)
  let p1RatingDelta = 0;
  let p2RatingDelta = 0;
  let p1NewRating: number | null = null;
  let p2NewRating: number | null = null;
  let p1CompetitiveElo: number | null = null;
  let p2CompetitiveElo: number | null = null;

  // Persist to DB when configured.
  if (prisma) {
    try {
      // 1. Persist match player stats + match status
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
          },
        }),
        prisma.match.update({
          where: { id: matchId },
          data: { status: 'completed' },
        }),
      ]);

      // 2. Update ratings (hidden MMR + competitive ELO for Apex+)
      const [rating1, rating2] = await Promise.all([
        prisma.rating.findUnique({ where: { userId: p1 } }),
        prisma.rating.findUnique({ where: { userId: p2 } }),
      ]);

      // Only update ratings when both players have completed placement (rating != null)
      if (rating1?.rating != null && rating2?.rating != null) {
        p1RatingDelta = calculateEloChange(
          rating1.rating, rating2.rating, p1Result as 'win' | 'loss' | 'draw',
        );
        p2RatingDelta = calculateEloChange(
          rating2.rating, rating1.rating, p2Result as 'win' | 'loss' | 'draw',
        );

        p1NewRating = Math.max(0, rating1.rating + p1RatingDelta);
        p2NewRating = Math.max(0, rating2.rating + p2RatingDelta);

        // -------------------------------------------------------------------
        // Competitive ELO — synced with hidden MMR for Apex+ players.
        //
        // Minimum MMR thresholds (must also meet leaderboard position):
        //   Apex:    >= 2100  AND top 1500
        //   Paragon: >= 2400  AND top 500
        //
        // Promotion:  When a player's new MMR >= 2100 and they're in top 1500
        //             but competitiveElo is still null → set it to 0.
        // Active:     When competitiveElo is non-null AND new MMR still >= 2100
        //             → apply the same delta as hidden MMR.
        // Demotion:   When competitiveElo is non-null but new MMR drops < 2100
        //             → null it out (player falls back to Velocity display).
        //
        // Note: leaderboard position check requires counting ratings above
        // the player's — done inline here. Paragon promotion (top 500) is the
        // same query but with a stricter count threshold.
        // -------------------------------------------------------------------
        const APEX_MMR = 2100;

        // Helper: count how many rated players have MMR strictly above a value
        const countAbove = async (mmr: number) =>
          prisma!.rating.count({ where: { rating: { gt: mmr } } });

        // Compute competitive ELO for each player
        const resolveCompElo = async (
          currentCompElo: number | null,
          newMmr: number,
          delta: number,
        ): Promise<number | null> => {
          if (newMmr < APEX_MMR) {
            // Below MMR floor → demote (or stay demoted)
            return null;
          }
          if (currentCompElo != null) {
            // Already in Apex+ → apply same delta, floor at 0
            return Math.max(0, currentCompElo + delta);
          }
          // New MMR qualifies — check leaderboard position for promotion
          const above = await countAbove(newMmr);
          const position = above + 1; // 1-indexed leaderboard position
          if (position <= 1500) {
            // Promoted to Apex! Competitive ELO starts at 0
            return 0;
          }
          return null; // MMR is high enough but not in top 1500 yet
        };

        const p1NewCompElo = await resolveCompElo(
          rating1.competitiveElo, p1NewRating, p1RatingDelta,
        );
        const p2NewCompElo = await resolveCompElo(
          rating2.competitiveElo, p2NewRating, p2RatingDelta,
        );

        await prisma.$transaction([
          prisma.rating.update({
            where: { userId: p1 },
            data: {
              rating: p1NewRating,
              // Explicitly set competitiveElo: number when promoted/active, null when demoted
              competitiveElo: p1NewCompElo,
            },
          }),
          prisma.rating.update({
            where: { userId: p2 },
            data: {
              rating: p2NewRating,
              competitiveElo: p2NewCompElo,
            },
          }),
        ]);

        p1CompetitiveElo = p1NewCompElo;
        p2CompetitiveElo = p2NewCompElo;
      } else {
        // At least one player is still in placement — increment their placement count
        // and check if they've completed all 5 placement games.
        const placementPlayers: { userId: string; newCount: number }[] = [];

        if (rating1 && rating1.rating == null) {
          const newCount = rating1.placementGamesPlayed + 1;
          placementPlayers.push({ userId: p1, newCount });
        }
        if (rating2 && rating2.rating == null) {
          const newCount = rating2.placementGamesPlayed + 1;
          placementPlayers.push({ userId: p2, newCount });
        }

        // Increment placement counters first
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

        // Check if any placement player just finished their 5th game
        const PLACEMENT_GAMES_REQUIRED = 5;
        for (const pp of placementPlayers) {
          if (pp.newCount >= PLACEMENT_GAMES_REQUIRED) {
            const initialMmr = await resolvePlacementRating(pp.userId, PLACEMENT_GAMES_REQUIRED);
            if (initialMmr != null) {
              await prisma!.rating.update({
                where: { userId: pp.userId },
                data: { rating: initialMmr },
              });

              // Store so the broadcast includes the new rating
              if (pp.userId === p1) p1NewRating = initialMmr;
              if (pp.userId === p2) p2NewRating = initialMmr;
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to persist match results', err);
    }
  }

  // Broadcast match_complete to both players (includes rating deltas)
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

  // Cleanup in-memory state
  activeMatchConfigs.delete(matchId);
  matchSubmissions.delete(matchId);
  matchProgressSamples.delete(matchId);
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
  typed: z.string().max(10_000),                       // raw typed text
  samples: z.array(z.number()).max(300).default([]),   // per-second WPM samples
});

// ---------------------------------------------------------------------------
// WebSocket handler
// ---------------------------------------------------------------------------

export async function liveMatchWs(app: FastifyInstance) {
  app.get('/ws/match', { websocket: true }, (connection, request: FastifyRequest) => {
    const socket = connection instanceof WebSocket
      ? connection
      : (connection as unknown as { socket: WebSocket }).socket;

    send(socket, { type: 'welcome', message: 'live match connected' });

    socket.on('message', (data: RawData) => {
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

        // ---- JOIN ----
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

          // Include match config so client generates identical text
          const config = activeMatchConfigs.get(joinPayload.data.matchId);

          send(socket, {
            type: 'joined',
            matchId: joinPayload.data.matchId,
            userId: authUser.id,
            config: config ? {
              seed: config.seed,
              mode: config.mode,
              limit: config.limit,
              difficulty: config.difficulty,
              textLength: config.textLength,
              includePunctuation: config.includePunctuation,
              startAt: config.startAt,
            } : null,
          });

          // Notify other players
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

        // All subsequent messages require a joined context
        const context = socketContexts.get(socket);
        if (!context) {
          send(socket, { type: 'error', message: 'join required before match events' });
          return;
        }

        // ---- PROGRESS ----
        if (message.type === 'progress') {
          const payload = progressSchema.safeParse(message);
          if (!payload.success) {
            send(socket, { type: 'error', message: 'invalid progress payload' });
            return;
          }

          // Store per-second sample for consistency calculation
          if (!matchProgressSamples.has(context.matchId)) {
            matchProgressSamples.set(context.matchId, new Map());
          }
          const matchSamples = matchProgressSamples.get(context.matchId)!;
          if (!matchSamples.has(context.userId)) {
            matchSamples.set(context.userId, []);
          }
          matchSamples.get(context.userId)!.push(payload.data.typedLength);

          // Relay to opponent
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

        // ---- RESULT (server-authoritative) ----
        if (message.type === 'result') {
          const payload = resultSchema.safeParse(message);
          if (!payload.success) {
            send(socket, { type: 'error', message: 'invalid result payload' });
            return;
          }

          const config = activeMatchConfigs.get(context.matchId);
          if (!config) {
            send(socket, { type: 'error', message: 'match config not found' });
            return;
          }

          // Timing validation
          const now = Date.now();
          const deadline = config.startAt + config.limit * 1000 + SUBMIT_GRACE_MS;
          if (now > deadline) {
            send(socket, { type: 'error', message: 'submission past deadline' });
            return;
          }

          // Store submission
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
          });

          send(socket, { type: 'result_received', matchId: context.matchId });

          // Notify opponent that this player finished
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

          // Finalise once all players have submitted
          const totalPlayers = prisma
            ? await prisma.matchPlayer.count({
              where: { matchId: context.matchId },
            })
            : (activeMatchConfigs.get(context.matchId)?.playerIds.length ?? 2);
          if (subs.size >= totalPlayers) {
            await finaliseMatch(context.matchId);
          }
          return;
        }

        send(socket, { type: 'error', message: 'unknown message type' });
      })().catch((err: unknown) => {
        app.log.error(err);
        send(socket, { type: 'error', message: 'internal error' });
      });
    });

    socket.on('close', () => {
      removeSocketFromRoom(socket);
    });
  });
}
