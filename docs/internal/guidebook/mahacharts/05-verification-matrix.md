---
title: MahaCharts Verification Matrix
slug: guidebook/mahacharts/verification-matrix
category: guidebook
visibility: signed-in
audience: testers
status: Current
order: 15
updatedAt: 2026-03-14
---

# MahaCharts verification matrix

## Deterministic coverage

Required route and unit coverage includes:

- strategy library CRUD
- version create, restore, delete
- workspace-session autosave
- indicator catalog route
- deployment route coverage
- webhook ingest coverage
- market-data route coverage
- Schwab order submission route coverage

## Browser coverage

Required Playwright coverage includes:

1. chart visible above the fold
2. indicators modal open and apply
3. strategy attach from `My Strategies`
4. editor overlay open without collapsing chart dominance
5. right-side overlays open from the permanent strip without reflowing chart width
6. editor overlay and right-side overlays are mutually exclusive
7. dock open and tester run
8. overlay and dock can coexist without clipping content
9. automation overlay deployment creation
10. no runtime noise like update-depth loops, disposed-chart errors, or nested-button hydration errors

## Manual charters

Manual review is still required for:

- chart readability
- pane balance
- editor overlay ergonomics and resize feel
- right overlay proportions and resize feel
- dock ergonomics
- long-session stability
- hot-reload/dispose behavior
- drawing-rail discoverability

## Evidence rule

MahaCharts work is not complete until these are updated together:

1. code
2. canonical docs
3. generated context packet
4. deterministic/browser evidence
