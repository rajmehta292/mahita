import fs from 'fs'
import path from 'path'
import { ParquetStorageService } from '../app/services/market-data/parquet-store'
import { YahooV2Provider } from '../app/services/market-data/providers/yahoo-v2'
import { timeframeToSeconds, Timeframe } from '../app/services/market-data/timeframe-math'

const parquetStore = new ParquetStorageService()
const yahoo = new YahooV2Provider()

// In MVP, we just boot the daemon to prove it runs independently of Next.js and can write Parquet manually.
async function runWorkerDaemon() {
    console.log(`[Worker] Starting Mahita V2 Data Daemon at ${new Date().toISOString()}`)

    // Simulate picking up a job for AAPL on the 1d timeframe for the last 5 years
    const symbol = 'AAPL'
    const assetClass = 'equity'
    const timeframe: Timeframe = '1d'

    const endUnix = Math.floor(Date.now() / 1000)
    const startUnix = endUnix - (5 * 365 * 86400) // 5 Years ago

    console.log(`[Worker] Picked up job: Fetch ${symbol} ${timeframe} from ${new Date(startUnix * 1000).toISOString()} to ${new Date(endUnix * 1000).toISOString()}`)

    try {
        const rawBars = await yahoo.fetchHistorical(symbol, assetClass, timeframe, startUnix, endUnix)
        console.log(`[Worker] Fetched ${rawBars.length} raw bars from Yahoo.`)

        if (rawBars.length === 0) {
            console.log('[Worker] No data returned. Aborting job.')
            return
        }

        // Group by Date for Parquet Partitioning
        const partitionMap = new Map<string, typeof rawBars>()

        for (const bar of rawBars) {
            // Truncate bar time to midnight UTC for the partition Date
            const date = new Date(bar.time * 1000)
            const partitionDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
            const partitionKey = partitionDate.toISOString()

            if (!partitionMap.has(partitionKey)) {
                partitionMap.set(partitionKey, [])
            }
            partitionMap.get(partitionKey)!.push(bar)
        }

        console.log(`[Worker] Grouped ${rawBars.length} bars into ${partitionMap.size} daily partitions.`)

        // Write the partitions to the Data Lake
        let writtenBars = 0
        for (const [dateStr, bars] of Array.from(partitionMap.entries())) {
            const partitionDate = new Date(dateStr)
            const filePath = parquetStore.getPartitionPath(assetClass, symbol, timeframe, partitionDate)

            await parquetStore.writePartition(filePath, bars)
            writtenBars += bars.length
        }

        console.log(`[Worker] Successfully wrote ${writtenBars} bars to the Parquet Data Lake.`)
        console.log(`[Worker] Job Complete! Sleeping...`)

    } catch (error: unknown) {
        console.error(`[Worker] Fatal Job Error:`, error)
    }
}

// Start the daemon loop (running once for the POC)
runWorkerDaemon().catch(console.error)
