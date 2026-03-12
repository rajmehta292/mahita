# 03 - Role And Access Model

## Roles
- `USER`
- `ADMIN`
- `SUPERUSER`

## Current Source Of Truth
Persisted role data is the runtime source of truth. Bootstrap email rules still exist only to ensure the owner account resolves to `SUPERUSER` during the current bootstrap phase.

## Access Layers
### Edge access
`proxy.ts` enforces:
- the request must be authenticated for protected app/API paths

It does **not** decide admin or ownership.

### Server access
Server routes enforce:
- signed-in requirement
- admin requirement
- superuser requirement
- resource ownership where applicable

The current reusable policy map is:
- `signedIn`
- `admin`
- `superuser`

## Why This Split Exists
Edge middleware is cheap and broad. Ownership and role checks require session and domain context, so they remain server-side.

## Current Weak Point
The role lifecycle is not yet fully admin-managed. It is still bootstrapped from owner email configuration, then persisted. Future work should make role governance a true control-plane function.
