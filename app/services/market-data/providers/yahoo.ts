import YahooFinance from 'yahoo-finance2'
import { IDataProvider, MarketDataPoint, Timeframe } from '../types'

export class YahooProvider implements IDataProvider {
    private yahoo: any

    constructor() {
        this.yahoo = new (YahooFinance as any)({ suppressNotices: ['ripHistorical'] })
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

        try {
            const rawResult = await this.yahoo.chart(this.normalizeSymbol(symbol), {
                period1: new Date(startTime * 1000),
                period2: new Date(endTime * 1000),
                interval,
                return: 'array'
            })

            const result = Array.isArray(rawResult?.quotes) ? rawResult.quotes : []

            return result
                .map((quote: any) => ({
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
