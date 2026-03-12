---
title: Current State and Limitations
slug: project-overview/current-state-and-limitations
category: project-overview
visibility: public
audience: reviewers
status: Current
order: 4
updatedAt: 2026-03-11
---

# Current state and limitations

Mahita should currently be described as a **working foundation** rather than a finished trading product.

## Working now

- signed-in user flow and profile continuity
- brokerage credential onboarding and Schwab authorization flow
- multiple signed-in users with isolated account state
- dashboard, portfolio, history, and active trader surfaces
- admin control plane foundation
- a growing documentation and operations layer

## Working but still transitional

- provider-pool architecture
- operator tooling for data and bridge management
- backtester/editor stability
- use of mock/demo pathways for presentation-safe setup

## Still incomplete

- final backtesting data quality and full engine correctness
- final UI polish across the entire terminal
- unified “backtest -> deploy -> monitor” strategy kernel
- dedicated platform provider credentials instead of a temporary bridge
- the more advanced ML experimentation framework

## Why this is acceptable for the project

The value of the project is not that every advanced feature is finished. The value is that the major system boundaries are now understood and documented:

- identity vs brokerage authorization
- user brokerage credentials vs platform provider credentials
- customer plane vs control plane
- research tooling vs eventual execution tooling

That is a defensible engineering outcome for a project of this scope.
