---
title: Codebase Tour
slug: guidebook/codebase-tour
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 6
updatedAt: 2026-03-11
---

# Codebase tour

## Main folders

- `app/`: Next.js routes, API routes, and product surfaces
- `lib/`: shared server and client helpers, auth, docs, security, brokerage, provider logic
- `prisma/`: schema and Prisma artifacts
- `docs/`: public and internal project documentation
- `scripts/`: bootstrap, evidence export, demo/data helpers
- `tests/` and `e2e/`: deterministic and browser/system tests

## Where to start

- auth: `lib/auth.ts`, `lib/auth-environment.ts`, `lib/auth-policy.ts`
- Schwab/brokerage: `lib/brokerage-connections.ts`, `app/api/schwab/*`
- control plane: `app/admin`, `app/api/admin/*`
- docs system: `lib/docs.ts`, `app/docs/*`
- backtester: `app/backtest/page.tsx`, `app/components/Backtest/*`

## Important warning

The repo contains both current and legacy material. Use the docs portal and current-state baseline to determine what is current before assuming an older file is authoritative.

