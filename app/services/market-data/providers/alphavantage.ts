import { IDataProvider, MarketDataPoint, Timeframe } from '../types'

interface AlphaVantageSeriesRow {
    [key: string]: string
}

interface AlphaVantageResponse {
    Information?: string
    Note?: string
    [key: string]: unknown
}

const INTRADAY_INTERVALS: Partial<Record<Timeframe, '1min' | '5min' | '15min' | '30min' | '60min'>> = {
    '1m': '1min',
    '5m': '5min',
    '15m': '15min',
    '30m': '30min',
    '1h': '60min'
}

function toQueryString(params: Record<string, string>) {
    return new URLSearchParams(params).toString()
}

function isForexSymbol(symbol: string) {
    return symbol.endsWith('=X') && symbol.length >= 7
}

function parseForexPair(symbol: string) {
    const normalized = symbol.replace('=X', '')
    return {
        fromSymbol: normalized.slice(0, 3),
        toSymbol: normalized.slice(3, 6)
    }
}

export class AlphaVantageProvider implements IDataProvider {
    private apiKey: string

    constructor() {
        this.apiKey = process.env.ALPHAVANTAGE_API_KEY || 'demo'
    }

    async getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number): Promise<MarketDataPoint[]> {
        try {
            const data = await this.fetchSeries(symbol, timeframe)
            if (!data) {
                return []
            }

            const timeSeriesKey = Object.keys(data).find((key) => key.includes('Time Series'))
            const series = timeSeriesKey ? data[timeSeriesKey] : null
            if (!timeSeriesKey || !series || typeof series !== 'object') {
                console.warn(`[AlphaVantageProvider] No data block found for ${symbol}`)
                return []
            }

            const points: MarketDataPoint[] = []

            for (const [dateStr, ohlcv] of Object.entries(series as Record<string, AlphaVantageSeriesRow>)) {
                const time = Math.floor(new Date(dateStr).getTime() / 1000)
                if (time < startTime || time > endTime) {
                    continue
                }

                points.push({
                    time,
                    open: parseFloat(ohlcv['1. open']),
                    high: parseFloat(ohlcv['2. high']),
                    low: parseFloat(ohlcv['3. low']),
                    close: parseFloat(ohlcv['4. close']),
                    volume: parseFloat(ohlcv['5. volume'] || ohlcv['6. volume'] || '0')
                })
            }

            return points.reverse()
        } catch (error) {
            console.warn(`[AlphaVantageProvider] Error fetching data for ${symbol}: ${error}`)
            return []
        }
    }

    private async fetchSeries(symbol: string, timeframe: Timeframe): Promise<AlphaVantageResponse | null> {
        const isForex = isForexSymbol(symbol)
        const intradayInterval = INTRADAY_INTERVALS[timeframe]
        let url: string | null = null

        if (isForex) {
            const { fromSymbol, toSymbol } = parseForexPair(symbol)

            if (intradayInterval) {
                url = `https://www.alphavantage.co/query?${toQueryString({
                    function: 'FX_INTRADAY',
                    from_symbol: fromSymbol,
                    to_symbol: toSymbol,
                    interval: intradayInterval,
                    outputsize: 'full',
                    apikey: this.apiKey
                })}`
            } else if (timeframe === '1d') {
                url = `https://www.alphavantage.co/query?${toQueryString({
                    function: 'FX_DAILY',
                    from_symbol: fromSymbol,
                    to_symbol: toSymbol,
                    outputsize: 'full',
                    apikey: this.apiKey
                })}`
            }
        } else if (intradayInterval) {
            url = `https://www.alphavantage.co/query?${toQueryString({
                function: 'TIME_SERIES_INTRADAY',
                symbol,
                interval: intradayInterval,
                outputsize: 'full',
                apikey: this.apiKey
            })}`
        } else if (timeframe === '1d') {
            url = `https://www.alphavantage.co/query?${toQueryString({
                function: 'TIME_SERIES_DAILY_ADJUSTED',
                symbol,
                outputsize: 'full',
                apikey: this.apiKey
            })}`
        }

        if (!url) {
            console.warn(`[AlphaVantageProvider] Unsupported symbol/timeframe: ${symbol} ${timeframe}`)
            return null
        }

        const response = await fetch(url)
        const data = await response.json() as AlphaVantageResponse

        if (data.Information && `${data.Information}`.toLowerCase().includes('rate limit')) {
            console.warn(`[AlphaVantageProvider] Rate limited for ${symbol}`)
            return null
        }

        if (data.Note) {
            console.warn(`[AlphaVantageProvider] API note for ${symbol}: ${data.Note}`)
            return null
        }

        return data
    }
}
