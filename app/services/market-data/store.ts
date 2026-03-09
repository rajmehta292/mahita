import {
    ChunkIngestionReport,
    IDataProvider,
    MarketDataFetchResult,
    MarketDataFetchReport,
    MarketDataPoint,
    TimeRange,
    Timeframe
} from './types'
import { AlphaVantageProvider } from './providers/alphavantage'
import { SchwabProvider } from './providers/schwab'
import { YahooProvider } from './providers/yahoo'
import { GoogleProvider } from './providers/google'
import { MockDataProvider } from './mock-provider'
import { providerTelemetryBus } from './provider-telemetry'
import { dedupeMarketDataPoints, getMissingRanges } from './utils'
import { getBaseRequirement, deriveBars } from './timeframe-math'
import { vaultManager } from './vault-manager'

interface ProviderEntry {
    name: string
    provider: IDataProvider
}

interface FetchOptions {
    forceRefresh?: boolean
    providerOverride?: string
}

export class MarketDataStore {
    private providers: ProviderEntry[]

    constructor() {
        this.providers = [
            { name: 'schwab', provider: new SchwabProvider() },
            { name: 'yahoo', provider: new YahooProvider() },
            { name: 'google', provider: new GoogleProvider() },
            { name: 'alphavantage', provider: new AlphaVantageProvider() }
        ]

        if (process.env.USE_MOCK_DATA === 'true') {
            this.providers.push({ name: 'mock', provider: new MockDataProvider() })
        }
    }

    getAvailableProviders(): string[] {
        return this.providers.map((entry) => entry.name)
    }

    async getHistoricalData(
        symbol: string,
        timeframe: Timeframe,
        startTime: number,
        endTime: number,
        providerOverride?: string,
        vaultName?: string
    ): Promise<MarketDataPoint[]> {
        const result = await this.getHistoricalDataWithReport(symbol, timeframe, startTime, endTime, {
            providerOverride,
            vaultName
        })

        return result.data
    }

    async getHistoricalDataWithReport(
        symbol: string,
        timeframe: Timeframe,
        startTime: number,
        endTime: number,
        options: FetchOptions & { vaultName?: string } = {}
    ): Promise<MarketDataFetchResult> {
        const requiredBaseTimeframe = getBaseRequirement(timeframe)
        const isDerived = requiredBaseTimeframe !== timeframe

        const targetVault = options.vaultName || options.providerOverride || 'schwab'
        const normalizedSymbol = symbol.trim().toUpperCase()

        // ALWAYS fetch the underlying base timeframe from storage, even if a derived view was requested
        const cachedData = await this.readFromDb(normalizedSymbol, requiredBaseTimeframe, startTime, endTime, targetVault)
        const missingRanges = options.forceRefresh
            ? [{ startTime, endTime }]
            : getMissingRanges(normalizedSymbol, requiredBaseTimeframe, cachedData, startTime, endTime)

        const client = await vaultManager.getClient(targetVault)

        const report: MarketDataFetchReport = {
            symbol: normalizedSymbol,
            timeframe,  // Report the originally requested timeframe outward
            rangeStart: startTime,
            rangeEnd: endTime,
            cacheBars: cachedData.length,
            fetchedBars: 0,
            persistedBars: 0,
            dbTotalAfterFetch: await client.marketData.count({
                where: { symbol: normalizedSymbol, timeframe: requiredBaseTimeframe }
            }),
            chunkReports: [],
            warnings: []
        }

        for (const range of missingRanges) {
            const chunkReport = await this.fetchMissingRange(
                normalizedSymbol,
                requiredBaseTimeframe, // Save internal requests onto the DB as base
                range,
                options.providerOverride,
                !!options.forceRefresh,
                targetVault
            )

            report.chunkReports.push(chunkReport)
            report.fetchedBars += chunkReport.fetchedBars
            report.persistedBars += chunkReport.persistedBars
            report.dbTotalAfterFetch = chunkReport.dbTotalAfterChunk
            report.warnings.push(...chunkReport.warnings)
        }

        const finalData = await this.readFromDb(normalizedSymbol, requiredBaseTimeframe, startTime, endTime, targetVault)

        // If a derived timeframe was requested (e.g. 5m), aggregate the 1m base array now
        const derivedFinalData = isDerived ? deriveBars(finalData, timeframe) : finalData

        return {
            data: derivedFinalData,
            report
        }
    }

    async fetchProviderBars(
        providerName: string,
        symbol: string,
        timeframe: Timeframe,
        startTime: number,
        endTime: number
    ): Promise<MarketDataPoint[]> {
        const provider = this.getProviders(providerName)[0]

        if (!provider) {
            throw new Error(`Unknown provider: ${providerName}`)
        }

        return this.callProvider(provider, symbol.trim().toUpperCase(), timeframe, startTime, endTime)
    }

    private getProviders(providerOverride?: string): ProviderEntry[] {
        if (!providerOverride) {
            return this.providers
        }

        return this.providers.filter(
            (entry) => entry.name === providerOverride.trim().toLowerCase()
        )
    }

    private async readFromDb(
        symbol: string,
        timeframe: Timeframe,
        startTime: number,
        endTime: number,
        vaultName = 'schwab'
    ): Promise<MarketDataPoint[]> {
        const client = await vaultManager.getClient(vaultName)
        const rows = await client.marketData.findMany({
            where: {
                symbol,
                timeframe,
                time: {
                    gte: new Date(startTime * 1000),
                    lte: new Date(endTime * 1000)
                }
            },
            orderBy: { time: 'asc' }
        })

        return rows.map((row) => ({
            time: Math.floor(row.time.getTime() / 1000),
            open: row.open,
            high: row.high,
            low: row.low,
            close: row.close,
            volume: row.volume
        }))
    }

    private async fetchMissingRange(
        symbol: string,
        timeframe: Timeframe,
        range: TimeRange,
        providerOverride?: string,
        forceRefresh = false,
        vaultName = 'schwab'
    ): Promise<ChunkIngestionReport> {
        const warnings: string[] = []
        const providers = this.getProviders(providerOverride)
        const client = await vaultManager.getClient(vaultName)

        if (providers.length === 0) {
            const dbTotalAfterChunk = await client.marketData.count({
                where: { symbol, timeframe }
            })

            return {
                provider: providerOverride || 'auto',
                rangeStart: range.startTime,
                rangeEnd: range.endTime,
                fetchedBars: 0,
                persistedBars: 0,
                dbTotalAfterChunk,
                warnings: [`Unknown provider override: ${providerOverride}`]
            }
        }

        for (const entry of providers) {
            try {
                const fetchedData = await this.callProvider(entry, symbol, timeframe, range.startTime, range.endTime)
                const persistedBars = await this.persistBars(
                    symbol,
                    timeframe,
                    fetchedData,
                    entry.name,
                    forceRefresh,
                    vaultName
                )

                const dbTotalAfterChunk = await client.marketData.count({
                    where: { symbol, timeframe }
                })

                if (fetchedData.length === 0) {
                    warnings.push(
                        `${entry.name} returned 0 bars for ${new Date(range.startTime * 1000).toISOString()} -> ${new Date(range.endTime * 1000).toISOString()}`
                    )
                    continue
                }

                if (persistedBars === 0) {
                    warnings.push(`${entry.name} fetched ${fetchedData.length} bars but persisted 0 new bars`)
                }

                return {
                    provider: entry.name,
                    rangeStart: range.startTime,
                    rangeEnd: range.endTime,
                    fetchedBars: fetchedData.length,
                    persistedBars,
                    dbTotalAfterChunk,
                    warnings
                }
            } catch (error) {
                warnings.push(`${entry.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
        }

        const dbTotalAfterChunk = await client.marketData.count({
            where: { symbol, timeframe }
        })

        return {
            provider: providerOverride || 'auto',
            rangeStart: range.startTime,
            rangeEnd: range.endTime,
            fetchedBars: 0,
            persistedBars: 0,
            dbTotalAfterChunk,
            warnings
        }
    }

    private async callProvider(
        entry: ProviderEntry,
        symbol: string,
        timeframe: Timeframe,
        startTime: number,
        endTime: number
    ): Promise<MarketDataPoint[]> {
        const startedAt = Date.now()

        await providerTelemetryBus.log({
            kind: 'request',
            provider: entry.name,
            symbol,
            timeframe,
            rangeStart: startTime,
            rangeEnd: endTime,
            message: `Requesting ${symbol} ${timeframe} from ${entry.name}.`,
            request: {
                startTime,
                endTime
            }
        })

        try {
            const fetchedData = dedupeMarketDataPoints(
                (await entry.provider.getHistoricalData(symbol, timeframe, startTime, endTime)).filter((point) => this.isValidBar(point))
            )

            await providerTelemetryBus.log({
                kind: 'response',
                provider: entry.name,
                symbol,
                timeframe,
                rangeStart: startTime,
                rangeEnd: endTime,
                message: `Received ${fetchedData.length} bars from ${entry.name}.`,
                response: {
                    durationMs: Date.now() - startedAt,
                    bars: fetchedData.length,
                    preview: this.summarizeBars(fetchedData)
                }
            })

            return fetchedData
        } catch (error) {
            await providerTelemetryBus.log({
                kind: 'error',
                provider: entry.name,
                symbol,
                timeframe,
                rangeStart: startTime,
                rangeEnd: endTime,
                message: `Provider ${entry.name} failed for ${symbol} ${timeframe}.`,
                response: {
                    durationMs: Date.now() - startedAt,
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            })
            throw error
        }
    }

    async persistBars(
        symbol: string,
        timeframe: Timeframe,
        points: MarketDataPoint[],
        source: string,
        overwriteExisting = false,
        vaultName = 'schwab'
    ): Promise<number> {
        if (points.length === 0) {
            return 0
        }

        const client = await vaultManager.getClient(vaultName)
        const normalizedPoints = dedupeMarketDataPoints(points)
        const startDate = new Date(normalizedPoints[0].time * 1000)
        const endDate = new Date(normalizedPoints[normalizedPoints.length - 1].time * 1000)

        // Trust SQLite upserts to handle deduplication natively
        const barsToPersist = normalizedPoints

        if (barsToPersist.length === 0) {
            return 0
        }

        if (overwriteExisting) {
            await client.marketData.deleteMany({
                where: {
                    symbol,
                    timeframe,
                    time: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            })
        }

        const CHUNK_SIZE = 250
        let persistedBars = 0
        let totalRowsBefore = await client.marketData.count({
            where: { symbol, timeframe }
        })

        for (let index = 0; index < barsToPersist.length; index += CHUNK_SIZE) {
            const chunk = barsToPersist.slice(index, index + CHUNK_SIZE)
            const dbChunk = chunk.map((point) => ({
                symbol,
                timeframe,
                time: new Date(point.time * 1000),
                open: point.open,
                high: point.high,
                low: point.low,
                close: point.close,
                volume: point.volume,
                source
            }))

            try {
                await client.marketData.createMany({
                    data: dbChunk
                })
            } catch (error) {
                for (const row of dbChunk) {
                    await client.marketData.upsert({
                        where: {
                            symbol_timeframe_time: {
                                symbol: row.symbol,
                                timeframe: row.timeframe,
                                time: row.time
                            }
                        },
                        update: {
                            open: row.open,
                            high: row.high,
                            low: row.low,
                            close: row.close,
                            volume: row.volume,
                            source: row.source
                        },
                        create: row
                    })
                }
            }

            const totalRowsAfter = await client.marketData.count({
                where: { symbol, timeframe }
            })
            persistedBars += Math.max(0, totalRowsAfter - totalRowsBefore)
            totalRowsBefore = totalRowsAfter
        }

        return persistedBars
    }

    private summarizeBars(points: MarketDataPoint[]) {
        if (points.length === 0) {
            return null
        }

        const first = points[0]
        const last = points[points.length - 1]

        return {
            first: {
                time: first.time,
                open: first.open,
                close: first.close,
                volume: first.volume
            },
            last: {
                time: last.time,
                open: last.open,
                close: last.close,
                volume: last.volume
            }
        }
    }

    private isValidBar(point: MarketDataPoint): boolean {
        return [
            point.time,
            point.open,
            point.high,
            point.low,
            point.close,
            point.volume
        ].every((value) => Number.isFinite(value))
    }
}

export const marketDataStore = new MarketDataStore()
