import { getRuntimeSchwabClient, getRuntimeSchwabClientWithOptions } from '@/app/services/schwab/runtime'
import { IDataProvider, MarketDataPoint, Timeframe } from '../types'

interface SchwabHistoryParams {
    periodType: 'day' | 'month' | 'year'
    frequencyType: 'minute' | 'daily' | 'weekly' | 'monthly'
    frequency: number
    startDate: number
    endDate: number
}

export class SchwabProvider implements IDataProvider {
    private buildParams(timeframe: Timeframe, startTime: number, endTime: number): SchwabHistoryParams | null {
        const startDate = startTime * 1000
        const endDate = endTime * 1000

        switch (timeframe) {
            case '1m':
                return { periodType: 'day', frequencyType: 'minute', frequency: 1, startDate, endDate }
            case '5m':
                return { periodType: 'day', frequencyType: 'minute', frequency: 5, startDate, endDate }
            case '10m':
                return { periodType: 'day', frequencyType: 'minute', frequency: 10, startDate, endDate }
            case '15m':
                return { periodType: 'day', frequencyType: 'minute', frequency: 15, startDate, endDate }
            case '30m':
                return { periodType: 'day', frequencyType: 'minute', frequency: 30, startDate, endDate }
            case '1d':
                return { periodType: 'year', frequencyType: 'daily', frequency: 1, startDate, endDate }
            case '1w':
                return { periodType: 'year', frequencyType: 'weekly', frequency: 1, startDate, endDate }
            case '1M':
                return { periodType: 'year', frequencyType: 'monthly', frequency: 1, startDate, endDate }
            default:
                return null
        }
    }

    private supportsSymbol(symbol: string): boolean {
        return !symbol.includes('=') && !symbol.includes('-USD')
    }

    async getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number): Promise<MarketDataPoint[]> {
        if (!this.supportsSymbol(symbol)) {
            return []
        }

        const params = this.buildParams(timeframe, startTime, endTime)
        if (!params) {
            return []
        }

        try {
            const response = await this.fetchPriceHistoryWithRetry(symbol, params)
            const candles = Array.isArray(response.data?.candles) ? response.data.candles : []

            return candles
                .map((candle: any) => ({
                    time: Math.floor(Number(candle.datetime) / 1000),
                    open: Number(candle.open),
                    high: Number(candle.high),
                    low: Number(candle.low),
                    close: Number(candle.close),
                    volume: Number(candle.volume || 0)
                }) as MarketDataPoint)
                .filter((point: MarketDataPoint) => point.time >= startTime && point.time <= endTime)
        } catch (error) {
            console.warn(`[SchwabProvider] Error fetching data for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            return []
        }
    }

    private async fetchPriceHistoryWithRetry(symbol: string, params: SchwabHistoryParams) {
        let client = await getRuntimeSchwabClient()
        if (!client) {
            throw new Error('No Schwab runtime client configured')
        }

        try {
            return await client.getPriceHistory(symbol, params)
        } catch (error) {
            const message = error instanceof Error ? error.message : ''

            // Handle Schwab Rate Limits
            if (message.includes('429')) {
                console.warn(`[SchwabProvider] Rate limit hit for ${symbol}. Sleeping 60s...`)
                await new Promise(resolve => setTimeout(resolve, 60000))
                return await client.getPriceHistory(symbol, params)
            }

            if (!message.includes('401')) {
                throw error
            }

            client = await getRuntimeSchwabClientWithOptions({ forceRefresh: true })
            if (!client) {
                throw error
            }

            return await client.getPriceHistory(symbol, params)
        }
    }
}
