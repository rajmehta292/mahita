---
title: Bug Log
slug: evidence/bug-log
category: evidence
visibility: signed-in
audience: reviewers
status: Current
order: 2
updatedAt: 2026-03-11
---

# Bug log

## Auth and OAuth

- origin/callback confusion between localhost and production
- popup lifecycle issues during Schwab connection
- transient tunnel availability causing callback failures

## State and navigation

- account-selection synchronization loops
- preference updates during unstable auth/navigation periods
- route fetch failures surfacing as poor UI states

## Backtester/editor

- Monaco initialization instability
- raw event-like errors surfacing in the browser
- chart/editor bootstrap failures requiring better isolation

## Control plane and data

- provider-pool tab contract mismatches
- runtime/schema drift causing Prisma client mismatch failures
- transitional data/provider architecture still requiring refinement
