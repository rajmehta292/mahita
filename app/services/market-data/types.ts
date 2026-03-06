export type Timeframe = '1m' | '3m' | '5m' | '10m' | '15m' | '30m' | '45m' | '1h' | '2h' | '3h' | '4h' | '1d' | '1w' | '1M'

export interface MarketDataPoint {
    time: number;       // Unix timestamp (seconds)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface IDataProvider {
    getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number): Promise<MarketDataPoint[]>
}
