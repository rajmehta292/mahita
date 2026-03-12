---
title: Demo Modes
slug: senior-project/demo-modes
category: senior-project
visibility: public
audience: presenter
status: Current
order: 10
updatedAt: 2026-03-11
---

# Demo modes

Mahita should be presented with explicit demo modes.

## Demo-only

Use seeded local data, dev-bypass auth, and no live external dependency.

Best for:

- high reliability
- classroom presentation fallback

## Demo-first with live stretch

Run the demo-safe environment first, but keep one live Schwab-connected walkthrough ready if the environment is healthy.

Best for:

- presentations where you want live credibility without risking the whole demo

## Live-capable dev box

Use the full local environment with real secrets, public callback reachability, and live Schwab connection capability.

Best for:

- rehearsal and advanced walkthroughs
- presentations where network and auth health are already verified

## Recommended presentation order

1. start in demo-safe mode
2. check auth and callback health
3. attempt the live stretch only if the environment is healthy
4. fall back immediately if it degrades

