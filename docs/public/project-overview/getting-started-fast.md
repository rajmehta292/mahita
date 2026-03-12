---
title: Getting Started Fast
slug: project-overview/getting-started-fast
category: project-overview
visibility: public
audience: reviewers
status: Current
order: 6
updatedAt: 2026-03-11
---

# Getting started fast

This guide is for someone who just opened the repository and wants to understand Mahita quickly.

## What Mahita is

Mahita is a trading terminal and strategy research platform. It combines:

- Mahita user identity and workspaces
- Schwab brokerage authorization through a user’s own developer app keys
- account-aware dashboard, portfolio, and trader screens
- a prototype backtester
- an admin/control plane
- a documentation/wiki system that records the project honestly

## The fastest way to run it

Use the demo bundle path first:

```bash
npm run bootstrap:demo
npm run dev
```

That gives you a presentation-safe local environment with seeded users and demo data.

## If you want to understand the structure

Read in this order:

1. `Architecture Summary`
2. `Current State And Limitations`
3. `Senior Project Report Draft`
4. `Codebase Tour` (signed-in)
5. `Architecture Map` (signed-in)

## Demo vs live-capable dev mode

- `Demo mode` is designed for presentation stability.
- `Live-capable dev mode` is for real integration work and requires additional secrets, public callback availability, and a working Schwab developer setup.

## Do not assume

Do not assume the following are complete:

- production-grade backtesting parity
- live strategy automation
- ML strategy optimization
- fully finished market-data architecture

Those areas are part of the roadmap, not final shipped capability.

