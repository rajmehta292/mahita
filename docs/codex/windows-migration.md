# Windows Migration Checklist

Status update (March 15, 2026):
- the copied workspace is now running in place on Windows from `C:\mahita\mahita`
- local dev serves on `http://localhost:6244`
- the public origin `https://mahita.ai` is currently tunneled from this Windows machine
- the remaining known brokerage UX issue is the Schwab OAuth orphan popup after a successful callback

This project can move to Windows cleanly, but the safest target is Windows with either WSL2 or Git Bash available because several scripts still assume Unix shell behavior.

## Recommended target setup

- Windows 11
- Git for Windows
- Node.js `v25.4.0`
- npm `11.7.0`
- Prisma-compatible SQLite access
- Playwright browsers installed
- One of:
  - WSL2 with Ubuntu
  - Git Bash

Codex-specific local state on the current Mac:

- Codex home: `/Users/rmehta01/.codex`

If you want to preserve local Codex skills, automations, and other app-local state, copy that directory separately in addition to the repo.

## Repo state to copy or recreate

Copy the repo itself:

- `git clone` on the new machine is preferred once the branch is pushed

Copy local secrets/config if needed:

- `.env.local`
- any provider credential files not committed to git

Do not rely on copying transient build output:

- `.next`
- `.next-playwright`
- `.next-prebuild-*`
- `node_modules`

Those are intentionally disposable.

## First boot on Windows

From the current Windows machine:

```bash
cd C:\mahita\mahita
npm install
npm run sync:monaco
npx prisma generate
npm run dev
```

From a fresh clone:

```bash
npm install
npm run sync:monaco
npx prisma generate
npx prisma db push
npm run dev
```

For the demo-safe path:

```bash
npm run bootstrap:demo
npm run dev
```

## Validation checklist after migration

Run these before resuming product work:

```bash
npm run test:mahacharts:deterministic
npx tsc --noEmit --pretty false
npx playwright test e2e/mahacharts.spec.ts
npx playwright test e2e/mahacharts.multiuser.spec.ts
node ./scripts/run-mahacharts-audit.mjs
```

## Windows-specific risks to resolve

These are the main portability gaps still present:

- `bash`-based scripts in `package.json`
  - `bootstrap:demo`
  - backup/restore/drill scripts
- `zsh`-based scripts in `package.json`
  - `validate:provider-matrix`
  - `check:platform-consistency`
- local filesystem assumptions in some market-data services
  - [app/services/market-data/vault-manager.ts](/Users/rmehta01/Sites/mahita/app/services/market-data/vault-manager.ts)
  - [app/services/market-data/parquet-store.ts](/Users/rmehta01/Sites/mahita/app/services/market-data/parquet-store.ts)

Practical recommendation:

- use WSL2 or Git Bash first
- get the branch green
- then replace the shell-specific scripts with cross-platform Node wrappers

## What counts as the portable context

Portable context for this project now lives in:

- [docs/codex/README.md](/Users/rmehta01/Sites/mahita/docs/codex/README.md)
- [docs/codex/session-handoff-2026-03-14.md](/Users/rmehta01/Sites/mahita/docs/codex/session-handoff-2026-03-14.md)
- [docs/internal/generated/mahacharts-handoff.md](/Users/rmehta01/Sites/mahita/docs/internal/generated/mahacharts-handoff.md)
- [docs/internal/generated/mahacharts-audit-summary.md](/Users/rmehta01/Sites/mahita/docs/internal/generated/mahacharts-audit-summary.md)

That is the material to trust when you resume on Windows, not the local app transcript alone.
