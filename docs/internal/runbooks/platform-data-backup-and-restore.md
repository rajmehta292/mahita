---
title: Platform Data Backup and Restore
slug: runbook/platform-data-backup-and-restore
category: runbook
visibility: signed-in
audience: operators
status: Current
order: 7
updatedAt: 2026-03-12
---

# Platform data backup and restore

This runbook exists to protect two different classes of data:

- **auth and platform state** in the main app database
- **cached market bars** in the vault SQLite databases

Treat them separately.

## What must be backed up

### Main app DB

Protects:

- Google/NextAuth identity state
- sessions
- user preferences
- brokerage connections
- provider-pool metadata
- vault registry
- inventory summaries

### Vault DBs

Protect:

- cached OHLCV bars per vault
- provider source metadata per bar

### Additional artifacts

- `logs/provider-traffic.jsonl`
- `data/lake/` if parquet artifacts exist
- backup manifest with auth/inventory/storage counts

## Primary commands

Create backup:

```bash
npm run backup:platform-data
```

Restore backup:

```bash
npm run restore:platform-data -- /absolute/path/to/backup
```

Verify after backup or restore:

```bash
npm run verify:platform-data
```

## Pre-change checklist

Run this before Prisma changes, vault changes, provider-pool changes, or route-read changes.

1. Stop making unrelated edits.
2. Record current branch and commit.
3. Run `npm run backup:platform-data`.
4. Save the backup directory path.
5. Run `npm run verify:platform-data` and keep the output.
6. Confirm the main DB snapshot exists.
7. Confirm the `vaults/` snapshot exists.

## Restore order

Always restore in this order:

1. main app DB
2. vault DBs
3. parquet and telemetry artifacts
4. verification checks

Why:

- auth/session continuity depends on the main app DB
- charts and backtests depend on the vault DBs

## Post-restore verification

Run:

```bash
npm run verify:platform-data
```

Then manually verify:

1. `http://127.0.0.1:6244/api/health/auth`
2. `http://127.0.0.1:6244/api/health/runtime`
3. sign in as an existing Google-linked user
4. load a chart-backed symbol
5. load the admin data/health view

## Latest drill result

Most recent recorded drill:
- `artifacts/platform-data-backups/drill-20260312-192131`

Recorded manifest state:
- users: `5`
- linked accounts: `2`
- sessions: `0`
- user preferences: `5`
- brokerage connections: `5`
- brokerage accounts: `10`
- provider credentials: `1`
- provider pool members: `1`
- inventory rows: `413`

Recorded sandbox restore footprint:
- app DB files: `1`
- vault files: `6`
- parquet files: `1256`
- log files: `1`

Interpretation:
- backup separation between auth/platform state and vault-bar state is working
- manual sign-in and route-level follow-up checks are still mandatory after restore

## Notes

- The restore script takes a safety snapshot before restoring.
- The current scripts assume SQLite-backed local development.
- If the app DB moves off SQLite later, this runbook must be updated.
