import { IDataProvider, MarketDataPoint, Timeframe } from '../types';

export class AlphaVantageProvider implements IDataProvider {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.ALPHAVANTAGE_API_KEY || 'demo';
    }

    async getHistoricalData(symbol: string, timeframe: Timeframe, startTime: number, endTime: number): Promise<MarketDataPoint[]> {
        // Basic implementation for AlphaVantage fallback
        // Their free tier API doesn't easily support arbitrary start/end timestamp ranges for intraday without premium pagination.
        // Therefore, we limit AlphaVantage primarily to daily fallbacks for robustness unless premium is needed.

        let functionType = 'TIME_SERIES_DAILY';
        if (timeframe.endsWith('m') || timeframe.endsWith('h')) {
            functionType = 'TIME_SERIES_INTRADAY';
            // Defaulting intraday to 60m because AV is highly restrictive
            // Extensibility note: Implement exact AV interval mapping here if premium key acquired.
        }

        const url = `https://www.alphavantage.co/query?function=${functionType}&symbol=${symbol}&apikey=${this.apiKey}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            // Check for rate limit error
            if (data.Information && data.Information.includes('rate limit')) {
                console.warn(`[AlphaVantageProvider] Rate limited for ${symbol}`);
                return [];
            }

            const timeSeriesKey = Object.keys(data).find(k => k.includes('Time Series'));
            if (!timeSeriesKey || !data[timeSeriesKey]) {
                console.warn(`[AlphaVantageProvider] No data block found for ${symbol}`);
                return [];
            }

            const series = data[timeSeriesKey];
            const points: MarketDataPoint[] = [];

            for (const [dateStr, ohlcv] of Object.entries(series) as any) {
                const time = Math.floor(new Date(dateStr).getTime() / 1000);

                // Only include points within requested range
                if (time >= startTime && time <= endTime) {
                    points.push({
                        time,
                        open: parseFloat(ohlcv['1. open']),
                        high: parseFloat(ohlcv['2. high']),
                        low: parseFloat(ohlcv['3. low']),
                        close: parseFloat(ohlcv['4. close']),
                        volume: parseFloat(ohlcv['5. volume'])
                    });
                }
            }

            // Alpha Vantage returns reverse chronological
            return points.reverse();

        } catch (error) {
            console.warn(`[AlphaVantageProvider] Error fetching data for ${symbol}: ${error}`);
            return [];
        }
    }
}
