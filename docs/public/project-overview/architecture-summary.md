---
title: Architecture Summary
slug: project-overview/architecture-summary
category: project-overview
visibility: public
audience: reviewers
status: Current
order: 3
updatedAt: 2026-03-11
---

# Architecture summary

Mahita is currently structured as a modular web application with clearly separated subsystems, even though it still runs as a single deployable codebase.

## Primary layers

### Identity and access

- Google / NextAuth for Mahita identity
- server-side role-aware route protection
- session-aware navigation continuity through stored user preferences

### Brokerage layer

- Schwab developer credentials stored per user
- Schwab OAuth authorization for the actual brokerage account
- brokerage connections and brokerage accounts modeled explicitly in the database

### Product layer

- dashboard and portfolio views
- active trader flow
- watchlists, history, and strategy-facing surfaces
- internal control plane for superuser operations

### Strategy and data layer

- prototype backtesting engine
- strategy-monitoring surfaces such as Trending Indicators
- market-data ingestion and inventory tooling
- an initial provider pool and platform bridge model

## Why this architecture was chosen

A single deployable codebase was more realistic for a senior project than a distributed microservice platform. That choice reduced operational complexity while still allowing the code to be structured by subsystem:

- auth
- brokerage
- market data
- strategy engine
- operator tooling
- documentation and runbooks

The codebase is therefore easier to demo, easier to reason about, and easier to evolve incrementally.

## Important current limitation

The strategy/backtesting/live-testing path is not fully unified yet. That is one of the biggest future architectural tasks still remaining.
