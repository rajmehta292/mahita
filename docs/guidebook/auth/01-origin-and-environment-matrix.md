# 01 - Origin And Environment Matrix

## Canonical Origins
- **Production app origin**: `https://mahita.ai`
- **Production Google callback**: `https://mahita.ai/api/auth/callback/google`
- **Production Schwab callback**: `https://mahita.ai/schwab/callback`
- **Local development origin**: `http://localhost:6244` by default

## Why Google And Schwab Use Different Callbacks
- Google callback returns to NextAuth to establish the Mahita identity session.
- Schwab callback returns to Mahita’s brokerage-connect surface so Mahita can exchange the Schwab authorization code for brokerage tokens.

They solve different problems and should never be conflated.

## Environment Matrix

| Environment | User-facing sign-in | Google enabled | Dev bypass | User docs may show localhost? |
| --- | --- | --- | --- | --- |
| Production (`mahita.ai`) | Google | Yes | No | No |
| Local development (`localhost`) | Dev bypass | No by default | Yes when enabled | No for real-user docs |
| Future staging (not yet shipped) | Separate public domain + separate OAuth client | Yes | Optional | No |

## Current Runtime Behavior
- request origin is inspected at auth-health time
- localhost requests default to dev-bypass mode
- public-origin requests can report Google availability
- auth health is the canonical runtime truth source for the UI

## Operator Rule
Do not add localhost to the production Google OAuth client unless Mahita intentionally reintroduces a separate local-only Google setup. The default operating model is:
- production users authenticate on `mahita.ai`
- developers use dev bypass locally

## Common Failure Mode
If users are sent to localhost, the app origin or OAuth callback was configured for a developer environment instead of the production origin.
