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

                // 1. Initial 1-year historical fetch if entirely missing
                const health = await DataHealthManager.getHealth(sym, tf)
                if (health.count === 0) {
                    const oneYearAgo = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60)
                    const now = Math.floor(Date.now() / 1000)

                    console.log(`[IngestCron] No data found. Bootstrapping ${sym}...`)
                    const fetched = await marketDataStore.getHistoricalData(sym, tf, oneYearAgo, now)
                    results.push({ symbol: sym, timeframe: tf, action: 'bootstrapped', newBars: fetched.length })
                    continue
                }

                // 2. Continuous Sync Gaps if data exists but is fragmented
                if (health.gaps && health.gaps.length > 0) {
                    console.log(`[IngestCron] Healing ${health.gaps.length} gaps for ${sym}...`)
                    const fixReport = await DataHealthManager.syncGaps(sym, tf)
                    results.push({ symbol: sym, timeframe: tf, action: 'healed', ...fixReport })
                } else {
                    // 3. Just catch up to present day
                    const lastBarUnix = Math.floor(health.endIndex!.getTime() / 1000)
                    const now = Math.floor(Date.now() / 1000)

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
