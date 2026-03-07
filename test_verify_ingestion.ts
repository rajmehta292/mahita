
import prisma from './app/lib/prisma';
import { MarketDataStore } from './app/services/market-data/store';
import { DataHealthManager } from './app/services/market-data/health';

async function verify() {
    const symbol = 'AAPL';
    const timeframe = '1d';
    const store = new MarketDataStore();

    console.log(`Verifying ${symbol} ${timeframe}...`);

    // Fetch last 10 days
    const end = Math.floor(Date.now() / 1000);
    const start = end - (30 * 24 * 3600); // 30 days back

    console.log(`Triggering ingestion for ${new Date(start * 1000).toISOString()} to ${new Date(end * 1000).toISOString()}`);
    const data = await store.getHistoricalData(symbol, timeframe, start, end);

    console.log(`Store returned ${data.length} bars.`);
    if (data.length > 0) {
        console.log('Sample Data Point:', data[0]);
    }

    // Refresh inventory and check health
    await DataHealthManager.refreshInventory();
    const health = await DataHealthManager.getHealth(symbol, timeframe);
    console.log(`Health Report for ${symbol}:`, JSON.stringify(health, null, 2));

    // Inspect actual DB records
    const dbRecords = await prisma.marketData.findMany({
        where: { symbol, timeframe },
        orderBy: { time: 'desc' },
        take: 5
    });
    console.log('\nTop 5 DB Records:');
    dbRecords.forEach(r => {
        console.log(`  ${r.time.toISOString()}: C:${r.close} S:${r.source}`);
    });
}

verify().catch(console.error).finally(() => prisma.$disconnect());
