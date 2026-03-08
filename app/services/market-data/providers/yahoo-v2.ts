import YahooFinance from 'yahoo-finance2'
import { IHistoricalProvider, ProviderCapability, HistoricalBar } from './registry'
import { Timeframe } from '../timeframe-math'

const yahooFinance = new (YahooFinance as any)();

export class YahooV2Provider implements IHistoricalProvider {
    name = 'yahoo'

    getCapabilities(): ProviderCapability {
        return {
            supportsDeepHistory: true,
            maxIntradayDays: 730,
            rateLimitMs: 1500,
            supportedAssetClasses: ['equity', 'crypto', 'forex']
        }
    }

    normalizeSymbol(symbol: string, assetClass: string): string {
        if (assetClass === 'crypto') return `${symbol}-USD`
        if (assetClass === 'forex') return `${symbol}=X`
        if (symbol === 'BRK.B') return 'BRK-B'
        return symbol.toUpperCase()
    }

    async fetchHistorical(symbol: string, assetClass: string, timeframe: Timeframe, startUnix: number, endUnix: number): Promise<HistoricalBar[]> {
        const intervalMap: Record<string, '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo'> = {
            '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h', '1d': '1d', '1w': '1wk', '1M': '1mo'
        }

        const interval = intervalMap[timeframe]
        if (!interval) return []

        const normSymbol = this.normalizeSymbol(symbol, assetClass)

        try {
            const rawResult = await yahooFinance.historical(normSymbol, {
                period1: startUnix,
                period2: endUnix,
                interval
            })

            const result = rawResult as any[]

            return result.map(quote => ({
                time: Math.floor(quote.date.getTime() / 1000),
                open: quote.open || 0,
                high: quote.high || 0,
                low: quote.low || 0,
                close: quote.close || 0,
                volume: quote.volume || 0
            }))
        } catch (error: any) {
            console.warn(`[YahooV2Provider] Error fetching ${normSymbol}: ${error.message}`)
            return []
        }
    }
}
