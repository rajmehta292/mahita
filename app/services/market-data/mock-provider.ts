import { IDataProvider, MarketDataPoint, Timeframe } from './types'

export class MockDataProvider implements IDataProvider {
    async getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number): Promise<MarketDataPoint[]> {
        console.log(`[MockProvider] Fetching data for ${symbol} from ${startTime} to ${endTime}`)

        // Determine step based on timeframe
        let stepMs = 60000 // 1m
        if (timeframe === '3m') stepMs = 180000
        if (timeframe === '5m') stepMs = 300000
        if (timeframe === '10m') stepMs = 600000
        if (timeframe === '15m') stepMs = 900000
        if (timeframe === '30m') stepMs = 1800000
        if (timeframe === '45m') stepMs = 2700000
        if (timeframe === '1h') stepMs = 3600000
        if (timeframe === '2h') stepMs = 7200000
        if (timeframe === '3h') stepMs = 10800000
        if (timeframe === '4h') stepMs = 14400000
        if (timeframe === '1d') stepMs = 86400000
        if (timeframe === '1w') stepMs = 604800000
        if (timeframe === '1M') stepMs = 2592000000 // Approx 30 days

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
