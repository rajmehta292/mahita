---
title: Build Log — 2026-03-11 Platform Data and Stability
slug: evidence/build-log-2026-03-11-platform-data
category: evidence
visibility: signed-in
audience: reviewers
status: Current
order: 8
updatedAt: 2026-03-12
---

# Build log: March 11, 2026

This log captures the major stabilization and platform-data work completed during the March 11 to March 12 push.

## 1. Tunnel and public origin recovery

- Restored the Cloudflare tunnel when `mahita.ai` was unavailable.
- Reconfirmed `mahita.ai` and the public health endpoints were reachable.
- Re-aligned auth origin handling so public traffic resolves against `https://mahita.ai` rather than localhost.

## 2. Google OAuth recovery

- Restored Google provider configuration in the running environment.
- Fixed the `OAuthAccountNotLinked` collision path by allowing Google same-email linking for pre-existing Mahita users.
- Stopped demo/bootstrap pathways from pre-creating real operator/user identities.

## 3. Schwab OAuth stabilization

- Hardened callback handling and stale-window recovery.
- Fixed pending-state handling so brokerage sync/update no longer clears auth state mid-flow.
- Improved popup completion behavior and retry/recovery messaging.

## 4. Presentation freeze and docs system

- Shipped the website-visible `/docs` portal.
- Expanded report, appendix, presentation, runbook, and evidence materials.
- Added demo bootstrap, evidence export, and bundle packaging workflows.

## 5. Portfolio/UI stabilization

- Fixed the portfolio holdings view so the positions table scrolls within the page layout instead of making the entire page excessively tall.
- Kept bottom metrics visible while browsing long holdings lists.

## 6. Platform data audit findings

The platform-data architecture was reviewed in depth and the following truths were confirmed:

- vault SQLite is the active runtime source of truth for cached market bars
- the main Prisma DB is the source of truth for auth, provider-pool state, vault registry, and inventory summaries
- parquet exists, but the V2 route is not the primary chart/backtest runtime path
- some routes were still reading `prisma.marketData` from the main DB even though the active bars lived in vault DBs
- verification logic is still coverage/gap-based plus a weak consolidator rather than a full reconciliation system

## 7. Platform data hardening completed in this tranche

- introduced a shared vault-backed read service for customer/admin routes
- normalized chart catalog and data-inspect reads away from `prisma.marketData`
- added route-visible provenance fields for the current canonical route
- added platform-data backup, restore, and verification scripts
- corrected the local vault-registry bootstrap so the canonical vault set can be reseeded into the active app DB
- documented migration safety rules to protect auth/login state

## 8. Remaining platform-data debt after this log

- provider-pool bridge is still transitional
- parquet is still experimental
- vault schema creation still depends on runtime `db push` for new DB files
- consolidation semantics are still too weak to market single-source bars as “verified”
