---
title: Documentation Maintenance Workflow
slug: guidebook/documentation-maintenance
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 5
updatedAt: 2026-03-11
---

# Documentation maintenance workflow

This document exists to keep future AI-assisted updates truthful.

## Source-of-truth order

1. actual code and runtime behavior
2. `docs/current_state_baseline.md`
3. guidebooks and runbooks
4. public-facing summaries and presentation docs

## Mandatory update triggers

Update documentation whenever any of the following changes:

- auth flow
- route or navigation structure
- data model or schema
- new product page
- known limitation or bug classification
- anything that changes the presentation or demo narrative

## Required outputs per meaningful update

- current-state delta
- updated affected docs pages
- docs index / website visibility changes if needed
- evidence log entry
- refreshed tests or test evidence if behavior changed

## Required update sequence

Use this order:

1. inspect the code and current runtime behavior
2. update `docs/current_state_baseline.md`
3. update guidebooks and runbooks
4. update public summaries and senior-project pages
5. update evidence exports if the change affects presentation or review materials

## Standard AI maintainer prompt

Use this exact operating pattern:

1. inspect the current code first
2. compare runtime behavior to the current docs
3. update truth-source docs before public summaries
4. mark old material as historical or superseded
5. never smooth over pivots, regressions, or unfinished work
6. summarize what changed, what remains open, and what was verified

## Truthfulness rules

- do not claim production readiness unless the release gates are actually green
- do not claim ML strategy refinement is finished
- do not claim live strategy automation parity unless the full path exists
- do not hide objective changes or project pivots
- do not claim a feature is “live” just because its UI exists
- do not change the senior-project narrative to make it cleaner than the actual research history
