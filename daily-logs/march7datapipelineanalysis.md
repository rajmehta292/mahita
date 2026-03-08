# March 7 Data Pipeline Analysis

## 1. The Core Issue: "No Data Available"
The application heavily relies on the `MarketDataStore` to provide historical data across varying time horizons. We define strict expectations for this data: 10 years for `1d` data and 5 years for `1h` data (defined in `DataHealthManager`).

When a user clicks on a symbol (e.g., AMGN `1d` or `1h`), the system checks the local SQLite database. If the `count === 0`, it triggers a deep historical bootstrap. 

**The Bug:**
The ingestion pipeline was fetching chunks of data going backward in time. To prevent infinite loops (for example, seeking data from before a company's IPO), it had a bailout condition: 
`if (fetched.length === 0 && currentStart < now - (ONE_YEAR * 5)) break;`

However, Yahoo Finance has strict upstream limitations: it only provides **730 days (~2 years)** of `1h` intraday data. When the pipeline attempted to fetch the chunk from 5 years ago to 3 years ago, Yahoo Finance returned an empty array. The pipeline saw an empty array, hit the 5-year bailout condition, and silently broke the loop. It never progressed to fetch the recent 2 years of data that *were* available. As a result, 0 bars were saved, and the UI displayed "No data available."

## 2. The Solution: Resilient Chunking & Live Observability
To resolve this, we modified the bailout condition gracefully allow skipping empty deep historical chunks while still ensuring the parser marches forward to gather recent data. 

Additionally, we identified that long-running ingestion sweeps were causing silent timeouts in the background. To give users complete visibility into the ingestion engine, we upgraded the `/api/trading/ingest` endpoint to stream data using Server-Sent Events (NDJSON). 

We integrated a live "Developer Terminal" overlay on the Data Command page. Now, when you trigger Global Ingestion or Sync a specific gap, you can watch the exact chunks being fetched, log any upstream provider warnings, and watch the database count increase in real-time.

## 3. Current Architecture of the Data Engine
The data engine is currently structured natively inside the Next.js App Router:
- **`app/services/market-data/health.ts`**: The brain of the data engine. It calculates target horizons (15y, 10y, 5y) and detects internal gaps (time jumps > 1.5x the timeframe interval, excluding weekends). 
- **`app/services/market-data/store.ts`**: The multi-provider fallback router. It first checks SQLite, then attempts Yahoo Finance, then AlphaVantage. It chunks data writes into 500-row inserts to prevent SQLite variable limits during massive synchronization.
- **`app/api/trading/ingest/route.ts`**: The execution worker. It streams NDJSON back to the client while processing 1) full bootstraps from scratch, 2) deep historical backfills to reach the desired percentage, 3) internal gap healing, and 4) catching up to the present day.

## 4. Next Steps for Data Resiliency
While the live logs heavily improve observability and error detection, the SQLite database is not designed for multi-gigabyte tick data. As we expand the universe to thousands of tickers:
1. **Migration to TimescaleDB or PostgreSQL**: SQLite handles 1D and 1H data for the Dow 30 flawlessly, but storing 1M data will eventually slow down queries.
2. **Dedicated Background Workers**: Right now, ingestion relies on Next.js API timeouts. Migrating heavy chronological syncs to a separate Node worker or Redis queue will ensure 100% uptime.
