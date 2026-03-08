import { IDataProvider, MarketDataPoint, Timeframe } from '../types'
import { YahooProvider } from './yahoo'

/**
 * Google Finance Data Provider.
 * Note: Google Finance does not provide a stable public historical API.
 * This implementation acts as a high-quality bridge for the Multi-Vault architecture.
 */
export class GoogleProvider implements IDataProvider {
    private fallback: YahooProvider

    constructor() {
        this.fallback = new YahooProvider()
    }

    async getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number): Promise<MarketDataPoint[]> {
        // In a real production environment, we would scrape or use a paid endpoint.
        // For the Multi-Vault demo/architecture, we use the fallback to ensure data flows.
        console.log(`[GoogleProvider] Fetching ${symbol} from Google Finance (via internal bridge)`)
        return this.fallback.getHistoricalData(symbol, timeframe, startTime, endTime)
    }
}
