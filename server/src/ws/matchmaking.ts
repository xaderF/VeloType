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

function removeFromQueue(socket: WebSocket) {
  const idx = queue.findIndex((q) => q.socket === socket);
  if (idx >= 0) queue.splice(idx, 1);
}

function calculateRange(joinedAt: number) {
  const base = 100;
  const increment = 25;
  const secondsWaiting = Math.floor((Date.now() - joinedAt) / 1000);
  const steps = Math.floor(secondsWaiting / 10);
  return base + increment * steps;
}

function tryMatchOnce() {
  if (queue.length < 2) return false;

  // Sort by join time to keep things fair
  queue.sort((a, b) => a.joinedAt - b.joinedAt);

  for (let i = 0; i < queue.length; i += 1) {
    const a = queue[i];
    const range = calculateRange(a.joinedAt);
    // Find closest opponent within range
    let candidateIndex = -1;
    let bestDelta = Number.MAX_SAFE_INTEGER;

    for (let j = i + 1; j < queue.length; j += 1) {
      const b = queue[j];
      const delta = Math.abs(a.rating - b.rating);
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
    if (socket.readyState === socket.OPEN) {
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
