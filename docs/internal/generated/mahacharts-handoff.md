---
title: MahaCharts Generated Handoff
slug: generated/mahacharts-handoff
category: guidebook
visibility: signed-in
audience: developers
status: Current
updatedAt: 2026-03-15
---

# MahaCharts generated handoff

This file is generated. Edit the canonical MahaCharts guidebook docs instead.

## Core route

- `/superchart`

## Primary code surfaces

- `app/components/SuperChart/SuperChartWorkspace.tsx`
- `app/components/Chart.tsx`
- `app/components/Backtest/MahitaCodeEditor.tsx`
- `lib/indicator-catalog.ts`
- `lib/strategy-library.ts`
- `lib/strategy-deployments.ts`
- `lib/script-drafts.ts`
- `lib/user-preferences.ts`
- `lib/docs.ts`

## Canonical docs

- MahaCharts Start Here For AI Agents: `docs/internal/guidebook/mahacharts/README.md`
- MahaCharts Overview: `docs/internal/guidebook/mahacharts/01-overview.md`
- MahaCharts UI Map: `docs/internal/guidebook/mahacharts/02-ui-map.md`
- MahaCharts State Model: `docs/internal/guidebook/mahacharts/03-state-model.md`
- MahaCharts Strategy Lifecycle: `docs/internal/guidebook/mahacharts/04-strategy-lifecycle.md`
- MahaCharts Verification Matrix: `docs/internal/guidebook/mahacharts/05-verification-matrix.md`
- MahaCharts Change Rules: `docs/internal/guidebook/mahacharts/06-change-rules.md`

## Required UI regions

- `mahacharts-topbar`: Top command bar for symbol, timeframe, indicator, strategy, and save actions.
- `mahacharts-left-rail`: Left drawing/tool rail.
- `mahacharts-stage`: Center chart stage, chart shell, legend, and range controls.
- `mahacharts-dock`: Bottom dock for editor, tester, orders, logs, and trading.
- `mahacharts-right-strip`: Permanent right utility strip that keeps icon affordances visible while the chart remains dominant.
- `mahacharts-right-overlay`: Shared right-side overlay spanning chart plus dock without reflowing the chart stage.
- `mahacharts-indicators-modal`: Indicators, strategies, profiles, and patterns modal.

## Required verification

- strategy route coverage
- indicator catalog route coverage
- deployment and webhook route coverage
- market-data route coverage
- workspace DOM coverage for modal, dock, and chart shell
- single-overlay controller coverage for editor and right-side overlays
- mahacharts shell smoke
- indicator modal flow
- right utility strip and overlay geometry
- chart visibility above the fold
- runtime-noise gate for update depth, nested buttons, and disposed chart objects
- desktop visual baselines
- concurrent-session propagation for strategies and deployments
- chart readability and pane density
- indicator add/remove ergonomics
- strategy version restore/delete flow
- dock and overlay resize balance
- long-session chart stability

## Product rules

- Keep the chart as the dominant desktop surface.
- Keep deployments pinned to immutable strategy versions.
- Keep docs and generated context updated with every meaningful MahaCharts change.
