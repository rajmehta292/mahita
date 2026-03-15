# Current State Baseline

Status: Updated baseline audit as of March 11, 2026 after the latest stabilization tranche. This document supersedes any older documentation claiming the platform is complete or production-ready.

Windows/public bring-up update (March 15, 2026):
- the active operator workspace is now running in place on Windows from `C:\mahita\mahita`
- local dev serves on port `6244`
- `https://mahita.ai` is currently being served from this Windows machine through the recovered Cloudflare tunnel
- public auth health is returning the expected public-origin contract
- the public Schwab OAuth popup now auto-closes on success through a scoped COOP override plus same-origin fallback signaling, so successful callbacks no longer strand an extra `/active-trader?schwab=connected` window

Documentation tranche update:
- a site-visible documentation/wiki section now exists at `/docs`
- public senior-project materials and signed-in technical guidebooks are now served from the application
- a presentation-safe demo/bootstrap path now exists through `scripts/bootstrap-demo.sh`
- senior-project evidence export now exists through `scripts/export-project-evidence.sh`
- report appendices, speaking notes, visual asset lists, reviewer guides, and post-presentation recovery plans now exist as first-class project artifacts
- the admin DI-UI workspace now exists as a real Stage 2 control surface for scheduler, caller telemetry, processor flow, verification, and raw storage browsing
- Stage 2 provider/request validation is now documented and Stage 3 has been explicitly deferred pending stronger scheduler evidence
- MahaCharts now has a dedicated signed-in guidebook cluster plus generated AI context artifacts for future chart, strategy, and deployment work

## Verified Release Gate Status

### `npx tsc --noEmit`
Passes.

Verified on the current tree:
- typed NextAuth session augmentation is in place
- Prisma schema and AI/auth code currently reconcile
- new shared session helpers and the Portfolio/Active Trader order flow typecheck cleanly

### `npm run build`
Passes.

Verified current warning:
- Turbopack warns that [app/services/market-data/parquet-store.ts](/Users/rmehta01/Sites/mahita/app/services/market-data/parquet-store.ts) uses an overly broad dynamic file pattern that matches a very large number of files.
- The `middleware` deprecation warning is resolved by migrating route protection to [proxy.ts](/Users/rmehta01/Sites/mahita/proxy.ts).

### `npm run lint`
Not a release gate in its current form. It currently reports thousands of warnings and hundreds of errors across the repo, including generated/extracted/vendor-like files and broad legacy debt. A scoped lint gate is required before release claims are credible.

### `npm run lint:scoped`
Passes.

Scoped release files now lint clean, including:
- auth/session helpers
- Schwab config/accounts/auth/orders routes
- Portfolio/Active Trader/Schwab Data surfaces
- new order-draft helpers
- current DOM/unit smoke tests

### `npm run test:smoke`
Passes.

Verified smoke coverage on the current tree:
- Portfolio table DOM behaviors
- user preference persistence hook
- customer runtime/chart read-model shaping
- Trending Indicators parser/evaluator kernel
- Trending Indicators dashboard rendering
- sidebar role-aware navigation
- Schwab Data request/code preview UI
- order-draft serialization and payload shaping
- auth environment normalization helpers
- secret encryption/decryption compatibility helpers

### `npm run qa:e2e`
Passes.

Verified browser/system coverage on the current tree:
- `/auth/signin` renders
- `/auth/error` renders instead of 404ing
- `/api/health/auth` returns a stable health contract
- `/api/auth/providers` stays on `localhost` for local development auth origins
- `/trending-indicators` renders a real unauthenticated recovery/sign-in surface
- authenticated main-screen navigation and logout complete without route lockups
- Settings can save Schwab credentials without surfacing raw Prisma/model errors to the user
- the Schwab OAuth popup regression is covered by a dedicated browser test that strips `window.opener` on the callback and still requires the popup to close while the parent page reaches connected state
- Admin tabs load independently instead of one failing endpoint blanking the entire control plane
- `/backtest` loads a stable editor surface and no longer hard-fails the route when Monaco initialization fails

### `npm run qa:all`
Passes.

Verified combined lane coverage on the current tree:
- unit/DOM regression suite passes
- Playwright browser lane passes

### MahaCharts-specific verification
Current state:
- `npm run test:mahacharts` is the focused MahaCharts gate for DOM coverage, deployment/webhook contracts, and the Playwright workspace lane.
- `npm run test:visual` is the focused desktop screenshot lane for the MahaCharts shell.
- `npm run verify:mahacharts-context`, `npm run verify:mahacharts-doc-links`, and `npm run verify:mahacharts-coverage` now enforce the docs/context packet and coverage contracts for future AI-assisted MahaCharts changes.

## Verified Product State

### Auth and roles
Current state:
- Prisma-backed roles now exist in [prisma/schema.prisma](/Users/rmehta01/Sites/mahita/prisma/schema.prisma).
- A first-pass user brokerage plane now exists in [prisma/schema.prisma](/Users/rmehta01/Sites/mahita/prisma/schema.prisma) through `BrokerageConnection` and `BrokerageAccount`.
- `raj.dmehta292@gmail.com` resolves to `SUPERUSER` in [lib/auth.ts](/Users/rmehta01/Sites/mahita/lib/auth.ts).
- Session typing now includes `session.user.id` and `session.user.role` via [types/next-auth.d.ts](/Users/rmehta01/Sites/mahita/types/next-auth.d.ts).
- Shared server-side session helpers now live in [lib/server-session.ts](/Users/rmehta01/Sites/mahita/lib/server-session.ts).
- Development bypass is now gated behind `ENABLE_DEV_AUTH_BYPASS === "true"` instead of plain `NODE_ENV === "development"`.
- Local auth origin is normalized through [lib/auth-environment.ts](/Users/rmehta01/Sites/mahita/lib/auth-environment.ts), so a local run no longer inherits `https://mahita.ai` as the callback origin by default.
- `/auth/error` now exists in [app/auth/error/page.tsx](/Users/rmehta01/Sites/mahita/app/auth/error/page.tsx) and the auth surface exposes a health contract at [app/api/health/auth/route.ts](/Users/rmehta01/Sites/mahita/app/api/health/auth/route.ts).
- Role handling no longer depends on runtime Prisma enum objects in browser-sensitive surfaces. App-owned role utilities now live in [lib/roles.ts](/Users/rmehta01/Sites/mahita/lib/roles.ts).
- The landing/sign-in flow is now server-routed:
  - signed-out users on `/` see the landing page
  - signed-in users on `/` are redirected to the most recent authenticated page when the current sign-in is still fresh, otherwise `/dashboard`
  - sign-in completion resolves through [app/auth/post-signin/page.tsx](/Users/rmehta01/Sites/mahita/app/auth/post-signin/page.tsx)
- Session navigation state is now persisted in `UserPreference`:
  - `lastVisitedPath`
  - `lastVisitedAt`
  - `lastSignInAt`
  - `previousSignInAt`
- Main authenticated app navigation now records the most recent page through [app/api/user/session-activity/route.ts](/Users/rmehta01/Sites/mahita/app/api/user/session-activity/route.ts) and [app/components/Auth/SessionActivityTracker.tsx](/Users/rmehta01/Sites/mahita/app/components/Auth/SessionActivityTracker.tsx).
- Unused Google OAuth provider tokens are now scrubbed from the NextAuth `Account` table after sign-in via [lib/auth.ts](/Users/rmehta01/Sites/mahita/lib/auth.ts) and [lib/security/platform-security.ts](/Users/rmehta01/Sites/mahita/lib/security/platform-security.ts).
- Google now uses same-email account linking for Mahita's existing user records, so a pre-existing Mahita `User` row without a linked NextAuth `Account` row no longer traps real users in `OAuthAccountNotLinked`.
- Demo/bootstrap auth seeding now uses synthetic demo emails instead of pre-creating real presentation/operator emails.

Implication:
- Core role/session foundations are now present and type-safe.
- The immediate sign-in failure path that previously ended in a 404 is fixed and browser-tested.
- The earlier `Cannot read properties of undefined (reading 'SUPERUSER')` crash path is eliminated from the client-facing auth/navigation flow.
- Landing, sign-in, and post-sign-in behavior are now deterministic instead of relying on ad hoc button callback defaults.
- The real-email/demo-seed collision that could block Google sign-in is now addressed without deleting existing user data.
- Production Google sign-in should now use the production Mahita origin only:
  - `https://mahita.ai` as the authorized JavaScript origin
  - `https://mahita.ai/api/auth/callback/google` as the authorized redirect URI
- Local development should use the Mahita dev-bypass flow by default instead of a shared Google OAuth client. If staging-style Google login is ever needed outside production, it should use a separate public staging domain and a separate OAuth client.
- A first-pass admin control plane now exists at [app/admin/page.tsx](/Users/rmehta01/Sites/mahita/app/admin/page.tsx), including provider-pool management, data-command operations, user visibility, audit browsing, and a superuser-only break-glass reveal flow for provider credentials.
- Break-glass credential reveal now requires:
  - superuser role
  - explicit reason
  - recent sign-in recency check
  - persisted `AdminSecretRevealGrant`
  - audit event
- The `next-auth` client/session path now has first-pass browser regression coverage, but admin and callback failure matrices still need deeper coverage.

### MahaCharts workspace and strategy library
Current state:
- `/superchart` is now framed as a five-region MahaCharts workspace instead of a dashboard card layout.
- The workspace shell is owned by [app/components/SuperChart/SuperChartWorkspace.tsx](/Users/rmehta01/Sites/mahita/app/components/SuperChart/SuperChartWorkspace.tsx).
- The chart renderer is owned by [app/components/Chart.tsx](/Users/rmehta01/Sites/mahita/app/components/Chart.tsx) and now supports built-in overlay indicators plus stacked oscillator panes.
- The Pine editing surface now lives as a resizable overlay over the workspace rather than as a permanent bottom-dock slab, so the chart remains primary until editing is explicitly opened.
- The right side now targets a permanent utility strip plus contextual overlays rather than a width-taking rail, matching the TradingView-style screenshot geometry used for current UI acceptance.
- A first-pass indicator catalog now exists in [lib/indicator-catalog.ts](/Users/rmehta01/Sites/mahita/lib/indicator-catalog.ts) and is exposed through [app/api/indicators/catalog/route.ts](/Users/rmehta01/Sites/mahita/app/api/indicators/catalog/route.ts).
- Script drafts now flow through a strategy library model in [lib/strategy-library.ts](/Users/rmehta01/Sites/mahita/lib/strategy-library.ts):
  - `Strategy`
  - `StrategyVersion`
  - `StrategyWorkspaceSession`
- Existing `ScriptDraft` behavior is currently shimmed for compatibility in [lib/script-drafts.ts](/Users/rmehta01/Sites/mahita/lib/script-drafts.ts), but the intended long-term product model is strategy-first, not draft-first.
- Deployment records now carry `strategyId` and `strategyVersionId` in addition to the legacy linked-draft path.
- A dedicated MahaCharts guidebook cluster now exists under [docs/internal/guidebook/mahacharts/README.md](/Users/rmehta01/Sites/mahita/docs/internal/guidebook/mahacharts/README.md).
- Generated AI-facing context artifacts now exist under `docs/internal/generated/`.

Implication:
- Future chart, indicator, strategy-history, tester, and deployment work now has a project-local source-of-truth packet instead of relying on vague repo memory.
- The strategy lifecycle is now explicitly split between mutable autosave workspace state and immutable deployable versions.
- Any doc or README that still describes MahaCharts as a generic status-rail dashboard is stale.

### Auth architecture audit appendix
Secure and working:
- Mahita identity is now clearly separated from Schwab brokerage authorization.
- Production/public-origin auth and localhost dev-bypass behavior are both implemented and browser-tested.
- Typed session state now includes stable user ID and role values.
- Root, sign-in, post-sign-in, and auth-error routing are deterministic instead of ad hoc.
- Schwab OAuth completion is tied to the initiating Mahita session and pending connection state.

Structurally acceptable but transitional:
- persisted role data exists, but owner bootstrap is still seeded by configured email instead of full admin-governed role lifecycle
- provider-pool schema/runtime exists, but the platform still supports a temporary superuser-backed Schwab bridge
- brokerage access now resolves through the brokerage plane, but the underlying secret bridge still depends on legacy `SchwabConfig`

Known weak points:
- edge auth only enforces signed-in state; role and ownership remain server-enforced and must stay documented carefully
- auth behavior still depends on origin/environment configuration and remains easy to misunderstand without the guidebook
- test coverage is stronger, but the auth/browser matrix is still narrower than the eventual production target

Intentionally deferred:
- admin-managed role governance
- dedicated platform-only provider credentials
- immutable append-only audit backend
- staging-origin auth matrix and separate staging OAuth client
- multi-user concurrency auth verification beyond the current first-pass suite

### Runtime health and typed failures
Current state:
- Runtime health now has a first-pass typed contract at [app/api/health/runtime/route.ts](/Users/rmehta01/Sites/mahita/app/api/health/runtime/route.ts).
- Shared runtime/schema checks now live in [lib/runtime-health.ts](/Users/rmehta01/Sites/mahita/lib/runtime-health.ts).
- Shared error normalization now lives in [lib/app-errors.ts](/Users/rmehta01/Sites/mahita/lib/app-errors.ts) and [lib/route-errors.ts](/Users/rmehta01/Sites/mahita/lib/route-errors.ts).
- Brokerage/provider services now explicitly assert required generated Prisma models before attempting writes, so stale Prisma client states return typed runtime errors instead of opaque `undefined.upsert` crashes.
- Settings now normalizes credential-save failures into recoverable user-visible messages and can surface runtime-schema mismatch hints instead of raw exception strings.
- Global and route-local error boundaries now exist for:
  - [app/error.tsx](/Users/rmehta01/Sites/mahita/app/error.tsx)
  - [app/global-error.tsx](/Users/rmehta01/Sites/mahita/app/global-error.tsx)
  - [app/admin/error.tsx](/Users/rmehta01/Sites/mahita/app/admin/error.tsx)
  - [app/backtest/error.tsx](/Users/rmehta01/Sites/mahita/app/backtest/error.tsx)

Implication:
- Schema/client drift in development is now diagnosable from the app instead of surfacing as raw browser crashes.
- Customer-visible errors are now much more likely to present a typed message and remediation hint.

### DI-UI scheduler and verification
Current state:
- The admin control plane now includes a `DI-UI` workspace with five sections:
  - `Scheduler`
  - `Caller`
  - `Processor`
  - `Verification`
  - `Storage`
- Stage 2 scheduler and verification models now exist in [prisma/schema.prisma](/Users/rmehta01/Sites/mahita/prisma/schema.prisma):
  - `IngestionProfile`
  - `IngestionLane`
  - `IngestionTarget`
  - `IngestionTargetSymbol`
  - `IngestionJob`
  - `IngestionDispatchLog`
  - `VerificationPolicy`
  - `VerificationJob`
  - `VerificationObservation`
  - `IngestionViewDemand`
- DI-UI now uses typed runtime guards for stale Prisma client cases instead of surfacing raw `findFirst`/`findMany` crashes.
- The Stage 2 scheduler path is now capable of:
  - seeding a default `presentation-default` profile
  - queuing persisted ingestion jobs by lane
  - dispatching real ingestion through the compatibility executor
  - writing bars into the active vault source
  - queuing repeat verification jobs
  - rebalancing toward after-hours verification when applicable
- Stage 2 now treats verification as an explicit recorded state, not a loose label. Current surfaced fields include:
  - `vaultName`
  - `provider`
  - `canonicalInterval`
  - `nativeOrDerived`
  - `verificationStatus`
  - `verificationMethod`
  - `lastVerifiedAt`
- Current short-term policy defaults are:
  - `USER_VIEW` highest priority
  - `DOW30_REALTIME` reserved high-priority lane
  - `SELECTED_OR_SP500_REALTIME` and `SELECTED_ALL_1M` share remaining budget
  - after-hours shifts more capacity toward verification and `1m` completeness
- Current storage truth remains:
  - vault SQLite for cached bars
  - main Prisma DB for auth, metadata, provider pool, inventory, and control state
  - parquet remains experimental

Implication:
- DI-UI Stage 2 is now a real and useful operator surface rather than a placeholder panel.
- The current implementation is intentionally a compatibility-driven scheduler foundation, not yet the final durable dispatch engine.
- Stage 3 queue-engine rewrite is still deferred.
- The current stage is intended to be truthful rather than fully autonomous: DI-UI can run ingestion, show processor and verification state, and browse storage, but it still relies on the Stage 2 compatibility executor rather than the final queue engine.

Stage decision:
- **Stage 2 remains active**
- **Stage 3 is deferred pending provider and scheduler validation evidence**
- The original `CRM 1m` Schwab failure is no longer treated as a Stage 3 trigger because provider validation now shows the corrected Stage 2 request path succeeds

### Tenant isolation and Schwab runtime
Current state:
- User preference and Schwab configuration routes are now user-scoped by typed session identity.
- Customer brokerage routes now resolve through [lib/brokerage-connections.ts](/Users/rmehta01/Sites/mahita/lib/brokerage-connections.ts) instead of treating raw `SchwabConfig` as the customer-facing domain model.
- Schwab account/auth/order routes now share the same gated session helper instead of ad hoc development bypass.
- Customer Schwab account fetches now sync real account metadata into `BrokerageAccount`, and admin visibility now reports brokerage-connection state instead of plain `SchwabConfig` presence.
- Schwab client secrets, access tokens, and refresh tokens now encrypt at rest through [lib/secrets.ts](/Users/rmehta01/Sites/mahita/lib/secrets.ts) and [lib/schwab-config.ts](/Users/rmehta01/Sites/mahita/lib/schwab-config.ts), with plaintext compatibility reads kept only as a migration bridge.
- [app/api/user/schwab-tokens/route.ts](/Users/rmehta01/Sites/mahita/app/api/user/schwab-tokens/route.ts) no longer returns raw tokens or client secrets to the browser.
- Operational routes including provider health, continuous ingest, inventory, data reset, and vault listing now require a `SUPERUSER` session.
- Operator telemetry and data-inspection endpoints are now also superuser-only:
  - [app/api/trading/provider-stream/route.ts](/Users/rmehta01/Sites/mahita/app/api/trading/provider-stream/route.ts)
  - [app/api/trading/provider-traffic/route.ts](/Users/rmehta01/Sites/mahita/app/api/trading/provider-traffic/route.ts)
  - [app/api/trading/data-inspect/route.ts](/Users/rmehta01/Sites/mahita/app/api/trading/data-inspect/route.ts)
  - [app/api/trading/data-health/route.ts](/Users/rmehta01/Sites/mahita/app/api/trading/data-health/route.ts)
  - [app/api/trading/data-health/refresh/route.ts](/Users/rmehta01/Sites/mahita/app/api/trading/data-health/refresh/route.ts)
  - [app/api/trading/data-health/sync-gaps/route.ts](/Users/rmehta01/Sites/mahita/app/api/trading/data-health/sync-gaps/route.ts)
- Shared runtime selection in [app/services/schwab/runtime.ts](/Users/rmehta01/Sites/mahita/app/services/schwab/runtime.ts) now fails closed by default instead of silently borrowing a random customer brokerage token for platform jobs.
- A temporary insecure local-development fallback still exists behind `MAHITA_ALLOW_INSECURE_USER_BROKERAGE_PLATFORM_FALLBACK=true`.
- A first-pass provider-pool schema/runtime now exists through:
- A first-pass user brokerage bridge/runtime now exists through:
  - [lib/brokerage-connections.ts](/Users/rmehta01/Sites/mahita/lib/brokerage-connections.ts)
  - [app/api/schwab/accounts/route.ts](/Users/rmehta01/Sites/mahita/app/api/schwab/accounts/route.ts)
  - [app/api/schwab/auth/route.ts](/Users/rmehta01/Sites/mahita/app/api/schwab/auth/route.ts)
  - [app/api/schwab/orders/route.ts](/Users/rmehta01/Sites/mahita/app/api/schwab/orders/route.ts)
  - [app/api/schwab/positions/route.ts](/Users/rmehta01/Sites/mahita/app/api/schwab/positions/route.ts)
  - [app/api/user/schwab-config/route.ts](/Users/rmehta01/Sites/mahita/app/api/user/schwab-config/route.ts)
  - [app/api/user/schwab-tokens/route.ts](/Users/rmehta01/Sites/mahita/app/api/user/schwab-tokens/route.ts)
- A first-pass provider-pool schema/runtime now exists through:
  - [lib/provider-credentials.ts](/Users/rmehta01/Sites/mahita/lib/provider-credentials.ts)
  - [app/api/admin/provider-pool/route.ts](/Users/rmehta01/Sites/mahita/app/api/admin/provider-pool/route.ts)
  - [app/services/schwab/runtime.ts](/Users/rmehta01/Sites/mahita/app/services/schwab/runtime.ts)
- When platform fallback is explicitly enabled for local development, shared runtime no longer selects an arbitrary Schwab config. It now resolves only through an explicit superuser brokerage bridge in [lib/brokerage-connections.ts](/Users/rmehta01/Sites/mahita/lib/brokerage-connections.ts).
- The current temporary operating model still allows a superuser to explicitly promote a user-owned Schwab config into the market-data provider pool. That is a controlled bridge and an improvement over the old implicit fallback, but it is still not the final dedicated platform-credential model.

Implication:
- The most obvious raw-secret exposure and unaudited operator-route exposure are closed.
- Customer brokerage access and shared platform provider access now have separate domain models, and the remaining local-development platform bridge is explicit to a superuser brokerage connection rather than arbitrary user selection.
- The requested multi-user + admin concurrent behavior is not release-safe yet.

### Portfolio workflow
Current state:
- Selected account is now persisted server-side in `UserPreference` and mirrored in `localStorage` as a client cache.
- Watchlist symbols and Trending Indicators display selections now also persist in `UserPreference`, with `localStorage` retained only as a compatibility cache.
- The portfolio table supports persisted column visibility/order and real DOM-tested sorting/expansion behavior.
- Expanded position detail now renders real current holding aggregates and live price/value context instead of fake tier rows.
- Portfolio row actions now open a real trade-preview modal and hand off into Active Trader with a typed order draft.
- CSV export now uses the active column configuration instead of a disconnected static schema.

Implication:
- The portfolio workflow is materially closer to production.
- Brokerage lot/tax-lot detail is still not guaranteed because Schwab lot-level payload integration is not implemented yet.
- Alpha is not yet consuming the shared account context end-to-end.

### Active Trader
Current state:
- Active Trader now includes a canonical order ticket with:
  - shared account selection
  - typed draft intake from Portfolio query params
  - live Schwab payload preview
  - submit flow
  - cancel flow for open orders
  - recent orders surface
- Strategy deployment remains feature-gated and UI-only.

Implication:
- Portfolio row actions now hand off into a real trading workflow.
- Alpha proposal handoff is still not implemented.

### Admin control plane and Data Command
Current state:
- The admin control plane at [app/admin/page.tsx](/Users/rmehta01/Sites/mahita/app/admin/page.tsx) now loads lazily by tab instead of fetching all control-plane data at once.
- [app/components/Admin/AdminControlPlane.tsx](/Users/rmehta01/Sites/mahita/app/components/Admin/AdminControlPlane.tsx) now:
  - loads `Overview` first
  - loads `Provider Pool`, `Data Command`, `Users`, and `Audit Log` on demand
  - keeps partial tab failures local instead of blanking the whole page
- `Data Command` now exposes operator-focused runtime summaries, ingest status, provider status, and explicit audited actions through:
  - [app/api/admin/data-command/route.ts](/Users/rmehta01/Sites/mahita/app/api/admin/data-command/route.ts)
  - [app/api/admin/data-command/action/route.ts](/Users/rmehta01/Sites/mahita/app/api/admin/data-command/action/route.ts)
- Break-glass reveal now returns reveal-grant metadata and correlates to persisted audit state instead of being a one-shot opaque response.

Implication:
- The admin plane is materially more resilient and usable than the previous all-or-nothing aggregate fetch.
- It is still a first-pass operator console, not the final enterprise admin surface.

### Alpha Insights
Current state:
- Alpha uses a brittle internal fetch pattern in [app/api/ai/alpha-insights/route.ts](/Users/rmehta01/Sites/mahita/app/api/ai/alpha-insights/route.ts).
- The service in [lib/ai/rag/alpha-insights-service.ts](/Users/rmehta01/Sites/mahita/lib/ai/rag/alpha-insights-service.ts) hardcodes the model ID `llama3.2:latest`.
- Knowledge retrieval is a small static keyword system, not a versioned money-manager knowledge base.
- `InvestorProfile` now exists in Prisma, but the UI and Alpha pipeline do not yet use it.
- No action proposal, preview, confirm, or cooldown workflow exists.

Implication:
- Alpha Insights is not yet the advisory/risk-assessment system described in product plans.

### Platform data architecture appendix
Secure and working:
- The active chart/backtest runtime path now uses vault-backed market data reads rather than falling back to the main Prisma `MarketData` table.
- Vault SQLite is now the documented short-term source of truth for cached OHLCV bars.
- The main Prisma DB remains the source of truth for auth, user state, brokerage metadata, provider-pool metadata, vault registry, and `DataInventory`.
- Route-visible provenance now exposes the current vault, storage timeframe, derived-vs-native classification, and verification classification.
- Sampled Schwab `1m` validation for `CRM`, `AAPL`, `MSFT`, `UNH`, `V`, `WMT`, and `XOM` now passes with the corrected Stage 2 request-shape/fallback logic.

Structurally acceptable but transitional:
- The parquet lake and `/api/v2/market-data` route still exist, but remain experimental and not the primary production path.
- `DataInventory` is a derived metadata layer and still depends on refresh discipline to stay current.
- The provider-pool runtime still supports a temporary superuser-backed Schwab bridge.
- DI-UI is now a real Stage 2 operator surface, but it still uses the Stage 2 compatibility executor rather than a final durable queue engine.

Known weak points:
- Verification is still weak. `DataConsolidator` can promote single-source data, so “verified” language must stay narrow.
- Vault schema creation still uses runtime `prisma db push` for newly created vault files.
- Timeframe support is broader at the UI surface than at the provider-native layer, which means some ranges depend on derivation or provider-specific degradation behavior.
- Inventory refresh parity is still incomplete. Sampled symbols like `CRM`, `MSFT`, and `WMT` can have vault-backed bars without refreshed `DataInventory` provenance rows.
- Derived `30s` views are structurally represented through `1s` storage, but the sampled local state still lacks broad `1s` base coverage.

Intentionally deferred:
- dedicated platform-only provider credentials
- parity-tested promotion of parquet as a canonical read layer
- stronger reconciliation/manifests/checksums for market data
- formal vault migration tooling beyond the current backup/restore discipline
- Stage 3 queue-engine rewrite, unless later evidence proves the Stage 2 executor cannot meet freshness, verification, or after-hours backfill requirements

### Schwab Data Center
Current state:
- First-pass surface implemented at [app/schwab-data/page.tsx](/Users/rmehta01/Sites/mahita/app/schwab-data/page.tsx) with:
  - sidebar navigation entry
  - request builder UI
  - live API preview
  - live cURL / TypeScript / Python previews
- Full symbol-catalog-backed search, export jobs, and artifact history are still not implemented.

### Backtester and editor shell
Current state:
- `/backtest` still uses the legacy prototype engine/runtime path and is not yet deploy-parity capable.
- The editor surface is now wrapped by [app/components/Backtest/MahitaCodeEditor.tsx](/Users/rmehta01/Sites/mahita/app/components/Backtest/MahitaCodeEditor.tsx) instead of using direct Monaco mounting from the page shell.
- The editor wrapper now:
  - uses Pine/plain-text safe language setup
  - performs explicit Monaco loader initialization
  - times out and falls back to a textarea surface if Monaco fails
  - keeps the page usable when editor bootstrap fails
- Chart and editor panes now render inside client-side error boundaries instead of taking down the route on initialization failures.
- Backtest API/runtime/editor/chart failures are now normalized into readable UI errors instead of raw event objects.
- The page explicitly labels the current runtime as a prototype engine.

Implication:
- The immediate Monaco crash path and raw `[object Event]` error path are stabilized.
- The page is usable again, but the underlying backtest engine is still a prototype and not yet trustworthy enough for direct live deployment.

### Customer-safe runtime and chart catalog surfaces
Current state:
- Dashboard no longer reads the superuser-only continuous-ingest control route for basic status.
- Chart no longer reads the superuser-only inventory route for symbol/timeframe discovery.
- Customer-safe read models now exist in:
  - [app/api/platform/runtime-status/route.ts](/Users/rmehta01/Sites/mahita/app/api/platform/runtime-status/route.ts)
  - [app/api/platform/chart-catalog/route.ts](/Users/rmehta01/Sites/mahita/app/api/platform/chart-catalog/route.ts)
- The read-model shaping logic is isolated in [lib/platform/customer-read-models.ts](/Users/rmehta01/Sites/mahita/lib/platform/customer-read-models.ts).

Implication:
- Normal customer pages are no longer structurally coupled to newly hardened operator-only endpoints for basic runtime/catalog visibility.
- A dedicated operator console is still required for actual ingest control, inventory inspection, and vault operations.

### Trending Indicators
Current state:
- A first real strategy-state page now exists at [app/trending-indicators/page.tsx](/Users/rmehta01/Sites/mahita/app/trending-indicators/page.tsx).
- It uses a real server scan contract in [app/api/trending-indicators/scan/route.ts](/Users/rmehta01/Sites/mahita/app/api/trending-indicators/scan/route.ts), not a frontend-only toy view.
- The current evaluator kernel lives in [lib/trending-indicators.ts](/Users/rmehta01/Sites/mahita/lib/trending-indicators.ts).
- The page supports:
  - saved strategy visibility selection
  - watchlist-driven multi-symbol scans
  - full strategy matches
  - new triggers
  - near misses
  - per-indicator match sections
  - explicit unsupported-script messaging

Implication:
- Mahita now has a first bridge surface between saved strategies and live market-state monitoring.
- This is still a limited monitor kernel, not the final shared evaluator needed for trustworthy backtest-to-live deployment parity.
- Scripts outside the supported EMA/SMA/RSI monitoring subset are correctly flagged as unsupported instead of guessed.

### Full symbol catalog and ingestion
Current state:
- The repo contains ingestion/catalog primitives such as `SymbolRegistry`, `DataPartition`, `DataSpan`, and `IngestionJob`.
- The implemented product flow is still closer to a curated/provider-specific universe than a full Schwab-search-backed catalog.
- There is no production-ready catalog sync or download center workflow in the app.

### Desktop expansion
Current state:
- The explanatory `Desktop Expansion` page now exists.
- There is still no MAUI helper or local encrypted cache integration in the shipped product.

## Documentation Accuracy Gaps

The following document currently overstates completion and should not be treated as source of truth:
- [docs/PLATFORM_COMPLETE.md](/Users/rmehta01/Sites/mahita/docs/PLATFORM_COMPLETE.md)
- [docs/blueprint/02_Authentication_and_Security.md](/Users/rmehta01/Sites/mahita/docs/blueprint/02_Authentication_and_Security.md) still references `middleware.ts` and does not reflect the current `proxy.ts` security boundary.
- [docs/blueprint/06_AI_Implementation_Guide.md](/Users/rmehta01/Sites/mahita/docs/blueprint/06_AI_Implementation_Guide.md) still references `middleware.ts`.

This baseline audit, the recovery program, and the QA verification matrix are now the source-of-truth documents for execution and release readiness.

## Immediate Recovery Priorities
1. Replace the temporary user-backed provider-pool bridge with dedicated platform credentials.
2. Separate remaining customer brokerage assumptions from legacy `SchwabConfig` storage and finish the `BrokerageConnection` control surface.
3. Harden the first-pass admin control plane into a full operator surface with broader auditing and coverage.
4. Add API smoke and concurrency/tenant isolation coverage beyond the first auth browser lane.
5. Integrate real Schwab lot detail or Mahita execution-ledger detail for expanded portfolio rows.
6. Upgrade Alpha to use `InvestorProfile`, configurable model routing, and action proposals.
7. Replace the first-pass Schwab Data Center with catalog-backed search, queueing, and artifacts.
8. Rebuild the strategy kernel so Backtester, Trending Indicators, and future deployment nodes share the same evaluator instead of separate prototype paths.
