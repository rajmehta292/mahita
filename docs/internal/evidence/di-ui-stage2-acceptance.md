---
title: DI-UI Stage 2 Acceptance
slug: evidence/di-ui-stage2-acceptance
category: evidence
visibility: signed-in
audience: developers
status: Transitional
order: 6
updatedAt: 2026-03-12
---

# DI-UI Stage 2 acceptance

This checklist records what is proven about the current DI-UI implementation and what still remains transitional.

## Goal

Prove that DI-UI is a trustworthy Stage 2 operator surface before using it as evidence for or against Stage 3.

## Evidence sources

Code and route surfaces:
- `app/components/Admin/DiUiWorkspace.tsx`
- `app/api/admin/di-ui/*`
- `app/services/market-data/scheduler.ts`
- `app/services/market-data/verification.ts`

Automated checks used:
- `tests/runtime-health.unit.test.ts`
- `e2e/di-ui.spec.ts`

## Section-by-section status

### Scheduler

Status:
- **Pass with transitional limits**

Proven:
- default profile and lane state load
- start/stop controls exist
- queue state renders
- after-hours mode is represented
- active profile and lane policy are visible

Still transitional:
- compatibility executor is still the Stage 2 engine
- this is not yet the final durable dispatch queue

### Caller

Status:
- **Pass**

Proven:
- live request/response/error events stream into the caller view
- provider and event filtering exist
- error traffic renders as structured telemetry

Still transitional:
- provider totals are only as trustworthy as the current traffic bus retention window

### Processor

Status:
- **Pass with partial maturity**

Proven:
- ingestion jobs and dispatch logs render
- vault destination, provider, and status fields are present
- processor view no longer crashes the workspace on stale runtime checks

Still transitional:
- processor flow is a Stage 2 compatibility-flow view, not the eventual job-dependency graph

### Verification

Status:
- **Pass with partial maturity**

Proven:
- verification queue and observation states render
- repeat verification controls exist
- verification badges distinguish unverified vs same-source vs cross-source vs disputed

Still transitional:
- most current sampled cached bars are still `single-source-unverified`
- verification is structurally present but not yet mature enough to claim broad “verified” coverage

### Storage

Status:
- **Pass with known data-coverage gaps**

Proven:
- storage section loads
- vault browsing works
- raw bars and inventory metadata can be inspected
- provenance and verification badges render

Still transitional:
- some symbols have vault bars without refreshed inventory provenance rows
- derived intervals can appear structurally before their base interval is materially populated

## Runtime mismatch behavior

Status:
- **Pass**

Proven:
- DI-UI now uses typed runtime guards for stale Prisma client cases
- sections should return schema/client mismatch errors instead of raw `findFirst` / `findMany` crashes

## Acceptance decision

### Accepted as Stage 2

DI-UI is accepted as a **working Stage 2 admin workspace** because:
- all five sections have meaningful working surfaces
- runtime mismatch handling is now typed
- provider telemetry, scheduler state, verification state, and storage state are visible

### Not accepted as Stage 3 proof

DI-UI does **not** yet justify Stage 3 by itself because:
- the current foundation is still capable of valid ingest after the provider fixes
- the remaining issues are about maturity and data trust, not a proven queue-architecture dead end
