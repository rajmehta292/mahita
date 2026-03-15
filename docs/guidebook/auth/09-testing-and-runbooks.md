# 09 - Testing And Runbooks

## Required Auth Verification

### Deterministic lane
- auth-environment origin matrix
- redirect helpers
- bootstrap role and route-access policy helpers
- Google same-email account-linking policy
- break-glass recent-auth and reveal grant behavior
- Schwab callback and pending-state validation helpers

### Browser lane
- landing page sign-in widget
- localhost dev-bypass path
- production-style Google sign-in rendering assumptions
- `/auth/error` recovery surface
- first-time user -> signup
- returning user -> resume or dashboard
- Schwab popup completion success / retry / timeout / auto-close fallback

## Debug Runbook

### Bad Google callback config
Symptoms:
- Google sign-in fails before creating a Mahita session
- `/auth/error?error=OAuthCallback`

Check:
- Google OAuth client has only:
  - `https://mahita.ai`
  - `https://mahita.ai/api/auth/callback/google`
- `/api/health/auth` reports the expected public origin

### Bad public origin config
Symptoms:
- auth UI points users to the wrong domain
- Google button hidden unexpectedly

Check:
- `NEXTAUTH_URL`
- `MAHITA_PUBLIC_APP_ORIGIN`
- `/api/health/auth`

### Missing secrets
Symptoms:
- auth health `ok=false`
- session signing or encryption failures

Check:
- `NEXTAUTH_SECRET`
- `MAHITA_SECRET_KEY` or `ENCRYPTION_KEY`

### Stale Schwab connect state
Symptoms:
- callback fails after popup completes
- "authorization expired" or state mismatch

Check:
- user started connect from the same Mahita session
- callback finished within the pending window
- retry from Active Trader or Dashboard

### Schwab popup does not auto-close after successful callback
Symptoms:
- Schwab account linking succeeds
- parent Mahita page may or may not reflect the connected state yet
- popup stays open after the callback instead of closing or showing the explicit success screen

Check:
- callback originated from `https://mahita.ai/schwab/callback`
- popup-compatible routes are serving `Cross-Origin-Opener-Policy: same-origin-allow-popups`
- the connect page set the popup-flow marker before leaving Mahita
- the callback emitted a same-origin completion signal (`postMessage`, `BroadcastChannel`, or `localStorage`)
- full-window fallback redirects only when the popup marker is absent

### Admin access failures
Symptoms:
- admin route 403
- reveal action denied

Check:
- session role
- recent sign-in freshness
- audit/reveal grant state

### OAuthAccountNotLinked
Symptoms:
- Google sign-in returns to `/auth/signin?error=OAuthAccountNotLinked`
- the same email already appears in Mahita, but sign-in never completes

Check:
- run `npm run audit:auth-collisions`
- confirm the user email exists with zero linked NextAuth `Account` rows
- confirm Mahita is running with the Google same-email linking policy enabled
- retry Google sign-in and confirm it links to the existing Mahita user instead of creating a duplicate

## Current Test Gaps
- multi-user concurrency auth lane
- deeper admin operational browser coverage
- full staging-origin auth matrix once staging exists
