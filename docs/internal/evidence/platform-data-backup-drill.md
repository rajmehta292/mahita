---
title: Platform Data Backup Drill
slug: evidence/platform-data-backup-drill
category: evidence
visibility: signed-in
audience: operators
status: Current
order: 8
updatedAt: 2026-03-12
---

# Platform data backup drill

This document records the non-destructive backup and restore drill performed before continuing platform-data work.

## Commands run

```bash
npm run drill:platform-backup
```

Artifacts produced:
- `artifacts/platform-data-backups/drill-20260312-192131/README.md`
- `artifacts/platform-data-backups/drill-20260312-192131/restore-summary.json`

## Drill result

### Backup created

Backup drill directory:
- `artifacts/platform-data-backups/drill-20260312-192131`

Contained:
- app DB snapshot
- vault DB snapshots
- parquet lake snapshot
- telemetry log snapshot
- manifest metadata
- sandbox restore target

### Restore summary

Observed manifest state:
- users: `5`
- linked accounts: `2`
- sessions: `0`
- user preferences: `5`
- brokerage connections: `5`
- brokerage accounts: `10`
- provider credentials: `1`
- provider pool members: `1`
- inventory rows: `413`
- distinct symbols: `396`
- distinct timeframes: `3`

Observed sandbox file counts:
- app DB files: `1`
- vault files: `6`
- parquet files: `1256`
- log files: `1`

## Interpretation

This proves:
- the backup scripts are capturing the app DB separately from the vault DBs
- the drill preserves enough structure to restore the platform-data state into a sandbox
- inventory/provider/auth counts can be recorded as part of the manifest

This does not yet prove:
- live Google sign-in after restore
- live chart route after restore
- live DI-UI route after restore

Those are still required manual follow-up checks and must remain part of the runbook.

## Decision

The backup/restore path is strong enough to keep using for Stage 2 hardening.

It supports the main migration safety rule:
- back up first
- verify auth-sensitive state counts
- restore in sandbox
- only then continue schema or platform-data changes
