# Codex Session Handoff

Date: 2026-03-15  
Branch: `codex/post-presentation-stabilization`  
Remote: `origin https://github.com/rajmehta292/mahita.git`

## Windows/public baseline

- Active workspace root: `C:\mahita\mahita`
- Local app origin: `http://localhost:6244`
- Public app origin: `https://mahita.ai`
- Public tunnel currently terminates from this Windows machine
- `.env.local` is the runtime env file on this machine and stays local-only
- `dev.db` is the preserved local runtime database and stays local-only

## Public auth/runtime status

- `https://mahita.ai/api/health/auth` returns the public-origin auth health JSON
- public Google sign-in is enabled on `mahita.ai`
- public protected routes redirect to sign-in as expected when unauthenticated
- protected API auth failures return JSON `401` instead of HTML redirect bodies
- real Schwab callback origin remains `https://mahita.ai/schwab/callback`

## Current known issue before the next fix

- Schwab OAuth account linking succeeds, but the popup can survive as an orphan window on `https://mahita.ai/active-trader?schwab=connected`
- the parent page still reflects the connected brokerage state
- the popup problem is lifecycle-only; the token exchange and account-linking path are otherwise working

## Local-only files intentionally excluded from Git

- `.env.local`
- `dev.db`
- `dev.db.pre_windows_bringup.bak`
- `windows-dev.stdout.log`
- `windows-dev.stderr.log`
- `windows-tunnel.stdout.log`
- `windows-tunnel.stderr.log`
- machine-specific Cloudflare tunnel credential material
- the Windows-specific `cloudflared/config.yml` credential path patch

## Repo hygiene notes

- accidental zip-copy churn in the TradingView archive, tracked `node_modules` UUID files, and tracked `tmp/*` files should not be treated as product work
- keep commit history focused on real source/docs/test changes plus explicit Windows handoff notes
- if the repo is copied between machines again, rebuild dependencies instead of copying `node_modules`
