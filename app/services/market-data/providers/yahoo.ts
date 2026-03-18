import YahooFinance from 'yahoo-finance2'
import { IDataProvider, MarketDataPoint, Timeframe } from '../types'

interface YahooChartQuote {
    date: Date
    open?: number | null
    high?: number | null
    low?: number | null
    close?: number | null
    volume?: number | null
}

interface YahooChartResponse {
    quotes?: YahooChartQuote[]
}

const YahooFinanceClient = YahooFinance as unknown as {
    new (options: { suppressNotices: string[] }): {
        chart(symbol: string, options: {
            period1: Date
            period2: Date
            interval: '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo'
            return: 'array'
        }): Promise<YahooChartResponse>
    }
}

export class YahooProvider implements IDataProvider {
    private yahoo: InstanceType<typeof YahooFinanceClient>

    constructor() {
        this.yahoo = new YahooFinanceClient({ suppressNotices: ['ripHistorical'] })
    }

    private normalizeSymbol(symbol: string): string {
        if (symbol === 'BRK.B') {
            return 'BRK-B'
        }

        return symbol.toUpperCase()
    }

    async getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number): Promise<MarketDataPoint[]> {
        const intervalMap: Record<string, '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo'> = {
            '1m': '1m',
            '5m': '5m',
            '15m': '15m',
            '30m': '30m',
            '1h': '1h',
            '1d': '1d',
            '1w': '1wk',
            '1M': '1mo'
        }

        const interval = intervalMap[timeframe]
        if (!interval) {
            console.warn(`[YahooProvider] Unsupported timeframe: ${timeframe}`)
            return []
        }

        const period1 = new Date(startTime * 1000)
        const safeEndTime = endTime <= startTime ? startTime + 1 : endTime
        const period2 = new Date(safeEndTime * 1000)

        try {
            const rawResult = await this.yahoo.chart(this.normalizeSymbol(symbol), {
                period1,
                period2,
                interval,
                return: 'array'
            })

            const result = Array.isArray(rawResult?.quotes) ? rawResult.quotes : []

            return result
                .map((quote) => ({
                    time: Math.floor(quote.date.getTime() / 1000),
                    open: Number(quote.open || 0),
                    high: Number(quote.high || 0),
                    low: Number(quote.low || 0),
                    close: Number(quote.close || 0),
                    volume: Number(quote.volume || 0)
                }) as MarketDataPoint)
                .filter((point: MarketDataPoint) => point.time >= startTime && point.time <= endTime)
        } catch (error) {
            console.warn(`[YahooProvider] Error fetching data for ${symbol}: ${error}`)
            return []
        }
    }
}
