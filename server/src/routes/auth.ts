import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const bodySchema = z.object({
      username: z.string().min(3),
      password: z.string().min(6),
    });

    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid payload' });
    }

    // Placeholder auth. Replace with real user lookup + password check.
    const { username } = parsed.data;
    return { user: { id: 'stub-user', username }, token: 'stub-token' };
  });
}
