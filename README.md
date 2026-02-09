# VeloType

<p align="left">
  <img alt="React" height="24" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/react/react-original.svg" />
  <img alt="TypeScript" height="24" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg" />
  <img alt="Tailwind CSS" height="24" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/tailwindcss/tailwindcss-original.svg" />
  <img alt="Vite" height="24" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/vitejs/vitejs-original.svg" />
</p>

VeloType is a competitive typing game that transforms typing speed, accuracy, and consistency into structured, skill-based competition.  
The project is designed around ranked progression, fair match conditions, and extensible game modes rather than traditional standalone typing tests.

---

## Overview

VeloType is built as a modern, **type-safe** frontend application to explore competitive typing mechanics beyond conventional typing platforms. Instead of measuring raw speed in isolation, the game evaluates relative performance between players, emphasizing accuracy, consistency, and decision-making under pressure.

The codebase is intentionally structured to support scalable game modes and future real-time features while maintaining clean component boundaries and predictable, strongly-typed game logic.

---

## Core Concepts

- **Skill-based evaluation** — performance is measured using speed, accuracy, and consistency rather than raw WPM alone  
- **Relative competition** — outcomes are determined by player-to-player comparison, not static thresholds  
- **Ranked progression** — ELO-style systems encourage long-term improvement  
- **Deterministic fairness** — shared text seeds ensure identical conditions for all players  
- **Type safety** — TypeScript enforces correctness in scoring, state, and game logic  
- **Extensible architecture** — new modes build on a shared typing engine  

---

## Game Modes

### ⚔️ Ranked 1v1

A head-to-head competitive mode where two players type the same text under identical conditions.

- Best-of-round structure  
- Performance-based scoring  
- Health / damage mechanics derived from typing accuracy and speed  
- Designed for ranked matchmaking and progression  

This mode forms the competitive core of VeloType.

---

### 🧠 Precision Duels

A shorter, high-pressure format focused on accuracy and consistency.

- Reduced round duration  
- Increased penalty for errors  
- Rewards controlled, deliberate typing over pure speed  

---

### 🔥 Battle Royale (Planned)

A multi-player competitive mode built on the same core scoring system.

- All players type simultaneously  
- Performance determines interactions and eliminations  
- Designed for replayability and spectator-friendly pacing  

---

## What Makes VeloType Different

- **Competitive-first design** — built around player interaction rather than solo benchmarks  
- **Fair by construction** — deterministic text generation removes randomness  
- **Progression-focused** — ranking systems reward improvement over time  
- **Game mechanics layered on typing** — typing performance directly affects outcomes  
- **Strongly typed game logic** — TypeScript ensures predictable behavior as complexity grows  

---

## Round Damage Model (1v1 / 1vAI)

Round combat uses a normalized score per player:

- `roundScore` is in `0..100`
- `damageDealt = max(0, roundScoreA - roundScoreB)`
- max possible round damage is `70`

A player reaches score `100` when both are true:

- accuracy is `100%`
- WPM is at least `(rank max WPM + 10)`

### Rank WPM Reference

| Rank | MMR Range | Max WPM (band) | WPM for score 100 |
|---|---:|---:|---:|
| Iron | 0-299 | 43 | 53 |
| Bronze | 300-599 | 51 | 61 |
| Silver | 600-899 | 59 | 69 |
| Gold | 900-1199 | 67 | 77 |
| Platinum | 1200-1499 | 75 | 85 |
| Diamond | 1500-1799 | 85 | 95 |
| Velocity | 1800-2099 | 97 | 107 |
| Apex | 2100-2399 | 110 | 120 |
| Paragon | 2400+ | 125 | 135 |

---

## Tech Stack

| Category    | Tools |
|------------|-------|
| Frontend   | React, TypeScript, HTML5, CSS3 |
| Styling    | Tailwind CSS |
| Tooling    | Vite, npm |
| Deployment | Vercel |

---

## Project Structure

```
root
├── public
├── src
│   ├── components     # Reusable UI components
│   ├── pages          # Route-level pages
│   ├── game           # Typing engine, scoring, and match rules
│   ├── assets         # Static assets
│   ├── styles         # Global and utility styles
│   └── main.tsx       # Application entry point
├── package.json
├── vite.config.ts
└── README.md
```
---

## Roadmap

The following roadmap outlines planned milestones for VeloType.  
Features are implemented incrementally, with an emphasis on correctness, fairness, and scalability.

### Phase 1 — Core Foundation
- [x] Deterministic typing engine
- [x] Strongly typed game logic using TypeScript
- [x] Modular frontend architecture
- [x] Repository structure cleanup and tooling polish
- [x] Environment configuration standardization

### Phase 2 — Persistence & Accounts
- [x] Backend API setup
- [x] Database integration (users, profiles, matches)
- [x] Authentication (OAuth or email-based)
- [x] User profiles with persisted settings
- [x] Match history storage and retrieval

### Phase 3 — Competitive Systems (In Progress)
- [x] Ranked matchmaking queue
- [x] Server-side ELO rating system
- [x] Rank tiers and progression visualization
- [x] Daily seeded leaderboards
- [ ] Anti-abuse and validation checks

### Phase 4 — Real-Time Multiplayer
- [x] WebSocket-based match infrastructure
- [x] Server-authoritative 1v1 match flow
- [x] Reconnect handling and match recovery
- [x] Latency and performance optimization

### Phase 5 — Expanded Game Modes (In Progress)
- [ ] Battle Royale typing mode
- [ ] Multi-round elimination mechanics
- [ ] Player targeting and interaction systems
- [ ] Spectator-friendly UI elements

### Phase 6 — Production Readiness
- [ ] Monitoring and logging
- [ ] Rate limiting and abuse prevention
- [ ] Accessibility and UX refinements
- [ ] Performance profiling and optimization
- [ ] Legal and privacy documentation

## Environment

To run VeloType locally or deploy, create a `.env` file at the project root and fill in your values. Below are the required environment variables:

- `DATABASE_URL`: Database connection string for backend (leave blank if not used yet)
- `AUTH_SECRET`: Secret key for authentication (leave blank if not used yet)
- `NEXT_PUBLIC_API_URL`: Base URL for API requests from frontend (optional)
- `NEXT_PUBLIC_ANALYTICS_ID`: Analytics or third-party integration key (optional)

You can add more variables as backend features are implemented. The app will run locally with a project-root `.env`, even if some features are stubbed.

## Backend (Phase 2 foundation)

Server scaffold lives in [server/README.md](server/README.md).

Quick start:

- Install: `cd server && npm install`
- Run dev server: `npm run dev` (default port 4000)
- Env used: `PORT` (default 4000), `DATABASE_URL` (optional now), `AUTH_SECRET` (optional now)
- Endpoints (stub): GET /health, POST /auth/login, GET /profile, WS /ws/matchmaking

Matchmaking (current): in-memory ranked queue with expanding rating window; emits `MATCH_FOUND` { matchId, seed, config, startAt }. If `DATABASE_URL` (Postgres) is set and migrations run, matches are persisted via Prisma.
