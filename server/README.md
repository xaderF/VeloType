# VeloType Server (Phase 2 foundation)

## Setup

1) Install deps
```
cd server
npm install
```

2) Env
- Copy the root `.env.example` to `.env` and fill values.
- Used vars: `PORT` (default 4000), `DATABASE_URL` (Postgres), `AUTH_SECRET` (optional now).

3) Run
```
npm run dev
```

4) Prisma (database schema)
- Update `DATABASE_URL` in the root `.env` to point to Postgres.
- Run migrations: `npm run prisma:migrate -- --name init`
- Generate client: `npm run prisma:generate`

## Endpoints (current)
- GET /health — health check
- POST /auth/login — stub login (returns stub token)
- GET /profile — stub profile
- WS /ws/matchmaking — in-memory queue + MATCH_FOUND payloads

## Notes
- Server uses Fastify + @fastify/websocket.
- `env.ts` validates env vars with zod.
- Matchmaking pairs by rating, widening search range over time; sends `MATCH_FOUND` with matchId, seed, config, startAt.
- If `DATABASE_URL` is set and migrations are applied, matches are persisted (match + match_players rows). Otherwise it still runs in-memory.
