---
title: Platform Data Migrations
slug: runbook/platform-data-migrations
category: runbook
visibility: signed-in
audience: operators
status: Current
order: 8
updatedAt: 2026-03-12
---

# Platform data migrations

Platform-data changes must respect a critical separation:

- the **main app DB** contains login, session, user, brokerage, and provider-pool state
- the **vault DBs** contain cached market bars

Do not treat them as one migration surface.

## Main app DB migration policy

The main app DB contains:

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

Because of that, Prisma changes to the main DB are potentially **auth-impacting**.

### Required process

1. Create a platform-data backup.
2. Snapshot auth-critical counts:
   - users
   - accounts
   - sessions
   - user preferences
   - brokerage connections
   - provider-pool members
3. Apply Prisma changes intentionally.
4. Regenerate Prisma client.
5. Restart the app.
6. Verify auth and runtime health.
7. Sign in as a known linked user.
8. Confirm `UserPreference` and brokerage state still resolve.

## Vault DB migration policy

Vault DBs should be treated as cache/data assets, not auth assets.

Current reality:

- new vault DBs are initialized lazily
- `VaultManager` currently uses `prisma db push` when a vault file does not exist

This is acceptable for the current local/dev stage, but it is not a long-term migration strategy.

### Current safe rule

- back up vault DBs before any schema-affecting change
- do not rely on runtime creation as your only migration discipline
- if a vault schema change is introduced, restore verification must include:
  - symbol/timeframe count checks
  - first/last bar checks
  - chart route smoke checks

## Post-migration auth-preservation smoke checks

These checks are mandatory after any main Prisma schema change:

1. existing Google-linked user still signs in
2. `/api/auth/session` still returns the user ID and role
3. `UserPreference` still resolves
4. `BrokerageConnection` rows still exist
5. provider-pool rows still exist
6. `/api/health/runtime` is green

## Latest migration-safety conclusion

Current conclusion from the latest Stage 2 backup drill and consistency audit:
- Prisma/auth-sensitive changes are still safe to continue **only** if they are preceded by:
  - app DB backup
  - vault backup
  - auth-state count snapshot
  - post-change sign-in verification
- Stage 3 queue work is currently deferred because the latest evidence points to Stage 2 provider/request-shape fixes and metadata hardening, not an immediate architectural dead end.

The latest drill evidence is recorded in:
- `docs/internal/evidence/platform-data-backup-drill.md`
- `docs/internal/evidence/stage2-provider-validation.md`
- `docs/internal/evidence/platform-data-consistency-checks.md`

## What not to combine in one tranche

Avoid combining these in a single migration:

- auth/schema changes
- provider-pool changes
- storage-source changes
- route-read normalization

Keep those as separate tranches so failures are attributable and reversible.
