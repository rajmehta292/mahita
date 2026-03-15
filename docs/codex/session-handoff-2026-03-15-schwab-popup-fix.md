# Codex Session Handoff

Date: 2026-03-15  
Branch: `codex/post-presentation-stabilization`  
Remote: `origin https://github.com/rajmehta292/mahita.git`

## Schwab popup root cause

- the public Windows runtime was successfully exchanging Schwab OAuth codes and linking the brokerage connection
- the popup callback path used the presence of `window.opener` as the close-vs-redirect switch
- the global `Cross-Origin-Opener-Policy: same-origin` header and the Schwab round-trip could sever the opener relationship before the popup returned to `https://mahita.ai`
- once `window.opener` was gone, the callback redirected the popup to `/active-trader?schwab=connected` instead of closing it

## Fix implemented

- kept the strict default COOP policy for the app, but applied `Cross-Origin-Opener-Policy: same-origin-allow-popups` only on these routes:
  - `/active-trader`
  - `/dashboard`
  - `/history`
  - `/portfolio`
  - `/schwab/connect`
  - `/schwab/callback`
- added a popup-flow marker so the callback can recognize popup intent even if `window.opener` is missing
- added same-origin completion signaling through `BroadcastChannel` with a `localStorage` storage-event fallback
- kept the existing `postMessage` path when the opener relationship survives
- changed the callback success behavior so popup-intended flows attempt `window.close()` first and only full-window flows redirect to `/active-trader?schwab=connected`
- left a manual close / return-to-app success screen in place for the rare case where a browser still blocks `window.close()` after success

## Verification run before push

```bash
npx vitest run tests/platform-security.unit.test.ts tests/schwab-callback.dom.test.tsx tests/schwab-gating.dom.test.tsx
npx tsc --noEmit --pretty false
npx eslint app/components/SchwabGating.tsx app/schwab/connect/page.tsx app/schwab/callback/page.tsx lib/schwab-popup-channel.ts lib/security/http-headers.ts next.config.ts playwright.config.ts tests/platform-security.unit.test.ts tests/schwab-callback.dom.test.tsx tests/schwab-gating.dom.test.tsx e2e/schwab-oauth-popup.spec.ts
npx playwright test e2e/schwab-oauth-popup.spec.ts
npx playwright test e2e/settings-and-admin.spec.ts
node ./scripts/verify-mahacharts-release.mjs
```

## Local-only files still excluded from Git

- `.env.local`
- `dev.db`
- `dev.db.pre_windows_bringup.bak`
- `windows-dev.stdout.log`
- `windows-dev.stderr.log`
- `windows-tunnel.stdout.log`
- `windows-tunnel.stderr.log`
- machine-specific Cloudflare tunnel credential material
- the Windows-specific `cloudflared/config.yml` credential path patch
