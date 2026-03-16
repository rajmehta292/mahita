import { YahooProvider } from '../../app/services/market-data/providers/yahoo';
import { marketDataStore } from '../../app/services/market-data/store';

async function test() {
    try {
        const symbol = 'AAPL';
        const timeframe = '1d';
        // Last week
        const end = Math.floor(Date.now() / 1000);
        const start = end - (10 * 24 * 3600); // 10 days

        console.log(`Testing ${symbol} ${timeframe} from ${new Date(start * 1000).toISOString()} to ${new Date(end * 1000).toISOString()}`);

        const provider = new YahooProvider();
        const data = await provider.getHistoricalData(symbol, timeframe, start, end);

        console.log(`Fetched ${data.length} bars from Yahoo:`);
        data.forEach((d) => {
            console.log(`  ${new Date(d.time * 1000).toISOString()}: O:${d.open} H:${d.high} L:${d.low} C:${d.close}`);
        });

        // Test store fetching (which caches)
        console.log('\nTesting Store fetching (should cache if missing):');
        const storeData = await marketDataStore.getHistoricalData(symbol, timeframe, start, end);
        console.log(`Store returned ${storeData.length} bars.`);
    } catch (err) {
        console.error('Error in test script:', err);
    }
}

test().catch(console.error);
