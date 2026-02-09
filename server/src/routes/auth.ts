import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import {
  createAuthToken,
  hashPassword,
  verifyPassword,
  verifyAuthToken,
  encryptPii,
  decryptPii,
  getBearerToken,
  getTokenRememberMe,
  hashEmailForLookup,
  normalizeEmail,
  revokeToken,
} from '../auth.js';
import { verifyOAuthIdentity } from '../oauth.js';

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[A-Za-z0-9_]+$/, 'Username may only include letters, numbers, and underscores');

const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional().default(false),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the Terms of Service and Privacy Policy' }),
  }),
});

const loginSchema = z.object({
  usernameOrEmail: z.string().trim().min(3),
  password: z.string().min(8),
  rememberMe: z.boolean().optional().default(false),
});

const oauthSchema = z.object({
  provider: z.string().trim().min(2).max(40),
  idToken: z.string().trim().min(10).optional(),
  accessToken: z.string().trim().min(10).optional(),
  username: usernameSchema.optional(),
}).refine((value) => Boolean(value.idToken || value.accessToken), {
  message: 'OAuth token is required',
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

async function backfillLegacyEmailHashes(db: PrismaClient, app: FastifyInstance) {
  const candidates = await db.user.findMany({
    where: { emailHash: null, email: { not: null } },
    select: { id: true, email: true },
  });

  let updatedCount = 0;
  for (const candidate of candidates) {
    if (!candidate.email) continue;
    const normalizedEmail = normalizeEmail(decryptPii(candidate.email));
    const emailHash = hashEmailForLookup(normalizedEmail);
    try {
      await db.user.update({
        where: { id: candidate.id },
        data: { emailHash },
      });
      updatedCount += 1;
    } catch {
      // Usually a unique collision from legacy duplicate emails.
      app.log.warn({ userId: candidate.id }, 'Could not backfill emailHash for legacy user');
    }
  }

  if (updatedCount > 0) {
    app.log.info({ updatedCount }, 'Backfilled legacy email hashes');
  }

  const missingEmailCount = await db.user.count({ where: { email: null } });
  if (missingEmailCount > 0) {
    app.log.warn({ missingEmailCount }, 'Some legacy accounts are missing email and need manual remediation');
  }
}

export async function authRoutes(app: FastifyInstance) {
  if (!prisma) {
    app.post('/auth/register', async (_request: FastifyRequest, reply: FastifyReply) => sendDatabaseUnavailable(reply));
    app.post('/auth/login', async (_request: FastifyRequest, reply: FastifyReply) => sendDatabaseUnavailable(reply));
    app.post('/auth/oauth', async (_request: FastifyRequest, reply: FastifyReply) => sendDatabaseUnavailable(reply));
    return;
  }

  const db = prisma;
  await backfillLegacyEmailHashes(db, app);

  // Stricter rate limits for auth endpoints: 10 attempts per minute per IP
  const authRateConfig = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };

  app.post('/auth/register', authRateConfig, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid payload' });
    }

    const username = parsed.data.username.toLowerCase();
    const email = normalizeEmail(parsed.data.email);
    const emailHash = hashEmailForLookup(email);
    const passwordHash = hashPassword(parsed.data.password);
    const encryptedEmail = encryptPii(email);

    const existingByUsername = await db.user.findUnique({ where: { username }, select: { id: true } });
    if (existingByUsername) {
      return reply.status(409).send({ error: 'Account already exists' });
    }
    const existingByEmail = await db.user.findUnique({ where: { emailHash }, select: { id: true } });
    if (existingByEmail) {
      return reply.status(409).send({ error: 'Account already exists' });
    }

    const created = await db.user.create({
      data: {
        username,
        email: encryptedEmail,
        emailHash,
        passwordHash,
        rating: { create: {} },
      },
      include: { rating: true },
    });

    const token = createAuthToken({ id: created.id, username: created.username }, parsed.data.rememberMe);
    return {
      token,
      user: {
        id: created.id,
        username: created.username,
        email,
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
      ? { emailHash: hashEmailForLookup(usernameOrEmail) }
      : { username: usernameOrEmail.toLowerCase() };

    const user = await db.user.findFirst({
      where: lookup,
      include: { rating: true },
    });

    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = createAuthToken({ id: user.id, username: user.username }, parsed.data.rememberMe);
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email ? decryptPii(user.email) : null,
        createdAt: user.createdAt,
        rating: user.rating?.rating ?? null,
        competitiveElo: user.rating?.competitiveElo ?? null,
        placementGamesPlayed: user.rating?.placementGamesPlayed ?? 0,
        settings: user.settings,
      },
    };
  });

  app.post('/auth/oauth', authRateConfig, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = oauthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid payload' });
    }

    const verified = await verifyOAuthIdentity(parsed.data.provider, {
      idToken: parsed.data.idToken,
      accessToken: parsed.data.accessToken,
    });
    if (!verified) {
      return reply.status(401).send({ error: 'Invalid OAuth credentials' });
    }

    const provider = verified.provider;
    const providerUserId = verified.providerUserId;
    const email = verified.email;
    const emailHash = hashEmailForLookup(email);
    const desiredUsername = parsed.data.username?.toLowerCase()
      ?? sanitizeUsernameFallback(verified.usernameHint ?? `${provider}_${providerUserId}`);

    const existingOauthUser = await db.user.findFirst({
      where: {
        oauthProvider: provider,
        oauthSubject: providerUserId,
      },
      include: { rating: true },
    });

    if (existingOauthUser) {
      const token = createAuthToken({ id: existingOauthUser.id, username: existingOauthUser.username }, true);
      return {
        token,
        user: {
          id: existingOauthUser.id,
          username: existingOauthUser.username,
          email: existingOauthUser.email ? decryptPii(existingOauthUser.email) : null,
            createdAt: existingOauthUser.createdAt,
            rating: existingOauthUser.rating?.rating ?? null,
            competitiveElo: existingOauthUser.rating?.competitiveElo ?? null,
            placementGamesPlayed: existingOauthUser.rating?.placementGamesPlayed ?? 0,
            settings: existingOauthUser.settings,
          },
        };
    }

    const byEmail = await db.user.findUnique({
      where: { emailHash },
      include: { rating: true },
    });
    if (byEmail) {
      if (byEmail.oauthProvider && byEmail.oauthProvider !== provider) {
        return reply.status(409).send({ error: 'Account already exists' });
      }
      const updated = await db.user.update({
        where: { id: byEmail.id },
        data: {
          oauthProvider: provider,
          oauthSubject: providerUserId,
          email: encryptPii(email),
          emailHash,
        },
        include: { rating: true },
      });
      const token = createAuthToken({ id: updated.id, username: updated.username }, true);
      return {
        token,
        user: {
          id: updated.id,
          username: updated.username,
          email: updated.email ? decryptPii(updated.email) : null,
          createdAt: updated.createdAt,
          rating: updated.rating?.rating ?? null,
          competitiveElo: updated.rating?.competitiveElo ?? null,
          placementGamesPlayed: updated.rating?.placementGamesPlayed ?? 0,
          settings: updated.settings,
        },
      };
    }

    const username = await makeUniqueUsername(db, desiredUsername);
    const encryptedEmail = encryptPii(email);
    const created = await db.user.create({
      data: {
        username,
        email: encryptedEmail,
        emailHash,
        oauthProvider: provider,
        oauthSubject: providerUserId,
        rating: { create: {} },
      },
      include: { rating: true },
    });

    const token = createAuthToken({ id: created.id, username: created.username }, true);
    return {
      token,
      user: {
        id: created.id,
        username: created.username,
        email,
        createdAt: created.createdAt,
        rating: created.rating?.rating ?? null,
        competitiveElo: created.rating?.competitiveElo ?? null,
        placementGamesPlayed: created.rating?.placementGamesPlayed ?? 0,
        settings: created.settings,
      },
    };
  });

  // -------------------------------------------------------------------------
  // POST /auth/refresh — exchange a valid token for a new one
  // -------------------------------------------------------------------------
  app.post('/auth/refresh', authRateConfig, async (request: FastifyRequest, reply: FastifyReply) => {
    const oldToken = getBearerToken(request.headers.authorization ?? undefined);
    const authUser = oldToken ? verifyAuthToken(oldToken) : null;
    if (!authUser || !oldToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const user = await db.user.findUnique({
      where: { id: authUser.id },
      include: { rating: true },
    });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Revoke old token and issue a new one preserving token class by default
    revokeToken(oldToken);
    const rememberMeBody = z.object({ rememberMe: z.boolean().optional() }).safeParse(request.body);
    const rememberMe = rememberMeBody.success && rememberMeBody.data.rememberMe !== undefined
      ? rememberMeBody.data.rememberMe
      : (getTokenRememberMe(oldToken) ?? false);
    const newToken = createAuthToken({ id: user.id, username: user.username }, rememberMe);

    return {
      token: newToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email ? decryptPii(user.email) : null,
        createdAt: user.createdAt,
        rating: user.rating?.rating ?? null,
        competitiveElo: user.rating?.competitiveElo ?? null,
        placementGamesPlayed: user.rating?.placementGamesPlayed ?? 0,
        settings: user.settings,
      },
    };
  });
}
