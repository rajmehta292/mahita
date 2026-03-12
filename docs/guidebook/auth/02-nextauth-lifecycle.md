# 02 - NextAuth Lifecycle

## Provider Model
Mahita currently supports:
- Google provider for production/public-domain identity
- Credentials provider for local dev bypass only

The providers live in `lib/auth.ts`. Google should be treated as the real user identity provider. Dev bypass is a local engineering tool.

## Google Account Linking Policy
- Mahita allows **Google-only same-email account linking**
- this exists to recover safely when a Mahita `User` row already exists but the corresponding NextAuth `Account` row has not been created yet
- the common trigger was demo/bootstrap data creating real-email `User` rows before the person completed real Google sign-in
- when this happens, Mahita now links the Google account to the existing user record instead of forcing a manual reset

This policy is intentionally scoped to Google. It does not broaden account linking to arbitrary providers.

## Session Model
- strategy: JWT
- session payload is enriched with:
  - `user.id`
  - `user.role`

The type contract lives in `types/next-auth.d.ts`.

## Sign-In Flow
1. User starts on `/` or `/auth/signin`
2. Google sign-in starts from the current public origin
3. NextAuth callback creates or resumes the Mahita user
4. Mahita records sign-in timing in `UserPreference`
5. Google provider tokens are scrubbed from the `Account` row because Mahita does not need them after identity is established
6. User is sent to `/auth/post-signin`
7. Mahita resolves destination:
   - first-time user -> `/signup`
   - recent returning user -> last visited authenticated page
   - otherwise -> `/dashboard`

## Why Token Scrubbing Exists
Google provider access tokens are not required for Mahita after login. Leaving them in the auth adapter table would create an unnecessary secondary secret store.

## Current Constraint
NextAuth handles Mahita identity only. It does not own Schwab brokerage auth. Schwab is a separate OAuth flow.

## Demo Auth Rule
Demo/bootstrap flows must only seed synthetic demo identities such as `*.demo@mahita.ai`. They must never pre-create real presentation or operator emails, because that can collide with real Google sign-in and surface `OAuthAccountNotLinked`.
