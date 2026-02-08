import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { createAuthToken, hashPassword, verifyPassword } from '../auth.js';

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[A-Za-z0-9_]+$/, 'Username may only include letters, numbers, and underscores');

const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email().optional(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  usernameOrEmail: z.string().trim().min(3),
  password: z.string().min(8),
});

const oauthSchema = z.object({
  provider: z.string().trim().min(2).max(40),
  providerUserId: z.string().trim().min(1).max(200),
  username: usernameSchema.optional(),
  email: z.string().trim().email().optional(),
});

const DATABASE_UNAVAILABLE_MESSAGE = 'Database is not configured. Set DATABASE_URL and run migrations.';

function sendDatabaseUnavailable(reply: FastifyReply) {
  return reply.status(503).send({ error: DATABASE_UNAVAILABLE_MESSAGE });
}

async function makeUniqueUsername(db: PrismaClient, base: string) {
  const normalizedBase = base.toLowerCase();
  let candidate = normalizedBase;
  let suffix = 1;
  // Keep this simple and bounded; collisions are rare with low user counts in Phase 2.
  while (suffix < 10_000) {
    const existing = await db.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!existing) return candidate;
    candidate = `${normalizedBase}_${suffix}`;
    suffix += 1;
  }
  throw new Error('Unable to generate unique username');
}

function sanitizeUsernameFallback(value: string) {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  return cleaned.length >= 3 ? cleaned : `user_${Math.floor(Math.random() * 999_999)}`;
}

export async function authRoutes(app: FastifyInstance) {
  if (!prisma) {
    app.post('/auth/register', async (_request: FastifyRequest, reply: FastifyReply) => sendDatabaseUnavailable(reply));
    app.post('/auth/login', async (_request: FastifyRequest, reply: FastifyReply) => sendDatabaseUnavailable(reply));
    app.post('/auth/oauth', async (_request: FastifyRequest, reply: FastifyReply) => sendDatabaseUnavailable(reply));
    return;
  }

  const db = prisma;

  // Stricter rate limits for auth endpoints: 10 attempts per minute per IP
  const authRateConfig = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.post('/auth/register', authRateConfig, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid payload' });
    }

    const username = parsed.data.username.toLowerCase();
    const email = parsed.data.email?.toLowerCase();
    const passwordHash = hashPassword(parsed.data.password);

    const existingByUsername = await db.user.findUnique({ where: { username }, select: { id: true } });
    if (existingByUsername) {
      return reply.status(409).send({ error: 'Username already taken' });
    }
    if (email) {
      const existingByEmail = await db.user.findUnique({ where: { email }, select: { id: true } });
      if (existingByEmail) {
        return reply.status(409).send({ error: 'Email already in use' });
      }
    }

    const created = await db.user.create({
      data: {
        username,
        email,
        passwordHash,
        rating: { create: {} },
      },
      include: { rating: true },
    });

    const token = createAuthToken({ id: created.id, username: created.username });
    return {
      token,
      user: {
        id: created.id,
        username: created.username,
        email: created.email,
        createdAt: created.createdAt,
        rating: created.rating?.rating ?? null,
        competitiveElo: created.rating?.competitiveElo ?? null,
        placementGamesPlayed: created.rating?.placementGamesPlayed ?? 0,
        settings: created.settings,
      },
    };
  });

  app.post('/auth/login', authRateConfig, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid payload' });
    }

    const { usernameOrEmail, password } = parsed.data;
    const lookup = usernameOrEmail.includes('@')
      ? { email: usernameOrEmail.toLowerCase() }
      : { username: usernameOrEmail.toLowerCase() };

    const user = await db.user.findFirst({
      where: lookup,
      include: { rating: true },
    });

    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    if (!user.passwordHash) {
      return reply.status(400).send({ error: 'This account uses OAuth login' });
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = createAuthToken({ id: user.id, username: user.username });
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        rating: user.rating?.rating ?? null,
        competitiveElo: user.rating?.competitiveElo ?? null,
        placementGamesPlayed: user.rating?.placementGamesPlayed ?? 0,
        settings: user.settings,
      },
    };
  });

  app.post('/auth/oauth', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = oauthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid payload' });
    }

    const provider = parsed.data.provider.toLowerCase();
    const providerUserId = parsed.data.providerUserId;
    const email = parsed.data.email?.toLowerCase();
    const desiredUsername = parsed.data.username?.toLowerCase()
      ?? sanitizeUsernameFallback(`${provider}_${providerUserId}`);

    const existingOauthUser = await db.user.findFirst({
      where: {
        oauthProvider: provider,
        oauthSubject: providerUserId,
      },
      include: { rating: true },
    });

    if (existingOauthUser) {
      const token = createAuthToken({ id: existingOauthUser.id, username: existingOauthUser.username });
      return {
        token,
        user: {
          id: existingOauthUser.id,
          username: existingOauthUser.username,
          email: existingOauthUser.email,
            createdAt: existingOauthUser.createdAt,
            rating: existingOauthUser.rating?.rating ?? null,
            competitiveElo: existingOauthUser.rating?.competitiveElo ?? null,
            placementGamesPlayed: existingOauthUser.rating?.placementGamesPlayed ?? 0,
            settings: existingOauthUser.settings,
          },
        };
    }

    if (email) {
      const byEmail = await db.user.findUnique({
        where: { email },
        include: { rating: true },
      });
      if (byEmail) {
        if (byEmail.oauthProvider && byEmail.oauthProvider !== provider) {
          return reply.status(409).send({ error: 'Email already linked to a different OAuth provider' });
        }
        const updated = await db.user.update({
          where: { id: byEmail.id },
          data: {
            oauthProvider: provider,
            oauthSubject: providerUserId,
          },
          include: { rating: true },
        });
        const token = createAuthToken({ id: updated.id, username: updated.username });
        return {
          token,
          user: {
            id: updated.id,
            username: updated.username,
            email: updated.email,
            createdAt: updated.createdAt,
            rating: updated.rating?.rating ?? null,
            competitiveElo: updated.rating?.competitiveElo ?? null,
            placementGamesPlayed: updated.rating?.placementGamesPlayed ?? 0,
            settings: updated.settings,
          },
        };
      }
    }

    const username = await makeUniqueUsername(db, desiredUsername);
    const created = await db.user.create({
      data: {
        username,
        email,
        oauthProvider: provider,
        oauthSubject: providerUserId,
        rating: { create: {} },
      },
      include: { rating: true },
    });

    const token = createAuthToken({ id: created.id, username: created.username });
    return {
      token,
      user: {
        id: created.id,
        username: created.username,
        email: created.email,
        createdAt: created.createdAt,
        rating: created.rating?.rating ?? null,
        competitiveElo: created.rating?.competitiveElo ?? null,
        placementGamesPlayed: created.rating?.placementGamesPlayed ?? 0,
        settings: created.settings,
      },
    };
  });
}
