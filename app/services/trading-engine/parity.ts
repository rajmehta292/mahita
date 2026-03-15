import type { CompletedTrade, NormalizedTradeRecord, ParityComparisonResult, StrategyRuntimeSnapshot } from './types'

interface FixtureTradePair {
    tradeNumber: number
    entryTimeLabel: string
    exitTimeLabel: string
    entryPrice: number
    exitPrice: number
    quantity: number
    pnl: number
    cumulativePnl: number
    entrySignal: string
    exitSignal: string
}

const TRADE_LABEL_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
})

function round(value: number) {
    return Math.round(value * 100) / 100
}

function toTradeLabel(timestamp: number) {
    return TRADE_LABEL_FORMATTER.format(new Date(timestamp * 1000))
}

export function groupFixtureTrades(trades: NormalizedTradeRecord[]): FixtureTradePair[] {
    const grouped = new Map<number, Partial<FixtureTradePair>>()

    for (const row of trades) {
        const bucket = grouped.get(row.tradeNumber) ?? { tradeNumber: row.tradeNumber }
        if (row.type === 'Entry long') {
            bucket.entryTimeLabel = row.timestampLabel
            bucket.entryPrice = row.price
            bucket.quantity = row.positionSizeQty
            bucket.entrySignal = row.signal
        } else if (row.type === 'Exit long') {
            bucket.exitTimeLabel = row.timestampLabel
            bucket.exitPrice = row.price
            bucket.pnl = row.netPnl
            bucket.cumulativePnl = row.cumulativePnl
            bucket.exitSignal = row.signal
        }

        grouped.set(row.tradeNumber, bucket)
    }

    return Array.from(grouped.values())
        .sort((left, right) => (left.tradeNumber ?? 0) - (right.tradeNumber ?? 0))
        .map((row) => ({
            tradeNumber: row.tradeNumber ?? 0,
            entryTimeLabel: row.entryTimeLabel ?? '',
            exitTimeLabel: row.exitTimeLabel ?? '',
            entryPrice: row.entryPrice ?? 0,
            exitPrice: row.exitPrice ?? 0,
            quantity: row.quantity ?? 0,
            pnl: row.pnl ?? 0,
            cumulativePnl: row.cumulativePnl ?? 0,
            entrySignal: row.entrySignal ?? '',
            exitSignal: row.exitSignal ?? '',
        }))
}

export function compareCompletedTradesToFixture(
    actualTrades: CompletedTrade[],
    fixtureTrades: NormalizedTradeRecord[],
    fixtureId?: string,
    window?: { firstBarTime?: number; lastBarTime?: number },
    runtimeSnapshots: StrategyRuntimeSnapshot[] = []
): ParityComparisonResult {
    const expected = filterFixtureTradesToWindow(groupFixtureTrades(fixtureTrades), window?.firstBarTime, window?.lastBarTime)

    let firstDivergenceTradeNumber: number | undefined
    let firstDivergenceField: string | undefined
    let firstDivergenceMessage: string | undefined
    let matchingTradeCount = 0

    const maxLength = Math.max(expected.length, actualTrades.length)

    for (let index = 0; index < maxLength; index += 1) {
        const expectedTrade = expected[index]
        const actualTrade = actualTrades[index]

        if (!expectedTrade || !actualTrade) {
            firstDivergenceTradeNumber = expectedTrade?.tradeNumber ?? index + 1
            firstDivergenceField = 'trade-count'
            firstDivergenceMessage = `Expected ${expected.length} completed trades but received ${actualTrades.length}.`
            break
        }

        const actualEntryLabel = toTradeLabel(actualTrade.entryTime)
        const actualExitLabel = toTradeLabel(actualTrade.exitTime)
        const actualCumulativePnl = round(actualTrade.cumulativePnl ?? 0)

        const checks: Array<[string, number | string, number | string]> = [
            ['entryTime', actualEntryLabel, expectedTrade.entryTimeLabel],
            ['exitTime', actualExitLabel, expectedTrade.exitTimeLabel],
            ['entryPrice', round(actualTrade.entryPrice), round(expectedTrade.entryPrice)],
            ['exitPrice', round(actualTrade.exitPrice), round(expectedTrade.exitPrice)],
            ['quantity', actualTrade.quantity, expectedTrade.quantity],
            ['pnl', round(actualTrade.pnl), round(expectedTrade.pnl)],
            ['cumulativePnl', actualCumulativePnl, round(expectedTrade.cumulativePnl)],
        ]

        const mismatch = checks.find(([, actualValue, expectedValue]) => actualValue !== expectedValue)
        if (mismatch) {
            firstDivergenceTradeNumber = expectedTrade.tradeNumber
            firstDivergenceField = mismatch[0]
            firstDivergenceMessage = `Trade #${expectedTrade.tradeNumber} diverged on ${mismatch[0]} (expected ${mismatch[2]}, received ${mismatch[1]}).`
            break
        }

        matchingTradeCount += 1
    }

    const divergenceContext = buildDivergenceContext(
        firstDivergenceField,
        firstDivergenceTradeNumber,
        expected,
        actualTrades,
        runtimeSnapshots
    )

    return {
        fixtureId,
        exactMatch: !firstDivergenceMessage && expected.length === actualTrades.length,
        matchingTradeCount,
        expectedTradeCount: expected.length,
        actualTradeCount: actualTrades.length,
        firstDivergenceTradeNumber,
        firstDivergenceField,
        firstDivergenceMessage,
        firstDivergenceBarTime: divergenceContext?.time,
        firstDivergenceBarLabel: divergenceContext?.label,
        firstDivergenceRuntimeVariable: divergenceContext?.runtimeVariable,
        firstDivergenceRuntimeValue: divergenceContext?.runtimeValue,
        expectedCumulativePnl: expected.length > 0 ? round(expected[expected.length - 1].cumulativePnl) : 0,
        actualCumulativePnl: actualTrades.length > 0 ? round(actualTrades[actualTrades.length - 1].cumulativePnl ?? 0) : 0,
    }
}

export function detectFixtureWindowMismatch(
    firstBarTime: number | undefined,
    lastBarTime: number | undefined,
    fixtureTrades: NormalizedTradeRecord[]
) {
    if (!firstBarTime || !lastBarTime || fixtureTrades.length === 0) {
        return null
    }

    const tradeYears = new Set(
        fixtureTrades
            .map((row) => row.timestampLabel.slice(0, 4))
            .filter((value) => /^\d{4}$/.test(value))
    )
    const barWindowLabel = `${toTradeLabel(firstBarTime)} -> ${toTradeLabel(lastBarTime)}`
    const barYear = String(new Date(firstBarTime * 1000).getUTCFullYear())

    if (tradeYears.size === 1 && !tradeYears.has(barYear)) {
        return `TradingView trade export year ${Array.from(tradeYears)[0]} does not match candle fixture year ${barYear} (${barWindowLabel}).`
    }

    return null
}

function filterFixtureTradesToWindow(
    trades: FixtureTradePair[],
    firstBarTime: number | undefined,
    lastBarTime: number | undefined
) {
    if (!firstBarTime || !lastBarTime) {
        return trades
    }

    const firstLabel = toTradeLabel(firstBarTime)
    const lastLabel = toTradeLabel(lastBarTime)

    return trades.filter((trade) => trade.entryTimeLabel >= firstLabel && trade.exitTimeLabel <= lastLabel)
}

function buildDivergenceContext(
    firstDivergenceField: string | undefined,
    firstDivergenceTradeNumber: number | undefined,
    expectedTrades: FixtureTradePair[],
    actualTrades: CompletedTrade[],
    runtimeSnapshots: StrategyRuntimeSnapshot[]
) {
    if (!firstDivergenceField || !firstDivergenceTradeNumber || runtimeSnapshots.length === 0) {
        return null
    }

    const expectedTrade = expectedTrades.find((trade) => trade.tradeNumber === firstDivergenceTradeNumber)
    const actualTrade = actualTrades[firstDivergenceTradeNumber - 1]
    const targetLabel = firstDivergenceField === 'exitTime'
        ? (expectedTrade?.exitTimeLabel ?? (actualTrade ? toTradeLabel(actualTrade.exitTime) : ''))
        : (expectedTrade?.entryTimeLabel ?? (actualTrade ? toTradeLabel(actualTrade.entryTime) : ''))
    const runtimeVariable = firstDivergenceField === 'exitTime' || firstDivergenceField === 'exitPrice' || firstDivergenceField === 'pnl' || firstDivergenceField === 'cumulativePnl'
        ? 'exitLong'
        : firstDivergenceField === 'quantity'
            ? 'positionSize'
            : 'longEntry'

    const snapshot = runtimeSnapshots.find((candidate) => toTradeLabel(candidate.time) === targetLabel)
        ?? runtimeSnapshots.find((candidate) => candidate.vars[runtimeVariable] !== undefined)

    if (!snapshot) {
        return null
    }

    return {
        time: snapshot.time,
        label: toTradeLabel(snapshot.time),
        runtimeVariable,
        runtimeValue: runtimeVariable === 'positionSize'
            ? snapshot.positionSize
            : snapshot.vars[runtimeVariable],
    }
}
