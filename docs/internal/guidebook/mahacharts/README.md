---
title: MahaCharts Start Here For AI Agents
slug: guidebook/mahacharts
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 10
updatedAt: 2026-03-14
---

# MahaCharts start here for AI agents

This is the canonical entry point for any future work on MahaCharts.

## What MahaCharts is

MahaCharts is the chart-native workspace at `/superchart`. It is not a dashboard. The product contract is:

1. top command bar
2. left drawing rail
3. center chart stage
4. adjustable Pine editor overlay
5. permanent right utility strip plus contextual right-side overlays

The bottom dock remains part of the workspace, but it is reserved for tester, trades, orders, positions, logs, and trading-panel surfaces. The editor should not consume chart height until it is explicitly opened.

Any change that makes the chart less dominant than those five regions is a regression.

## Where the code lives

- workspace shell: `app/components/SuperChart/SuperChartWorkspace.tsx`
- chart renderer and pane orchestration: `app/components/Chart.tsx`
- indicator catalog: `lib/indicator-catalog.ts`
- strategy library and version/session lifecycle: `lib/strategy-library.ts`
- deployment pipeline: `lib/strategy-deployments.ts`
- strategy API routes: `app/api/strategies/*`
- indicator catalog route: `app/api/indicators/catalog/route.ts`

## Canonical docs in this guidebook

Read these in order:

1. [MahaCharts Overview](01-overview.md)
2. [MahaCharts UI Map](02-ui-map.md)
3. [MahaCharts State Model](03-state-model.md)
4. [MahaCharts Strategy Lifecycle](04-strategy-lifecycle.md)
5. [MahaCharts Verification Matrix](05-verification-matrix.md)
6. [MahaCharts Change Rules](06-change-rules.md)

## Generated context packet

These artifacts are generated from the canonical docs plus selected source files:

- `docs/internal/generated/mahacharts-context.json`
- `docs/internal/generated/mahacharts-ui-map.json`
- `docs/internal/generated/mahacharts-verification-checklist.json`
- `docs/internal/generated/mahacharts-handoff.md`

Refresh them with `npm run generate:mahacharts-context`.

## Mandatory verification before claiming completion

Any meaningful MahaCharts change must update:

1. code
2. canonical docs
3. generated context packet
4. deterministic or browser evidence

The enforceable scripts are:

- `npm run verify:mahacharts-context`
- `npm run verify:mahacharts-doc-links`
- `npm run verify:mahacharts-coverage`

## Product rules that future agents must not violate

- Do not reintroduce dashboard cards above the chart.
- Do not reintroduce a width-taking right rail; right-side content must open as overlays over the chart workspace.
- Do not move provider, parity, fixture, or deployment state into the primary chart command lane unless there is a chart-native reason.
- Do not bind deployments to mutable draft-only state; deployments must resolve to immutable strategy versions.
- Do not add new MahaCharts surfaces without `data-testid` coverage and docs updates.
