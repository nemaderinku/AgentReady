# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgentReady is a Next.js 14 web app that audits e-commerce websites for AI shopping agent compatibility. It dispatches TinyFish AI agents to run 5 behavioral tests against a target URL, streams results in real-time via SSE, scores them on a weighted scale, and maintains a Redis-backed leaderboard.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server on http://localhost:3000
npm run build        # Production build
npm start            # Start production server
```

No test framework or linter is configured.

## Environment Setup

Copy `.env.example` to `.env.local` and provide:
- `TINYFISH_API_KEY` — TinyFish AI API key
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis credentials

## Architecture

**Stack:** TypeScript, Next.js 14 (App Router), React 18, Tailwind CSS, Upstash Redis, TinyFish AI API.

**Data flow:**
1. User submits URL → `POST /api/audit/start` creates an auditId, spawns 5 parallel TinyFish agents in the background
2. Each agent runs a behavioral test (SSE stream from TinyFish), scores results 0–100
3. Progress events are pushed to an in-memory event store and forwarded to the client via `GET /api/audit/status` (SSE)
4. Final weighted score is computed, stored in Redis, and leaderboard updated

**Core modules (`app/lib/`):**
- `tests.ts` — Defines the 5 test suites (Discovery 25%, Product Understanding 25%, Cart Interaction 25%, Checkout Navigation 15%, Policy Extraction 10%), each with a `buildGoal()` prompt and `score()` function
- `tinyfish.ts` — TinyFish API client; handles SSE stream parsing to extract streaming URLs and structured results
- `redis.ts` — Upstash Redis wrapper; audit storage with 30-day TTL, sorted-set leaderboard, in-memory event pub/sub for SSE forwarding

**API routes (`app/api/`):**
- `audit/start/route.ts` — POST: validates URL, kicks off background test run, returns auditId
- `audit/status/route.ts` — GET: SSE stream that replays past events and subscribes to new ones
- `leaderboard/route.ts` — GET: returns top 20 leaderboard entries

**Pages:**
- `app/page.tsx` — Main audit UI (~700 lines, includes inline components: ScoreCircle, TestCard, LivePreview)
- `app/leaderboard/page.tsx` — Leaderboard display

## Key Patterns

- Path alias `@/*` maps to the project root (tsconfig)
- Brand colors defined as CSS variables in `globals.css` and in `tailwind.config.js` (cyan `#00E5FF`, green `#00E676`, red `#FF1744`, amber `#FFAB00`)
- Fonts: JetBrains Mono (monospace), Outfit (sans-serif)
- Redis keys: `audit:{domain}:{timestamp}`, `audit:{domain}:latest`, sorted set `leaderboard`
