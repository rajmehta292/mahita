
const yahooFinance = require('yahoo-finance2').default;

async function test() {
    try {
        const symbol = 'AAPL';
        const start = '2024-03-01';
        const end = '2024-03-07';

        console.log(`Testing ${symbol} from ${start} to ${end}`);

        const result = await yahooFinance.historical(symbol, {
            period1: start,
            period2: end,
            interval: '1d'
        });

        console.log(`Fetched ${result.length} bars.`);
        result.slice(0, 3).forEach((d, i) => {
            console.log(`Bar ${i}:`, JSON.stringify(d, null, 2));
            console.log(`  Date type: ${typeof d.date}`);
            console.log(`  Date is instance of Date: ${d.date instanceof Date}`);
        });
    } catch (err) {
        console.error('Yahoo test failed:', err);
    }
}

test();
