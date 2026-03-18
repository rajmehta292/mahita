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
import { getBaseRequirement, deriveBars, timeframeToSeconds } from './timeframe-math'
import { getRuntimeProviderOrder, normalizeStage2Provider } from './provider-policy'
import { vaultManager, withVaultQueryRetry } from './vault-manager'

interface ProviderEntry {
    name: string
    provider: IDataProvider
}

interface FetchOptions {
    forceRefresh?: boolean
    providerOverride?: string
    providerClient?: unknown
    providerTimeoutMs?: number
    fetchMode?: 'interactive' | 'repair'
}

const parsedProviderTimeoutMs = Number(process.env.MAHITA_MARKET_DATA_PROVIDER_TIMEOUT_MS || 20_000)
const DEFAULT_PROVIDER_TIMEOUT_MS = Number.isFinite(parsedProviderTimeoutMs) && parsedProviderTimeoutMs > 0
    ? parsedProviderTimeoutMs
    : 20_000
const MAX_INTERACTIVE_MISSING_RANGES = 24
const MAX_INTERACTIVE_SELECTED_RANGES = 4

async function withProviderTimeout<T>(operation: Promise<T>, timeoutMs: number, providerName: string, symbol: string, timeframe: Timeframe) {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined

    try {
        return await Promise.race([
            operation,
            new Promise<T>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new Error(`${providerName} timed out after ${timeoutMs}ms for ${symbol} ${timeframe}.`))
                }, timeoutMs)
            }),
        ])
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle)
        }
    }
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
            dbTotalAfterFetch: await withVaultQueryRetry(() => client.marketData.count({
                where: { symbol: normalizedSymbol, timeframe: requiredBaseTimeframe }
            })),
            chunkReports: [],
            warnings: []
        }

        const plannedRanges = options.fetchMode === 'interactive'
            ? this.planInteractiveMissingRanges(requiredBaseTimeframe, startTime, endTime, cachedData, missingRanges)
            : { ranges: missingRanges, warnings: [] }

        report.warnings.push(...plannedRanges.warnings)

        for (const range of plannedRanges.ranges) {
            const chunkReport = await this.fetchMissingRange(
                normalizedSymbol,
                requiredBaseTimeframe, // Save internal requests onto the DB as base
                range,
                options.providerOverride,
                !!options.forceRefresh,
                targetVault,
                options.providerClient,
                options.providerTimeoutMs
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
            const runtimeOrder = getRuntimeProviderOrder()
            const runtimeProviders = this.providers.filter((entry) => runtimeOrder.includes(entry.name as "schwab" | "yahoo"))
            return runtimeProviders.length > 0 ? runtimeProviders : this.providers
        }

        const normalized = normalizeStage2Provider(providerOverride) || providerOverride.trim().toLowerCase()
        return this.providers.filter((entry) => entry.name === normalized)
    }

    private getInteractiveRefreshWindowSeconds(timeframe: Timeframe): number {
        switch (timeframe) {
            case '1s':
                return 6 * 3600
            case '1m':
                return 3 * 86400
            case '1h':
                return 30 * 86400
            case '1d':
                return 365 * 86400
            default:
                return 30 * 86400
        }
    }

    private coalesceRanges(ranges: TimeRange[], mergeGapSeconds: number): TimeRange[] {
        if (ranges.length <= 1) {
            return ranges
        }

        const sortedRanges = [...ranges].sort((left, right) => left.startTime - right.startTime)
        const merged: TimeRange[] = [{ ...sortedRanges[0] }]

        for (let index = 1; index < sortedRanges.length; index += 1) {
            const current = sortedRanges[index]
            const previous = merged[merged.length - 1]

            if (current.startTime <= previous.endTime + mergeGapSeconds) {
                previous.endTime = Math.max(previous.endTime, current.endTime)
                continue
            }

            merged.push({ ...current })
        }

        return merged
    }

    private planInteractiveMissingRanges(
        timeframe: Timeframe,
        startTime: number,
        endTime: number,
        cachedData: MarketDataPoint[],
        missingRanges: TimeRange[]
    ): { ranges: TimeRange[]; warnings: string[] } {
        if (missingRanges.length === 0 || cachedData.length === 0 || missingRanges.length <= MAX_INTERACTIVE_MISSING_RANGES) {
            return { ranges: missingRanges, warnings: [] }
        }

        const recentWindowStart = Math.max(startTime, endTime - this.getInteractiveRefreshWindowSeconds(timeframe))
        const recentRanges = this.coalesceRanges(
            missingRanges.filter((range) => range.endTime >= recentWindowStart),
            Math.max(timeframeToSeconds(timeframe) * 30, 30 * 60)
        )

        let selectedRanges = recentRanges
        if (selectedRanges.length > MAX_INTERACTIVE_SELECTED_RANGES) {
            selectedRanges = [{ startTime: recentWindowStart, endTime }]
        }

        if (selectedRanges.length === 0) {
            return {
                ranges: [],
                warnings: [
                    `Skipped ${missingRanges.length} fragmented missing ranges during interactive load because no recent refresh window needed repair.`
                ]
            }
        }

        return {
            ranges: selectedRanges,
            warnings: [
                `Skipped ${Math.max(0, missingRanges.length - selectedRanges.length)} fragmented missing ranges during interactive load; background repair should fill older holes.`
            ]
        }
    }

    private async readFromDb(
        symbol: string,
        timeframe: Timeframe,
        startTime: number,
        endTime: number,
        vaultName = 'schwab'
    ): Promise<MarketDataPoint[]> {
        const client = await vaultManager.getClient(vaultName)
        const rows = await withVaultQueryRetry(() => client.marketData.findMany({
            where: {
                symbol,
                timeframe,
                time: {
                    gte: new Date(startTime * 1000),
                    lte: new Date(endTime * 1000)
                }
            },
            orderBy: { time: 'asc' }
        }))

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
        vaultName = 'schwab',
        providerClient?: unknown,
        providerTimeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS
    ): Promise<ChunkIngestionReport> {
        const warnings: string[] = []
        const providers = this.getProviders(providerOverride)
        const client = await vaultManager.getClient(vaultName)

        if (providers.length === 0) {
            const dbTotalAfterChunk = await withVaultQueryRetry(() => client.marketData.count({
                where: { symbol, timeframe }
            }))

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
                const fetchedData = await this.callProvider(
                    entry,
                    symbol,
                    timeframe,
                    range.startTime,
                    range.endTime,
                    providerClient,
                    providerTimeoutMs
                )
                const persistedBars = await this.persistBars(
                    symbol,
                    timeframe,
                    fetchedData,
                    entry.name,
                    forceRefresh,
                    vaultName
                )

                const dbTotalAfterChunk = await withVaultQueryRetry(() => client.marketData.count({
                    where: { symbol, timeframe }
                }))

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

        const dbTotalAfterChunk = await withVaultQueryRetry(() => client.marketData.count({
            where: { symbol, timeframe }
        }))

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
        endTime: number,
        providerClient?: unknown,
        providerTimeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS
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
                (
                    await withProviderTimeout(
                        entry.provider.getHistoricalData(symbol, timeframe, startTime, endTime, { providerClient }),
                        providerTimeoutMs,
                        entry.name,
                        symbol,
                        timeframe
                    )
                ).filter((point) => this.isValidBar(point))
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
            await withVaultQueryRetry(() => client.marketData.deleteMany({
                where: {
                    symbol,
                    timeframe,
                    time: {
                        gte: startDate,
                        lte: endDate
                    }
                }
            }))
        }

        const CHUNK_SIZE = 250
        let persistedBars = 0
        let totalRowsBefore = await withVaultQueryRetry(() => client.marketData.count({
            where: { symbol, timeframe }
        }))

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
                await withVaultQueryRetry(() => client.marketData.createMany({
                    data: dbChunk
                }))
            } catch {
                for (const row of dbChunk) {
                    await withVaultQueryRetry(() => client.marketData.upsert({
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
                    }))
                }
            }

            const totalRowsAfter = await withVaultQueryRetry(() => client.marketData.count({
                where: { symbol, timeframe }
            }))
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
