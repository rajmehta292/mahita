# Enterprise Security Program

Status: Active implementation baseline as of March 10, 2026. This document defines the security posture Mahita should meet to be treated as a trustworthy technical store for personal financial information. It is intentionally stricter than the platform's current implementation state.

## Security Goals

Mahita must satisfy five non-negotiable goals:

1. Protect customer financial data and connected-broker credentials as regulated secrets.
2. Prevent cross-tenant data leakage between customers, operators, and background jobs.
3. Make privileged access explicit, minimal, auditable, and reversible where possible.
4. Fail closed when secure platform infrastructure is missing.
5. Prove behavior with repeatable automated verification, not claims.

## Trust Boundaries

### Customer plane
- Dashboard
- Portfolio
- History
- Active Trader
- Backtester
- Trending Indicators
- Alpha

Rules:
- customer pages can read only customer-safe APIs
- customer routes must be tenant-scoped by authenticated user ID
- no customer page may depend on operator or platform-control endpoints

### Operator plane
- provider health
- ingestion control
- inventory inspection
- vault inspection
- future admin console

Rules:
- operator routes require `SUPERUSER`
- mutating actions must create audit events
- operator capabilities must not be linked from standard customer navigation for non-admin users

### Platform plane
- market-data ingestion
- shared provider pool
- scheduled backfills
- monitoring and background sync

Rules:
- platform jobs must not read end-user brokerage tokens
- dedicated provider credentials must be distinct from brokerage connections
- insecure fallbacks may exist only for explicit local development and must be disabled by default

### Secret plane
- Schwab client secrets
- Schwab access and refresh tokens
- BYOK AI keys
- session signing secrets

Rules:
- encrypt at rest
- redact in responses
- never log plaintext
- never return raw values to the browser except in a deliberately designed, audited break-glass admin flow

## Required Controls

### Identity and access management
- Google sign-in or equivalent federated identity
- typed role model: `USER`, `ADMIN`, `SUPERUSER`
- role checks executed server-side
- no authorization based solely on client-visible state
- future admin impersonation and secret reveal must require:
  - re-auth
  - explicit reason
  - short-lived access window
  - immutable audit event

### Session and route protection
- authenticated routes protected at the edge via `proxy.ts`
- `/auth/error` must always exist and be user-readable
- local development auth origin must not default to the production host
- all protected API routes must fail closed when session or ownership is missing

### Secrets and key management
- encrypt Schwab credentials and tokens at rest
- scrub unused Google OAuth account tokens after sign-in so the NextAuth account table is not a secondary secret store
- future migration: unify all secret handling under one application-managed encryption layer or KMS adapter
- production requirement:
  - dedicated `MAHITA_SECRET_KEY`
  - no reuse of development keys
  - managed rotation procedure

### Data protection
- TLS in transit
- security headers on all routes:
  - CSP
  - HSTS in production
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
- platform data inspection routes restricted to `SUPERUSER`
- no customer endpoint may return raw brokerage tokens or client secrets

### Platform credential isolation
- customer Schwab connections are brokerage credentials
- platform ingestion credentials are provider-pool credentials
- the two must not be interchangeable
- until provider-pool infrastructure exists, Mahita must reject using end-user brokerage credentials for shared ingestion by default
- any local-only insecure fallback must require the explicit environment flag:
  - `MAHITA_ALLOW_INSECURE_USER_BROKERAGE_PLATFORM_FALLBACK=true`

### Auditability
- admin/operator mutations must emit `AdminAuditEvent`
- future required events:
  - secret reveal
  - provider enable/disable
  - ingestion start/stop/reset
  - user inspection/impersonation
  - security settings changes

### Secure SDLC and verification
- every feature must have two test lanes:
  - deterministic lane: unit, DOM, contract, mocked provider
  - system lane: browser/integration
- release gates:
  - `npx tsc --noEmit`
  - `npm run build`
  - scoped lint
  - relevant unit/DOM coverage
  - relevant Playwright coverage

## Controls Implemented In This Security Pass

- encrypted Schwab credentials and tokens at rest remain in force
- a first-pass user brokerage plane now exists via `BrokerageConnection` and `BrokerageAccount`, reducing direct customer-route dependence on raw `SchwabConfig`
- raw Schwab secrets are not returned by customer routes
- customer auth origin is normalized for localhost
- authenticated route enforcement migrated to `proxy.ts`
- security headers now ship globally through `next.config.ts`
- operator routes now share centralized superuser access control
- `provider-traffic`, `provider-stream`, `data-inspect`, `data-health`, `data-health/refresh`, and `data-health/sync-gaps` are now superuser-only
- operator mutations now begin writing `AdminAuditEvent` entries for:
  - continuous ingest start/stop
  - inventory refresh
  - data reset
  - gap sync
- platform jobs now fail closed by default instead of silently borrowing end-user Schwab tokens
- Google OAuth provider tokens are scrubbed from the NextAuth `Account` store after sign-in

## Known Gaps

These gaps still block a true enterprise-ready claim:

- a first-pass provider-pool schema and runtime now exist, but the pool still relies on a temporary user-backed bridge until dedicated platform credentials are provisioned
- customer brokerage routes now resolve through the brokerage plane, but the underlying secret store is still the legacy `SchwabConfig` table acting as a bridge
- NextAuth `Account` tokens are scrubbed after sign-in, but a deeper adapter-level secret-storage review is still needed
- BYOK AI key storage still uses a separate encryption path and has not been unified with the core secret vault
- a first-pass admin console and audited provider-credential break-glass UI now exist, but still need deeper operational safeguards and broader review coverage
- break-glass reveal is now recent-auth gated and persisted as `AdminSecretRevealGrant`, but it still needs fuller operational UI and API coverage
- no immutable append-only audit log backend exists beyond the current relational audit table
- backtester runtime is still prototype-grade and not suitable for live-deploy trust guarantees
- no dedicated `qa-console/` app exists yet for environment validation and multi-lane test orchestration

## Required Next Steps

1. Replace the temporary user-backed provider pool bridge with dedicated platform credentials.
2. Finish migrating user brokerage secrets and status off the legacy `SchwabConfig` bridge and into a fully owned brokerage-connection secret plane.
3. Harden the first-pass admin console and break-glass workflows into a full operator control plane.
4. Unify secret management across Schwab, AI keys, and future provider credentials.
5. Add multi-user isolation, concurrency, and ops-route Playwright/API coverage.
6. Add KMS/HSM-backed key management for production deployments.
