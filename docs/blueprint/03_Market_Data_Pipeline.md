# 03 - Market Data Pipeline Blueprint

## Executive Summary
Defines the `MarketDataStore` local proxy and caching module used to serve OHLCV data without rapidly encountering Remote Vendor rate limiting.

## 1. Data Schema
The universal internal unit is the `MarketDataPoint`:
```typescript
export interface MarketDataPoint {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}
```

## 2. Retrieval Logistics & Multi-Vault Architecture
When an engine requests parameters `(Symbol, Timeframe, StartDate, EndDate)`:
1.  **Timeframe Analysis**: The engine explicitly prevents storing weird derivative frames (`15m`). It intercepts requests and maps them to a strictly tracked Base Timeframe (`1s, 1m, 1h, 1d, 1w, 1M`).
2.  **Vault Selection**: `VaultManager` creates dedicated SQLite `.db` instances mapping to explicit external sources (Schwab, Yahoo, AI, CSV).
3.  **Local Cache Check**: Query localized SQLite Vault cache via Prisma using the Base Timeframe.
4.  **Gap Healing**: Identify temporal cache-misses or blank gaps.
5.  **External Polling**: Query generic `IDataProvider` for only the missing gaps.
6.  **Persistence & Aggregation**: Upsert gap delta into local Vault, then dynamically derive up (aggregate bars) if the originating caller needed a multi-minute layout (`15m`).
7.  **Return**: Serve the seamlessly merged, linearly sorted array back.

## 3. Connectivity Protocols
*   **REST Polling**: Standard historic gap-fill mechanisms relying on the provider HTTP wrappers.
*   **WebSockets**: Required for live forward-testing (Shadow Trading) to process real-time bar completion triggers dynamically without exhausting polling limits.
