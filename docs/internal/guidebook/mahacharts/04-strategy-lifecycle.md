---
title: MahaCharts Strategy Lifecycle
slug: guidebook/mahacharts/strategy-lifecycle
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 14
updatedAt: 2026-03-14
---

# MahaCharts strategy lifecycle

## Create or load

The user either:

- starts from the default Pine template
- selects an existing strategy from the workspace select
- attaches a strategy from the strategies modal

## Autosave

Autosave writes to `StrategyWorkspaceSession`.

Autosave is for recovery and fast iteration. It should not be treated as immutable history.

## Save Version

`Save Version` creates an immutable `StrategyVersion` snapshot from the current workspace state.

Each version captures:

- source
- symbol
- timeframe
- linked fixture
- run settings
- engine mode
- diagnostics summary
- source hash

## Restore Version

Restoring a version copies it back into the workspace session. The restored code becomes the current mutable editing state.

## Delete Version

Delete only applies to immutable versions. A version should not be deletable if future policy blocks it because of deployment or protection rules.

## Attach to chart

Strategies attach through the strategies modal or quick-select controls. Once attached, the strategy name and current version should be visible in the chart legend/header flow.

## Backtest and deploy

Backtests can run from the workspace session, but deployments must resolve to an immutable version. If no version exists yet, MahaCharts should create one before deployment.
