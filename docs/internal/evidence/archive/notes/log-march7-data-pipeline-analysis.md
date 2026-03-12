# March 7 Data Pipeline Analysis

This document provides a deep structural analysis of the current data aggregation pipeline, diagnosing why "data issues are abundant" and why massive continuous ingestion jobs fail (often throwing unhandled Next.js 500 HTML errors).

## 1. The Core Architecture
The data system currently revolves around three layers:
1.  **The Database (SQLite + Prisma):** Stores `MarketData` (the raw candles) and `DataInventory` (the metadata and health scores).
2.  **The Store (`marketDataStore`):** The orchestrator that receives a request for historical data (e.g. AAPL, 1d, 2016-2026). It first checks the SQLite DB. If missing, it traverses a chain of fallback providers.
3.  **The Providers (`YahooProvider`, `AlphaVantageProvider`):** The actual fetchers.

## 2. Diagnosing the Failure Modes

### A. The "Next.js 500 HTML" Ingestion Crash
When clicking "Run Global Ingestion", the frontend attempts to parse the response as JSON but receives an HTML document instead (`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`). 
**Root Causes:**
1.  **Vercel/Next.js Route Timeouts:** The Edge/Serverless functions have strict execution limits. A request that attempts to sequentially backfill 10 symbols across 15 years using 2-year chunks will easily exceed standard API route timeout windows (usually 15-60 seconds depending on the environment). When it times out, Next.js forcefully terminates the connection and returns a default 500 HTML 
2.  **SQLite Variable Limits (OOM/Crash):** Prisma `createMany` with SQLite has a strict bound on the number of bind variables. Attempting to insert 10,000+ rows in a single query (which happens when fetching deep history for 1m or 1h intervals) will crash the Prisma Rust engine implicitly, sometimes crashing the Node process and resulting in an HTML 500.

### B. "Data by Interval is Missing"
**Root Causes:**
1.  **Hardcoded Ingest Routine:** The `ingest` cron route was previously hardcoded to only run on `['1d', '1h']` limits unless specifically overridden by a single symbol sync. Intraday frames like `1m`, `5m`, or `15m` are never natively bootstrapped across the universe.
2.  **API Limitations (Yahoo Finance):** The Yahoo provider is fundamentally incapable of fetching 5 years of `1m` intraday data. Yahoo physically deletes `1m` data older than 7 days, and `1h` data older than 730 days. If the chunking system requests `2016 to 2018` for `1m` data, Yahoo returns an error, triggering the fallback to AlphaVantage for thousands of requests, instantly hitting the AlphaVantage free tier limits.

## 3. The Path Forward (The Fixes)

### UI Provider Selection
To empower the user to debug these black-box API restrictions, we need to bypass the `store.ts` fallback chain. The Data Doctor UI must provide a dropdown to select a specific provider (`Yahoo`, `AlphaVantage`, `Auto-Fallback`) and explicitly push that override via the UI to the API route.

### Chunk Database Inserts
To prevent SQLite Prisma crashes, `store.ts` must manually chunk its inserts. If a provider returns 20,000 bars, Prisma must insert them in batches of 500 max.

### Expose Total Record Counts dynamically
The `DataInventory` should aggregate the sum of all `barCount` columns and this must be transmitted to the frontend on polling intervals.

### Shift to Background Task Offloading
Long term, massive historical ingestion cannot happen inside a standard HTTP Request/Response cycle awaiting `res.json()`. While we will implement short-term chunking to prevent immediate timeouts, the true solution is an asynchronous worker queue (or edge-scheduled cron jobs doing micro-chunks). For now, we will lower the chunk sizes and add the explicit provider override to make it deterministic.
