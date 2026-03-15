---
title: Platform Data Architecture Audit
slug: guidebook/platform-data-architecture-audit
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 6
updatedAt: 2026-03-12
---

# Platform data architecture audit

This document is the current source of truth for how Mahita acquires, caches, serves, verifies, and stores platform market data.

## Short version

Mahita currently runs on a **hybrid transitional data architecture**:

- **Vault SQLite databases** are the source of truth for cached OHLCV market bars.
- The **main Prisma application database** is the source of truth for auth, user state, brokerage metadata, provider-pool metadata, vault registry, and data inventory summaries.
- The **parquet lake and V2 route** exist, but they are experimental and not the primary chart/backtest runtime path.

## What data Mahita is currently seeking

### Currently used

- equity OHLCV bars
- intraday and higher-timeframe bars used by charts and backtests
- account, position, and order data from Schwab brokerage APIs

### Derived in-app

- non-native timeframes derived from a base timeframe
- examples:
  - `5m`, `15m`, `30m` derived from `1m`
  - `2h`, `3h`, `4h` derived from `1h`

### Experimental or partial

- parquet lake under `data/lake`
- `SymbolRegistry`, `DataPartition`, `DataSpan`, `IngestionJob`, and `IngestionEvent`
- multi-provider consolidation into the `master` vault

### Not yet reliable enough to present as final

- broad second-level coverage
- provider-native support for every surfaced timeframe
- cross-source “verified” semantics beyond the current consolidator

## Runtime acquisition flow

### Primary runtime path

1. Customer route requests bars from `/api/trading/market-data`.
2. `MarketDataStore` resolves the requested timeframe to a required base timeframe.
3. Cached bars are read from the selected vault SQLite database.
4. Missing ranges are computed.
5. The active provider fetches only missing ranges.
6. Fetched bars are written back into the vault database.
7. If the requested timeframe is derived, Mahita aggregates the base bars into the requested timeframe before returning them.

Primary files:

- `app/services/market-data/store.ts`
- `app/services/market-data/providers/schwab.ts`
- `app/services/market-data/providers/yahoo.ts`
- `app/services/market-data/vault-manager.ts`
- `app/api/trading/market-data/route.ts`

### Ingestion path

The continuous ingest system uses the same general store and health machinery but runs as a background platform sweep.

1. Continuous ingest selects symbols from the global universe.
2. It inspects local coverage and gaps through `DataHealthManager`.
3. It bootstraps empty ranges, backfills weak coverage, repairs gaps, and refreshes stale tails.
4. It writes fetched bars into vault storage.
5. Inventory summaries are refreshed in the main app DB.

Primary files:

- `app/services/market-data/ingestion.ts`
- `app/services/market-data/health.ts`
- `app/services/market-data/universe-loader.ts`

## Current storage structure

## 1. Main application database

The main Prisma DB stores platform control and auth state, including:

- `User`
- `Account`
- `Session`
- `UserPreference`
- `BrokerageConnection`
- `BrokerageAccount`
- `ProviderCredential`
- `ProviderPoolMember`
- `Vault`
- `DataInventory`

This DB must be treated as auth-sensitive. Prisma changes here can affect sign-in and session continuity.

## 2. Vault SQLite databases

These are separate SQLite files, usually under `data/vaults/`, such as:

- `schwab.db`
- `yahoo.db`
- `google.db`
- `master.db`
- `csv.db`

Each vault DB stores rows in the `MarketData` table for:

- `symbol`
- `timeframe`
- `time`
- `open/high/low/close/volume`
- `source`

These vault DBs are the current source of truth for cached market bars.

## 3. Telemetry logs

Provider traffic is captured in JSONL:

- `logs/provider-traffic.jsonl`

This is useful for operator inspection and post-mortem analysis, but it is not a durable metadata system yet.

## 4. Parquet lake

The parquet data lake currently lives under:

- `data/lake/{assetClass}/{symbol}/{timeframe}/{YYYY}/{MM}/{DD}/bars.parquet`

It is present, readable, and used by `/api/v2/market-data`, but it is explicitly **not** the canonical runtime read path today.

## Route-by-route behavior

### `/api/trading/market-data`

Canonical runtime route for charts and backtest fetches.

- reads and writes through `MarketDataStore`
- uses vault SQLite storage
- now reports provenance:
  - source of truth
  - vault name
  - storage timeframe
  - requested timeframe
  - derived vs native
  - verification classification

### `/api/platform/chart-catalog`

Customer-facing catalog route.

- now uses a shared vault-backed catalog read path
- prefers canonical inventory rows for the canonical vault
- falls back to the vault DB itself if inventory has not been refreshed yet

### `/api/trading/data-inspect`

Operator inspection route.

- now reads paginated cached bars directly from a selected vault
- pairs those rows with vault-based `DataHealthManager` output
- no longer relies on `prisma.marketData` in the main DB

### `/api/v2/market-data`

Experimental parquet route.

- reads directly from parquet partitions
- remains explicitly experimental
- should not be treated as the primary production route until promoted with parity checks

## Verification and health logic today

### `DataHealthManager`

Current health logic is based on:

- bar count
- observed first/last bar
- internal missing-range detection
- target-horizon coverage percentage

This is useful operationally, but it is not a full market-data correctness system.

### `DataConsolidator`

Current consolidation is intentionally simple:

- compare Schwab and Yahoo overlap
- treat close prices within 0.1% as acceptable
- write promoted output to the `master` vault

Current limitation:

- if only one source exists, the consolidator still promotes that source
- that means a single-source bar should not be treated as strongly verified

## Known inconsistencies and risks

### Fixed in this tranche

- customer/admin routes no longer read `prisma.marketData` from the main DB for active bar inspection/catalog behavior
- provenance is now surfaced explicitly at the route layer

### Still transitional

- the provider pool still supports a temporary superuser-backed Schwab bridge
- vault schema creation still relies on runtime `prisma db push` for new vault files
- the parquet route exists in parallel but is not yet promoted or parity-validated
- consolidation semantics are still too weak for “verified” language outside controlled contexts

### Still risky

- app DB migrations can impact auth/session data if handled casually
- vault DB schema drift is not governed by a formal migration pipeline yet
- inventory can go stale if refresh processes are skipped
- unsupported timeframes can still degrade into derived or provider-specific behavior without enough user-facing explanation

## Short-term platform-data truth model

This is the operating rule until a future replatform:

- **Vault SQLite** is the source of truth for cached bars.
- **Main Prisma DB** is the source of truth for auth, metadata, provider pool, brokerage metadata, vault registry, and inventory summaries.
- **Parquet** is experimental and read-only until explicitly promoted.

## Improvement order

1. Keep all runtime reads on the vault-backed read service.
2. Keep `DataInventory` derived from vault contents, never competing with them.
3. Strengthen provenance and health classification before making data claims stronger.
4. Replace the temporary provider bridge with dedicated platform credentials.
5. Decide later whether parquet is archive-only or a promoted canonical read layer.
