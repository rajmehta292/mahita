import prisma from '../lib/prisma'
import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance()

const DOW_30 = [
    'AAPL', 'AMGN', 'AXP', 'BA', 'CAT', 'CRM', 'CVX', 'DIS', 'DOW', 'GS',
    'HD', 'HON', 'IBM', 'INTC', 'JNJ', 'JPM', 'KO', 'MCD', 'MMM', 'MRK',
    'MSFT', 'NKE', 'PG', 'TRV', 'UNH', 'V', 'VZ', 'WBA', 'WMT'
].filter((v, i, a) => a.indexOf(v) === i);

async function seedSymbol(symbol: string) {
    console.log(`Fetching data for ${symbol}...`)
    try {
        const today = new Date()
        const queryOptions = {
            period1: '2020-01-01',
            period2: today.toISOString().split('T')[0],
            interval: '1d' as any
        };
        const results = await yahooFinance.historical(symbol, queryOptions);

        console.log(`Received ${results.length} rows for ${symbol}. Upserting to database...`)

        const dataToInsert = results.map(row => ({
            symbol,
            timeframe: '1d',
            time: new Date(row.date),
            open: row.open,
            high: row.high,
            low: row.low,
            close: row.close,
            volume: row.volume || 0,
        }))

        for (const chunk of chunkArray(dataToInsert, 100)) {
            await Promise.all(chunk.map(item =>
                prisma.marketData.upsert({
                    where: {
                        symbol_timeframe_time: {
                            symbol: item.symbol,
                            timeframe: item.timeframe,
                            time: item.time
                        }
                    },
                    update: item,
                    create: item
                })
            ))
        }

        console.log(`Successfully synced ${symbol}`)
        // Throttling to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
        console.error(`Error syncing ${symbol}:`, error)
    }
}

function chunkArray<T>(array: T[], size: number): T[][] {
    const result = []
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size))
    }
    return result
}

async function main() {
    console.log('Starting Dow 30 Data Sync...')
    for (const symbol of DOW_30) {
        await seedSymbol(symbol)
    }
    console.log('Finished Dow 30 Data Sync.')
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
