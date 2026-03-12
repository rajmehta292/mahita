---
title: Presentation Day Recovery Checklist
slug: runbooks/presentation-day-recovery
category: runbook
visibility: signed-in
audience: presenter
status: Current
order: 6
updatedAt: 2026-03-11
---

# Presentation day recovery checklist

## Before presenting

- run the demo bootstrap on a clean machine if needed
- verify `npm run dev` starts cleanly
- confirm documentation home loads
- confirm dashboard, settings, and backtester open
- confirm mock/demo mode is active if using the presentation-safe flow
- confirm `npm run export:evidence` succeeds
- confirm the latest demo bundle exists if you need portability

## If live auth is required

- verify `mahita.ai/api/health/auth`
- verify public callback availability
- verify Cloudflare/tunnel health before opening the room
- verify Schwab callback reachability before attempting live brokerage authorization

## If something fails live

Fallback order:

1. open the documentation section
2. show the report/presentation materials and current-state docs
3. explain the system honestly using the architecture guidebook
4. continue the presentation with screenshots and runbooks if a live flow degrades

## Exact recovery phrasing

If the live path breaks, say:

“Because this project touches real auth and brokerage infrastructure, I prepared a seeded demonstration and a documentation-backed walkthrough so the engineering story remains verifiable even if an external service degrades.”

## Recommended mode choice

- use `Live-capable dev box` only if auth health and callback reachability are green before the talk
- otherwise switch to `Demo-first with live stretch`
- if anything feels unstable, use `Demo-only`
