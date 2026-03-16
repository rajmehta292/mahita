---
title: Operator Cheatsheet
slug: runbooks/operator-cheatsheet
category: runbook
visibility: signed-in
audience: operators
status: Current
order: 7
updatedAt: 2026-03-12
---

# Operator cheatsheet

## Core commands

```bash
npm run dev
npm run dev:reset
npm run build
npm run start
npm run bootstrap:demo
npm run backup:platform-data
npm run verify:platform-data
npm run export:evidence
npm run bundle:demo
```

## Key health endpoints

- `/api/health/auth`
- `/api/health/runtime`
- `/api/trading/market-data?symbol=AAPL&timeframe=1d`

## Presentation-critical surfaces

- `/docs`
- `/dashboard`
- `/settings`
- `/backtest`
- `/admin`

## DI-UI quick use

- Open `/admin?tab=di-ui`
- `Scheduler`
  - start or stop the Stage 2 scheduler
  - edit provider budgets, lane weights, target enablement, and canonical intervals
  - review the active policy separately from the observed runtime state
  - use `Universe Control` to switch between Dow 30, S&P 500, custom, and all-enabled targets
  - current default profile is `presentation-default`
  - current default ingest emphasis is:
    - `USER_VIEW`
    - `DOW30_REALTIME`
    - `SELECTED_OR_SP500_REALTIME`
    - `SELECTED_ALL_1M`
- `Caller`
  - watch live provider request, response, and error traffic
- `Processor`
  - inspect recent ingestion jobs and dispatch logs
  - verify which vault received bars, what timeframe was stored, and whether a verification job was enqueued
- `Verification`
  - run after-hours verification or repeat verification for a symbol/timeframe
  - review `same-source-verified`, `cross-source-verified`, `disputed`, and `stale` outcomes
  - after-hours mode shifts more budget into `1m` historical completion and repeat verification
- `Storage`
  - browse raw cached bars and inventory metadata from the active vault source
  - provenance badges tell you whether rows are native, derived, verified, or disputed

## Current Stage 2 defaults

- canonical short-term source of truth for cached bars: vault SQLite
- primary provider: Schwab
- fallback/reference provider: Yahoo
- default high-priority target: Dow 30
- canonical stored interval for current realtime lane: `1m`
- `30s` is presented as a derived view, not a native stored interval
- user-view refresh default: `13s`
- verification runs in separate lanes:
  - `AFTER_HOURS_VERIFY`
  - `REPEAT_FETCH_VERIFY`
- no bar should be described as verified unless the verification method is explicitly recorded

## If the public domain fails

- verify Cloudflare tunnel state
- verify local app on `localhost:6244`
- restart or re-run the `Mahita Web Supervisor.cmd` and `Mahita Tunnel Supervisor.cmd` Startup launchers
- switch to demo-safe local mode if the public callback path is unavailable

## If live OAuth fails

- do not keep retrying in front of the audience
- fall back to screenshots and the docs portal
- explain that the live path is present but external dependency health degraded

## If DI-UI looks stale or a section reports schema mismatch

- run `npx prisma generate`
- run `npx prisma db push`
- restart the local app server
- refresh `/api/health/runtime`
- confirm `diUiPrismaClientReady` is `true` before assuming the section logic is broken
