# Live Smoke Checklist

Status: Manual operator runbook. This checklist is intentionally excluded from public CI because it depends on live secrets, the Windows operator machine, and real external providers.

## Preconditions

- Operator machine: `C:\mahita\mahita`
- Local dev server or production-start flow is running on port `6244`
- Cloudflare tunnel is connected for [https://mahita.ai](https://mahita.ai)
- `.env.local` contains the current Google, Schwab, and Mahita runtime secrets
- Manual brokerage actions are paper-safe or explicitly approved before submission

## Public auth smoke

1. Open [https://mahita.ai/api/health/auth](https://mahita.ai/api/health/auth)
2. Verify:
   - `authMode` is the public Google mode
   - `googleSignInEnabled` is `true`
   - `devBypassEnabled` is `false`
3. Complete one real Google sign-in at [https://mahita.ai/auth/signin](https://mahita.ai/auth/signin)
4. Confirm session-backed navigation for:
   - `/docs`
   - `/dashboard`
   - `/chart`
   - `/active-trader`

## Schwab smoke

1. Confirm Schwab developer credentials are present in Settings
2. Start a Schwab connect flow from Active Trader
3. Complete the brokerage OAuth popup
4. Verify:
   - the popup auto-closes
   - the parent page enters the connected state
   - account summaries, positions, and recent orders load
5. Disconnect and reconnect once to verify stale-session recovery

## UI/runtime smoke

1. Open `/screener` and verify first render resolves to data, empty state, or explicit error state without hanging
2. Open `/admin?tab=di-ui` and verify degraded/provider-unavailable states still keep the page usable
3. Open `/superchart` and verify the MahaCharts shell loads without console/runtime noise

## Manual real-order smoke

Only run this with explicit approval.

1. Verify the target account and quantity are intentionally tiny
2. Capture the current buying power and open positions
3. Submit one approved order
4. Confirm:
   - Active Trader shows the submitted order
   - order status updates propagate to positions/orders surfaces
   - cancellation or closeout works if required
5. Record the outcome in the current session handoff before ending the run
