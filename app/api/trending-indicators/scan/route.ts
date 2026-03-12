import { NextRequest, NextResponse } from "next/server"
import { getAppServerSession } from "@/lib/server-session"
import { marketDataStore } from "@/app/services/market-data/store"
import {
    evaluateTrendingStrategy,
    normalizeTrendingSymbols,
    normalizeTrendingTimeframe,
    parseStrategyForTrending,
    type TrendingStrategyInput,
} from "@/lib/trending-indicators"

const LOOKBACK_SECONDS: Record<string, number> = {
    "1m": 14 * 24 * 60 * 60,
    "3m": 30 * 24 * 60 * 60,
    "5m": 45 * 24 * 60 * 60,
    "10m": 60 * 24 * 60 * 60,
    "15m": 90 * 24 * 60 * 60,
    "30m": 180 * 24 * 60 * 60,
    "45m": 180 * 24 * 60 * 60,
    "1h": 365 * 24 * 60 * 60,
    "2h": 365 * 24 * 60 * 60,
    "3h": 365 * 24 * 60 * 60,
    "4h": 365 * 24 * 60 * 60,
    "1d": 3 * 365 * 24 * 60 * 60,
    "1w": 8 * 365 * 24 * 60 * 60,
    "1M": 12 * 365 * 24 * 60 * 60,
}

export async function POST(request: NextRequest) {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const strategies = Array.isArray(body.strategies) ? (body.strategies as TrendingStrategyInput[]) : []
    const symbols = normalizeTrendingSymbols(Array.isArray(body.symbols) ? body.symbols : undefined)

    if (strategies.length === 0) {
        return NextResponse.json({
            success: true,
            generatedAt: new Date().toISOString(),
            cards: [],
        })
    }

    const parsedStrategies = strategies.slice(0, 20).map(parseStrategyForTrending)
    const now = Math.floor(Date.now() / 1000)
    const seriesCache = new Map<string, Awaited<ReturnType<typeof marketDataStore.getHistoricalData>>>()

    for (const parsed of parsedStrategies) {
        const timeframe = normalizeTrendingTimeframe(parsed.timeframe)
        const uniqueSymbols = normalizeTrendingSymbols([
            ...symbols,
            ...strategies
                .filter((strategy) => strategy.id === parsed.strategyId)
                .map((strategy) => strategy.symbol ?? "")
                .filter(Boolean),
        ])

        for (const symbol of uniqueSymbols) {
            const cacheKey = `${symbol}:${timeframe}`
            if (seriesCache.has(cacheKey)) {
                continue
            }

            const lookback = LOOKBACK_SECONDS[timeframe] ?? LOOKBACK_SECONDS["1d"]
            const data = await marketDataStore.getHistoricalData(symbol, timeframe, now - lookback, now)
            seriesCache.set(cacheKey, data)
        }
    }

    const cards = parsedStrategies.map((parsed) => {
        const timeframe = normalizeTrendingTimeframe(parsed.timeframe)
        const strategySymbols = normalizeTrendingSymbols([
            ...symbols,
            ...strategies
                .filter((strategy) => strategy.id === parsed.strategyId)
                .map((strategy) => strategy.symbol ?? "")
                .filter(Boolean),
        ])

        const seriesBySymbol = Object.fromEntries(
            strategySymbols.map((symbol) => [
                symbol,
                seriesCache.get(`${symbol}:${timeframe}`) ?? [],
            ])
        )

        return evaluateTrendingStrategy(parsed, strategySymbols, seriesBySymbol)
    }).sort((left, right) => {
        if (right.summary.fullEntryMatches !== left.summary.fullEntryMatches) {
            return right.summary.fullEntryMatches - left.summary.fullEntryMatches
        }

        return left.name.localeCompare(right.name)
    })

    return NextResponse.json({
        success: true,
        generatedAt: new Date().toISOString(),
        cards,
    })
}
