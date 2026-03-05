import { IDataProvider, MarketDataPoint, Timeframe } from './types'

export class MockDataProvider implements IDataProvider {
    async getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number): Promise<MarketDataPoint[]> {
        console.log(`[MockProvider] Fetching data for ${symbol} from ${startTime} to ${endTime}`)

        // Determine step based on timeframe
        let stepMs = 60000 // 1m
        if (timeframe === '5m') stepMs = 300000
        if (timeframe === '15m') stepMs = 900000
        if (timeframe === '1h') stepMs = 3600000
        if (timeframe === '1d') stepMs = 86400000

        const data: MarketDataPoint[] = []
        let currentPrice = 150.0 // Starting dummy price
        let currentTimeMs = startTime * 1000
        const endTimeMs = endTime * 1000

        while (currentTimeMs <= endTimeMs) {
            const volatility = currentPrice * 0.002
            const open = currentPrice
            const high = open + Math.random() * volatility
            const low = open - Math.random() * volatility
            const close = low + Math.random() * (high - low)

            data.push({
                time: Math.floor(currentTimeMs / 1000),
                open,
                high,
                low,
                close,
                volume: Math.floor(Math.random() * 10000)
            })

            currentPrice = close
            currentTimeMs += stepMs
        }

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500))

        return data
    }
}
