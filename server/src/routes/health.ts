import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    const checks: Record<string, string> = {};

    // Database connectivity
    if (prisma) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = 'ok';
      } catch {
        checks.database = 'unreachable';
      }
    } else {
      checks.database = 'not_configured';
    }

    // Memory usage
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);

    const healthy = checks.database !== 'unreachable';

    const payload = {
      status: healthy ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      heapUsedMB,
      checks,
    };

    return reply.status(healthy ? 200 : 503).send(payload);
  });
}
