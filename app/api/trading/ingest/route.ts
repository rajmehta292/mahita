import { NextRequest, NextResponse } from 'next/server'
import { GLOBAL_UNIVERSE } from '@/app/services/market-data/universe'
import { marketDataStore } from '@/app/services/market-data/store'
import { DataHealthManager } from '@/app/services/market-data/health'
import { Timeframe } from '@/app/services/market-data/types'

// Prevent concurrent global ingestion (but allow individual syncs to queue or run if small)
let isIngesting = false

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}))
    const { symbol, overrideTimeframe, provider } = body

    const isGlobal = !symbol;

    if (isIngesting && isGlobal) {
        return NextResponse.json({ error: 'Global ingestion currently in progress.' }, { status: 429 })
    }

    const timeframes: Timeframe[] = overrideTimeframe ? [overrideTimeframe as Timeframe] : ['1d', '1h']
    const universe = symbol ? [symbol] : GLOBAL_UNIVERSE.slice(0, 10) // Limit to 10 for safety in cron mode

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (type: 'log' | 'result' | 'error', data: any) => {
                const message = JSON.stringify({ type, data }) + '\n';
                controller.enqueue(encoder.encode(message));
            }

            if (isGlobal) isIngesting = true;

            try {
                send('log', `Starting ingestion sweep for ${universe.length} symbols...`);
                let totalProcessed = 0;

                for (const sym of universe) {
                    for (const tf of timeframes) {
                        send('log', `Checking gaps for ${sym} @ ${tf}...`);

                        const health = await DataHealthManager.getHealth(sym, tf)
                        const targetStart = DataHealthManager.getTargetHorizon(tf)
                        const now = Math.floor(Date.now() / 1000)
                        const ONE_YEAR = 31536000

                        if (health.count === 0) {
                            send('log', `No data found for ${sym} (${tf}). Bootstrapping from ${new Date(targetStart * 1000).toISOString()}...`);
                            let currentStart = targetStart
                            let totalFetched = 0

                            while (currentStart < now) {
                                const currentEnd = Math.min(currentStart + (ONE_YEAR * 2), now)
                                try {
                                    send('log', `-> Fetching chunk ${new Date(currentStart * 1000).toISOString()} to ${new Date(currentEnd * 1000).toISOString()} using provider: ${provider || 'auto'}`);
                                    const fetched = await marketDataStore.getHistoricalData(sym, tf, currentStart, currentEnd, provider)
                                    totalFetched += fetched.length

                                    send('log', `-> Received ${fetched.length} bars.`);

                                    // Break if no data and highly historical (Yahoo doesn't support deep intraday)
                                    if (fetched.length === 0 && currentStart < now - (ONE_YEAR * 3)) {
                                        send('log', `-> No data found for deep chunk. Bailing early to prevent infinite empty loop.`);
                                        break;
                                    }

                                    await new Promise(resolve => setTimeout(resolve, 1500))
                                } catch (e: any) {
                                    send('log', `-> Chunk failed: ${e.message}`);
                                    break;
                                }
                                currentStart = currentEnd
                            }

                            totalProcessed++;
                            send('log', `Finished bootstrap for ${sym} (${tf}). Added ${totalFetched} total bars.`);
                            continue
                        }

                        if (health.targetCoveragePercent < 100 && health.startIndex) {
                            const actualStart = Math.floor(health.startIndex.getTime() / 1000)
                            if (actualStart > targetStart + (ONE_YEAR)) {
                                send('log', `Low coverage (${health.targetCoveragePercent}%). Backfilling deep history for ${sym}...`);

                                let currentStart = targetStart
                                let totalFetched = 0

                                while (currentStart < actualStart) {
                                    const currentEnd = Math.min(currentStart + (ONE_YEAR * 2), actualStart)
                                    try {
                                        send('log', `-> Fetching backfill chunk ${new Date(currentStart * 1000).toISOString()} to ${new Date(currentEnd * 1000).toISOString()}`);
                                        const fetched = await marketDataStore.getHistoricalData(sym, tf, currentStart, currentEnd, provider)
                                        totalFetched += fetched.length

                                        if (fetched.length === 0 && currentStart < actualStart - (ONE_YEAR * 3)) break;
                                        await new Promise(resolve => setTimeout(resolve, 1500))
                                    } catch (e: any) {
                                        send('log', `-> Backfill chunk failed: ${e.message}`);
                                        break;
                                    }
                                    currentStart = currentEnd
                                }
                                totalProcessed++;
                                send('log', `Finished backfill for ${sym} (${tf}). Added ${totalFetched} bars.`);
                            }
                        }

                        if (health.gaps && health.gaps.length > 0) {
                            send('log', `Healing ${health.gaps.length} internal gaps for ${sym}...`);
                            // We don't have stream logs in DataHealthManager.syncGaps easily, but let's log completion
                            const fixReport = await DataHealthManager.syncGaps(sym, tf, provider)
                            totalProcessed++;
                            send('log', `Healed gaps. Gaps fixed: ${fixReport.gapsFixed}, Bars added: ${fixReport.barsAdded}`);
                        } else {
                            const lastBarUnix = Math.floor(health.endIndex!.getTime() / 1000)
                            if (now - lastBarUnix > DataHealthManager.timeframeToSeconds(tf) * 2) {
                                send('log', `Syncing tail for ${sym} (${tf}) up to present day...`);
                                const fetched = await marketDataStore.getHistoricalData(sym, tf, lastBarUnix, now, provider)
                                totalProcessed++;
                                send('log', `Caught up context. Synchronized ${fetched.length} bars.`);
                            }
                        }
                    }
                }

                send('log', 'Refreshing robust inventory overview...');
                await DataHealthManager.refreshInventory();

                send('log', 'Ingestion sweep complete.');
                send('result', { processed: totalProcessed });

            } catch (error: any) {
                send('error', error.message || 'Fatal ingestion error');
            } finally {
                if (isGlobal) isIngesting = false;
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
        }
    });
}
