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

## MahaCharts rule

MahaCharts changes have a stricter four-part requirement:

1. code
2. canonical MahaCharts guidebook docs
3. generated MahaCharts context packet
4. deterministic and browser evidence

Use these scripts:

- `npm run generate:mahacharts-context`
- `npm run verify:mahacharts-context`
- `npm run verify:mahacharts-doc-links`
- `npm run verify:mahacharts-coverage`
- `npm run test:mahacharts`
- `npm run test:visual`
