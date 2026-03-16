# Mahita Recovery Program

Status: Active execution plan. This is the source of truth for implementation order, release gates, and rollback boundaries.

## Program Objective
Bring Mahita from a partially implemented prototype with documentation drift into a buildable, testable, tenant-safe platform with credible release gates and a clear path to:
- admin/superuser operations
- isolated multi-user Schwab connections
- shared account context
- production portfolio and Active Trader workflows
- Alpha Insights 2.0
- Schwab Data Center
- future desktop expansion

## Phase Order

## Current Progress Snapshot
- Phase 0 is complete on the current tranche:
  - `npx tsc --noEmit` passes
  - `npm run build` passes
  - `npm run lint:scoped` passes
  - `npm run test:smoke` passes
  - `npm run qa:e2e` passes
  - `npm run qa:all` passes
  - `/auth/error` is now a real recovery page instead of a 404 sink
  - local auth origin normalization prevents dev sign-in from inheriting `mahita.ai`
  - signed-out users now stay on the landing page while signed-in users resolve through deterministic root redirects
  - sign-in completion now routes through a dedicated post-sign-in resolver with 12-hour recent-page fallback rules
  - Schwab secrets now encrypt at rest with compatibility reads
  - raw token/secret reads were removed from the customer token route
  - exposed operator routes are now superuser-guarded
  - runtime health now has a typed health contract at `/api/health/runtime`
  - runtime/schema drift now returns typed recoverable errors instead of raw `undefined.upsert` failures in Settings/Admin paths
  - admin tabs now load independently and no longer fail all-at-once
  - backtest/editor/chart initialization now sits behind client error boundaries and a hardened Monaco wrapper
- Phase 1 is partially complete:
  - Prisma-backed roles, preferences, and audit/investor-profile schema are in place
  - typed session support is in place
  - shared server-session helpers are in place
  - first-pass admin control plane is live at `/admin`
  - first-pass audited provider-credential reveal flow is implemented
  - break-glass reveal now requires recent sign-in and creates a persisted reveal grant
- Phase 3 and Phase 4 have working foundations:
  - selected account persists server-side
  - watchlist symbols and Trending Indicators display selections persist server-side
  - Portfolio supports persisted column config
  - Portfolio now hands off to a real Active Trader ticket path
  - Trade History is now aligned to the shared selected-account preference flow
- Phase 5 has a functional first pass:
  - Active Trader now has preview/submit/cancel order flows
  - live order history is surfaced
- Phase 5 also has better disconnect handling:
  - brokerage reconnect paths no longer hard-reload the page as the primary recovery mechanism
- Phase 7 has a functional first pass:
  - `Schwab Data` page exists with request/code preview
- Phase 2 has a first pass:
  - `BrokerageConnection` and `BrokerageAccount` now exist as the user brokerage plane
  - `ProviderCredential` and `ProviderPoolMember` exist in Prisma
  - platform Schwab runtime resolves from the provider pool first
  - superuser can explicitly promote a user Schwab config into the market-data provider pool as a temporary bridge
  - customer Schwab routes now resolve through the brokerage plane and sync real account metadata
- A pre-Phase strategy-state monitoring surface now exists:
  - `Trending Indicators` ships with a real server scan contract and explicit unsupported-script handling
- Customer pages no longer depend on hardened superuser-only ingest/inventory routes for basic runtime visibility
- Phase 10 has a documentation surface:
  - `Desktop Expansion` page exists
- A stabilization-first editor/runtime tranche is complete:
  - shared app error normalization is in place
  - route-specific error boundaries exist for app/admin/backtest
  - Monaco fallback behavior is browser-tested
  - signed-in Settings save flow and Admin tab loading are browser-tested
- The auth guidebook now exists under [docs/guidebook/auth/README.md](../guidebook/auth/README.md) and is the canonical architecture reference for auth/session/brokerage/operator access behavior.

### Phase 0. Baseline Recovery
Owner responsibilities:
- Architecture: establish truthful release gates and stop documentation drift.
- Platform engineering: restore `tsc` and `build`.
- QA: define first verification scripts and scoped lint gates.

Deliverables:
- baseline audit docs
- execution docs
- verification matrix
- fixed current TypeScript/build blockers
- initial test harness
- runtime health contract
- typed app error contract
- route-level error boundaries
- stabilized backtest editor shell

Release gates:
- `npx tsc --noEmit`
- `npm run build`
- scoped lint on touched files
- `npm run qa:all`

Rollback boundary:
- no schema or auth migration is considered complete until build/typecheck are green and baseline docs are updated.

### Phase 1. Auth, Roles, And Admin Foundations
Owner responsibilities:
- Architecture/security: define role model and admin boundaries.
- Backend: implement role-aware auth/session helpers.
- QA: add auth/session regression checks.

Deliverables:
- Prisma `User.role`
- Prisma `UserPreference`
- Prisma `AdminAuditEvent`
- typed NextAuth session support
- seeded `SUPERUSER` for `raj.dmehta292@gmail.com`
- server-owned auth navigation state (`lastVisitedPath`, `lastSignInAt`, `previousSignInAt`)
- signed-out landing page + post-sign-in redirect resolver
- audited break-glass superuser reveal workflow

Release gates:
- session routes verified
- admin-only routes blocked for normal users
- audit event creation verified for privileged actions
- sign-in failure route renders without 404
- auth health contract verifies local/prod origin sanity
- landing page sign-in widget, `/auth/signin`, and `/auth/post-signin` browser flow verified

### Phase 2. Credential Separation And Runtime Replatform
Owner responsibilities:
- Backend/security: separate user brokerage credentials from platform provider credentials.
- Platform data engineering: rework runtime selection and pool behavior.

Deliverables:
- user-owned `BrokerageConnection` model
- user-owned `BrokerageAccount` model
- platform-owned provider pool models
- removal of shared `findFirst()` leakage from runtime paths
- provider pool management surface

Release gates:
- tenant isolation tests
- provider-pool isolation tests

### Phase 3. Shared Account Context
Owner responsibilities:
- Full-stack product engineering: unify account selection across core portfolio workflows.
- QA: validate cross-page persistence and multi-device behavior.

Deliverables:
- server-side selected-account persistence
- shared account context for Dashboard, Portfolio, Active Trader, Alpha
- shared watchlist and strategy-visibility persistence for monitoring surfaces

Release gates:
- account switching verified across surfaces
- most-recent account persists server-side

### Phase 4. Portfolio Table And Portfolio Workflow
Owner responsibilities:
- Frontend engineering/design: production portfolio interaction model.
- Backend/product: real detail source and action flow.

Deliverables:
- configurable/sortable/reorderable portfolio table
- mobile-compatible layout
- expanded rows backed by real detail
- buy/sell all/sell custom workflow handoff to real order path

Release gates:
- DOM tests for sorting/config/reordering/expansion
- E2E tests for export and action flow

### Phase 5. Active Trader Completion
Owner responsibilities:
- Trading workflow engineering: canonical ticket/preview/submit flow.
- QA: execution preview validation and status flow checks.

Deliverables:
- shared order ticket model
- preview/submit/cancel flow
- account-aware active trader context

### Phase 6. Alpha Insights 2.0
Owner responsibilities:
- AI platform engineering: robust portfolio intelligence pipeline.
- Product/design: investor-profile-driven advisory surfaces.
- QA: deterministic output-contract validation and action proposal workflow tests.

Deliverables:
- `InvestorProfile`
- assessment pipeline
- configurable model routing
- insight cards + risk assessment + optional action proposal flow

### Phase 7. Schwab Data Center
Owner responsibilities:
- Data platform engineering: download configuration, artifact generation, job history.
- Frontend/design: guided desktop/mobile data center experience.

Deliverables:
- `Schwab Data` page
- searchable symbol catalog surface
- API/code preview panels
- export job queue

### Phase 8. Full Symbol Catalog And Data Engine
Owner responsibilities:
- Data engineering: catalog sync, backfill, completeness tracking, job health.

Deliverables:
- canonical `SymbolCatalog`
- staged sync/backfill engine
- completeness/lag/health observability

### Phase 9. Motion, Mobile, And Design Cohesion
Owner responsibilities:
- Design system/frontend: unify tokens, motion, panel behavior, mobile parity.

Deliverables:
- shared motion system
- mobile acceptance improvements across portfolio, Alpha, Schwab Data

### Phase 10. Desktop Expansion Track
Owner responsibilities:
- Architecture/platform: define future MAUI and helper protocol.
- Product: publish current web-facing expansion page without fake implementation claims.

Deliverables:
- `Desktop Expansion` page
- desktop expansion spec

## Execution Rules
- No document may claim `production ready` until all active release gates are green.
- Every completed phase must update:
  - current-state diff
  - known gaps
  - test evidence
  - decisions changed from plan
- Shipping order follows dependency order, not visual appeal.
- Multi-user isolation and admin boundaries take precedence over cosmetic UI work.

## Current Known Gaps
- Admin console and break-glass superuser workflow are implemented at a first pass, but still need deeper operational polish and broader verification.
- Alpha is still not model/config/profile-safe.
- Shared runtime/provider credential separation is structurally in place, but still depends on a temporary user-backed market-data bridge until dedicated platform credentials are loaded.
- The temporary local bridge is now explicit to a superuser brokerage connection, but it is still a bridge and not the final dedicated provider-credential model.
- Customer brokerage routes now use the brokerage plane, but secrets still physically live in the legacy `SchwabConfig` store as a bridge and have not been fully migrated out yet.
- Lot-level brokerage detail is not wired into Portfolio expanded rows yet.
- Symbol-catalog sync, download queueing, and artifact management are still pending.
- Playwright auth/browser smoke exists, but the wider API suite, concurrency lane, and dedicated QA console are still pending.
- Backtester, Trending Indicators, and future automated trading nodes still do not share one canonical evaluator/deployment kernel.
