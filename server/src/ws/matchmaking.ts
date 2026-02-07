import { randomUUID } from 'crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import { prisma } from '../db.js';

type QueueEntry = {
  userId: string;
  rating: number;
  joinedAt: number;
  socket: WebSocket;
};

const queue: QueueEntry[] = [];
const MATCH_INTERVAL_MS = 1000;
let matcherInterval: ReturnType<typeof setInterval> | null = null;

// Rank system
const RANKS = [
  'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Velocity', 'Apex', 'Paragon',
];
const SUBRANKS = [1, 2, 3];
const RANK_ELO_STEP = 100;
const RANK_CAP = 600; // max range for matchmaking (6 subranks * 100 elo)
const TOP_PARAGON = 500;
const TOP_APEX = 1500;

function getRankInfo(rating: number, leaderboardPosition?: number) {
  // Paragon: top 500, Apex: next 1000 (501–1500)
  if (typeof leaderboardPosition === 'number') {
    if (leaderboardPosition <= TOP_PARAGON) return { rank: 'Paragon', subrank: null, apexElo: rating };
    if (leaderboardPosition <= TOP_APEX) return { rank: 'Apex', subrank: null, apexElo: rating };
  }

  // Rating-based: Iron–Diamond (subranks) and Velocity (subranks)
  const cappedRating = Math.min(rating, RANK_ELO_STEP * (7 * SUBRANKS.length));
  const rankIdx = Math.floor(cappedRating / (RANK_ELO_STEP * SUBRANKS.length));
  const rank = RANKS[Math.min(rankIdx, 6)]; // up to Velocity
  const subrank = Math.floor((cappedRating % (RANK_ELO_STEP * SUBRANKS.length)) / RANK_ELO_STEP) + 1;
  if (rankIdx <= 6) {
    return { rank, subrank };
  }
  // Fallback to Velocity if somehow beyond
  return { rank: 'Velocity', subrank: 3 };
}

function rankToNumeric(rank: string, subrank: number | null): number {
  // Iron 1 = 0 ... Diamond 3 = 17, Velocity 1-3 = 18-20, Apex = 21, Paragon = 22
  const idx = RANKS.indexOf(rank);
  if (idx <= 6 && subrank) return idx * 3 + (subrank - 1);
  if (rank === 'Apex') return 21;
  if (rank === 'Paragon') return 22;
  // Velocity fallback
  return 18;
}

function removeFromQueue(socket: WebSocket) {
  const idx = queue.findIndex((q) => q.socket === socket);
  if (idx >= 0) queue.splice(idx, 1);
}

function calculateRange(joinedAt: number) {
  const base = 100;
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
    const range = calculateRange(a.joinedAt);
    const aRankInfo = getRankInfo(a.rating);
    // Find closest opponent within allowed matchmaking rules
    let candidateIndex = -1;
    let bestDelta = Number.MAX_SAFE_INTEGER;

    for (let j = i + 1; j < queue.length; j += 1) {
      const b = queue[j];
      const delta = Math.abs(a.rating - b.rating);
      const bRankInfo = getRankInfo(b.rating);

      const aNum = rankToNumeric(aRankInfo.rank, aRankInfo.subrank ?? 1);
      const bNum = rankToNumeric(bRankInfo.rank, bRankInfo.subrank ?? 1);
      const maxDiff = 3; // 3 subranks (one full rank)
      const spread = Math.abs(aNum - bNum);

      let allowed = false;
      // Iron–Diamond (and Velocity subranks): max spread of 3 subranks
      if (aNum < 21 && bNum < 21) {
        allowed = spread <= maxDiff;
      } else if (aRankInfo.rank === 'Velocity' || bRankInfo.rank === 'Velocity') {
        // Velocity (with subranks): Velocity <-> Velocity/Apex (not Paragon), spread <= 3
        const inBand = (aRankInfo.rank === 'Velocity' || aRankInfo.rank === 'Apex') && (bRankInfo.rank === 'Velocity' || bRankInfo.rank === 'Apex');
        allowed = inBand && spread <= maxDiff;
      } else if (aRankInfo.rank === 'Apex' || bRankInfo.rank === 'Apex') {
        // Apex: Apex <-> Apex/Velocity/Paragon (no restriction vs Paragon)
        allowed = (aRankInfo.rank === 'Apex' || aRankInfo.rank === 'Velocity' || aRankInfo.rank === 'Paragon')
          && (bRankInfo.rank === 'Apex' || bRankInfo.rank === 'Velocity' || bRankInfo.rank === 'Paragon')
          && spread <= maxDiff;
      } else if (aRankInfo.rank === 'Paragon' || bRankInfo.rank === 'Paragon') {
        // Paragon: Paragon <-> Paragon/Apex (not Velocity)
        allowed = (aRankInfo.rank === 'Paragon' || aRankInfo.rank === 'Apex') && (bRankInfo.rank === 'Paragon' || bRankInfo.rank === 'Apex') && spread <= maxDiff;
      }

      if (delta <= range && delta < bestDelta && allowed) {
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
  const startAt = Date.now() + 2000; // 2s delay to sync clients
  const config = {
    mode: 'time' as const,
    limit: 30,
    difficulty: 'medium' as const,
    length: 240,
  };

  const payload = {
    type: 'MATCH_FOUND',
    matchId,
    seed,
    config,
    startAt,
  };

  // Send to both players
  [a.socket, b.socket].forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  });

  // Persist match stub if DB is available
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
    // Log and continue; matchmaking should still proceed
    console.error('Failed to persist match', err);
  }
}

export async function matchmakingWs(app: FastifyInstance) {
  startMatcher();

  app.addHook('onClose', async () => {
    stopMatcher();
  });

  app.get('/ws/matchmaking', { websocket: true }, (rawConnection, _req: FastifyRequest) => {
    const socket = (rawConnection as unknown as { socket: WebSocket }).socket;

    socket.send(JSON.stringify({ type: 'welcome', message: 'matchmaking connected' }));

    socket.on('message', (data: RawData) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'invalid json' }));
        return;
      }

      if (typeof parsed === 'object' && parsed !== null && 'type' in parsed && (parsed as { type?: unknown }).type === 'join') {
        const joinMsg = parsed as { userId?: unknown; rating?: unknown };
        const userId = typeof joinMsg.userId === 'string' ? joinMsg.userId.trim() : String(joinMsg.userId ?? '').trim();
        const rating = typeof joinMsg.rating === 'number' ? joinMsg.rating : Number(joinMsg.rating ?? 0);
        if (!userId || Number.isNaN(rating)) {
          socket.send(JSON.stringify({ type: 'error', message: 'invalid join payload' }));
          return;
        }
        removeFromQueue(socket);
        queue.push({ userId, rating, joinedAt: Date.now(), socket });
        socket.send(JSON.stringify({ type: 'queued', rating }));
        // Trigger a match attempt immediately; interval also runs in the background.
        let matched = false;
        do {
          matched = tryMatchOnce();
        } while (matched);
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
