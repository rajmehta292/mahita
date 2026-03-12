---
title: Executive Overview
slug: project-overview/executive-overview
category: project-overview
visibility: public
audience: reviewers
status: Current
order: 1
updatedAt: 2026-03-11
---

# Mahita executive overview

Mahita is a web-based trading terminal and research platform built as a senior project for Computer Engineering at Cal Poly. The goal of the project is to combine three workflows that are usually fragmented across multiple tools:

1. connecting a user’s brokerage context,
2. researching and backtesting strategies,
3. moving the same strategy context into live monitoring and eventual live testing.

The platform currently delivers a real user/account/auth foundation, brokerage connectivity through Schwab developer credentials, portfolio and account-aware views, a backtesting prototype, and an expanding operator/control plane for secure multi-user administration. It is not being presented as a finished commercial product. It is being presented as a technically serious foundation with a clearly documented roadmap.

## What was built

- Mahita identity and session management using Google + NextAuth
- user profiles, saved preferences, and persistent navigation state
- Schwab developer-key onboarding and Schwab OAuth account connection
- multi-user account isolation and early admin controls
- portfolio, dashboard, active trader, history, and watchlist workflows
- a prototype backtesting workspace and strategy-monitoring surfaces
- internal documentation, runbooks, and security guidebooks

## What still needs refinement

- historical data quality and coverage for backtesting
- deeper strategy runtime correctness and UI polish in the backtester
- better production operator tooling and dedicated provider credentials
- expansion of ML-driven strategy research into a more systematic framework

## Why the project matters

Retail traders can usually access backtesting tools or broker execution tools, but not a coherent system that keeps strategy research, account context, and future automation tied together. Mahita attempts to close that gap with an architecture that can evolve from prototype research tooling into a safer, more trustworthy trading platform.
