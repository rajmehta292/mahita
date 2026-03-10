import { DataHealthManager } from './health'
import { marketDataStore } from './store'
import { providerTelemetryBus } from './provider-telemetry'
import { getGlobalUniverse } from './universe-loader'
import { ChunkIngestionReport, Timeframe } from './types'
import { timeframeToSeconds } from './utils'

const ONE_YEAR = 31536000

export interface IngestionLogPayload {
    message: string
    symbol?: string
    timeframe?: Timeframe
    provider?: string
    rangeStart?: number
    rangeEnd?: number
    fetchedBars?: number
    persistedBars?: number
    dbTotalAfterChunk?: number
    warnings?: string[]
    gapCount?: number
    targetCoveragePercent?: number
    totalProcessed?: number
    totalPersisted?: number
}

export interface IngestionSweepOptions {
    symbols?: string[]
    overrideTimeframe?: Timeframe | Timeframe[]
    provider?: string
    pauseMs?: number
    limit?: number
}

export interface IngestionSweepResult {
    processed: number
    persistedBars: number
    symbols: string[]
    timeframes: Timeframe[]
}

export type IngestionLogger = (payload: IngestionLogPayload, level?: 'log' | 'error') => Promise<void> | void

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeSymbols(symbols: string[]): string[] {
    return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))]
}

function resolveTimeframes(override?: Timeframe | Timeframe[]): Timeframe[] {
    if (!override) {
        return ['1d', '1h']
    }

    return Array.isArray(override) ? override : [override]
}

class IngestionService {
    private running = false
    private cursor: number = 0 // Persistent rotation index for continuous polling

    isRunning() {
        return this.running
    }

    async runSweep(options: IngestionSweepOptions = {}, logger: IngestionLogger = () => undefined): Promise<IngestionSweepResult> {
        if (this.running) {
            throw new Error('An ingestion sweep is already running.')
        }

        // --- Multi-Key Pooling Implementation ---
        const { getSchwabClientPool } = await import('@/app/services/schwab/runtime')
        const clientPool = await getSchwabClientPool()

        if (clientPool.length === 0 && process.env.USE_MOCK_DATA !== 'true') {
            await providerTelemetryBus.log({
                kind: 'error',
                message: `SYS-CRITICAL: No valid Schwab keys in pool. Halting Sweep.`,
            })
            throw new Error(`IngestionService Halted: No valid keys found in pool.`)
        }

        this.running = true
        let poolIndex = 0

        const timeframes = resolveTimeframes(options.overrideTimeframe)
        const universe = normalizeSymbols(options.symbols?.length ? options.symbols : await getGlobalUniverse())
        const pauseMs = options.pauseMs ?? 400

        await providerTelemetryBus.log({
            kind: 'control',
            message: 'Ingestion sweep started.',
            response: {
                symbols: universe.length,
                timeframes,
                providerOverride: options.provider || 'auto'
            }
        })

        try {
            await logger({ message: `Starting ingestion sweep for ${universe.length} symbols (Cursor Start: ${this.cursor})...` })

            let totalProcessed = 0
            let totalPersisted = 0

            const maxLimit = options.limit ?? universe.length

            // Build a dynamically rotated queue starting from the persistent cursor
            const rotatedUniverse = [
                ...universe.slice(this.cursor),
                ...universe.slice(0, this.cursor)
            ]

            for (const symbol of rotatedUniverse) {
                if (totalProcessed >= maxLimit) {
                    await logger({ message: `Reached requested batch limit of ${maxLimit}. Stopping sweep.` })
                    break
                }

                try {
                    // Rotate provider throughout the pool for each symbol to balance load
                    const activeClient = clientPool[poolIndex % clientPool.length]
                    poolIndex++

                    for (const timeframe of timeframes) {
                        await logger({ message: `Checking ${symbol} @ ${timeframe}...`, symbol, timeframe })

                        const health = await DataHealthManager.getHealth(symbol, timeframe)
                        const targetStart = DataHealthManager.getTargetHorizon(timeframe)
                        const now = Math.floor(Date.now() / 1000)

                        if (health.count === 0) {
                            await logger({
                                message: `No local data found for ${symbol} (${timeframe}). Bootstrapping...`,
                                symbol,
                                timeframe,
                                rangeStart: targetStart,
                                rangeEnd: now
                            })

                            const bootstrapResult = await this.fillRange(symbol, timeframe, targetStart, now, options.provider, pauseMs, logger, activeClient)
                            totalPersisted += bootstrapResult.persistedBars
                            totalProcessed++

                            await DataHealthManager.refreshInventory()
                            const postBootstrapHealth = await DataHealthManager.getHealth(symbol, timeframe)

                            await logger({
                                message: `Finished bootstrap for ${symbol} (${timeframe}).`,
                                symbol,
                                timeframe,
                                fetchedBars: bootstrapResult.fetchedBars,
                                persistedBars: bootstrapResult.persistedBars,
                                dbTotalAfterChunk: postBootstrapHealth.count,
                                gapCount: postBootstrapHealth.gapCount || postBootstrapHealth.gaps.length
                            })
                            continue
                        }

                        if (health.targetCoveragePercent < 100 && health.startIndex) {
                            const actualStart = Math.floor(health.startIndex.getTime() / 1000)

                            if (actualStart > targetStart + ONE_YEAR) {
                                await logger({
                                    message: `Backfilling ${symbol} (${timeframe}) due to low coverage.`,
                                    symbol,
                                    timeframe,
                                    targetCoveragePercent: health.targetCoveragePercent,
                                    rangeStart: targetStart,
                                    rangeEnd: actualStart
                                })

                                const backfillResult = await this.fillRange(symbol, timeframe, targetStart, actualStart, options.provider, pauseMs, logger)
                                totalPersisted += backfillResult.persistedBars
                                totalProcessed++

                                await DataHealthManager.refreshInventory()
                                const postBackfillHealth = await DataHealthManager.getHealth(symbol, timeframe)

                                await logger({
                                    message: `Finished backfill for ${symbol} (${timeframe}).`,
                                    symbol,
                                    timeframe,
                                    fetchedBars: backfillResult.fetchedBars,
                                    persistedBars: backfillResult.persistedBars,
                                    dbTotalAfterChunk: postBackfillHealth.count,
                                    gapCount: postBackfillHealth.gapCount || postBackfillHealth.gaps.length
                                })
                            }
                        }

                        if (health.gaps.length > 0) {
                            await logger({
                                message: `Healing ${health.gaps.length} internal gaps for ${symbol} (${timeframe})...`,
                                symbol,
                                timeframe
                            })

                            const fixReport = await DataHealthManager.syncGaps(symbol, timeframe, options.provider)
                            totalProcessed++
                            totalPersisted += fixReport.barsAdded

                            await DataHealthManager.refreshInventory()
                            const postGapHealth = await DataHealthManager.getHealth(symbol, timeframe)

                            await logger({
                                message: `Gap healing finished for ${symbol} (${timeframe}).`,
                                symbol,
                                timeframe,
                                fetchedBars: fixReport.barsAdded,
                                persistedBars: fixReport.barsAdded,
                                dbTotalAfterChunk: postGapHealth.count,
                                gapCount: postGapHealth.gapCount || postGapHealth.gaps.length
                            })
                            continue
                        }

                        if (health.endIndex) {
                            const lastBarUnix = Math.floor(health.endIndex.getTime() / 1000)

                            if (now - lastBarUnix > timeframeToSeconds(timeframe) * 2) {
                                await logger({
                                    message: `Syncing recent tail for ${symbol} (${timeframe})...`,
                                    symbol,
                                    timeframe,
                                    rangeStart: lastBarUnix,
                                    rangeEnd: now
                                })

                                const tailResult = await marketDataStore.getHistoricalDataWithReport(symbol, timeframe, lastBarUnix, now, {
                                    providerOverride: options.provider,
                                    providerClient: activeClient
                                })

                                for (const chunkReport of tailResult.report.chunkReports) {
                                    await this.logChunk(logger, 'Tail chunk synchronized.', symbol, timeframe, chunkReport)
                                }

                                totalProcessed++
                                totalPersisted += tailResult.report.persistedBars

                                await DataHealthManager.refreshInventory()
                                const postTailHealth = await DataHealthManager.getHealth(symbol, timeframe)

                                await logger({
                                    message: `Tail sync finished for ${symbol} (${timeframe}).`,
                                    symbol,
                                    timeframe,
                                    fetchedBars: tailResult.report.fetchedBars,
                                    persistedBars: tailResult.report.persistedBars,
                                    dbTotalAfterChunk: postTailHealth.count,
                                    gapCount: postTailHealth.gapCount || postTailHealth.gaps.length,
                                    warnings: tailResult.report.warnings
                                })
                            }
                        }
                    }
                } catch (error) {
                    const msg = error instanceof Error ? error.message : 'Unknown error'
                    if (msg.includes('RATE_LIMITED')) {
                        await logger({
                            message: `Symbol throttled due to RATE_LIMITED lock. Skipping to next symbol in batch.`,
                            symbol
                        }, 'error')
                        continue
                    }
                    console.error(`[Ingestion] Unknown fatal error for ${symbol}: ${msg}`)
                    throw error
                }
            }

            // Advance the cursor by exactly how many items we evaluated globally
            this.cursor = (this.cursor + totalProcessed) % universe.length

            await DataHealthManager.refreshInventory()
            await logger({
                message: 'Ingestion sweep complete.',
                totalProcessed,
                totalPersisted
            })

            await providerTelemetryBus.log({
                kind: 'control',
                message: 'Ingestion sweep completed.',
                response: {
                    totalProcessed,
                    totalPersisted
                }
            })

            return {
                processed: totalProcessed,
                persistedBars: totalPersisted,
                symbols: universe,
                timeframes
            }
        } catch (error) {
            await providerTelemetryBus.log({
                kind: 'error',
                message: 'Ingestion sweep failed.',
                response: {
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            })
            throw error
        } finally {
            this.running = false
        }
    }

    private async fillRange(
        symbol: string,
        timeframe: Timeframe,
        startTime: number,
        endTime: number,
        provider: string | undefined,
        pauseMs: number,
        logger: IngestionLogger,
        providerClient?: any
    ): Promise<{ fetchedBars: number, persistedBars: number }> {
        let currentStart = startTime
        let fetchedBars = 0
        let persistedBars = 0

        while (currentStart < endTime) {
            const currentEnd = Math.min(currentStart + (ONE_YEAR * 2), endTime)

            try {
                const result = await marketDataStore.getHistoricalDataWithReport(symbol, timeframe, currentStart, currentEnd, {
                    providerOverride: provider,
                    providerClient
                })

                fetchedBars += result.report.fetchedBars
                persistedBars += result.report.persistedBars

                if (result.report.chunkReports.length === 0) {
                    await logger({
                        message: 'Chunk completed without provider persistence.',
                        symbol,
                        timeframe,
                        rangeStart: currentStart,
                        rangeEnd: currentEnd,
                        fetchedBars: 0,
                        persistedBars: 0,
                        dbTotalAfterChunk: result.report.dbTotalAfterFetch,
                        warnings: result.report.warnings
                    })
                } else {
                    for (const chunkReport of result.report.chunkReports) {
                        await this.logChunk(logger, 'Chunk synchronized.', symbol, timeframe, chunkReport)
                    }
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                await logger({
                    message: 'Chunk failed.',
                    symbol,
                    timeframe,
                    rangeStart: currentStart,
                    rangeEnd: currentEnd,
                    warnings: [errorMessage]
                })

                if (errorMessage.includes('RATE_LIMITED')) {
                    throw error
                }
            }

            currentStart = currentEnd
            await sleep(pauseMs)
        }

        return { fetchedBars, persistedBars }
    }

    private async logChunk(
        logger: IngestionLogger,
        message: string,
        symbol: string,
        timeframe: Timeframe,
        report: ChunkIngestionReport
    ) {
        await logger({
            message,
            symbol,
            timeframe,
            provider: report.provider,
            rangeStart: report.rangeStart,
            rangeEnd: report.rangeEnd,
            fetchedBars: report.fetchedBars,
            persistedBars: report.persistedBars,
            dbTotalAfterChunk: report.dbTotalAfterChunk,
            warnings: report.warnings
        })
    }
}

declare global {
    var __mahitaIngestionService: IngestionService | undefined
}

export const ingestionService = globalThis.__mahitaIngestionService ?? new IngestionService()

if (process.env.NODE_ENV !== 'production') {
    globalThis.__mahitaIngestionService = ingestionService
}
