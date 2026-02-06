# VeloType

<p align="left">
  <img alt="React" height="24" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/react/react-original.svg" />
  <img alt="Tailwind CSS" height="24" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/tailwindcss/tailwindcss-original.svg" />
  <img alt="Vite" height="24" src="https://raw.githubusercontent.com/devicons/devicon/master/icons/vitejs/vitejs-original.svg" />
</p>

VeloType is a competitive typing game that transforms typing speed and accuracy into structured, skill-based competition.  
The project focuses on ranked progression, fair match design, and extensible game modes rather than traditional standalone typing tests.

---

## Overview

VeloType is built as a modern web application to explore competitive typing mechanics beyond conventional typing platforms. Instead of measuring raw speed in isolation, the game evaluates relative performance between players, emphasizing accuracy, consistency, and decision-making under pressure.

The codebase is designed to support ranked play, scalable multiplayer modes, and future real-time features while maintaining clean component boundaries and predictable game logic.

---

## Core Concepts

- **Skill-based evaluation** — performance is measured using speed, accuracy, and consistency rather than raw WPM alone  
- **Relative competition** — outcomes are determined by player-to-player comparison, not static thresholds  
- **Ranked progression** — ELO-style matchmaking encourages long-term improvement  
- **Deterministic fairness** — shared text seeds ensure identical conditions for all players  
- **Extensible design** — new game modes are layered on top of the same core typing engine  

---

## Game Modes

### ⚔️ Ranked 1v1

A head-to-head competitive mode where two players type the same text under identical conditions.

- Best-of-round format
- Performance-based scoring
- Health / damage mechanics derived from typing accuracy and speed
- Ranked matchmaking with ELO progression

This mode forms the competitive core of VeloType.

---

### 🧠 Precision Duels

A shorter, high-pressure format focused on accuracy and consistency.

- Reduced round length
- Heavier penalties for errors
- Designed to reward controlled typing over pure speed

---

### 🔥 Battle Royale (Planned)

A multi-player competitive mode built on the same scoring system.

- All players type simultaneously
- Performance determines interactions and eliminations
- Designed for high replayability and spectator-friendly pacing

---

## What Makes VeloType Different

- **Competitive-first design** — built around player interaction, not solo benchmarks  
- **Fair by construction** — deterministic text generation removes randomness  
- **Progression-focused** — ranking systems reward improvement over time  
- **Game mechanics layered on typing** — typing performance directly affects outcomes  
- **Built for extensibility** — new modes reuse the same core engine  

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

```text
root
├── public
├── src
│   ├── components     # Reusable UI components
│   ├── pages          # Route-level pages
│   ├── game           # Typing engine, scoring, and match rules
│   ├── assets         # Static assets
│   ├── styles         # Global and utility styles
│   └── main.jsx       # Application entry point
├── package.json
├── vite.config.js
└── README.md
