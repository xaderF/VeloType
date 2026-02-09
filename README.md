# VeloXType

<p align="left">
  <img alt="React" height="24" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/react/react-original.svg" />
  <img alt="TypeScript" height="24" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg" />
  <img alt="Tailwind CSS" height="24" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/tailwindcss/tailwindcss-original.svg" />
  <img alt="Vite" height="24" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/vitejs/vitejs-original.svg" />
</p>

VeloXType is a competitive typing game that transforms typing speed, accuracy, and consistency into structured, skill-based competition.  
The project is designed around ranked progression, fair match conditions, and extensible game modes rather than traditional standalone typing tests.

---

## Overview

VeloXType is built as a modern, **type-safe** frontend application to explore competitive typing mechanics beyond conventional typing platforms. Instead of measuring raw speed in isolation, the game evaluates relative performance between players, emphasizing accuracy, consistency, and decision-making under pressure.

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

This mode forms the competitive core of VeloXType.

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

## What Makes VeloXType Different

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

The following roadmap outlines planned milestones for VeloXType.  
Features are implemented incrementally, with an emphasis on correctness, fairness, and scalability.
