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
- MahaCharts workspace DOM coverage
- strategy library and indicator-catalog route coverage
- deployment and TradingView webhook route coverage

## Browser/system coverage

- sign-in and authenticated navigation flows
- backtester editor fallback flow
- admin/settings flows
- MahaCharts workspace shell and visual baseline flow

## MahaCharts-specific commands

- `npm run test:mahacharts`
- `npm run test:visual`
- `npm run verify:mahacharts-context`
- `npm run verify:mahacharts-doc-links`
- `npm run verify:mahacharts-coverage`

## Export path

Run `npm run export:evidence` to create a reproducible artifact bundle under `artifacts/senior-project/`.
