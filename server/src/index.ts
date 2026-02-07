import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { env } from './env.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { profileRoutes } from './routes/profile.js';
import { matchmakingWs } from './ws/matchmaking.js';

const app = Fastify({ logger: true });

await app.register(websocket);
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(profileRoutes);
await app.register(matchmakingWs);

const port = env.PORT;

app.listen({ port, host: '0.0.0.0' })
  .then(() => {
    app.log.info(`Server running on :${port} (env: ${env.NODE_ENV})`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
