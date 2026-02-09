import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getBearerToken, verifyAuthToken } from '../auth.js';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { generateText } from '../engine/text.js';
import {
  computeServerMetrics,
  performanceScore,
} from '../engine/metrics.js';

// ---------------------------------------------------------------------------
// Daily seed — deterministic from the date string so every player gets the
// same text on the same calendar day in a fixed reset timezone.
// ---------------------------------------------------------------------------

const dailyDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: env.DAILY_RESET_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function getDailyDate(at: Date = new Date()): string {
  const parts = dailyDateFormatter.formatToParts(at);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('Failed to derive daily date from formatter parts');
  }
  return `${year}-${month}-${day}`;
}

function getNextResetAt(at: Date = new Date()): string {
  const currentDate = getDailyDate(at);
  let low = at.getTime() + 1000;
  let high = at.getTime() + 36 * 60 * 60 * 1000;

  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2);
    if (getDailyDate(new Date(mid)) === currentDate) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return new Date(high).toISOString();
}

function getDailySeed(date: string): string {
  return `veloxtype-daily-${date}`;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

const DATABASE_UNAVAILABLE_MESSAGE = 'Database is not configured. Set DATABASE_URL and run migrations.';

function sendDatabaseUnavailable(reply: FastifyReply) {
  return reply.status(503).send({ error: DATABASE_UNAVAILABLE_MESSAGE });
}

const submitSchema = z.object({
  typed: z.string().min(1).max(5000),       // what the user typed
  elapsedMs: z.number().int().positive(),   // how long in ms
  totalErrors: z.number().int().nonnegative().optional(),    // cumulative errors incl. corrected
  totalKeystrokes: z.number().int().nonnegative().optional(), // total forward keystrokes
});

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function leaderboardRoutes(app: FastifyInstance) {
  if (!prisma) {
    app.get('/leaderboard', async (_req, reply) => sendDatabaseUnavailable(reply));
    app.get('/daily', async (_req, reply) => sendDatabaseUnavailable(reply));
    app.get('/daily/leaderboard', async (_req, reply) => sendDatabaseUnavailable(reply));
    app.post('/daily/submit', async (_req, reply) => sendDatabaseUnavailable(reply));
    return;
  }

  const db = prisma;

  // ---- GET /leaderboard -----------------------------------------------------
  // Main ELO-based leaderboard. Returns top players by MMR rating.
  // Public — no auth required.
  // ---------------------------------------------------------------------------
  const leaderboardQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  });

  app.get('/leaderboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = leaderboardQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query params' });
    }
    const { limit, offset } = parsed.data;

    const totalRanked = await db.rating.count({ where: { rating: { not: null } } });

    const rows = await db.rating.findMany({
      where: { rating: { not: null } },
      orderBy: { rating: 'desc' },
      skip: offset,
      take: limit,
      include: {
        user: {
          select: {
            username: true,
            matches: {
              select: { result: true, wpm: true },
              where: { match: { status: 'completed' } },
            },
          },
        },
      },
    });

    // Check if the requesting user is on the board
    let myRank: { rank: number; rating: number; username: string } | null = null;
    const token = getBearerToken(request.headers.authorization);
    const authUser = token ? verifyAuthToken(token) : null;
    if (authUser) {
      const myRating = await db.rating.findUnique({ where: { userId: authUser.id } });
      if (myRating?.rating != null) {
        const aboveMe = await db.rating.count({
          where: { rating: { gt: myRating.rating } },
        });
        const me = await db.user.findUnique({ where: { id: authUser.id }, select: { username: true } });
        myRank = { rank: aboveMe + 1, rating: myRating.rating, username: me?.username ?? '' };
      }
    }

    return {
      total: totalRanked,
      limit,
      offset,
      myRank,
      leaderboard: rows.map((row, index) => {
        const matches = row.user.matches;
        const wins = matches.filter((m) => m.result === 'win').length;
        const losses = matches.filter((m) => m.result === 'loss').length;
        const wpmValues = matches.map((m) => m.wpm).filter((w): w is number => w != null);
        const avgWpm = wpmValues.length > 0 ? Math.round(wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length) : 0;

        return {
          rank: offset + index + 1,
          username: row.user.username,
          rating: row.rating!,
          wins,
          losses,
          avgWpm,
        };
      }),
    };
  });

  // ---- GET /daily -----------------------------------------------------------
  // Returns today's seed, target text, and whether the logged-in user has
  // already submitted a score.
  // ---------------------------------------------------------------------------
  app.get('/daily', async (request: FastifyRequest, reply: FastifyReply) => {
    const date = getDailyDate();
    const nextResetAt = getNextResetAt();
    const seed = getDailySeed(date);
    const targetText = generateText({ seed, length: 200, difficulty: 'medium', includePunctuation: false });

    // Check if the user already played today (optional — works without auth too)
    let alreadyPlayed = false;
    let myScore: { wpm: number; accuracy: number; score: number; rank: number } | null = null;

    const token = getBearerToken(request.headers.authorization);
    const authUser = token ? verifyAuthToken(token) : null;

    if (authUser) {
      const existing = await db.dailyScore.findUnique({
        where: { userId_date: { userId: authUser.id, date } },
      });
      if (existing) {
        alreadyPlayed = true;
        // Find their rank
        const betterCount = await db.dailyScore.count({
          where: { date, score: { gt: existing.score } },
        });
        myScore = {
          wpm: existing.wpm,
          accuracy: existing.accuracy,
          score: existing.score,
          rank: betterCount + 1,
        };
      }
    }

    return {
      date,
      nextResetAt,
      resetTimezone: env.DAILY_RESET_TIMEZONE,
      seed,
      targetText,
      alreadyPlayed,
      myScore,
    };
  });

  // ---- POST /daily/submit ---------------------------------------------------
  // Submit your attempt for today's daily challenge. Server recomputes metrics
  // from the typed text (same as ranked matches — server-authoritative).
  // One attempt per user per day.
  // ---------------------------------------------------------------------------
  app.post(
    '/daily/submit',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const token = getBearerToken(request.headers.authorization);
      const authUser = token ? verifyAuthToken(token) : null;
      if (!authUser) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const parsed = submitSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid payload' });
      }

      const date = getDailyDate();
      const seed = getDailySeed(date);

      // Already submitted today?
      const existing = await db.dailyScore.findUnique({
        where: { userId_date: { userId: authUser.id, date } },
      });
      if (existing) {
        return reply.status(409).send({ error: 'Already submitted for today' });
      }

      // Server-authoritative: regenerate text, compute metrics
      const targetText = generateText({ seed, length: 200, difficulty: 'medium', includePunctuation: false });
      const { typed, elapsedMs, totalErrors, totalKeystrokes } = parsed.data;

      // Plausibility check — same cap as ranked (~20 chars/sec)
      const maxChars = Math.ceil((elapsedMs / 1000) * 20);
      const clampedTyped = typed.slice(0, Math.min(typed.length, maxChars, targetText.length));

      const metrics = computeServerMetrics(targetText, clampedTyped, elapsedMs, [], undefined, totalErrors, totalKeystrokes);
      const perfScore = performanceScore(metrics.wpm, metrics.accuracy, metrics.consistency);

      let record;
      try {
        record = await db.dailyScore.create({
          data: {
            userId: authUser.id,
            date,
            seed,
            wpm: metrics.wpm,
            rawWpm: metrics.rawWpm,
            accuracy: metrics.accuracy,
            consistency: metrics.consistency,
            score: perfScore,
            correctChars: metrics.correctChars,
            totalTyped: metrics.totalTyped,
            errors: metrics.errors,
          },
        });
      } catch (error) {
        // Protect one-attempt-per-day invariant even under concurrent submissions.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return reply.status(409).send({ error: 'Already submitted for today' });
        }
        throw error;
      }

      // Return rank
      const betterCount = await db.dailyScore.count({
        where: { date, score: { gt: perfScore } },
      });

      return {
        id: record.id,
        wpm: metrics.wpm,
        rawWpm: metrics.rawWpm,
        accuracy: metrics.accuracy,
        consistency: metrics.consistency,
        score: perfScore,
        errors: metrics.errors,
        rank: betterCount + 1,
      };
    },
  );

  // ---- GET /daily/leaderboard -----------------------------------------------
  // Top scores for a given date (defaults to today). Public — no auth required.
  // ---------------------------------------------------------------------------
  app.get('/daily/leaderboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsedQuery = querySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({ error: 'Invalid query params' });
    }

    const date = parsedQuery.data.date ?? getDailyDate();
    const limit = parsedQuery.data.limit;
    const today = getDailyDate();

    const rows = await db.dailyScore.findMany({
      where: { date },
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        user: {
          select: { username: true, rating: { select: { rating: true } } },
        },
      },
    });

    const totalParticipants = await db.dailyScore.count({ where: { date } });

    return {
      date,
      nextResetAt: date === today ? getNextResetAt() : null,
      resetTimezone: env.DAILY_RESET_TIMEZONE,
      totalParticipants,
      leaderboard: rows.map((row, index) => ({
        rank: index + 1,
        username: row.user.username,
        rating: row.user.rating?.rating ?? null,
        wpm: row.wpm,
        rawWpm: row.rawWpm,
        accuracy: row.accuracy,
        consistency: row.consistency,
        score: row.score,
        errors: row.errors,
      })),
    };
  });
}
