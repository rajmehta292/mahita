import prisma from '@/lib/prisma'
import { IDataProvider, MarketDataPoint, Timeframe } from './types'
import { YahooProvider } from './providers/yahoo'
import { AlphaVantageProvider } from './providers/alphavantage'
import { MockDataProvider } from './mock-provider'

export class MarketDataStore {
    private providers: IDataProvider[]

    constructor() {
        // Fallback chain: Yahoo (Fast/Robust) -> AlphaVantage (Rate-limited but precise) -> Mock (if requested)
        this.providers = [
            new YahooProvider(),
            new AlphaVantageProvider()
        ]

        if (process.env.USE_MOCK_DATA === 'true') {
            this.providers.push(new MockDataProvider())
        }
    }

    async getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number): Promise<MarketDataPoint[]> {
        // 1. Check local DB for existing data
        const cachedData = await prisma.marketData.findMany({
            where: {
                symbol,
                timeframe,
                time: {
                    gte: new Date(startTime * 1000),
                    lte: new Date(endTime * 1000)
                }
            },
            orderBy: { time: 'asc' }
        })

        // Simple MVP cache logic
        if (cachedData.length > 0) {
            return cachedData.map(c => ({
                time: Math.floor(c.time.getTime() / 1000),
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume
            }))
        }

        // 2. Data missing, trigger fallback chain
        let fetchedData: MarketDataPoint[] = []
        let successfulProviderIndex = -1;

        for (let i = 0; i < this.providers.length; i++) {
            try {
                fetchedData = await this.providers[i].getHistoricalData(symbol, timeframe, startTime, endTime)
                if (fetchedData && fetchedData.length > 0) {
                    successfulProviderIndex = i;
                    break; // Successfully got data, stop trying fallbacks
                }
            } catch (err) {
                console.warn(`[MarketDataStore] Provider ${i} failed for ${symbol}:`, err)
            }
            console.log(`[MarketDataStore] Falling back to provider ${i + 1} for ${symbol}...`)
        }

        // 3. Cache to DB
        if (fetchedData.length > 0) {

            const providerName = successfulProviderIndex === 0 ? 'yahoo' :
                successfulProviderIndex === 1 ? 'alphavantage' : 'mock';

            try {
                await (prisma.marketData as any).createMany({
                    data: fetchedData.map(d => ({
                        symbol,
                        timeframe,
                        time: new Date(d.time * 1000),
                        open: d.open,
                        high: d.high,
                        low: d.low,
                        close: d.close,
                        volume: d.volume,
                        source: providerName
                    })),
                    skipDuplicates: true
                })
            } catch (dbErr) {
                console.error(`[MarketDataStore] Error persisting gap data to DB:`, dbErr)
            }
        }

        return fetchedData
    }
}

// Export singleton instance
export const marketDataStore = new MarketDataStore()
