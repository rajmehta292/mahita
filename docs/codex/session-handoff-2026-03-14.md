# Codex Session Handoff

Date: 2026-03-14  
Branch: `codex/post-presentation-stabilization`

## What changed in this session

- Fixed the MahaCharts API JSON failure mode that surfaced as `Unexpected token '<'` when an auth redirect returned HTML instead of JSON.
- Changed API auth handling in [proxy.ts](/Users/rmehta01/Sites/mahita/proxy.ts) so protected `/api/*` requests return JSON `401` instead of redirect HTML.
- Added `readJsonResponse()` hardening in [lib/app-errors.ts](/Users/rmehta01/Sites/mahita/lib/app-errors.ts) so bad upstream bodies fail with readable app errors.
- Patched MahaCharts and Backtest fetch call sites to use the safer JSON helper:
  - [app/components/SuperChart/SuperChartWorkspace.tsx](/Users/rmehta01/Sites/mahita/app/components/SuperChart/SuperChartWorkspace.tsx)
  - [app/backtest/page.tsx](/Users/rmehta01/Sites/mahita/app/backtest/page.tsx)
  - [app/components/Chart/ChartWorkspace.tsx](/Users/rmehta01/Sites/mahita/app/components/Chart/ChartWorkspace.tsx)
- Reduced idle MahaCharts work by lazy-loading brokerage account data only when trade-related surfaces are active.
- Repaired the deterministic DOM suite after the fetch helper change by upgrading mocked responses to proper JSON-like `Response` shapes in [tests/mahacharts-workspace.dom.test.tsx](/Users/rmehta01/Sites/mahita/tests/mahacharts-workspace.dom.test.tsx).
- Added a targeted regression test for HTML/JSON parsing in [tests/app-errors.unit.test.ts](/Users/rmehta01/Sites/mahita/tests/app-errors.unit.test.ts).
- Kept the screenshot-driven MahaCharts overlay model intact and revalidated it through deterministic, browser, multiuser, and audit lanes.
- Added this `docs/codex` folder and linked it from [README.md](/Users/rmehta01/Sites/mahita/README.md).

## Verified in this session

- `npm run test:mahacharts:deterministic`
- `npx tsc --noEmit --pretty false`
- `npx playwright test e2e/mahacharts.spec.ts`
- `npx playwright test e2e/mahacharts.multiuser.spec.ts`
- `node ./scripts/run-mahacharts-audit.mjs`

Latest generated artifacts:

- [docs/internal/generated/mahacharts-audit-report.json](/Users/rmehta01/Sites/mahita/docs/internal/generated/mahacharts-audit-report.json)
- [docs/internal/generated/mahacharts-audit-summary.md](/Users/rmehta01/Sites/mahita/docs/internal/generated/mahacharts-audit-summary.md)

## Known remaining issues

- Next/Turbopack still warns about overly broad filesystem tracing in:
  - [app/services/market-data/vault-manager.ts](/Users/rmehta01/Sites/mahita/app/services/market-data/vault-manager.ts)
  - [app/services/market-data/parquet-store.ts](/Users/rmehta01/Sites/mahita/app/services/market-data/parquet-store.ts)
- Those warnings did not block the current verification lanes, but they are still a real build-performance cleanup target.
- Several repo scripts are still shell-specific (`bash` / `zsh`) and need Windows-safe equivalents or a documented WSL/Git Bash requirement.

## If work resumes on another machine

Start here:

1. [docs/codex/windows-migration.md](/Users/rmehta01/Sites/mahita/docs/codex/windows-migration.md)
2. [docs/internal/guidebook/mahacharts/README.md](/Users/rmehta01/Sites/mahita/docs/internal/guidebook/mahacharts/README.md)
3. [docs/internal/generated/mahacharts-handoff.md](/Users/rmehta01/Sites/mahita/docs/internal/generated/mahacharts-handoff.md)
4. [docs/current_state_baseline.md](/Users/rmehta01/Sites/mahita/docs/current_state_baseline.md)

## Important context rule

Raw Codex chats are not the portable source of truth. The portable source is:

1. committed code
2. canonical guidebooks
3. generated audit/context artifacts
4. dated handoff notes in `docs/codex`
