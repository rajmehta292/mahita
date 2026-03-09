import { SchwabProvider } from './app/services/market-data/providers/schwab'

async function debugSchwab() {
    console.log('[DEBUG] Starting Schwab Provider Telemetry...')
    const provider = new SchwabProvider()

    // Test a common S&P 500 symbol
    const symbol = 'AAPL'
    const now = Math.floor(Date.now() / 1000)

    // We want the last 30 days
    const THIRTY_DAYS = 30 * 24 * 60 * 60
    const start = now - THIRTY_DAYS

    console.log('\n--- Fetching 1d Timeframe ---')
    try {
        const d_bars = await provider.getHistoricalData(symbol, '1d', start, now)
        console.log(`Yielded ${d_bars.length} daily bars.`)
    } catch (e) {
        console.error('1d exception:', e)
    }

    console.log('\n--- Fetching 1h Timeframe ---')
    try {
        const h_bars = await provider.getHistoricalData(symbol, '1h', start, now)
        console.log(`Yielded ${h_bars.length} hourly bars.`)
    } catch (e) {
        console.error('1h exception:', e)
    }
}

debugSchwab()
