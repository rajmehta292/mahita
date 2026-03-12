# 04 - User Navigation State

## Goal
Mahita should feel continuous after sign-in instead of dumping users into a fixed page every time.

## Stored State
Mahita stores navigation continuity in `UserPreference`:
- `lastVisitedPath`
- `lastVisitedAt`
- `lastSignInAt`
- `previousSignInAt`

## Current Rules
### `/`
- signed-out user: landing page
- signed-in user: resolved destination

### `/auth/post-signin`
- first-time user with no prior auth state: `/signup`
- returning user with prior sign-in within 12 hours and a safe app path: last visited path
- stale or missing resume state: `/dashboard`

### Session activity tracking
The main app records safe authenticated paths back to the server so the next sign-in can resume correctly.

## Safety Rules
- `/auth/*` and `/api/*` paths are never treated as resumable destinations
- root `/` is not treated as resumable state
- only authenticated app pages are tracked

## Operational Meaning
This is a user-experience continuity layer, not an authorization layer. It should never be used to grant access.
