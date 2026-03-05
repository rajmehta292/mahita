# 06 - Master AI Implementation Guide

## Executive Summary
**ATTENTION NEXT AI AGENT**: This acts as the meta-instruction wrapper for executing the codebase correctly in isolated autonomous sessions. Start from Doc 01 and proceed aggressively but iteratively through Doc 05.

## Operational Order Execution Plan

### Phase 1: Security & Bootstrap
1. Scaffold Next.js + Tailwind. Define `.env.local` ignoring database schema integrations for secrets.
2. Initialize NextAuth with Google Provider strictly applying the whitelist conditional check against `ALLOWED_EMAIL` inside the `callbacks: signIn` payload. Enforce routing locks via `middleware.ts`.

### Phase 2: Structural Data Providers
1. Define Prisma Data models (Strategy, MarketData, Auth scopes).
2. Wire the `MarketDataStore` to interface with abstract `IDataProvider` proxies (i.e. MockProvider, SchwabProvider).

### Phase 3: The Engine Heart
1. Translate `StrategyAST` json schemas into Typescript Interfaces.
2. Code the `StrategyEvaluator.ts` parser logic to run conditional triggers (`>`,`<`, `crosses_above`) over pre-compiled `technicalindicator` buffer states.
3. Code the `PaperBrokerProvider.ts` to simulate slippage logic and track closed trade lifecycle PnL metrics accurately against virtual ledgers.

### Phase 4: UI Assembly
1. Inject the glassmorphism Global CSS scope.
2. Code the Client React hooks bridging the Backtester API endpoint into the visual `lightweight-charts` DOM refs array. Display calculated statistics matrix inside the dashboard views.
3. Verify comprehensive terminal runtime.
