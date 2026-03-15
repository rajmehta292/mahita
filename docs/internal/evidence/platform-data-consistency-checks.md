---
title: Platform Data Consistency Checks
slug: evidence/platform-data-consistency-checks
category: evidence
visibility: signed-in
audience: developers
status: Current
order: 7
updatedAt: 2026-03-12
---

# Platform data consistency checks

This document records the vault-backed consistency checks used to confirm the current source-of-truth model before any Stage 3 work.

## Commands run

```bash
npm run check:platform-consistency
```

Artifact produced:
- `artifacts/platform-data-validation/consistency-checks.json`

## Source-of-truth conclusion

Current source-of-truth model remains:
- cached bars: **vault SQLite**
- metadata and auth/platform state: **main Prisma DB**
- parquet: **experimental**

This matches the intended short-term rule.

## Sampled checks

Validated on:
- `AAPL 1m`
- `CRM 1m`
- `MSFT 1m`
- `AAPL 30s`
- `WMT 1m`

All checks were scoped to:
- `vaultName = schwab`

## Results

### `AAPL 1m`

Observed:
- vault-backed route-like count and cache count align
- storage class is `native-cached`
- verification status is `single-source-unverified`
- inventory provenance exists

Interpretation:
- healthy example of current Stage 2 behavior

### `CRM 1m`

Observed:
- vault-backed bar reads succeed
- storage class is `native-cached`
- verification status is `single-source-unverified`
- `inventoryProvenance` is currently `null`

Interpretation:
- provider request issue is fixed
- inventory refresh parity is still incomplete

### `MSFT 1m`

Observed:
- vault-backed bar reads succeed
- storage class is `native-cached`
- verification status is `single-source-unverified`
- `inventoryProvenance` is currently `null`

Interpretation:
- same category as `CRM`
- storage is present, but derived metadata is incomplete

### `AAPL 30s`

Observed:
- requested interval is mapped to storage timeframe `1s`
- storage class is `derived`
- no cached base bars currently exist in the sampled vault state

Interpretation:
- Stage 2 correctly exposes `30s` as derived
- but it is not materially backed yet in the sampled local data state
- this is an honesty win, but still a coverage gap

### `WMT 1m`

Observed:
- vault-backed bar reads succeed
- storage class is `native-cached`
- verification status is `single-source-unverified`
- inventory parity remains incomplete

## Health and verification conclusions

Current truth:
- vault reads are coherent enough to support Stage 2
- verification metadata exists structurally but is not yet mature
- many rows remain `single-source-unverified`
- repeated downloads must continue to be logged and classified instead of silently promoted

## Decision

### What this proves

- Vault SQLite is the current effective source of truth for cached bars.
- Route/read normalization toward vault-backed access is correct.
- Stage 2 can continue.

### What this does not prove

- It does not prove broad verification maturity.
- It does not prove inventory refresh completeness.
- It does not prove that `30s` should be presented as broadly available data today.

### Stage 3 decision

These consistency checks do **not** justify Stage 3 yet.
