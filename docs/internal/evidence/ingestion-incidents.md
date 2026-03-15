---
title: Ingestion Incidents
slug: evidence/ingestion-incidents
category: evidence
visibility: signed-in
audience: developers
status: Current
order: 4
updatedAt: 2026-03-12
---

# Ingestion incidents

This log records concrete ingestion issues found during Stage 2 validation and whether they were fixed or remain open.

## Incident log

| Symbol | Timeframe | Provider | Request parameters / context | Result | Root cause classification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `CRM` | `1m` | Schwab | Range request over the same 7-day intraday window the Stage 2 scheduler generated | Failed previously with `400 Bad Request`; now passes with range-first + day-period fallback | Invalid provider request shape for intraday fallback | Fixed in Stage 2 |
| `AAPL` | `1w` | Schwab | Multi-year weekly request | Failed previously on raw range path; now passes with supported year-period fallback | Unsupported non-minute range combination on raw path | Fixed in Stage 2 |
| `AAPL` | `30s` | Derived via Schwab vault | Requested `30s` view mapped to `1s` storage timeframe | Returns zero cached base bars in current local validation | Base interval not yet ingested broadly; derived interval structurally defined but not materially backed | Open |
| `CRM` | `1m` | Vault + inventory | Vault bar reads succeed, but `DataInventory` provenance row is missing | Inventory metadata lags vault truth for some symbols | Inventory refresh completeness issue | Open |
| `MSFT` | `1m` | Vault + inventory | Vault bar reads succeed, but `DataInventory` provenance row is missing | Inventory metadata lags vault truth for some symbols | Inventory refresh completeness issue | Open |
| Sampled symbols | `1m` / `1w` | Yahoo | Reference validation only | Requests succeed, but results are not yet promoted to strong parity claims | Reference provider without full trust model | Open by design |

## What this means

- The original `CRM 1m` error did **not** prove that Stage 3 is required.
- The strongest fixed issue was provider request construction.
- The strongest remaining issues are:
  - incomplete inventory refresh parity
  - immature verification promotion
  - derived interval exposure without confirmed base coverage

## Decision

Current recommendation:
- **continue Stage 2 hardening**
- **do not start Stage 3 yet**

Stage 3 should begin only if valid provider requests still cannot meet freshness and scheduling goals after Stage 2 validation and hardening are complete.
