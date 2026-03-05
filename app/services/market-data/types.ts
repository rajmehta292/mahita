export type Timeframe = '1m' | '5m' | '15m' | '1h' | '1d'

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
