---
title: MahaCharts Change Rules
slug: guidebook/mahacharts/change-rules
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 16
updatedAt: 2026-03-14
---

# MahaCharts change rules

## Mandatory updates when touching MahaCharts

If a change affects chart UX, strategies, backtesting, trading rails, deployments, or docs context, update:

1. the code
2. `docs/current_state_baseline.md`
3. the relevant MahaCharts guidebook pages
4. the generated context artifacts
5. the relevant deterministic or browser tests

## What counts as a regression

- the chart is no longer the dominant surface
- state cards or generic dashboard blocks return to the chart stage
- strategy deployments stop resolving to immutable versions
- autosave and immutable history become the same thing again
- new controls ship without stable `data-testid` coverage
- docs claim broader TradingView parity than the code actually implements

## Source-of-truth order

For MahaCharts work, use this order:

1. runtime behavior and code
2. MahaCharts guidebook docs
3. generated context artifacts
4. README and public summaries

## Future AI-agent operating rule

If an AI agent receives a vague MahaCharts task, it must start from:

1. this guidebook cluster
2. the generated handoff artifact
3. the verification scripts

Then it should inspect the current code before proposing or applying changes.
