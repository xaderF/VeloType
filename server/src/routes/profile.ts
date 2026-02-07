import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export async function profileRoutes(app: FastifyInstance) {
  app.get('/profile', async (_request: FastifyRequest, _reply: FastifyReply) => {
    // Placeholder profile. Replace with DB lookup using auth token.
    return {
      id: 'stub-user',
      username: 'player1',
      rating: 1100,
      createdAt: new Date().toISOString(),
    };
  });
}
