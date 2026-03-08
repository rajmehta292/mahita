import { Timeframe } from '../timeframe-math'

export interface HistoricalBar {
    time: number // Unix timestamp
    open: number
    high: number
    low: number
    close: number
    volume: number
}

export interface ProviderCapability {
    supportsDeepHistory: boolean // Can fetch > 5 years?
    maxIntradayDays: number      // e.g. Yahoo is 730 days for 1h
    rateLimitMs: number          // Delay between requests
    supportedAssetClasses: ('equity' | 'crypto' | 'forex')[]
}

export interface IHistoricalProvider {
    name: string;
    getCapabilities(): ProviderCapability;

    /**
     * Normalizes a Mahita internal symbol to the provider's specific format.
     * e.g. 'AAPL' -> 'AAPL', 'BTC/USD' -> 'BTC-USD'
     */
    normalizeSymbol(symbol: string, assetClass: string): string;

    /**
     * Fetches raw bar data from the upstream provider.
     */
    fetchHistorical(
        symbol: string,
        assetClass: string,
        timeframe: Timeframe,
        startUnix: number,
        endUnix: number
    ): Promise<HistoricalBar[]>;
}
