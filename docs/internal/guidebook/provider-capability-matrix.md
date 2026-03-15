---
title: Provider Capability Matrix
slug: guidebook/provider-capability-matrix
category: guidebook
visibility: signed-in
audience: developers
status: Current
order: 7
updatedAt: 2026-03-12
---

# Provider capability matrix

This document is the current source of truth for what Mahita should ask from each market-data provider during Stage 2.

It exists to prevent the scheduler from enqueueing requests the provider cannot satisfy cleanly.

## Decision summary

- **Stage 3 is not justified yet.**
- The earlier `CRM 1m` Schwab failure was a **Stage 2 request-shape issue**, not a scheduler-architecture proof.
- Short-term canonical storage remains:
  - `1m`
  - `1h`
  - `1w`
- Short-term derived views remain:
  - `30s`
  - `3m`
  - `5m`
  - `10m`
  - `15m`
  - `30m`
  - `2h`
  - `3h`
  - `4h`

## Canonical provider policy

### Schwab

Role:
- primary provider

Native stored intervals used by Stage 2:
- `1m`
- `1d`
- `1w`

Derived in Mahita:
- `30s` from `1s` when available
- `1h` from intraday base bars
- `3m`, `5m`, `10m`, `15m`, `30m` from `1m`
- `2h`, `3h`, `4h` from `1h`

Current validated request shapes:

| Requested interval | Native or derived | Valid request policy | Notes |
| --- | --- | --- | --- |
| `1m` | Native | Range request first, then fallback to `periodType=day`, `period=10`, `frequencyType=minute`, `frequency=1` on `400` | This fixed the observed `CRM 1m` failure |
| `1d` | Native | Daily history request | Long-running parquet/vault coverage already exists |
| `1w` | Native | Range request first, then fallback to `periodType=year`, supported year period, `frequencyType=weekly`, `frequency=1` on `400` | Weekly range validation now passes |
| `30s` | Derived | Never ask Schwab for native `30s` | Only expose as derived from `1s` base when `1s` is actually cached |
| `1h` | Derived | Do not schedule as native | Derived from cached intraday base bars |

Current validated lookback assumptions:
- `1m`: scheduler currently uses a 7-day rolling range window and now validates cleanly on the sampled symbols
- `1w`: year-period fallback is valid for multi-year coverage

Known unsupported or unsafe combinations:
- native `30s` requests
- pretending `1h` is a provider-native canonical interval
- arbitrary non-minute period combinations not mapped to Schwab-supported values

### Yahoo

Role:
- secondary/reference provider

Operational assumption:
- conservative budget default of **20 calls/min**
- not treated as a trusted parity source by default

Validated current use:
- reference `1m` comparisons
- reference `1h` and `1w` reads where supported

Native stored intervals used by Stage 2:
- reference-only support for sampled `1m`, `1h`, `1w`

Known policy:
- use Yahoo for:
  - reference validation
  - spot comparison
  - fallback exploration
- do not present Yahoo parity as guaranteed production-grade verification

## Validation run used for this matrix

Artifacts:
- `artifacts/platform-data-validation/provider-matrix.json`

Sampled Schwab minute requests:
- `CRM 1m`
- `AAPL 1m`
- `MSFT 1m`
- `UNH 1m`
- `V 1m`
- `WMT 1m`
- `XOM 1m`

Sampled Yahoo reference requests:
- `CRM 1m`
- `AAPL 1m`
- `MSFT 1m`
- sampled `1h`
- sampled `1w`

Observed result:
- sampled Schwab `1m` requests: **pass**
- sampled Schwab `1w` request: **pass** after non-minute fallback
- sampled Yahoo reference requests: **pass**

## What the scheduler must do

The scheduler must:
- request only canonical native intervals from providers
- explicitly mark all other intervals as derived
- record the request plan used for retriable provider calls
- never call a bar “verified” unless verification method is explicitly recorded

## What still needs work

- broader symbol validation outside the sampled set
- formal `1s` capability validation before enabling broad `30s` derived views
- stronger same-source and cross-source verification promotion rules
- symbol-catalog-driven coverage instead of curated sets
