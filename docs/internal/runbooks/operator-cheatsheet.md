---
title: Operator Cheatsheet
slug: runbooks/operator-cheatsheet
category: runbook
visibility: signed-in
audience: operators
status: Current
order: 7
updatedAt: 2026-03-11
---

# Operator cheatsheet

## Core commands

```bash
npm run dev
npm run dev:reset
npm run bootstrap:demo
npm run export:evidence
npm run bundle:demo
```

## Key health endpoints

- `/api/health/auth`
- `/api/health/runtime`

## Presentation-critical surfaces

- `/docs`
- `/dashboard`
- `/settings`
- `/backtest`
- `/admin`

## If the public domain fails

- verify Cloudflare tunnel state
- verify local app on `localhost:6244`
- switch to demo-safe local mode if the public callback path is unavailable

## If live OAuth fails

- do not keep retrying in front of the audience
- fall back to screenshots and the docs portal
- explain that the live path is present but external dependency health degraded

