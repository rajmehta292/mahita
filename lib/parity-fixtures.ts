import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { csvParse } from 'd3-dsv'
import prisma from '@/lib/prisma'
import type { MarketDataPoint } from '@/app/services/market-data/types'
import { BacktestEngine } from '@/app/services/trading-engine/backtester'
import { hashPineSource } from '@/app/services/trading-engine/script-engine'
import {
    type FixtureValidationReport,
    type NormalizedTradeRecord,
    type ParityBatchFixtureResult,
    type ParityBatchReport,
    type ParityFixtureManifest,
    type ParityFixtureStatus,
    type StrategyRunSettings,
} from '@/app/services/trading-engine/types'
import { groupFixtureTrades } from '@/app/services/trading-engine/parity'

const TRADINGVIEW_FIXTURES_DIR = path.join(process.cwd(), 'fixtures', 'tradingview')
const FILE_TEXT_CACHE = new Map<string, string>()
const BAR_FILE_CACHE = new Map<string, MarketDataPoint[]>()
const TRADE_FILE_CACHE = new Map<string, NormalizedTradeRecord[]>()
const FIXTURE_BUNDLE_CACHE = new Map<string, BuiltInParityFixtureBundle>()

interface BuiltInFixtureDefinition {
    fixtureKey: string
    name: string
    dirName: string
    symbol: string
    timeframe: string
    notes: string
    candleFileName: string
    tradeFileName: string
    supportCandleFileNames?: string[]
    runSettings: StrategyRunSettings
}

interface BuiltInParityFixtureBundle {
    fixtureKey: string
    name: string
    source: 'tradingview-fixture'
    symbol: string
    timeframe: string
    notes: string
    candles: MarketDataPoint[]
    trades: NormalizedTradeRecord[]
    pineSource: string
    manifest: ParityFixtureManifest
}

interface StoredParityFixture {
    id: string
    fixtureKey: string
    name: string
    source: string
    symbol: string
    timeframe: string
    engineMode: string
    status: string
    notes: string | null
    manifest: ParityFixtureManifest | null
    lastParityReport: ParityBatchFixtureResult | null
    firstBarTime: string | null
    lastBarTime: string | null
    barCount: number
    tradeCount: number
    importedAt: string
    candles: MarketDataPoint[]
    trades: NormalizedTradeRecord[]
}

const BUILT_IN_PARITY_FIXTURES: BuiltInFixtureDefinition[] = [
    {
        fixtureKey: 'tradingview-vti-1m-2026-03-14',
        name: 'TradingView VTI 1m Parity Fixture',
        dirName: 'vti-1m',
        symbol: 'VTI',
        timeframe: '1m',
        notes: 'Seeded from the March 14, 2026 TradingView VTI 1m parity baseline with explicit run-property overrides.',
        candleFileName: 'bars-baseline.csv',
        tradeFileName: 'trades-baseline.csv',
        supportCandleFileNames: ['bars-session-1.csv', 'bars-window-1.csv', 'bars-window-2.csv', 'bars-window-3.csv'],
        runSettings: {
            initialCapital: 10000,
            defaultQtyType: 'cash',
            defaultQtyValue: 1000,
            pyramiding: 10,
            commissionPercent: 0,
            verifyPriceForLimitOrdersTicks: 0,
            slippageTicks: 0,
            marginLongPercent: 100,
            marginShortPercent: 100,
            calcAfterOrderFilled: false,
            calcOnEveryTick: false,
            useBarMagnifier: false,
            onBarClose: false,
            useStandardOhlc: true,
            source: 'fixture-manifest',
        },
    },
    {
        fixtureKey: 'tradingview-vti-60m-2026-03-14',
        name: 'TradingView VTI 60m Parity Fixture',
        dirName: 'vti-60m',
        symbol: 'VTI',
        timeframe: '1h',
        notes: 'Seeded from the March 14, 2026 TradingView VTI 60m export with 500 USD cash sizing and standard OHLC disabled.',
        candleFileName: 'bars-baseline.csv',
        tradeFileName: 'trades-baseline.csv',
        runSettings: {
            initialCapital: 10000,
            defaultQtyType: 'cash',
            defaultQtyValue: 500,
            pyramiding: 10,
            commissionPercent: 0,
            verifyPriceForLimitOrdersTicks: 0,
            slippageTicks: 0,
            marginLongPercent: 100,
            marginShortPercent: 100,
            calcAfterOrderFilled: false,
            calcOnEveryTick: false,
            useBarMagnifier: false,
            onBarClose: false,
            useStandardOhlc: false,
            source: 'fixture-manifest',
        },
    },
    {
        fixtureKey: 'tradingview-aapl-1m-2026-03-14',
        name: 'TradingView AAPL 1m Parity Fixture',
        dirName: 'aapl-1m',
        symbol: 'AAPL',
        timeframe: '1m',
        notes: 'Seeded from the March 14, 2026 TradingView AAPL 1m export using the largest covering candle file plus nested overlap windows.',
        candleFileName: 'bars-baseline.csv',
        tradeFileName: 'trades-baseline.csv',
        supportCandleFileNames: ['bars-window-1.csv', 'bars-window-2.csv', 'bars-window-3.csv'],
        runSettings: {
            initialCapital: 10000,
            defaultQtyType: 'cash',
            defaultQtyValue: 500,
            pyramiding: 10,
            commissionPercent: 0,
            verifyPriceForLimitOrdersTicks: 0,
            slippageTicks: 0,
            marginLongPercent: 100,
            marginShortPercent: 100,
            calcAfterOrderFilled: false,
            calcOnEveryTick: false,
            useBarMagnifier: false,
            onBarClose: false,
            useStandardOhlc: false,
            source: 'fixture-manifest',
        },
    },
]

const DEFAULT_FIXTURE_KEY = BUILT_IN_PARITY_FIXTURES[0].fixtureKey

function hashContent(value: string) {
    return createHash('sha256').update(value).digest('hex')
}

function assertFixtureFile(dirName: string, fileName: string) {
    const targetPath = path.join(TRADINGVIEW_FIXTURES_DIR, dirName, fileName)
    if (!fs.existsSync(targetPath)) {
        throw new Error(`Missing parity fixture file: ${targetPath}`)
    }

    return targetPath
}

function readTextCached(filePath: string) {
    const cached = FILE_TEXT_CACHE.get(filePath)
    if (cached) {
        return cached
    }

    const text = fs.readFileSync(filePath, 'utf8')
    FILE_TEXT_CACHE.set(filePath, text)
    return text
}

function parseNumber(value: string | undefined) {
    const normalized = (value ?? '').replace(/,/g, '').trim()
    if (!normalized) {
        return 0
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number) {
    return Math.round(value * 100) / 100
}

function timeframeToSeconds(timeframe: string) {
    switch (timeframe) {
        case '1m':
            return 60
        case '5m':
            return 300
        case '15m':
            return 900
        case '1h':
            return 3600
        case '4h':
            return 14_400
        case '1d':
            return 86_400
        case '1w':
            return 604_800
        default:
            return 60
    }
}

function toTradeLabel(timestamp: number) {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date(timestamp * 1000))
}

function parseBarCsvFile(filePath: string) {
    const cached = BAR_FILE_CACHE.get(filePath)
    if (cached) {
        return cached
    }

    const rows = csvParse(readTextCached(filePath))
        .map((row) => ({
            time: Number(row.time),
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
            volume: Number(row.Volume ?? row.volume ?? 0),
        }))
        .filter((row) => Number.isFinite(row.time))

    BAR_FILE_CACHE.set(filePath, rows)
    return rows
}

function parseTradeCsvFile(filePath: string): NormalizedTradeRecord[] {
    const cached = TRADE_FILE_CACHE.get(filePath)
    if (cached) {
        return cached
    }

    const rows = csvParse(readTextCached(filePath)).map((row) => ({
        tradeNumber: parseNumber(row['Trade #'] ?? row['﻿Trade #']),
        type: (row.Type as NormalizedTradeRecord['type']) ?? 'Entry long',
        timestampLabel: row['Date and time'] ?? '',
        price: parseNumber(row['Price USD']),
        positionSizeQty: parseNumber(row['Position size (qty)']),
        positionSizeValue: parseNumber(row['Position size (value)']),
        netPnl: parseNumber(row['Net P&L USD']),
        netPnlPercent: parseNumber(row['Net P&L %']),
        cumulativePnl: parseNumber(row['Cumulative P&L USD']),
        cumulativePnlPercent: parseNumber(row['Cumulative P&L %']),
        signal: row.Signal ?? '',
    }))

    TRADE_FILE_CACHE.set(filePath, rows)
    return rows
}

function validateSupportWindows(
    baselineCandles: MarketDataPoint[],
    supportWindows: Array<{ fileName: string; candles: MarketDataPoint[] }>
) {
    if (supportWindows.length === 0) {
        return {
            supportWindowsMatchBaseline: true,
            supportWindowMismatchCount: 0,
            warnings: [] as string[],
        }
    }

    const warnings: string[] = []
    const baselineByTime = new Map(baselineCandles.map((bar) => [bar.time, bar]))
    let mismatchCount = 0
    let missingCount = 0

    for (const supportWindow of supportWindows) {
        for (const bar of supportWindow.candles) {
            const baseline = baselineByTime.get(bar.time)
            if (!baseline) {
                missingCount += 1
                continue
            }

            const isMatch = round(baseline.open) === round(bar.open)
                && round(baseline.high) === round(bar.high)
                && round(baseline.low) === round(bar.low)
                && round(baseline.close) === round(bar.close)
                && round(baseline.volume) === round(bar.volume)

            if (!isMatch) {
                mismatchCount += 1
            }
        }
    }

    if (mismatchCount === 0) {
        warnings.push(`Validated ${supportWindows.length} supporting candle window exports against the canonical baseline.`)
    }
    if (missingCount > 0) {
        warnings.push(`Ignored ${missingCount} support-window rows that fall outside the canonical candle window.`)
    }

    return {
        supportWindowsMatchBaseline: mismatchCount === 0,
        supportWindowMismatchCount: mismatchCount,
        warnings,
    }
}

function buildValidationReport(
    candles: MarketDataPoint[],
    trades: NormalizedTradeRecord[],
    runSettings: StrategyRunSettings,
    timeframe: string,
    supportWindows: Array<{ fileName: string; candles: MarketDataPoint[] }>
): FixtureValidationReport {
    const warnings: string[] = []
    const errors: string[] = []
    const groupedTrades = groupFixtureTrades(trades)
    const barByLabel = new Map(candles.map((bar) => [toTradeLabel(bar.time), bar]))
    const supportWindowValidation = validateSupportWindows(candles, supportWindows)
    const fillTolerance = 0.01

    const candleContinuityOk = candles.every((bar, index) => index === 0 || bar.time > candles[index - 1].time)
    if (!candleContinuityOk) {
        errors.push('Candle continuity check failed: the imported TradingView candle export contains a duplicate or non-increasing timestamp.')
    }

    const expectedStepSeconds = timeframeToSeconds(timeframe)
    const sessionGapCount = candles.reduce((count, bar, index) => {
        if (index === 0) {
            return count
        }

        return count + (bar.time - candles[index - 1].time > expectedStepSeconds ? 1 : 0)
    }, 0)
    if (sessionGapCount > 0) {
        warnings.push(`Detected ${sessionGapCount} expected non-trading session gaps in the imported TradingView candle export.`)
    }

    const tradePairingOk = groupedTrades.every((trade) => Boolean(trade.entryTimeLabel) && Boolean(trade.exitTimeLabel))
    if (!tradePairingOk) {
        errors.push('Trade pairing check failed: one or more TradingView trade rows did not pair into a complete entry/exit trade.')
    }

    const firstBarLabel = candles[0] ? toTradeLabel(candles[0].time) : ''
    const lastBarLabel = candles[candles.length - 1] ? toTradeLabel(candles[candles.length - 1].time) : ''
    const exactTradeWindowMatch = groupedTrades.every((trade) => trade.entryTimeLabel >= firstBarLabel && trade.exitTimeLabel <= lastBarLabel)
    if (!exactTradeWindowMatch) {
        errors.push('Trade window check failed: the TradingView trade export extends outside the candle fixture window.')
    }

    const timezoneConsistent = groupedTrades.every((trade) => barByLabel.has(trade.entryTimeLabel) && barByLabel.has(trade.exitTimeLabel))
    if (!timezoneConsistent) {
        errors.push('Timezone consistency check failed: one or more trade timestamps could not be matched to a New York session bar label.')
    }

    const fillPricesMatchExpectedBarOpens = groupedTrades.every((trade) => {
        const entryBar = barByLabel.get(trade.entryTimeLabel)
        const exitBar = barByLabel.get(trade.exitTimeLabel)
        if (!entryBar || !exitBar) {
            return false
        }

        const entryMatches = Math.abs(round(trade.entryPrice) - round(entryBar.open)) <= fillTolerance
        const exitMatches = trade.exitSignal === 'Open'
            ? Math.abs(round(trade.exitPrice) - round(exitBar.close)) <= fillTolerance
            : Math.abs(round(trade.exitPrice) - round(exitBar.open)) <= fillTolerance

        return entryMatches && exitMatches
    })
    if (!fillPricesMatchExpectedBarOpens) {
        errors.push('Fill-price check failed: one or more trades do not align with the expected next-bar-open or final-bar-close fill behavior.')
    }

    const quantityMatchesSettings = groupedTrades.every((trade) => {
        const expectedQuantity = Math.floor(runSettings.defaultQtyValue / trade.entryPrice)
        return expectedQuantity === trade.quantity
    })
    if (!quantityMatchesSettings) {
        errors.push('Quantity check failed: the trade export does not match the configured default cash order size for this fixture run.')
    }

    if (!supportWindowValidation.supportWindowsMatchBaseline) {
        errors.push(`Support-window overlap check failed: ${supportWindowValidation.supportWindowMismatchCount} supporting candle rows disagreed with the canonical baseline.`)
    }

    warnings.push(...supportWindowValidation.warnings)

    if (groupedTrades[groupedTrades.length - 1]?.exitSignal === 'Open') {
        warnings.push('TradingView force-closed the last open trade on the final bar close. The Mahita broker must mirror that end-of-window behavior.')
    }

    return {
        exactTradeWindowMatch,
        candleContinuityOk,
        tradePairingOk,
        fillPricesMatchExpectedBarOpens,
        quantityMatchesSettings,
        timezoneConsistent,
        supportWindowsMatchBaseline: supportWindowValidation.supportWindowsMatchBaseline,
        supportWindowMismatchCount: supportWindowValidation.supportWindowMismatchCount,
        supportWindowCount: supportWindows.length,
        warnings,
        errors,
    }
}

function buildFixtureManifest(
    definition: BuiltInFixtureDefinition,
    candles: MarketDataPoint[],
    trades: NormalizedTradeRecord[],
    pineSource: string,
    supportWindows: Array<{ fileName: string; candles: MarketDataPoint[] }>
): ParityFixtureManifest {
    const candleFilePath = assertFixtureFile(definition.dirName, definition.candleFileName)
    const validation = buildValidationReport(candles, trades, definition.runSettings, definition.timeframe, supportWindows)

    return {
        fixtureKey: definition.fixtureKey,
        name: definition.name,
        symbol: definition.symbol,
        timeframe: definition.timeframe,
        source: 'tradingview-fixture',
        candleFileName: definition.candleFileName,
        tradeFileName: definition.tradeFileName,
        supportCandleFileNames: definition.supportCandleFileNames ?? [],
        pineSourceHash: hashPineSource(pineSource),
        candleHash: hashContent(readTextCached(candleFilePath)),
        candleWindow: {
            firstBarTime: candles[0]?.time ?? 0,
            lastBarTime: candles[candles.length - 1]?.time ?? 0,
            barCount: candles.length,
        },
        runSettings: { ...definition.runSettings },
        validation,
    }
}

function loadBuiltInFixtureBundle(definition: BuiltInFixtureDefinition): BuiltInParityFixtureBundle {
    const cached = FIXTURE_BUNDLE_CACHE.get(definition.fixtureKey)
    if (cached) {
        return cached
    }

    const candleFilePath = assertFixtureFile(definition.dirName, definition.candleFileName)
    const tradeFilePath = assertFixtureFile(definition.dirName, definition.tradeFileName)
    const strategyFilePath = assertFixtureFile(definition.dirName, 'strategy.pine')
    const candles = parseBarCsvFile(candleFilePath)
    const trades = parseTradeCsvFile(tradeFilePath)
    const pineSource = readTextCached(strategyFilePath)
    const supportWindows = (definition.supportCandleFileNames ?? []).map((fileName) => ({
        fileName,
        candles: parseBarCsvFile(assertFixtureFile(definition.dirName, fileName)),
    }))

    const bundle: BuiltInParityFixtureBundle = {
        fixtureKey: definition.fixtureKey,
        name: definition.name,
        source: 'tradingview-fixture',
        symbol: definition.symbol,
        timeframe: definition.timeframe,
        notes: definition.notes,
        candles,
        trades,
        pineSource,
        manifest: buildFixtureManifest(definition, candles, trades, pineSource, supportWindows),
    }

    FIXTURE_BUNDLE_CACHE.set(definition.fixtureKey, bundle)
    return bundle
}

export function loadDefaultParityFixtureBundle() {
    return loadBuiltInFixtureBundle(BUILT_IN_PARITY_FIXTURES[0])
}

export function loadBuiltInParityFixtureBundles() {
    return BUILT_IN_PARITY_FIXTURES.map(loadBuiltInFixtureBundle)
}

export function getBuiltInParityFixtureDefinition(fixtureKey: string) {
    return BUILT_IN_PARITY_FIXTURES.find((fixture) => fixture.fixtureKey === fixtureKey) ?? null
}

async function runParityReportForBundle(bundle: BuiltInParityFixtureBundle): Promise<ParityBatchFixtureResult> {
    const comparedAt = new Date().toISOString()

    if (bundle.manifest.validation.errors.length > 0) {
        return {
            fixtureKey: bundle.fixtureKey,
            name: bundle.name,
            symbol: bundle.symbol,
            timeframe: bundle.timeframe,
            status: 'invalid',
            validation: bundle.manifest.validation,
            replayComparison: null,
            engineComparison: null,
            replayRuntimeMs: 0,
            engineRuntimeMs: 0,
            comparedAt,
        }
    }

    const engine = new BacktestEngine({} as never)
    const strategy = {
        id: bundle.fixtureKey,
        name: bundle.name,
        asset: bundle.symbol,
        timeframe: bundle.timeframe,
        script: bundle.pineSource,
        riskManagement: {
            positionSizingPercent: 100,
        },
    }

    const fixtureDataset = {
        id: bundle.fixtureKey,
        name: bundle.name,
        symbol: bundle.symbol,
        timeframe: bundle.timeframe,
        manifest: bundle.manifest,
        candles: bundle.candles,
        trades: bundle.trades,
    }
    const startTime = bundle.candles[0]?.time ?? 0
    const endTime = bundle.candles[bundle.candles.length - 1]?.time ?? startTime

    const replayStartedAt = Date.now()
    const replayResult = await engine.run(strategy, startTime, endTime, undefined, {
        fixture: fixtureDataset,
        strictParity: true,
        comparisonMode: 'auto',
    })
    const replayRuntimeMs = Date.now() - replayStartedAt

    const engineStartedAt = Date.now()
    const engineResult = await engine.run(strategy, startTime, endTime, undefined, {
        fixture: fixtureDataset,
        strictParity: false,
        comparisonMode: 'force-engine',
    })
    const engineRuntimeMs = Date.now() - engineStartedAt

    const replayComparison = replayResult.parityComparison ?? null
    const engineComparison = engineResult.parityComparison ?? null
    const status: ParityFixtureStatus = engineComparison?.exactMatch
        ? 'engine-compare'
        : replayComparison?.exactMatch
            ? 'verified-fixture-replay'
            : 'invalid'

    return {
        fixtureKey: bundle.fixtureKey,
        name: bundle.name,
        symbol: bundle.symbol,
        timeframe: bundle.timeframe,
        status,
        validation: bundle.manifest.validation,
        replayComparison,
        engineComparison,
        replayRuntimeMs,
        engineRuntimeMs,
        comparedAt,
    }
}

export async function runBuiltInParityBatch(fixtureKeys?: string[]) {
    const selected = BUILT_IN_PARITY_FIXTURES.filter((fixture) => !fixtureKeys || fixtureKeys.includes(fixture.fixtureKey))
    const fixtures: ParityBatchFixtureResult[] = []

    for (const definition of selected) {
        const bundle = loadBuiltInFixtureBundle(definition)
        fixtures.push(await runParityReportForBundle(bundle))
    }

    return {
        fixtures,
        exactReplayCount: fixtures.filter((fixture) => fixture.replayComparison?.exactMatch).length,
        exactEngineCount: fixtures.filter((fixture) => fixture.engineComparison?.exactMatch).length,
        divergentCount: fixtures.filter((fixture) => fixture.status === 'verified-fixture-replay').length,
        invalidCount: fixtures.filter((fixture) => fixture.status === 'invalid').length,
        totalFixtures: fixtures.length,
    } satisfies ParityBatchReport
}

function serializeFixtureRecord(record: {
    id: string
    fixtureKey: string
    name: string
    source: string
    symbol: string
    timeframe: string
    engineMode: string
    status: string
    notes: string | null
    manifestJson: string | null
    lastParityReportJson: string | null
    firstBarTime: Date | null
    lastBarTime: Date | null
    barCount: number
    tradeCount: number
    importedAt: Date
    candleRowsJson: string
    tradeRowsJson: string | null
}): StoredParityFixture {
    return {
        id: record.id,
        fixtureKey: record.fixtureKey,
        name: record.name,
        source: record.source,
        symbol: record.symbol,
        timeframe: record.timeframe,
        engineMode: record.engineMode,
        status: record.status,
        notes: record.notes,
        manifest: record.manifestJson ? JSON.parse(record.manifestJson) : null,
        lastParityReport: record.lastParityReportJson ? JSON.parse(record.lastParityReportJson) : null,
        firstBarTime: record.firstBarTime?.toISOString() ?? null,
        lastBarTime: record.lastBarTime?.toISOString() ?? null,
        barCount: record.barCount,
        tradeCount: record.tradeCount,
        importedAt: record.importedAt.toISOString(),
        candles: JSON.parse(record.candleRowsJson),
        trades: record.tradeRowsJson ? JSON.parse(record.tradeRowsJson) : [],
    }
}

export async function ensureBuiltInParityFixtures(userId: string, fixtureKeys?: string[]) {
    const selectedDefinitions = BUILT_IN_PARITY_FIXTURES.filter((fixture) => !fixtureKeys || fixtureKeys.includes(fixture.fixtureKey))
    const existingRecords = await prisma.parityFixture.findMany({
        where: { userId },
    })
    const existingByKey = new Map(existingRecords.map((record) => [record.fixtureKey, record]))
    const legacyBySignature = new Map(
        existingRecords
            .filter((record) => !record.fixtureKey)
            .map((record) => [`${record.name}:${record.symbol}:${record.timeframe}`, record] as const)
    )
    const ensured: StoredParityFixture[] = []

    for (const definition of selectedDefinitions) {
        const bundle = loadBuiltInFixtureBundle(definition)
        const manifestJson = JSON.stringify(bundle.manifest)
        const existing = existingByKey.get(definition.fixtureKey)
        const legacyRecord = legacyBySignature.get(`${definition.name}:${definition.symbol}:${definition.timeframe}`)

        if (
            existing
            && existing.manifestJson === manifestJson
            && existing.barCount === bundle.candles.length
            && existing.tradeCount === bundle.trades.length
            && existing.lastParityReportJson
        ) {
            ensured.push(serializeFixtureRecord(existing))
            continue
        }

        const report = await runParityReportForBundle(bundle)
        const nextData = {
            name: bundle.name,
            source: bundle.source,
            symbol: bundle.symbol,
            timeframe: bundle.timeframe,
            engineMode: 'pinets',
            status: report.status,
            notes: bundle.notes,
            manifestJson,
            lastParityReportJson: JSON.stringify(report),
            candleRowsJson: JSON.stringify(bundle.candles),
            tradeRowsJson: JSON.stringify(bundle.trades),
            firstBarTime: bundle.candles.length > 0 ? new Date(bundle.candles[0].time * 1000) : null,
            lastBarTime: bundle.candles.length > 0 ? new Date(bundle.candles[bundle.candles.length - 1].time * 1000) : null,
            barCount: bundle.candles.length,
            tradeCount: bundle.trades.length,
        }

        const upserted = legacyRecord && !existing
            ? await prisma.parityFixture.update({
                where: { id: legacyRecord.id },
                data: {
                    fixtureKey: definition.fixtureKey,
                    ...nextData,
                },
            })
            : await prisma.parityFixture.upsert({
                where: {
                    userId_fixtureKey: {
                        userId,
                        fixtureKey: definition.fixtureKey,
                    },
                },
                update: nextData,
                create: {
                    userId,
                    fixtureKey: definition.fixtureKey,
                    ...nextData,
                },
            })

        ensured.push(serializeFixtureRecord(upserted))
    }

    return ensured
}

export async function ensureDefaultParityFixture(userId: string) {
    const [fixture] = await ensureBuiltInParityFixtures(userId, [DEFAULT_FIXTURE_KEY])
    return fixture
}

export async function listParityFixtures(userId: string) {
    await ensureBuiltInParityFixtures(userId)

    const records = await prisma.parityFixture.findMany({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }],
    })
    const order = new Map(BUILT_IN_PARITY_FIXTURES.map((fixture, index) => [fixture.fixtureKey, index]))

    return records
        .map(serializeFixtureRecord)
        .filter((record) => order.has(record.fixtureKey))
        .sort((left, right) => (order.get(left.fixtureKey) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.fixtureKey) ?? Number.MAX_SAFE_INTEGER))
}

export async function getParityFixture(userId: string, id: string) {
    let record = await prisma.parityFixture.findFirst({
        where: {
            id,
            userId,
        },
    })

    if (!record) {
        await ensureBuiltInParityFixtures(userId)
        record = await prisma.parityFixture.findFirst({
            where: {
                id,
                userId,
            },
        })
    }

    return record ? serializeFixtureRecord(record) : null
}
