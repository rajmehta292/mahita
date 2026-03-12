---
title: Testing Guidebook
slug: guidebook/testing-guidebook
category: guidebook
visibility: signed-in
audience: testers
status: Current
order: 3
updatedAt: 2026-03-11
---

# Testing guidebook

Mahita currently uses a two-lane testing model:

- deterministic/unit-dom testing with Vitest
- browser/system testing with Playwright

## What the current suite is good at

- auth policy and redirect behavior
- documentation and sidebar rendering
- Schwab popup/callback UI behavior
- backtester editor failure handling
- admin and settings page regressions

## What still needs improvement

- broader end-to-end scenario coverage across more product surfaces
- richer demo-mode validation
- deeper strategy/backtest correctness fixtures
- cleaner operator/data path coverage

## Rule for future work

Any meaningful platform change should update:

1. the code,
2. the current-state docs,
3. the relevant deterministic/browser tests.
