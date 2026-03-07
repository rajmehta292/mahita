import { NextRequest, NextResponse } from 'next/server'
import { GLOBAL_UNIVERSE } from '@/app/services/market-data/universe'
import { marketDataStore } from '@/app/services/market-data/store'
import { DataHealthManager } from '@/app/services/market-data/health'
import { Timeframe } from '@/app/services/market-data/types'

// Prevent concurrent cron execution
let isIngesting = false

export async function POST(request: NextRequest) {
    if (isIngesting) {
        return NextResponse.json({ error: 'Ingestion currently in progress.' }, { status: 429 })
    }

    try {
        isIngesting = true
        const body = await request.json().catch(() => ({}))
        const { symbol, overrideTimeframe } = body

        const timeframes: Timeframe[] = overrideTimeframe ? [overrideTimeframe as Timeframe] : ['1d', '1h']
        const universe = symbol ? [symbol] : GLOBAL_UNIVERSE.slice(0, 10) // Limit to 10 for safety in cron mode

        const results = []

        for (const sym of universe) {
            for (const tf of timeframes) {
                console.log(`[IngestCron] Checking gaps for ${sym} @ ${tf}...`)

                // 1. Initial deep historical fetch if entirely missing
                const health = await DataHealthManager.getHealth(sym, tf)
                const targetStart = DataHealthManager.getTargetHorizon(tf)
                const now = Math.floor(Date.now() / 1000)
                const ONE_YEAR = 31536000

                if (health.count === 0) {
                    console.log(`[IngestCron] No data found for ${sym}. Bootstrapping from ${new Date(targetStart * 1000).toISOString()}...`)
                    let currentStart = targetStart
                    let totalFetched = 0

                    while (currentStart < now) {
                        const currentEnd = Math.min(currentStart + (ONE_YEAR * 2), now) // 2 year chunks to avoid rate limits/OOM
                        try {
                            console.log(`  -> Fetching chunk ${new Date(currentStart * 1000).toISOString()} to ${new Date(currentEnd * 1000).toISOString()}`)
                            const fetched = await marketDataStore.getHistoricalData(sym, tf, currentStart, currentEnd)
                            totalFetched += fetched.length

                            // Prevent infinite loops if provider returns empty for older ranges (e.g. IPO was recent)
                            if (fetched.length === 0 && currentStart < now - (ONE_YEAR * 5)) {
                                console.log(`  -> No data found for deep chunk, assumption: Asset did not exist yet (pre-IPO). Bailing early.`)
                                break;
                            }
                            await new Promise(resolve => setTimeout(resolve, 1500)) // Rate limit delay
                        } catch (e) {
                            console.error(`[IngestCron] Chunk failed for ${sym}:`, e)
                            break;
                        }
                        currentStart = currentEnd
                    }

                    results.push({ symbol: sym, timeframe: tf, action: 'bootstrapped', newBars: totalFetched })
                    continue
                }

                // 2. Pre-pend missing deep historical data if coverage < 100%
                if (health.targetCoveragePercent < 100 && health.startIndex) {
                    const actualStart = Math.floor(health.startIndex.getTime() / 1000)
                    if (actualStart > targetStart + (ONE_YEAR)) { // Only backfill if we're missing more than a year
                        console.log(`[IngestCron] Low coverage (${health.targetCoveragePercent}%). Backfilling deep history for ${sym}...`)

                        let currentStart = targetStart
                        let totalFetched = 0

                        while (currentStart < actualStart) {
                            const currentEnd = Math.min(currentStart + (ONE_YEAR * 2), actualStart)
                            try {
                                const fetched = await marketDataStore.getHistoricalData(sym, tf, currentStart, currentEnd)
                                totalFetched += fetched.length
                                if (fetched.length === 0 && currentStart < actualStart - (ONE_YEAR * 5)) break;
                                await new Promise(resolve => setTimeout(resolve, 1500))
                            } catch (e) {
                                break;
                            }
                            currentStart = currentEnd
                        }
                        results.push({ symbol: sym, timeframe: tf, action: 'historical_backfill', newBars: totalFetched })
                    }
                }

                // 3. Continuous Sync Internal Gaps if data exists but is fragmented
                if (health.gaps && health.gaps.length > 0) {
                    console.log(`[IngestCron] Healing ${health.gaps.length} internal gaps for ${sym}...`)
                    const fixReport = await DataHealthManager.syncGaps(sym, tf)
                    results.push({ symbol: sym, timeframe: tf, action: 'healed', ...fixReport })
                } else {
                    // 4. Just catch up to present day (tail sync)
                    const lastBarUnix = Math.floor(health.endIndex!.getTime() / 1000)

                    if (now - lastBarUnix > DataHealthManager.timeframeToSeconds(tf) * 2) {
                        const fetched = await marketDataStore.getHistoricalData(sym, tf, lastBarUnix, now)
                        results.push({ symbol: sym, timeframe: tf, action: 'caught_up', newBars: fetched.length })
                    }
                }
            }
        }

        // Compute final robust inventory
        await DataHealthManager.refreshInventory()

        return NextResponse.json({
            success: true,
            message: 'Ingestion sweep complete.',
            processed: results.length,
            details: results
        })

    } catch (error: any) {
        console.error('[IngestCron] Error:', error)
        return NextResponse.json({ error: error.message || 'Fatal ingestion error' }, { status: 500 })
    } finally {
        isIngesting = false
    }
}
