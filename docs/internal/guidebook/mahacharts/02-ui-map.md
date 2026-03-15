---
title: MahaCharts UI Map
slug: guidebook/mahacharts/ui-map
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 12
updatedAt: 2026-03-14
---

# MahaCharts UI map

## Top command bar

Owned in `SuperChartWorkspace.tsx` through `MahaChartsTopBar`.

Primary controls:

- symbol search
- timeframe buttons
- provider, reference, compare, and chart-type selects
- indicators modal trigger
- strategies modal trigger
- favorite indicator quick-add buttons
- quick strategy attach buttons
- watchlist toggle
- alert/automation entry
- replay/tester entry
- save workspace
- settings entry
- snapshot copy
- trade entry

## Left rail

Owned in `MahaChartsLeftRail`.

Current tools:

- pointer
- crosshair
- trend line
- horizontal line
- brush
- text
- measure
- magnet
- lock
- hide
- clear

These are phase-one tools. Some are visual scaffolding rather than persisted chart objects.

## Center stage

Owned in `MahaChartsStage`.

Sections:

- stage header
- chart shell
- chart legend/status badges
- chart panel
- range toolbar

The stage must remain the dominant desktop surface.

## Editor overlay

Owned in `SuperChartWorkspace.tsx` through `MahaChartsEditorOverlay`.

Contents:

- Monaco-based Pine editor
- workspace metadata and draft selection
- validate and save-version actions
- autosave state
- runtime settings
- version history with restore and delete actions

The overlay is user-invoked, resizable from its leading edge, and must not consume chart height until opened.

## Right utility strip

Owned in `SuperChartWorkspace.tsx` through `MahaChartsRightStrip`.

Current icons:

- Watchlist
- Details
- Trade
- Automation

The strip is always visible, fixed-width, and does not expand into layout width.

## Right overlay

Owned in `SuperChartWorkspace.tsx` through `MahaChartsRightOverlay`.

Current overlay bodies:

- Watchlist overlay
- Details overlay
- Trade overlay
- Automation overlay

Rules:

- only one overlay may be open at a time
- opening a right overlay closes the editor overlay
- opening the editor overlay closes any right overlay
- the overlay spans from below the top bar to the bottom of the workspace, covering chart plus dock without reflowing the chart
- the permanent right strip stays visible while an overlay is open

## Bottom dock

Owned in `MahaChartsBottomDock`.

Tabs:

- Strategy Tester
- Trades
- Orders
- Positions
- Logs
- Trading Panel

## Modal surfaces

Current modal:

- `IndicatorsStrategiesModal`

Tabs:

- Indicators
- Strategies
- Profiles
- Patterns

## Required test IDs

The generated UI map artifact is the machine-readable source for the current `data-testid` inventory. If a new MahaCharts region is added, the test ID must be added in code and then regenerated into the context packet.
