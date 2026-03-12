# 05 - Schwab OAuth And Brokerage Connections

## Three Separate Credentials In The Schwab Flow
1. **Schwab Developer Client ID / Client Secret**
   - identify the app Mahita uses with Schwab
2. **Schwab brokerage OAuth code**
   - returned by Schwab during account authorization
3. **Schwab access / refresh tokens**
   - exchanged and stored after successful brokerage OAuth

Mahita should only ever ask users to paste the first category into Settings.

## Current Flow
1. User signs in to Mahita
2. User saves Schwab Client ID / Client Secret
3. Mahita starts a pending brokerage authorization on a `BrokerageConnection`
4. Mahita issues a state value tied to that connection
5. User goes through Schwab OAuth
6. Schwab returns to `https://mahita.ai/schwab/callback`
7. Mahita validates the pending state
8. Mahita exchanges the code for tokens
9. Tokens are attached to the user’s `BrokerageConnection`

## Isolation Model
- the callback URL identifies Mahita
- the signed-in Mahita session plus the pending state identify which user/connection started the flow
- this is why multiple users can share the same production Schwab callback URL safely

## Current Product Constraint
One Mahita user supports one active Schwab brokerage connection today. Reauthorizing that same Mahita user replaces the prior Schwab authorization for that Mahita user.

## Current Weak Points
- user brokerage secrets still bridge through legacy `SchwabConfig`
- lot-level brokerage detail is not yet fully modeled through the newer brokerage plane
