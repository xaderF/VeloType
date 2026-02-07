import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getBearerToken, verifyAuthToken } from '../auth.js';
import { prisma } from '../db.js';

const DATABASE_UNAVAILABLE_MESSAGE = 'Database is not configured. Set DATABASE_URL and run migrations.';

function sendDatabaseUnavailable(reply: FastifyReply) {
  return reply.status(503).send({ error: DATABASE_UNAVAILABLE_MESSAGE });
}

export async function profileRoutes(app: FastifyInstance) {
  if (!prisma) {
    app.get('/profile', async (_request: FastifyRequest, reply: FastifyReply) => sendDatabaseUnavailable(reply));
    app.patch('/profile', async (_request: FastifyRequest, reply: FastifyReply) => sendDatabaseUnavailable(reply));
    return;
  }

  const db = prisma;

  const profileUpdateSchema = z.object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(24)
      .regex(/^[A-Za-z0-9_]+$/, 'Username may only include letters, numbers, and underscores')
      .optional(),
    email: z.string().trim().email().nullable().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  });

  app.get('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = getBearerToken(request.headers.authorization);
    const authUser = token ? verifyAuthToken(token) : null;
    if (!authUser) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const profile = await db.user.findUnique({
      where: { id: authUser.id },
      include: { rating: true },
    });
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' });
    }

    return {
      id: profile.id,
      username: profile.username,
      email: profile.email,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      rating: profile.rating?.rating ?? null,
      competitiveElo: profile.rating?.competitiveElo ?? null,
      settings: profile.settings,
    };
  });

  app.patch('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = getBearerToken(request.headers.authorization);
    const authUser = token ? verifyAuthToken(token) : null;
    if (!authUser) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parsed = profileUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid payload' });
    }

    const nextUsername = parsed.data.username?.toLowerCase();
    const nextEmail = parsed.data.email?.toLowerCase() ?? parsed.data.email;
    const dataToUpdate: {
      username?: string;
      email?: string | null;
      settings?: Prisma.InputJsonValue;
    } = {};

    if (nextUsername) {
      const existing = await db.user.findUnique({
        where: { username: nextUsername },
        select: { id: true },
      });
      if (existing && existing.id !== authUser.id) {
        return reply.status(409).send({ error: 'Username already taken' });
      }
      dataToUpdate.username = nextUsername;
    }

    if (parsed.data.email !== undefined) {
      if (nextEmail) {
        const existing = await db.user.findUnique({
          where: { email: nextEmail },
          select: { id: true },
        });
        if (existing && existing.id !== authUser.id) {
          return reply.status(409).send({ error: 'Email already in use' });
        }
      }
      dataToUpdate.email = nextEmail;
    }

    if (parsed.data.settings !== undefined) {
      dataToUpdate.settings = parsed.data.settings as Prisma.InputJsonValue;
    }

    const updated = await db.user.update({
      where: { id: authUser.id },
      data: dataToUpdate,
      include: { rating: true },
    });

    return {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      rating: updated.rating?.rating ?? null,
      competitiveElo: updated.rating?.competitiveElo ?? null,
      settings: updated.settings,
    };
  });
}
