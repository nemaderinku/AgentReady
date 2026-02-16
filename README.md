# AgentReady

**The first behavioral testing tool for agentic commerce.**

AI shopping agents from Amazon, ChatGPT, and Google are trying to buy from your store right now. AgentReady deploys 5 real AI web agents that simulate the shopping experience and tell you exactly where they fail.

## Architecture

```
                         ┌─────────────────┐
                         │    User / Judge │
                         └────────┬────────┘
                                  │  submits URL
                                  ▼
                    ┌─────────────────────────────┐
                    │     Next.js 14 (App Router) │
                    │  ┌─────────┐  ┌───────────┐ │
                    │  │ Frontend│  │ API Routes│ │
                    │  │ (React) │  │   (SSE)   │ │
                    │  └─────────┘  └─────┬─────┘ │
                    └─────────────────────┼───────┘
                                          │ spawns 5 parallel agents
                         ┌────────────────┼────────────────┐
                         ▼                ▼                ▼
                   ┌──────────┐    ┌──────────┐    ┌──────────┐
                   │ TinyFish │    │ TinyFish │    │ TinyFish │  (×5)
                   │  Agent 1 │    │  Agent 2 │    │  Agent 3 │
                   │ Discovery│    │ Product  │    │  Cart    │  ...
                   └────┬─────┘    └────┬─────┘    └────┬─────┘
                        │               │               │
                        └───────────────┼───────────────┘
                                        ▼
                              ┌──────────────────┐
                              │  Upstash Redis   │
                              │ • JSON storage   │
                              │ • Sorted Sets    │
                              │ • TTL caching    │
                              └──────────────────┘
```

## Features

- **5-Agent Behavioral Audit** — Real AI web agents navigate your store, not static code analysis
- **Weighted Scoring** — 0-100 Agent Readiness Score with letter grade
- **Shareable Report Pages** — Permanent `/report/{domain}` URLs with OG meta tags
- **PDF & JSON Export** — Download audit results in multiple formats
- **Before/After Comparison** — See score delta when re-auditing a domain
- **Leaderboard** — Redis-backed ranking of the most agent-ready stores
- **Priority Fix List** — Actionable, prioritized recommendations

## Quick Start

```bash
# Install dependencies
npm install

# Copy env file and add your keys
cp .env.example .env.local
# Edit .env.local with your TinyFish API key and Upstash Redis credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter a store URL to audit.

## API Keys Needed

1. **TinyFish API Key** — Sign up at [tinyfish.ai](https://agent.tinyfish.ai/signup)
2. **Upstash Redis** — Create a free database at [upstash.com](https://upstash.com) (optional — works without Redis, just no persistence/leaderboard)

## How It Works

AgentReady runs 5 parallel test suites using TinyFish web agents:

| Test | What It Checks | Weight |
|------|---------------|--------|
| 🔍 Discovery | Can an agent find products via search/navigation? | 25% |
| 📦 Product Understanding | Can an agent extract price, variants, availability? | 25% |
| 🛒 Cart Interaction | Can an agent select options and add to cart? | 25% |
| 💳 Checkout Navigation | Can an agent reach the checkout page? | 15% |
| 📋 Policy Extraction | Can an agent find return/shipping/warranty policies? | 10% |

Each test produces a 0-100 subscore. The weighted average is your **Agent Readiness Score**.

## Screenshots

<!-- Add screenshots here -->
<!-- ![Audit Results](screenshots/audit.png) -->
<!-- ![Report Page](screenshots/report.png) -->
<!-- ![Leaderboard](screenshots/leaderboard.png) -->

## Tech Stack

- **Next.js 14** — Frontend + API routes (App Router, Server Components)
- **TinyFish** — AI web agent automation (SSE streaming, multi-step navigation, form interaction, dynamic content handling)
- **Upstash Redis** — Audit storage (JSON with TTL), leaderboard (Sorted Sets), real-time event pub/sub
- **Tailwind CSS** — Styling with custom brand theme

## Built for the r/AI_Agents Hackathon (Feb 2026)

### TinyFish Features Used
- **Navigation** — Agents browse pages, follow links, use search bars
- **Form Interaction** — Variant selectors, add-to-cart buttons, checkout forms
- **Dynamic Content** — Handles SPAs, lazy-loaded products, JavaScript-rendered pages
- **Multi-step Flows** — Cart → checkout navigation across multiple page transitions
- **Structured Output** — JSON extraction from agent observations for automated scoring

### Redis Features Used
- **JSON Storage** — Full audit results stored with `SET` and 30-day TTL
- **Sorted Sets** — Leaderboard ranking via `ZADD` / `ZRANGE REV`
- **Key Patterns** — `audit:{domain}:{timestamp}`, `audit:{domain}:latest`, `leaderboard`
- **TTL Caching** — Automatic expiry prevents stale data accumulation
