import { randomUUID } from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyBaseLogger } from 'fastify';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import { prisma } from '../db.js';
import { verifyAuthToken } from '../auth.js';
import { activeMatchConfigs } from './live-match.js';
import { wsRateLimitAllow } from './ws-rate-limit.js';
import { calculatePlacementProgressRating, type PlacementGameResult } from '../placement.js';

// Module-level logger — initialised when the plugin registers
let log: FastifyBaseLogger;

type QueueEntry = {
  userId: string;
  username: string;
  rating: number | null; // public/display rating (null = unranked)
  matchmakingRating: number; // always numeric; includes provisional placement estimate
  joinedAt: number;
  socket: WebSocket;
};

const queue: QueueEntry[] = [];
const MATCH_INTERVAL_MS = 1000;
const MIN_QUEUE_WAIT_MS = 0;
let matcherInterval: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Rank system — must match client-side scoring.ts exactly.
//
//   Iron 1:      0–99     Bronze 1:  300–399   Silver 1:   600–699
//   Iron 2:    100–199    Bronze 2:  400–499   Silver 2:   700–799
//   Iron 3:    200–299    Bronze 3:  500–599   Silver 3:   800–899
//   Gold 1:    900–999    Plat 1:   1200–1299  Diamond 1: 1500–1599
//   Gold 2:   1000–1099   Plat 2:   1300–1399  Diamond 2: 1600–1699
//   Gold 3:   1100–1199   Plat 3:   1400–1499  Diamond 3: 1700–1799
//   Velocity 1: 1800–1899 Velocity 2: 1900–1999 Velocity 3: 2000–2099
//
//   Apex:    hidden MMR >= 2100 AND leaderboard top 1500
//   Paragon: hidden MMR >= 2400 AND leaderboard top 500
// ---------------------------------------------------------------------------
const RANKS = [
  'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Velocity', 'Apex', 'Paragon',
];
const SUBRANKS = [1, 2, 3];
const RANK_ELO_STEP = 100;
const RANK_CAP = 700; // max matchmaking range (7 tiers * 100 elo)
const TOP_PARAGON = 500;
const TOP_APEX = 1500;
const PROVISIONAL_PLACEMENT_MMR = 1050;

async function loadPlacementHistory(userId: string, take: number): Promise<PlacementGameResult[]> {
  if (!prisma || take <= 0) return [];

  const rows = await prisma.matchPlayer.findMany({
    where: {
      userId,
      wpm: { not: null },
      result: { in: ['win', 'loss'] },
    },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      match: {
        include: {
          players: {
            where: { userId: { not: userId } },
            include: {
              user: { include: { rating: true } },
            },
          },
        },
      },
    },
  });

  return rows.reverse().map((mp) => {
    const opponent = mp.match.players[0];
    return {
      wpm: mp.wpm ?? 0,
      accuracy: mp.accuracy ?? 0,
      consistency: mp.consistency ?? 0,
      won: mp.result === 'win',
      opponentRating: opponent?.user?.rating?.rating ?? null,
    };
  });
}

/** Number of MMR-based ranks (Iron through Velocity, each with 3 tiers). */
const MMR_BASED_RANK_COUNT = 7; // Iron=0, Bronze=1, Silver=2, Gold=3, Platinum=4, Diamond=5, Velocity=6

function getRankInfo(rating: number, leaderboardPosition?: number) {
  // Paragon: top 500, Apex: next 1000 (501–1500)
  if (typeof leaderboardPosition === 'number') {
    if (leaderboardPosition <= TOP_PARAGON) return { rank: 'Paragon', subrank: null, apexElo: rating };
    if (leaderboardPosition <= TOP_APEX) return { rank: 'Apex', subrank: null, apexElo: rating };
  }

  // Rating-based: Iron–Velocity (3 tiers each, 100 MMR per tier)
  const maxMmrRating = RANK_ELO_STEP * (MMR_BASED_RANK_COUNT * SUBRANKS.length); // 2100
  const cappedRating = Math.min(Math.max(0, rating), maxMmrRating - 1);
  const rankIdx = Math.floor(cappedRating / (RANK_ELO_STEP * SUBRANKS.length));
  const rank = RANKS[Math.min(rankIdx, MMR_BASED_RANK_COUNT - 1)];
  const subrank = Math.floor((cappedRating % (RANK_ELO_STEP * SUBRANKS.length)) / RANK_ELO_STEP) + 1;
  return { rank, subrank };
}

function rankToNumeric(rank: string, subrank: number | null): number {
  // Iron 1 = 0 ... Velocity 3 = 20, Apex = 21, Paragon = 22
  const idx = RANKS.indexOf(rank);
  if (idx >= 0 && idx < MMR_BASED_RANK_COUNT && subrank) return idx * 3 + (subrank - 1);
  if (rank === 'Apex') return MMR_BASED_RANK_COUNT * 3;       // 21
  if (rank === 'Paragon') return MMR_BASED_RANK_COUNT * 3 + 1; // 22
  // Velocity fallback
  return (MMR_BASED_RANK_COUNT - 1) * 3; // 18 = Velocity 1
}

function removeFromQueue(socket: WebSocket) {
  const idx = queue.findIndex((q) => q.socket === socket);
  if (idx >= 0) queue.splice(idx, 1);
}

function calculateRange(joinedAt: number) {
  const base = 300;
  const increment = 25;
  const secondsWaiting = Math.floor((Date.now() - joinedAt) / 1000);
  const steps = Math.floor(secondsWaiting / 10);
  return Math.min(base + increment * steps, RANK_CAP);
}

function tryMatchOnce() {
  if (queue.length < 2) return false;

  // Sort by join time to keep things fair
  queue.sort((a, b) => a.joinedAt - b.joinedAt);

  for (let i = 0; i < queue.length; i += 1) {
    const a = queue[i];
    if (Date.now() - a.joinedAt < MIN_QUEUE_WAIT_MS) continue;
    const range = calculateRange(a.joinedAt);
    const aRating = a.matchmakingRating;
    // Find closest opponent within allowed matchmaking rules
    let candidateIndex = -1;
    let bestDelta = Number.MAX_SAFE_INTEGER;

    for (let j = i + 1; j < queue.length; j += 1) {
      const b = queue[j];
      if (Date.now() - b.joinedAt < MIN_QUEUE_WAIT_MS) continue;
      const bRating = b.matchmakingRating;
      const delta = Math.abs(aRating - bRating);

      // Primary gate is dynamic MMR range; this prevents "same-time, in-range"
      // players from being blocked by secondary rank-band rules.
      if (delta <= range && delta < bestDelta) {
        candidateIndex = j;
        bestDelta = delta;
      }
    }

    if (candidateIndex !== -1) {
      const [playerA] = queue.splice(i, 1);
      const [playerB] = queue.splice(candidateIndex - 1, 1); // adjust index after removal

      void createMatch(playerA, playerB);
      return true; // found a match, caller can keep trying
    }
  }

  return false;
}

function startMatcher() {
  if (matcherInterval) return;

  matcherInterval = setInterval(() => {
    let matched = false;
    do {
      matched = tryMatchOnce();
    } while (matched);
  }, MATCH_INTERVAL_MS);
}

function stopMatcher() {
  if (!matcherInterval) return;
  clearInterval(matcherInterval);
  matcherInterval = null;
}

async function createMatch(a: QueueEntry, b: QueueEntry) {
  const matchId = randomUUID();
  const seed = randomUUID();
  const PREP_SECONDS = 11; // 5s loading + 3s quiet hold + 3s visible countdown
  const COUNTDOWN_SECONDS = 3; // final 3s use countdown overlay
  const startAt = Date.now() + PREP_SECONDS * 1000;
  const config = {
    mode: 'time' as const,
    limit: 30,
    difficulty: 'medium' as const,
    length: 10000,
    includePunctuation: false,
    maxRounds: 6,
    prepSeconds: PREP_SECONDS,
    countdownSeconds: COUNTDOWN_SECONDS,
    breakSeconds: 7,
  };

  // Register in live-match active configs so the server can validate results
  activeMatchConfigs.set(matchId, {
    matchId,
    seed,
    playerIds: [a.userId, b.userId],
    mode: config.mode,
    limit: config.limit,
    difficulty: config.difficulty,
    textLength: config.length,
    includePunctuation: config.includePunctuation,
    startAt,
    maxRounds: config.maxRounds,
    prepSeconds: config.prepSeconds,
    countdownSeconds: config.countdownSeconds,
    breakSeconds: config.breakSeconds,
    playerRatings: {
      [a.userId]: a.matchmakingRating,
      [b.userId]: b.matchmakingRating,
    },
  });

  const payload = {
    type: 'MATCH_FOUND',
    matchId,
    seed,
    config,
    startAt,
    opponents: {
      [a.userId]: { username: a.username, rating: a.rating },
      [b.userId]: { username: b.username, rating: b.rating },
    },
  };

  // Send to both players
  [a.socket, b.socket].forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  });

  // Persist match stub if DB is available.
  if (prisma) {
    try {
      await prisma.match.create({
        data: {
          id: matchId,
          seed,
          mode: config.mode,
          limit: config.limit,
          status: 'pending',
          players: {
            create: [
              { userId: a.userId },
              { userId: b.userId },
            ],
          },
        },
      });
    } catch (err) {
      // Log and continue; matchmaking should still proceed.
      log.error({ err, matchId }, 'Failed to persist match');
    }
  }
}

export async function matchmakingWs(app: FastifyInstance) {
  log = app.log;
  startMatcher();

  app.addHook('onClose', async () => {
    stopMatcher();
  });

  app.get('/ws/matchmaking', { websocket: true }, (connection, _req: FastifyRequest) => {
    const socket = connection instanceof WebSocket
      ? connection
      : (connection as unknown as { socket: WebSocket }).socket;

    socket.send(JSON.stringify({ type: 'welcome', message: 'matchmaking connected' }));

    socket.on('message', (data: RawData) => {
      // Per-connection rate limit: 30 burst, 10/sec refill
      if (!wsRateLimitAllow(socket)) {
        socket.send(JSON.stringify({ type: 'error', message: 'rate limited — slow down' }));
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'invalid json' }));
        return;
      }

      if (typeof parsed === 'object' && parsed !== null && 'type' in parsed && (parsed as { type?: unknown }).type === 'join') {
        const joinMsg = parsed as { token?: unknown; userId?: unknown; rating?: unknown };

        // Authenticate via token
        const token = typeof joinMsg.token === 'string' ? joinMsg.token : undefined;
        const authUser = token ? verifyAuthToken(token) : null;
        if (!authUser) {
          socket.send(JSON.stringify({ type: 'error', message: 'unauthorized – valid token required' }));
          return;
        }

        // Look up rating from DB
        void (async () => {
          let username = authUser.username;
          let rating: number | null = null;
          let matchmakingRating = PROVISIONAL_PLACEMENT_MMR;

          if (prisma) {
            const user = await prisma.user.findUnique({
              where: { id: authUser.id },
              include: { rating: true },
            });
            if (!user) {
              socket.send(JSON.stringify({ type: 'error', message: 'user not found' }));
              return;
            }

            username = user.username;
            rating = user.rating?.rating ?? null;
            if (rating != null) {
              matchmakingRating = rating;
            } else {
              const gamesPlayed = Math.max(0, user.rating?.placementGamesPlayed ?? 0);
              const history = await loadPlacementHistory(authUser.id, gamesPlayed);
              matchmakingRating = calculatePlacementProgressRating(history, PROVISIONAL_PLACEMENT_MMR);
            }
            // competitiveElo is available via user.rating?.competitiveElo ?? null
          } else if (typeof joinMsg.rating === 'number' && Number.isFinite(joinMsg.rating)) {
            rating = Math.round(joinMsg.rating);
            matchmakingRating = rating;
          }

          removeFromQueue(socket);
          queue.push({
            userId: authUser.id,
            username,
            rating,
            matchmakingRating,
            joinedAt: Date.now(),
            socket,
          });
          socket.send(JSON.stringify({ type: 'queued', rating, userId: authUser.id, username }));

          // Trigger immediate match attempt
          let matched = false;
          do {
            matched = tryMatchOnce();
          } while (matched);
        })().catch((err) => {
          log.error({ err }, 'matchmaking join error');
          socket.send(JSON.stringify({ type: 'error', message: 'internal error' }));
        });
        return;
      }

      if (typeof parsed === 'object' && parsed !== null && 'type' in parsed && (parsed as { type?: unknown }).type === 'leave') {
        removeFromQueue(socket);
        socket.send(JSON.stringify({ type: 'left' }));
        return;
      }

      socket.send(JSON.stringify({ type: 'error', message: 'unknown message type' }));
    });

    socket.on('close', () => {
      removeFromQueue(socket);
    });
  });
}
