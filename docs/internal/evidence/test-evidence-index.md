---
title: Test Evidence Index
slug: evidence/test-evidence-index
category: evidence
visibility: signed-in
audience: reviewers
status: Current
order: 3
updatedAt: 2026-03-11
---

# Test evidence index

## Deterministic coverage

- auth environment and policy tests
- sidebar and docs visibility tests
- settings/admin/backtest UI regression tests
- Schwab popup/callback UI tests

## Browser/system coverage

- sign-in and authenticated navigation flows
- backtester editor fallback flow
- admin/settings flows

## Export path

Run `npm run export:evidence` to create a reproducible artifact bundle under `artifacts/senior-project/`.
