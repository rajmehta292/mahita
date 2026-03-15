---
title: MahaCharts State Model
slug: guidebook/mahacharts/state-model
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 13
updatedAt: 2026-03-14
---

# MahaCharts state model

## URL state

The current canonical route is `/superchart`.

Supported query parameters:

- `symbol`
- `timeframe`
- `draft`

`draft` currently resolves to the selected strategy id for compatibility with the older script-draft mental model.

## Workspace state

UI-only workspace state in `SuperChartWorkspace.tsx` includes:

- active overlay:
  - `null`
  - editor overlay
  - right-side overlay with selected tab
- editor overlay width
- right overlay widths by tab
- overlay resize interaction
- active dock tab
- dock expanded or collapsed
- active left-rail tool
- selected indicators
- range preset
- indicators modal state and selected modal tab

The right utility strip is not part of the overlay state. It remains visible at all times and acts as the launcher/toggle surface for right-side overlays.

## Strategy state

The strategy system has three layers:

1. `Strategy`
2. `StrategyVersion`
3. `StrategyWorkspaceSession`

`Strategy` is the durable library identity.

`StrategyVersion` is immutable and is the unit used for deployment-safe history.

`StrategyWorkspaceSession` is the mutable autosave lane for in-progress edits.

## Deployment state

Deployments should resolve both:

- `strategyId`
- `strategyVersionId`

Legacy `linkedScriptDraftId` remains for compatibility, but it is not the intended long-term primary reference.

## Preference state

Relevant user preference keys:

- `watchlistSymbols`
- `indicatorFavorites`
- `selectedAccountId`

## Cross-surface state rule

When a strategy is selected in MahaCharts, the editor, tester, trade overlay, and automation overlay must all reflect the same strategy/version context. Divergence between those surfaces is a bug.
