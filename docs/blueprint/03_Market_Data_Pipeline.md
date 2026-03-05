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

## 2. Retrieval Logistics Architecture
When an engine requests parameters `(Symbol, Timeframe, StartDate, EndDate)`:
1.  Query local SQLite cache via Prisma.
2.  Identify temporal cache-misses or blank gaps.
3.  Query generic `IDataProvider` for only the missing gaps.
4.  Upsert delta into local cache via `skipDuplicates` or Prisma bulk-update.
5.  Return the seamlessly merged and linearly sorted temporal array to the caller.

## 3. Connectivity Protocols
*   **REST Polling**: Standard historic gap-fill mechanisms relying on the provider HTTP wrappers.
*   **WebSockets**: Required for live forward-testing (Shadow Trading) to process real-time bar completion triggers dynamically without exhausting polling limits.
