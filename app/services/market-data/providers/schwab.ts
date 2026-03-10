import { getRuntimeSchwabClient, getRuntimeSchwabClientWithOptions } from '@/app/services/schwab/runtime'
import { IDataProvider, MarketDataPoint, Timeframe } from '../types'
import { providerTelemetryBus } from '../provider-telemetry'

interface SchwabHistoryParams {
    periodType?: 'day' | 'month' | 'year' | 'ytd'
    period?: number
    frequencyType?: 'minute' | 'daily' | 'weekly' | 'monthly'
    frequency?: number
    startDate?: number
    endDate?: number
}

export class SchwabProvider implements IDataProvider {
    private buildParams(timeframe: Timeframe, startTime: number, endTime: number): SchwabHistoryParams | null {
        const startDate = startTime * 1000
        const endDate = endTime * 1000

        // Schwab requires 'period' instead of 'startDate'/'endDate' for minute frequencies
        // Calculate days between start and end (min 1, max 10 for minute grids)
        const daysDiff = Math.max(1, Math.ceil((endTime - startTime) / 86400))
        const minutePeriod = Math.min(10, daysDiff)

        switch (timeframe) {
            case '1m':
                return { periodType: 'day', period: minutePeriod, frequencyType: 'minute', frequency: 1 }
            case '5m':
                return { periodType: 'day', period: minutePeriod, frequencyType: 'minute', frequency: 5 }
            case '10m':
                return { periodType: 'day', period: minutePeriod, frequencyType: 'minute', frequency: 10 }
            case '15m':
                return { periodType: 'day', period: minutePeriod, frequencyType: 'minute', frequency: 15 }
            case '30m':
                return { periodType: 'day', period: minutePeriod, frequencyType: 'minute', frequency: 30 }
            case '1h':
                // Schwab doesn't have an explicit 'hour' frequencyType, and rejects 60m frequency.
                // We request 30m candles using 'day' period, and let our DB aggregate them into 1h intervals.
                return { periodType: 'day', period: minutePeriod, frequencyType: 'minute', frequency: 30 }
            case '1d':
                return { periodType: 'year', frequencyType: 'daily', frequency: 1, startDate, endDate }
            case '1w':
                return { periodType: 'year', frequencyType: 'weekly', frequency: 1, startDate, endDate }
            case '1M':
                return { periodType: 'year', frequencyType: 'monthly', frequency: 1, startDate, endDate }
            default:
                console.warn(`[SchwabProvider] Unsupported timeframe: ${timeframe}. Defaulting to daily fallback.`)
                return { periodType: 'year', frequencyType: 'daily', frequency: 1, startDate, endDate }
        }
    }

    private supportsSymbol(symbol: string): boolean {
        return !symbol.includes('=') && !symbol.includes('-USD')
    }

    async getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number, options?: { providerClient?: any }): Promise<MarketDataPoint[]> {
        if (!this.supportsSymbol(symbol)) {
            return []
        }

        const params = this.buildParams(timeframe, startTime, endTime)
        if (!params) {
            return []
        }

        try {
            let allCandles: any[] = []

            // Chunking logic for minute data (Schwab caps this strictly to 10 days per request)
            if (params.frequencyType === 'minute' && params.startDate && params.endDate) {
                const CHUNK_SIZE_MS = 5 * 24 * 60 * 60 * 1000 // Safely pull 5 days at a time to prevent 400 Bad Request boundaries
                let currentStart = params.startDate
                const finalEnd = params.endDate

                while (currentStart < finalEnd) {
                    const currentEnd = Math.min(currentStart + CHUNK_SIZE_MS, finalEnd)
                    const chunkParams = { ...params, startDate: currentStart, endDate: currentEnd }

                    const response = await this.fetchPriceHistoryWithRetry(symbol, chunkParams, options?.providerClient)
                    const candles = Array.isArray(response.data?.candles) ? response.data.candles : []
                    allCandles = allCandles.concat(candles)

                    currentStart = currentEnd + 1
                    if (currentStart < finalEnd) {
                        await new Promise(r => setTimeout(r, 200)) // light throttle between chunks
                    }
                }
            } else {
                const response = await this.fetchPriceHistoryWithRetry(symbol, params, options?.providerClient)
                allCandles = Array.isArray(response.data?.candles) ? response.data.candles : []
            }

            return allCandles
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
            const msg = error instanceof Error ? error.message : 'Unknown error'
            console.warn(`[SchwabProvider] Error fetching data for ${symbol}: ${msg}`)
            providerTelemetryBus.log({
                kind: 'error',
                message: `Schwab rejected history request: ${msg}`,
                provider: 'schwab',
                symbol,
                timeframe,
                response: { error: msg }
            })
            // Throw so the engine knows it failed instead of returning [] and looking complete
            throw error
        }
    }

    private async fetchPriceHistoryWithRetry(symbol: string, params: SchwabHistoryParams, providerClient?: any) {
        let client = providerClient || await getRuntimeSchwabClient()
        if (!client) {
            throw new Error('No Schwab client available (checked pool and runtime fallback)')
        }

        try {
            return await client.getPriceHistory(symbol, params)
        } catch (error) {
            const message = error instanceof Error ? error.message : ''

            // Handle Schwab Rate Limits - Push state upstream to Job Queue instead of thread sleep
            if (message.includes('429')) {
                throw new Error(`RATE_LIMITED: ${message}`)
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
