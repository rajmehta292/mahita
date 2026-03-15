---
title: Stage 2 Provider Validation
slug: evidence/stage2-provider-validation
category: evidence
visibility: signed-in
audience: developers
status: Current
order: 5
updatedAt: 2026-03-12
---

# Stage 2 provider validation

This document records the focused provider validation run requested before any Stage 3 queue-engine work.

## Goal

Determine whether the observed `Provider schwab failed for CRM 1m` issue was:
- a Stage 2 provider/request-shape bug, or
- evidence that the Stage 2 scheduler foundation is no longer viable

## Commands run

```bash
npm run validate:provider-matrix
```

Artifacts produced:
- `artifacts/platform-data-validation/provider-matrix.json`

## Symbols validated

Primary Schwab `1m` validation set:
- `CRM`
- `AAPL`
- `MSFT`
- `UNH`
- `V`
- `WMT`
- `XOM`

Reference-provider checks:
- Yahoo for sampled `1m`
- Yahoo for sampled `1h`
- Yahoo for sampled `1w`

## Result summary

### Schwab

Observed result:
- sampled `1m` requests now pass
- sampled `1w` requests now pass with non-minute fallback handling

Important request behavior:
- Stage 2 now uses a range request first
- if Schwab returns `400` for intraday minute history, it retries with:
  - `periodType=day`
  - `period=10`
  - `frequencyType=minute`
  - `frequency=1`
- for weekly requests, it retries with a supported year-period request

### Yahoo

Observed result:
- sampled reference requests pass

Interpretation:
- Yahoo is currently useful as a reference source
- Yahoo is **not** yet a full-trust parity source

## Decision

### Conclusion

The original `CRM 1m` issue was a **provider/request-shape problem** in Stage 2, not a scheduler-architecture failure.

### Stage 3 decision

**Stage 3 is deferred.**

Stage 3 is not justified by the current evidence because:
- valid Schwab `1m` requests now succeed for the sampled set
- the Stage 2 scheduler foundation can still use corrected provider plans
- remaining gaps are mostly:
  - inventory refresh consistency
  - verification maturity
  - derived interval backing

### Immediate next focus

Continue Stage 2 hardening on:
- inventory parity with vault data
- explicit verification state progression
- derived interval honesty
- DI-UI section-level acceptance evidence
