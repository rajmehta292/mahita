import YahooFinance from 'yahoo-finance2';
import { IDataProvider, MarketDataPoint, Timeframe } from '../types';

export class YahooProvider implements IDataProvider {
    private yahoo: any;

    constructor() {
        this.yahoo = new (YahooFinance as any)();
    }

    async getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number): Promise<MarketDataPoint[]> {
        // Map our internal timeframes to Yahoo Finance intervals
        // Yahoo supports: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
        const intervalMap: Record<string, '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo'> = {
            '1m': '1m',
            '5m': '5m',
            '15m': '15m',
            '30m': '30m',
            '1h': '1h',
            '1d': '1d',
            '1w': '1wk',
            '1M': '1mo'
        };

        const interval = intervalMap[timeframe];
        if (!interval) {
            console.warn(`[YahooProvider] Unsupported timeframe: ${timeframe}`);
            return [];
        }

        try {
            const rawResult = await this.yahoo.historical(symbol, {
                period1: new Date(startTime * 1000),
                period2: new Date(endTime * 1000),
                interval
            });
            const result = rawResult as any[];

            return result.map((quote: any) => ({
                time: Math.floor(quote.date.getTime() / 1000),
                open: quote.open,
                high: quote.high,
                low: quote.low,
                close: quote.close,
                volume: quote.volume
            }));
        } catch (error) {
            console.warn(`[YahooProvider] Error fetching data for ${symbol}: ${error}`);
            // Return empty array to signal upstream that we failed and should try next fallback
            return [];
        }
    }
}
