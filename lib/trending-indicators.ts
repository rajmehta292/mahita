import { EMA, RSI, SMA } from "technicalindicators"
import type { MarketDataPoint, Timeframe } from "@/app/services/market-data/types"

export interface TrendingStrategyInput {
    id: string
    name: string
    script: string
    timeframe: string
    symbol?: string
    description?: string
}

export type IndicatorRole = "entry_trigger" | "entry_confirmation" | "filter"

export type SupportedCondition =
    | {
        id: string
        kind: "ema_alignment" | "ema_crossover_up"
        label: string
        ruleText: string
        role: IndicatorRole
        fast: number
        slow: number
    }
    | {
        id: string
        kind: "sma_alignment" | "sma_crossover_up"
        label: string
        ruleText: string
        role: IndicatorRole
        fast: number
        slow: number
    }
    | {
        id: string
        kind: "rsi_below" | "rsi_above"
        label: string
        ruleText: string
        role: IndicatorRole
        length: number
        threshold: number
    }

export interface ParsedTrendingStrategy {
    strategyId: string
    name: string
    timeframe: string
    supported: boolean
    supportNote?: string
    conditions: SupportedCondition[]
}

export interface IndicatorMatch {
    symbol: string
    matchedAt: string
    price: number
    reason: string
    value: number
}

export interface StrategyFullMatch {
    symbol: string
    matchedAt: string
    price: number
    matchedConditions: number
    totalConditions: number
    isNewTrigger: boolean
}

export interface TrendingIndicatorCard {
    strategyId: string
    name: string
    timeframe: string
    status: "active" | "unsupported" | "data_stale"
    supportNote?: string
    lastScanAt: string | null
    summary: {
        symbolsScanned: number
        fullEntryMatches: number
        newTriggers: number
        nearMisses: number
        indicatorMatchesTotal: number
    }
    fullStrategyMatches: StrategyFullMatch[]
    newTriggers: StrategyFullMatch[]
    nearMisses: StrategyFullMatch[]
    indicators: Array<{
        conditionId: string
        label: string
        ruleText: string
        role: IndicatorRole
        matchCount: number
        matches: IndicatorMatch[]
    }>
}

const SUPPORTED_TIMEFRAMES = new Set<Timeframe>([
    "1m",
    "3m",
    "5m",
    "10m",
    "15m",
    "30m",
    "45m",
    "1h",
    "2h",
    "3h",
    "4h",
    "1d",
    "1w",
    "1M",
])

export const DEFAULT_TRENDING_SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "TSLA", "META"]

export function normalizeTrendingSymbols(symbols: string[] | undefined): string[] {
    const source = Array.isArray(symbols) && symbols.length > 0 ? symbols : DEFAULT_TRENDING_SYMBOLS
    return Array.from(
        new Set(source.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))
    ).slice(0, 40)
}

export function normalizeTrendingTimeframe(timeframe: string | undefined): Timeframe {
    if (timeframe && SUPPORTED_TIMEFRAMES.has(timeframe as Timeframe)) {
        return timeframe as Timeframe
    }

    return "1d"
}

export function parseStrategyForTrending(input: TrendingStrategyInput): ParsedTrendingStrategy {
    const script = input.script || ""
    const conditions: SupportedCondition[] = []
    const emaPeriods = extractPeriods(script, /ta\.ema\(\s*(?:close\s*,\s*)?(\d+)\s*\)/g)
    const smaPeriods = extractPeriods(script, /ta\.sma\(\s*(?:close\s*,\s*)?(\d+)\s*\)/g)
    const rsiPeriods = extractPeriods(script, /ta\.rsi\(\s*(?:close\s*,\s*)?(\d+)\s*\)/g)

    const hasCrossover = /(?:ta\.)?crossover\(/i.test(script)

    if (emaPeriods.length >= 2) {
        const [fast, slow] = emaPeriods.slice(0, 2).sort((left, right) => left - right)
        conditions.push({
            id: "ema-trend",
            kind: hasCrossover ? "ema_crossover_up" : "ema_alignment",
            label: hasCrossover ? "EMA Bullish Crossover" : "EMA Trend Alignment",
            ruleText: hasCrossover
                ? `EMA(${fast}) crosses above EMA(${slow})`
                : `EMA(${fast}) > EMA(${slow})`,
            role: hasCrossover ? "entry_trigger" : "entry_confirmation",
            fast,
            slow,
        })
    } else if (smaPeriods.length >= 2) {
        const [fast, slow] = smaPeriods.slice(0, 2).sort((left, right) => left - right)
        conditions.push({
            id: "sma-trend",
            kind: hasCrossover ? "sma_crossover_up" : "sma_alignment",
            label: hasCrossover ? "SMA Bullish Crossover" : "SMA Trend Alignment",
            ruleText: hasCrossover
                ? `SMA(${fast}) crosses above SMA(${slow})`
                : `SMA(${fast}) > SMA(${slow})`,
            role: hasCrossover ? "entry_trigger" : "entry_confirmation",
            fast,
            slow,
        })
    }

    if (rsiPeriods.length > 0) {
        const length = rsiPeriods[0]
        const rsiBelow = script.match(/\brsi[\w]*\s*<\s*(\d+(?:\.\d+)?)/i)
        const rsiAbove = script.match(/\brsi[\w]*\s*>\s*(\d+(?:\.\d+)?)/i)

        if (rsiBelow) {
            conditions.push({
                id: "rsi-below",
                kind: "rsi_below",
                label: "RSI Threshold",
                ruleText: `RSI(${length}) < ${rsiBelow[1]}`,
                role: "filter",
                length,
                threshold: Number(rsiBelow[1]),
            })
        } else if (rsiAbove) {
            conditions.push({
                id: "rsi-above",
                kind: "rsi_above",
                label: "RSI Momentum",
                ruleText: `RSI(${length}) > ${rsiAbove[1]}`,
                role: "filter",
                length,
                threshold: Number(rsiAbove[1]),
            })
        }
    }

    if (conditions.length === 0) {
        return {
            strategyId: input.id,
            name: input.name,
            timeframe: normalizeTrendingTimeframe(input.timeframe),
            supported: false,
            supportNote: "This script uses indicators or dynamic inputs that the current monitor kernel cannot evaluate yet.",
            conditions,
        }
    }

    return {
        strategyId: input.id,
        name: input.name,
        timeframe: normalizeTrendingTimeframe(input.timeframe),
        supported: true,
        conditions,
    }
}

export function evaluateTrendingStrategy(
    parsed: ParsedTrendingStrategy,
    symbols: string[],
    seriesBySymbol: Record<string, MarketDataPoint[]>
): TrendingIndicatorCard {
    if (!parsed.supported) {
        return {
            strategyId: parsed.strategyId,
            name: parsed.name,
            timeframe: parsed.timeframe,
            status: "unsupported",
            supportNote: parsed.supportNote,
            lastScanAt: null,
            summary: {
                symbolsScanned: 0,
                fullEntryMatches: 0,
                newTriggers: 0,
                nearMisses: 0,
                indicatorMatchesTotal: 0,
            },
            fullStrategyMatches: [],
            newTriggers: [],
            nearMisses: [],
            indicators: [],
        }
    }

    const indicatorMap = new Map(parsed.conditions.map((condition) => [condition.id, {
        conditionId: condition.id,
        label: condition.label,
        ruleText: condition.ruleText,
        role: condition.role,
        matchCount: 0,
        matches: [] as IndicatorMatch[],
    }]))

    const fullStrategyMatches: StrategyFullMatch[] = []
    const newTriggers: StrategyFullMatch[] = []
    const nearMisses: StrategyFullMatch[] = []
    let lastScanAt: string | null = null
    let symbolsScanned = 0

    for (const symbol of symbols) {
        const data = seriesBySymbol[symbol]
        if (!data || data.length < 40) {
            continue
        }

        symbolsScanned += 1
        const latestBar = data[data.length - 1]
        lastScanAt = latestBar ? new Date(latestBar.time * 1000).toISOString() : lastScanAt

        let currentMatched = 0
        let previousMatched = 0

        for (const condition of parsed.conditions) {
            const evaluation = evaluateCondition(condition, data)
            if (!evaluation) {
                continue
            }

            if (evaluation.current) {
                currentMatched += 1
                const entry = indicatorMap.get(condition.id)
                if (entry) {
                    entry.matches.push({
                        symbol,
                        matchedAt: new Date(latestBar.time * 1000).toISOString(),
                        price: latestBar.close,
                        reason: evaluation.reason,
                        value: evaluation.value,
                    })
                    entry.matchCount = entry.matches.length
                }
            }

            if (evaluation.previous) {
                previousMatched += 1
            }
        }

        const match: StrategyFullMatch = {
            symbol,
            matchedAt: new Date(latestBar.time * 1000).toISOString(),
            price: latestBar.close,
            matchedConditions: currentMatched,
            totalConditions: parsed.conditions.length,
            isNewTrigger: currentMatched === parsed.conditions.length && previousMatched !== parsed.conditions.length,
        }

        if (currentMatched === parsed.conditions.length) {
            fullStrategyMatches.push(match)
            if (match.isNewTrigger) {
                newTriggers.push(match)
            }
        } else if (currentMatched === parsed.conditions.length - 1 && parsed.conditions.length > 1) {
            nearMisses.push(match)
        }
    }

    const indicators = Array.from(indicatorMap.values()).map((entry) => ({
        ...entry,
        matches: [...entry.matches].sort((left, right) => left.symbol.localeCompare(right.symbol)),
    }))

    return {
        strategyId: parsed.strategyId,
        name: parsed.name,
        timeframe: parsed.timeframe,
        status: symbolsScanned === 0 ? "data_stale" : "active",
        supportNote: symbolsScanned === 0 ? "No sufficiently recent market data was available for this strategy scan." : parsed.supportNote,
        lastScanAt,
        summary: {
            symbolsScanned,
            fullEntryMatches: fullStrategyMatches.length,
            newTriggers: newTriggers.length,
            nearMisses: nearMisses.length,
            indicatorMatchesTotal: indicators.reduce((sum, indicator) => sum + indicator.matchCount, 0),
        },
        fullStrategyMatches: fullStrategyMatches.sort((left, right) => left.symbol.localeCompare(right.symbol)),
        newTriggers: newTriggers.sort((left, right) => left.symbol.localeCompare(right.symbol)),
        nearMisses: nearMisses.sort((left, right) => right.matchedConditions - left.matchedConditions || left.symbol.localeCompare(right.symbol)),
        indicators,
    }
}

function extractPeriods(script: string, pattern: RegExp) {
    return Array.from(
        new Set(
            Array.from(script.matchAll(pattern), (match) => Number(match[1])).filter((value) => Number.isFinite(value))
        )
    ).sort((left, right) => left - right)
}

function evaluateCondition(condition: SupportedCondition, data: MarketDataPoint[]) {
    if (condition.kind === "rsi_below" || condition.kind === "rsi_above") {
        const values = RSI.calculate({
            period: condition.length,
            values: data.map((point) => point.close),
        })
        const current = values[values.length - 1]
        const previous = values[values.length - 2]

        if (current == null || previous == null) {
            return null
        }

        const comparator = condition.kind === "rsi_below"
            ? (value: number) => value < condition.threshold
            : (value: number) => value > condition.threshold

        return {
            current: comparator(current),
            previous: comparator(previous),
            value: current,
            reason: `RSI(${condition.length}) ${current.toFixed(2)} vs ${condition.threshold}`,
        }
    }

    if (condition.kind === "ema_alignment" || condition.kind === "ema_crossover_up") {
        return evaluateMovingAverageCondition(condition, data, true)
    }

    if (condition.kind === "sma_alignment" || condition.kind === "sma_crossover_up") {
        return evaluateMovingAverageCondition(condition, data, false)
    }

    return null
}

function evaluateMovingAverageCondition(
    condition: Extract<SupportedCondition, { kind: "ema_alignment" | "ema_crossover_up" | "sma_alignment" | "sma_crossover_up" }>,
    data: MarketDataPoint[],
    useEma: boolean
) {
    const calculator = useEma ? EMA : SMA
    const values = data.map((point) => point.close)
    const fastSeries = padSeries(values.length, calculator.calculate({ period: condition.fast, values }))
    const slowSeries = padSeries(values.length, calculator.calculate({ period: condition.slow, values }))
    const currentIndex = values.length - 1
    const previousIndex = values.length - 2
    const prePreviousIndex = values.length - 3

    const currentFast = fastSeries[currentIndex]
    const currentSlow = slowSeries[currentIndex]
    const previousFast = fastSeries[previousIndex]
    const previousSlow = slowSeries[previousIndex]
    const prePreviousFast = fastSeries[prePreviousIndex]
    const prePreviousSlow = slowSeries[prePreviousIndex]

    if ([currentFast, currentSlow, previousFast, previousSlow].some((value) => Number.isNaN(value))) {
        return null
    }

    if (condition.kind === "ema_crossover_up" || condition.kind === "sma_crossover_up") {
        return {
            current: currentFast > currentSlow && previousFast <= previousSlow,
            previous: Number.isNaN(prePreviousFast) || Number.isNaN(prePreviousSlow)
                ? false
                : previousFast > previousSlow && prePreviousFast <= prePreviousSlow,
            value: currentFast - currentSlow,
            reason: `${useEma ? "EMA" : "SMA"}(${condition.fast}) ${currentFast.toFixed(2)} crossed above ${condition.slow} at ${currentSlow.toFixed(2)}`,
        }
    }

    return {
        current: currentFast > currentSlow,
        previous: previousFast > previousSlow,
        value: currentFast - currentSlow,
        reason: `${useEma ? "EMA" : "SMA"}(${condition.fast}) ${currentFast.toFixed(2)} vs ${condition.slow} ${currentSlow.toFixed(2)}`,
    }
}

function padSeries(targetLength: number, values: number[]) {
    return new Array(targetLength - values.length).fill(Number.NaN).concat(values)
}
