# VeloType

VeloType is a competitive typing game focused on speed, accuracy, and skill-based progression.  
The project is designed as a structured, extensible frontend application that supports ranked competitive modes and real-time interaction.

---

## Overview

VeloType is built as a modern web application to explore competitive typing mechanics beyond traditional typing tests. Instead of focusing solely on raw speed, the system emphasizes accuracy, consistency, and relative performance between players.

The project is structured to support ranked 1v1 gameplay, scalable game modes, and future real-time features while maintaining clean component boundaries and predictable state management.

---

## Core Concepts

- Skill-based typing evaluation (speed, accuracy, consistency)
- Competitive scoring based on relative performance
- Ranked progression using ELO-style matchmaking
- Deterministic text generation for fair matches
- Extensible game-mode architecture

---

## Features

- Multi-page frontend architecture
- Modular React component design
- Deterministic typing rounds with shared text seeds
- Performance-focused typing engine
- Responsive layout for desktop and tablet
- Clean separation between UI, game logic, and scoring logic

---

## Tech Stack

| Category    | Tools |
|------------|-------|
| Frontend   | React, JavaScript (ES6+), HTML5, CSS3 |
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
│   ├── game           # Typing logic, scoring, and match rules
│   ├── assets         # Static assets
│   ├── styles         # Global and utility styles
│   └── main.jsx       # Application entry point
├── package.json
├── vite.config.js
└── README.md
