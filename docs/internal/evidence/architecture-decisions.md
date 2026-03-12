---
title: Architecture Decisions
slug: evidence/architecture-decisions
category: evidence
visibility: signed-in
audience: reviewers
status: Current
order: 4
updatedAt: 2026-03-11
---

# Architecture decisions

## Key decisions

### 1. Separate Mahita identity from Schwab brokerage authorization

This was necessary for security and conceptual clarity.

### 2. Prefer one application codebase with strong subsystem boundaries

A simpler deployment shape was more realistic than premature microservice sprawl.

### 3. Treat provider credentials and user brokerage credentials as different domains

This is a core trust boundary.

### 4. Freeze public claims to match current reality

The project is stronger when the docs are honest than when they overclaim.

### 5. Treat ML as a research extension, not a marketing claim

The project now has a realistic path for ML experimentation without pretending that the platform already performs ML-driven trading autonomously.
