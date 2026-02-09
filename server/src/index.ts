import { randomUUID } from 'crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { env } from './env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { profileRoutes } from './routes/profile.js';
import { matchRoutes } from './routes/matches.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { matchmakingWs } from './ws/matchmaking.js';
import { liveMatchWs } from './ws/live-match.js';

const app = Fastify({
  logger: true,
  genReqId: () => randomUUID(),
  requestIdHeader: 'x-request-id',
});

// ---------------------------------------------------------------------------
// Global error handler — log every unhandled route error
// ---------------------------------------------------------------------------
app.setErrorHandler((error, request, reply) => {
  request.log.error(
    { err: error, reqId: request.id, url: request.url, method: request.method },
    'Unhandled route error',
  );

  const statusCode = error.statusCode ?? 500;
  reply.status(statusCode).send({
    error: statusCode >= 500 ? 'Internal Server Error' : error.message,
  });
});

// ---------------------------------------------------------------------------
// Request lifecycle logging — attach user context when available
// ---------------------------------------------------------------------------
app.addHook('onRequest', async (request) => {
  // Attach requestId to every log line automatically via Pino child bindings
  request.log = request.log.child({ reqId: request.id });
});

app.addHook('onResponse', async (request, reply) => {
  request.log.info(
    { url: request.url, method: request.method, statusCode: reply.statusCode, responseTime: reply.elapsedTime },
    'request completed',
  );
});

await app.register(cors, { origin: true });

// Global rate limit: 100 requests per minute per IP
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

await app.register(websocket);
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(profileRoutes);
await app.register(matchRoutes);
await app.register(leaderboardRoutes);
await app.register(matchmakingWs);
await app.register(liveMatchWs);

// ---------------------------------------------------------------------------
// Process-level crash handlers
// ---------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  app.log.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  app.log.fatal({ err: reason }, 'Unhandled promise rejection — shutting down');
  process.exit(1);
});

const port = env.PORT;

app.listen({ port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`Server running on :${port} (env: ${env.NODE_ENV})`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
