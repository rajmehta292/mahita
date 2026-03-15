---
title: MahaCharts Overview
slug: guidebook/mahacharts/overview
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 11
updatedAt: 2026-03-14
---

# MahaCharts overview

## Product objective

MahaCharts is the chart-first workspace for Mahita. It is the place where symbol context, chart interaction, strategy authoring, backtesting, trade intent, and deployment state converge around the chart itself.

## Visual contract

Desktop MahaCharts follows a five-region model:

1. top command bar for symbol, timeframe, chart type, indicators, strategies, save, settings, and snapshot
2. left drawing rail for chart tools
3. center stage for price action, indicator panes, chart legend, and range controls
4. adjustable Pine editor overlay that stays out of the way until opened
5. permanent right utility strip plus contextual right-side overlays for watchlist, details, trade, and automation

The bottom dock still exists, but it is for strategy report and execution-adjacent surfaces, not the primary editing surface.

## Current implementation anchors

- `SuperChartWorkspace.tsx` owns workspace composition, route sync, the single-overlay controller, dock state, autosave, deployments, watchlist, and brokerage surfaces.
- `Chart.tsx` owns main candlestick rendering, overlay indicators, stacked oscillator panes, markers, resize handling, and dispose safety.
- `strategy-library.ts` owns the strategy, immutable version, and workspace-session model.

## Non-goals for this phase

- multi-chart layouts
- community indicator marketplace breadth
- full TradingView drawing-object persistence
- broker-agnostic execution adapters beyond current paper/Schwab paths

## Acceptance bar

The chart must stay readable above the fold, attached strategies must be inspectable from the chart workflow, and the deployment/tester/trade experience must feel subordinate to the chart rather than like separate dashboards.
