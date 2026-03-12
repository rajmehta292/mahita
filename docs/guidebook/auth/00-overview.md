# 00 - Overview

## Purpose
Mahita uses a hybrid auth architecture because it solves two different problems:

- **Mahita identity**: who the user is inside Mahita
- **Brokerage authorization**: which external Schwab account Mahita is allowed to access for that user

These are separate trust problems and are intentionally handled by separate flows.

## Auth Layers
Mahita auth has five layers:

1. **Public identity layer**
   - Google OAuth via NextAuth
   - creates or resumes a Mahita user
2. **Session layer**
   - JWT-backed NextAuth session
   - typed session includes `user.id` and `user.role`
3. **Authorization layer**
   - edge-level “signed in” requirement
   - server-side role and ownership checks
4. **Brokerage authorization layer**
   - Schwab Developer app credentials
   - Schwab OAuth for the real brokerage account
5. **Operator/control plane**
   - superuser admin surfaces
   - audited reveal and privileged actions

## Design Goals
- real users authenticate only through `https://mahita.ai`
- localhost never appears in real-user setup instructions
- sessions are restorable and deterministic
- user brokerage data remains tenant-scoped
- privileged access is explicit and auditable
- platform data access remains distinct from user brokerage access

## Current State
Secure and working:
- production/public-origin Google auth model is implemented
- local dev defaults to dev bypass
- typed sessions and role-aware server checks exist
- Schwab OAuth is state-bound to the initiating user/connection
- recent-auth and audit-backed break-glass exists at first pass

Transitional:
- bootstrap superuser logic still uses configured email seeding
- provider pool still supports a temporary superuser-backed bridge
- user brokerage secrets still bridge through legacy `SchwabConfig`

Not yet final:
- admin-managed role governance
- dedicated platform provider credentials everywhere
- immutable append-only audit backend
- fully shared strategy/deployment auth model
