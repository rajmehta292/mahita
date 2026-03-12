# Verification Matrix

Status: Active QA matrix. This defines what must be verified before Mahita can credibly be called production-ready.

## Release Gates
- `npx tsc --noEmit`
- `npm run build`
- scoped lint on changed release files
- unit/dom smoke suite
- API smoke suite
- Playwright E2E smoke suite
- `npm run qa:all`

## Workflow Matrix

### Authentication
- Signed-out `/` renders the landing page instead of redirecting into a broken sign-in flow.
- Signed-in `/` redirects to the most recent authenticated page when the active sign-in is recent, otherwise `/dashboard`.
- Landing page top-right sign-in widget opens and starts the Google auth flow.
- Sign in with Google.
- Development credential login only when explicitly enabled for development.
- `/api/auth/session` returns stable session shape.
- Session contains typed user ID and role.
- Unauthorized user is blocked from admin routes.
- Superuser can access admin console.

### Multi-user and tenant isolation
- User A cannot fetch User B preferences.
- User A cannot fetch User B Schwab config.
- User A cannot fetch User B positions via manipulated account IDs.
- Concurrent user sessions retain separate selected accounts and table preferences.
- Admin inspection does not mutate the user’s active session.

### Admin
- Superuser directory loads.
- Overview loads independently of later tabs.
- Provider Pool loads independently of later tabs.
- Data Command loads independently of later tabs.
- User inspection loads brokerage status and preferences.
- Break-glass secret reveal requires re-auth and reason.
- Break-glass secret reveal requires recent sign-in and issues a persisted reveal grant.
- Break-glass reveal logs immutable audit event.
- Normal users cannot access audit or reveal routes.

### Portfolio
- Loads positions for selected account.
- Default columns render correctly.
- Column visibility changes persist.
- Column order changes persist.
- Sorting works for each visible sortable column.
- Row expansion shows real detail source.
- CSV export reflects configured/displayed schema.
- `Buy`, `Sell All`, and `Sell Custom` open real workflow paths.

### Dashboard and shared account context
- Switching account on Dashboard updates the shared selected account.
- Portfolio, Active Trader, and Alpha consume the same selected account.
- History consumes the same selected account preference model.
- Most recent account persists server-side and restores on reload.
- Watchlist symbols persist server-side and restore on reload.

### Active Trader
- Prefilled order opens from portfolio action.
- Edit flow from Alpha proposal opens the same ticket path.
- Order preview validates quantity/account/side.
- Submit and cancel flows resolve cleanly.

### Alpha Insights
- Assessment route uses selected account data, not hardcoded sample data.
- Investor profile affects prompt payload.
- Model routing is configurable and not hardcoded in business logic.
- Output contract includes health score, summary, categorized insights, and risk assessment.
- Profit-booking proposal does not auto-submit on timeout.
- Confirm path previews before submit.
- Edit path hands off to Active Trader.

### Schwab Data Center
- Sidebar entry is visible below Backtester.
- Symbol search works against canonical catalog surface.
- Parameter explanations render.
- API/code preview updates as parameters change.
- Download job is queued and status updates correctly.
- JSON/CSV/Parquet export paths respond correctly.

### Runtime health and typed failure handling
- `/api/health/runtime` returns a stable schema/client/env readiness contract.
- Settings save failures never surface raw Prisma/model errors to the browser.
- Runtime schema/client mismatch returns a typed recoverable error with remediation hint.
- One failing admin endpoint does not blank the whole admin surface.
- Customer-visible runtime failures do not render as raw `[object Event]` or `error: {}` strings.

### Trending Indicators
- Sidebar entry is visible below Backtester.
- Saved strategy selector remembers which cards are visible.
- Strategy cards distinguish:
  - full strategy matches
  - new triggers
  - near misses
  - indicator-level matches
- Unsupported scripts render an explicit support note instead of fake signal output.
- Unauthenticated users see a sign-in recovery state instead of a broken page.

### Desktop Expansion
- Sidebar entry is final item.
- Page renders current-state explanation without implying shipped desktop integration.

## Device Matrix
- `390x844`
- `768x1024`
- `1440x900`

Acceptance expectations:
- no clipped account switchers
- no hidden core trade actions
- tables degrade into usable mobile cards or stacked layouts
- drawers/modals remain keyboard and touch accessible

## Test Types

### Unit
- auth/session helpers
- role guards
- bootstrap role and route-access policy helpers
- auth redirect resolution helpers
- preference serialization
- Alpha assessment shaping
- Schwab Data request/config mapping

### DOM
- portfolio table config/sort/expand/actions
- account selector state restoration
- Alpha widget loading/error/success states
- Active Trader ticket prefill

### API
- auth/session routes
- Schwab config routes
- positions/accounts routes
- Alpha assessment route
- account preference route
- admin audit/reveal routes

### E2E
- sign-in flow
- landing-to-sign-in flow
- account switching
- portfolio actions
- Active Trader order flow
- Alpha confirm/edit flows
- admin console access
- admin tab isolation and refresh
- settings credential save flow
- backtest editor bootstrap and fallback flow
- Schwab Data Center configuration/download flow

## Current Baseline Result
- Current verified gates:
  - `npx tsc --noEmit` passes
  - `npm run build` passes
  - `npm run lint:scoped` passes
  - `npm run test:smoke` passes
  - `npm run qa:e2e` passes
  - `npm run qa:all` passes
- Current smoke coverage:
  - portfolio table DOM behaviors
  - user preference hook
  - customer runtime/chart read-model helpers
  - Trending Indicators evaluator kernel
  - Trending Indicators dashboard rendering
  - sidebar role-aware navigation
  - order-draft serialization/payload shaping
  - Schwab Data request/code preview
  - auth environment normalization
  - secret encryption/decryption compatibility
  - runtime health guards and schema/client mismatch handling
  - settings typed error rendering
  - admin lazy-tab loading and tab-local failure handling
  - backtest editor Monaco fallback behavior
  - auth browser/system flow for sign-in, auth error, auth health, and provider callback origin
  - Trending Indicators unauthenticated browser recovery flow
  - authenticated browser flow for settings credential save and admin tab loading
  - authenticated browser flow for backtest editor stability
- Still pending before production claims:
  - API smoke suite
  - tenant/concurrency verification
  - deeper admin/superuser workflow verification beyond current control-plane smoke
  - broader Playwright coverage beyond auth
  - dedicated QA console application
