export type BaseTimeframe = '1s' | '1m' | '1h' | '1d' | '1w' | '1M'
export type DerivedTimeframe = '1s' | '5s' | '15s' | '30s' | '1m' | '3m' | '5m' | '10m' | '15m' | '30m' | '45m' | '1h' | '2h' | '3h' | '4h' | '1d' | '1w' | '1M'
export type Timeframe = DerivedTimeframe
export interface MarketDataPoint {
    time: number;       // Unix timestamp (seconds)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface IDataProvider {
    getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number, options?: { providerClient?: unknown }): Promise<MarketDataPoint[]>
}

export interface TimeRange {
    startTime: number
    endTime: number
}

export interface ChunkIngestionReport {
    provider: string
    rangeStart: number
    rangeEnd: number
    fetchedBars: number
    persistedBars: number
    dbTotalAfterChunk: number
    warnings: string[]
}

export interface MarketDataFetchReport {
    symbol: string
    timeframe: Timeframe
    rangeStart: number
    rangeEnd: number
    cacheBars: number
    fetchedBars: number
    persistedBars: number
    dbTotalAfterFetch: number
    chunkReports: ChunkIngestionReport[]
    warnings: string[]
}

export interface MarketDataFetchResult {
    data: MarketDataPoint[]
    report: MarketDataFetchReport
}
