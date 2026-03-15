import { getRuntimeSchwabClient, getRuntimeSchwabClientWithOptions } from '@/app/services/schwab/runtime'
import type { SchwabClient } from '@/app/services/schwab/client'
import { IDataProvider, MarketDataPoint, Timeframe } from '../types'
import { providerTelemetryBus } from '../provider-telemetry'
import { getPlatformCredentialIsolationError } from '@/lib/security/platform-security'

interface SchwabHistoryParams {
    periodType?: 'day' | 'month' | 'year' | 'ytd'
    period?: number
    frequencyType?: 'minute' | 'daily' | 'weekly' | 'monthly'
    frequency?: number
    startDate?: number
    endDate?: number
}

interface SchwabCandle {
    datetime: number
    open: number
    high: number
    low: number
    close: number
    volume?: number
}

interface SchwabPriceHistoryResponse {
    data?: {
        candles?: SchwabCandle[]
    } | null
}

export const SCHWAB_SUPPORTED_MINUTE_PERIODS = [1, 2, 3, 4, 5, 10] as const
export const SCHWAB_MINUTE_CHUNK_SIZE_MS = 5 * 24 * 60 * 60 * 1000
export const SCHWAB_SUPPORTED_YEAR_PERIODS = [1, 2, 3, 5, 10, 15, 20] as const

function isMinuteTimeframe(timeframe: Timeframe) {
    return timeframe === '1m' || timeframe === '5m' || timeframe === '10m' || timeframe === '15m' || timeframe === '30m' || timeframe === '1h'
}

export function getSupportedMinutePeriod(daysDiff: number) {
    if (daysDiff <= 1) return 1
    if (daysDiff <= 2) return 2
    if (daysDiff <= 3) return 3
    if (daysDiff <= 4) return 4
    if (daysDiff <= 5) return 5
    return 10
}

function getSupportedYearPeriod(daysDiff: number) {
    const years = Math.max(1, Math.ceil(daysDiff / 365))
    for (const period of SCHWAB_SUPPORTED_YEAR_PERIODS) {
        if (years <= period) {
            return period
        }
    }

    return SCHWAB_SUPPORTED_YEAR_PERIODS[SCHWAB_SUPPORTED_YEAR_PERIODS.length - 1]
}

function getMinuteFrequency(timeframe: Timeframe) {
    switch (timeframe) {
        case '1m':
            return 1
        case '5m':
            return 5
        case '10m':
            return 10
        case '15m':
            return 15
        case '30m':
        case '1h':
            return 30
        default:
            return 1
    }
}

export function buildSchwabHistoryParams(
    timeframe: Timeframe,
    startTime: number,
    endTime: number,
    mode: 'range' | 'period' = 'range'
): SchwabHistoryParams | null {
    const startDate = startTime * 1000
    const endDate = endTime * 1000
    const daysDiff = Math.max(1, Math.ceil((endTime - startTime) / 86400))

    if (isMinuteTimeframe(timeframe)) {
        const frequency = getMinuteFrequency(timeframe)
        if (mode === 'period') {
            return {
                periodType: 'day',
                period: getSupportedMinutePeriod(daysDiff),
                frequencyType: 'minute',
                frequency,
            }
        }

        return {
            frequencyType: 'minute',
            frequency,
            startDate,
            endDate,
        }
    }

    switch (timeframe) {
        case '1d':
            return mode === 'period'
                ? { periodType: 'year', period: getSupportedYearPeriod(daysDiff), frequencyType: 'daily', frequency: 1 }
                : { periodType: 'year', frequencyType: 'daily', frequency: 1, startDate, endDate }
        case '1w':
            return mode === 'period'
                ? { periodType: 'year', period: getSupportedYearPeriod(daysDiff), frequencyType: 'weekly', frequency: 1 }
                : { periodType: 'year', frequencyType: 'weekly', frequency: 1, startDate, endDate }
        case '1M':
            return mode === 'period'
                ? { periodType: 'year', period: getSupportedYearPeriod(daysDiff), frequencyType: 'monthly', frequency: 1 }
                : { periodType: 'year', frequencyType: 'monthly', frequency: 1, startDate, endDate }
        default:
            console.warn(`[SchwabProvider] Unsupported timeframe: ${timeframe}. Defaulting to daily fallback.`)
            return mode === 'period'
                ? { periodType: 'year', period: getSupportedYearPeriod(daysDiff), frequencyType: 'daily', frequency: 1 }
                : { periodType: 'year', frequencyType: 'daily', frequency: 1, startDate, endDate }
    }
}

export class SchwabProvider implements IDataProvider {
    private buildParams(timeframe: Timeframe, startTime: number, endTime: number): SchwabHistoryParams | null {
        return buildSchwabHistoryParams(timeframe, startTime, endTime, "range")
    }

    private buildFallbackMinuteParams(timeframe: Timeframe, startTime: number, endTime: number): SchwabHistoryParams | null {
        return buildSchwabHistoryParams(timeframe, startTime, endTime, "period")
    }

    private buildFallbackRangeParams(timeframe: Timeframe, startTime: number, endTime: number): SchwabHistoryParams | null {
        return buildSchwabHistoryParams(timeframe, startTime, endTime, "period")
    }

    private supportsSymbol(symbol: string): boolean {
        return !symbol.includes('=') && !symbol.includes('-USD')
    }

    async getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number, options?: { providerClient?: SchwabClient }): Promise<MarketDataPoint[]> {
        if (!this.supportsSymbol(symbol)) {
            return []
        }

        const params = this.buildParams(timeframe, startTime, endTime)
        if (!params) {
            return []
        }

        try {
            let allCandles: SchwabCandle[] = []

            await providerTelemetryBus.log({
                kind: "control",
                provider: "schwab",
                symbol,
                timeframe,
                rangeStart: startTime,
                rangeEnd: endTime,
                message: "Prepared Schwab history request.",
                request: {
                    params,
                },
            })

            // Chunk minute data with explicit date windows so historical 1m coverage can be backfilled and verified.
            if (params.frequencyType === 'minute' && params.startDate && params.endDate) {
                let currentStart = params.startDate
                const finalEnd = params.endDate

                while (currentStart < finalEnd) {
                    const currentEnd = Math.min(currentStart + SCHWAB_MINUTE_CHUNK_SIZE_MS, finalEnd)
                    const chunkParams = { ...params, startDate: currentStart, endDate: currentEnd }
                    try {
                        const response = await this.fetchPriceHistoryWithRetry(symbol, chunkParams, options?.providerClient)
                        const candles = Array.isArray(response.data?.candles) ? response.data.candles : []
                        allCandles = allCandles.concat(candles)
                    } catch (error) {
                        const fallbackParams = this.buildFallbackMinuteParams(
                            timeframe,
                            Math.floor(currentStart / 1000),
                            Math.floor(currentEnd / 1000)
                        )

                        const shouldTryFallback =
                            fallbackParams &&
                            error instanceof Error &&
                            error.message.includes("400") &&
                            currentEnd === finalEnd &&
                            Math.ceil((currentEnd - currentStart) / 86400000) <= 10

                        if (!shouldTryFallback) {
                            throw error
                        }

                        await providerTelemetryBus.log({
                            kind: "control",
                            provider: "schwab",
                            symbol,
                            timeframe,
                            rangeStart: Math.floor(currentStart / 1000),
                            rangeEnd: Math.floor(currentEnd / 1000),
                            message: "Minute range request failed; retrying with period-based Schwab fallback.",
                            request: {
                                primary: chunkParams,
                                fallback: fallbackParams,
                            },
                        })

                        const response = await this.fetchPriceHistoryWithRetry(symbol, fallbackParams, options?.providerClient)
                        const candles = Array.isArray(response.data?.candles) ? response.data.candles : []
                        allCandles = allCandles.concat(candles)
                    }

                    currentStart = currentEnd + 1
                    if (currentStart < finalEnd) {
                        await new Promise(r => setTimeout(r, 200)) // light throttle between chunks
                    }
                }
            } else {
                try {
                    const response = await this.fetchPriceHistoryWithRetry(symbol, params, options?.providerClient)
                    allCandles = Array.isArray(response.data?.candles) ? response.data.candles : []
                } catch (error) {
                    const fallbackParams = this.buildFallbackRangeParams(timeframe, startTime, endTime)
                    const shouldTryFallback =
                        fallbackParams &&
                        error instanceof Error &&
                        error.message.includes("400")

                    if (!shouldTryFallback) {
                        throw error
                    }

                    await providerTelemetryBus.log({
                        kind: "control",
                        provider: "schwab",
                        symbol,
                        timeframe,
                        rangeStart: startTime,
                        rangeEnd: endTime,
                        message: "Schwab range request failed; retrying with period-based fallback.",
                        request: {
                            primary: params,
                            fallback: fallbackParams,
                        },
                    })

                    const response = await this.fetchPriceHistoryWithRetry(symbol, fallbackParams, options?.providerClient)
                    allCandles = Array.isArray(response.data?.candles) ? response.data.candles : []
                }
            }

            return allCandles
                .map((candle) => ({
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

    private async fetchPriceHistoryWithRetry(symbol: string, params: SchwabHistoryParams, providerClient?: SchwabClient): Promise<SchwabPriceHistoryResponse> {
        let client = providerClient || await getRuntimeSchwabClient()
        if (!client) {
            throw new Error(getPlatformCredentialIsolationError())
        }

        try {
            return await client.getPriceHistory(symbol, params) as SchwabPriceHistoryResponse
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

            return await client.getPriceHistory(symbol, params) as SchwabPriceHistoryResponse
        }
    }
}
