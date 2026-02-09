import { randomUUID } from 'crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
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

  const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
  reply.status(statusCode).send({
    error: statusCode >= 500 ? 'Internal Server Error' : (error as Error).message,
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

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  // HSTS, X-Frame-Options, X-Content-Type-Options are enabled by default
});

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function matchesOrigin(candidateOrigin: string, allowedOrigin: string) {
  const normalizedCandidate = normalizeOrigin(candidateOrigin);
  const normalizedAllowed = normalizeOrigin(allowedOrigin);

  if (normalizedAllowed === '*') return true;
  if (normalizedCandidate === normalizedAllowed) return true;

  if (normalizedAllowed.includes('*')) {
    const wildcardPattern = `^${normalizedAllowed
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*')}$`;
    return new RegExp(wildcardPattern, 'i').test(normalizedCandidate);
  }

  return false;
}

const allowedOrigins = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:8080', 'http://127.0.0.1:8080']; // dev-only defaults

await app.register(cors, {
  origin: (origin, cb) => {
    // Non-browser requests may not send an Origin header.
    if (!origin) {
      cb(null, true);
      return;
    }

    const isAllowed = allowedOrigins.some((allowedOrigin) => matchesOrigin(origin, allowedOrigin));
    cb(null, isAllowed);
  },
  credentials: true,
});

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
