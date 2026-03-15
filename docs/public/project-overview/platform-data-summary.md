---
title: Platform Data Summary
slug: project-overview/platform-data-summary
category: project-overview
visibility: public
audience: reviewers
status: Current
order: 5
updatedAt: 2026-03-12
---

# Platform data summary

Mahita currently uses a **hybrid market-data architecture**.

## What is real today

- charts and backtests currently read cached OHLCV bars from local vault SQLite databases
- Schwab is the main live market-data provider
- Yahoo exists as a secondary data source
- the app tracks inventory and health summaries in the main application database
- the current Stage 2 scheduler foundation is active, and the next full queue rewrite is intentionally deferred until stronger evidence says it is needed

## What is transitional

- a parquet lake exists, but it is still experimental and not the main app data path
- some higher timeframes are derived from base bars instead of fetched natively
- the provider-pool architecture still includes a temporary bridge while dedicated platform credentials are completed
- some inventory metadata still lags the vault-backed bar truth for sampled symbols

## What still needs work

- stronger cross-source verification and provenance
- cleaner long-term storage promotion between vault caches and the parquet lake
- more complete historical coverage and stricter handling of unsupported intervals
- stronger backing for derived intervals like `30s`, which are currently defined correctly but not yet broadly populated by `1s` base storage

## Why this matters for the project

The important engineering result is that the platform now clearly separates:

- user/brokerage identity
- platform provider access
- cached bar storage
- inventory metadata
- future archival/experimental data storage

That makes the system understandable and improvable, even though the final data architecture is still not complete.
