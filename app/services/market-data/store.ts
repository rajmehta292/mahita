import prisma from '@/lib/prisma'
import { IDataProvider, MarketDataPoint, Timeframe } from './types'
import { MockDataProvider } from './mock-provider'

export class MarketDataStore {
    private provider: IDataProvider

    constructor(provider: IDataProvider = new MockDataProvider()) {
        this.provider = provider
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

        // For the MVP, if we have ANY data in that range, we'll return it (imperfect caching logic for brevity, 
        // a real implementation would find exact gaps and only fetch those).
        if (cachedData.length > 0) {
            // Return mapped cached data
            return cachedData.map(c => ({
                time: Math.floor(c.time.getTime() / 1000),
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volume: c.volume
            }))
        }

        // 2. Data missing, fetch from provider
        const fetchedData = await this.provider.getHistoricalData(symbol, timeframe, startTime, endTime)

        // 3. Cache to DB
        if (fetchedData.length > 0) {
            // Use createMany to bulk insert
            await prisma.marketData.createMany({
                data: fetchedData.map(d => ({
                    symbol,
                    timeframe,
                    time: new Date(d.time * 1000),
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                    volume: d.volume
                })),
                skipDuplicates: true // Important to avoid unique constraint errors
            })
        }

        return fetchedData
    }
}

// Export singleton instance
export const marketDataStore = new MarketDataStore()
