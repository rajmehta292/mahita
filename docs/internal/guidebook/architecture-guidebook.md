---
title: Architecture Guidebook
slug: guidebook/architecture-guidebook
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 1
updatedAt: 2026-03-11
---

# Architecture guidebook

Mahita currently operates as a modular application with explicit subsystem boundaries:

- identity and session management
- brokerage authorization and connection state
- user-facing product surfaces
- operator/control plane
- data and strategy subsystems
- documentation and runbooks

## Design principle

The system should prefer clear boundaries over accidental coupling. The most important boundaries are:

- Mahita identity vs brokerage authorization
- customer plane vs control plane
- user credentials vs platform provider credentials
- public docs vs internal technical docs

## Current high-level shape

- `app/` owns UI routes and API routes
- `lib/` owns most reusable business logic
- `docs/` now serves as both a repo artifact and a website-visible wiki
- `scripts/` owns reproducible project setup and evidence export tasks

## Transitional areas

- provider-pool bridging is still transitional
- backtester and future strategy deployment are not yet unified
- some operator/data flows still need refinement

## Recommended future architecture sequence

1. finish provider/brokerage separation
2. complete the control plane
3. unify strategy definition, backtesting, monitoring, and deployment
4. expand ML research on top of that cleaner strategy model
