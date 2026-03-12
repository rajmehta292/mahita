---
title: Report Appendix - Architecture
slug: senior-project/report-appendix-architecture
category: senior-project
visibility: public
audience: reviewers
status: Current
order: 9
updatedAt: 2026-03-11
---

# Report appendix: architecture

## System layers

Mahita should be understood as five layers:

1. public identity layer
2. session and authorization layer
3. brokerage authorization layer
4. platform/provider/control layer
5. user-facing product surfaces

## Core split that matters

The most important trust boundary is the split between:

- Mahita identity
- Schwab brokerage authorization

Google sign-in identifies the Mahita user. Schwab OAuth authorizes that user’s brokerage account access. Those are intentionally separate.

## Transitional architecture

Mahita currently includes a provider-pool bridge that lets a superuser-backed Schwab connection temporarily support platform data access. That is safer than the earlier ad hoc fallback model, but it is still transitional and not the final intended architecture.

## Product surfaces

The user-facing platform currently includes:

- landing and documentation
- dashboard
- portfolio
- active trader
- trade history
- watchlist
- backtester prototype
- admin control plane

## Architecture lesson

One of the strongest outcomes of the project is not merely the current UI. It is the clearer understanding of where identity, brokerage authorization, data pipelines, strategy logic, and operator tooling must be separated.

