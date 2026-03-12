# 08 - Code Map

## Core Ownership Map

### Identity and provider configuration
- `lib/auth.ts`
  - NextAuth providers, callbacks, session enrichment, sign-in events
- `lib/auth-environment.ts`
  - origin/environment normalization and auth-health computation
- `app/api/auth/[...nextauth]/route.ts`
  - NextAuth route wrapper

### Session and redirect state
- `lib/server-session.ts`
  - server session and current-user helpers
- `lib/auth-redirect.ts`
  - root/post-sign-in destination resolution
- `app/api/user/session-activity/route.ts`
  - persistence of recent authenticated page state

### Authorization and operator controls
- `lib/auth-policy.ts`
  - bootstrap role seeding rules and route-access policy definitions
- `lib/roles.ts`
  - role normalization helpers
- `lib/security/platform-security.ts`
  - server-side access enforcement, break-glass, audit helpers
- `proxy.ts`
  - authenticated-edge boundary for protected routes

### Health and recovery surfaces
- `app/api/health/auth/route.ts`
  - runtime auth health contract
- `app/auth/error/page.tsx`
  - auth recovery surface
- `app/auth/signin/page.tsx`
  - dedicated sign-in page
- `app/auth/post-signin/page.tsx`
  - post-sign-in resolver

### Schwab brokerage authorization
- `app/api/schwab/auth/route.ts`
  - start/status/complete user Schwab auth
- `app/schwab/callback/page.tsx`
  - popup callback completion UX
- `lib/brokerage-connections.ts`
  - brokerage connection lifecycle and pending auth state

## How To Read The Stack
- start with `auth-environment`
- then `auth.ts`
- then `auth-redirect`
- then `platform-security`
- then the Schwab connect files

That order matches the actual runtime flow.
