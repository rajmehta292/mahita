import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { marketDataStore } from '@/app/services/market-data/store'
import { Timeframe } from '@/app/services/market-data/types'

const DEFAULT_LOOKBACKS: Record<Timeframe, number> = {
    '1s': 86400,
    '5s': 3 * 86400,
    '15s': 3 * 86400,
    '30s': 3 * 86400,
    '1m': 7 * 86400,
    '3m': 21 * 86400,
    '5m': 30 * 86400,
    '10m': 45 * 86400,
    '15m': 60 * 86400,
    '30m': 120 * 86400,
    '45m': 180 * 86400,
    '1h': 365 * 86400,
    '2h': 730 * 86400,
    '3h': 730 * 86400,
    '4h': 730 * 86400,
    '1d': 5 * 31536000,
    '1w': 10 * 31536000,
    '1M': 15 * 31536000
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get("symbol")?.trim().toUpperCase()
    const timeframe = (searchParams.get("timeframe") || "1d") as Timeframe
    const provider = searchParams.get("provider") || undefined
    const forceRefresh = searchParams.get("refresh") === "true"
    const now = Math.floor(Date.now() / 1000)

    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required" }, { status: 400 })
    }

    if (!(timeframe in DEFAULT_LOOKBACKS)) {
        return NextResponse.json({ error: "Unsupported timeframe" }, { status: 400 })
    }

    const explicitFrom = Number(searchParams.get("from"))
    const explicitTo = Number(searchParams.get("to"))
    const endTime = Number.isFinite(explicitTo) && explicitTo > 0 ? explicitTo : now
    const startTime = Number.isFinite(explicitFrom) && explicitFrom > 0
        ? explicitFrom
        : endTime - DEFAULT_LOOKBACKS[timeframe]

    try {
        const result = await marketDataStore.getHistoricalDataWithReport(symbol, timeframe, startTime, endTime, {
            providerOverride: provider,
            forceRefresh
        })

        const sourceRows = await prisma.marketData.findMany({
            where: {
                symbol,
                timeframe,
                time: {
                    gte: new Date(startTime * 1000),
                    lte: new Date(endTime * 1000)
                }
            },
            select: { source: true },
            distinct: ['source']
        })

        const sources = sourceRows.map((row) => row.source).filter(Boolean)

        const formattedData = result.data.map((point) => ({
            time: point.time,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume,
            source: sources.join(',') || result.report.chunkReports[result.report.chunkReports.length - 1]?.provider || 'cache'
        }))

        return NextResponse.json({
            symbol,
            timeframe,
            data: formattedData,
            metadata: {
                rangeStart: startTime,
                rangeEnd: endTime,
                cacheBars: result.report.cacheBars,
                fetchedBars: result.report.fetchedBars,
                persistedBars: result.report.persistedBars,
                dbBarCount: result.report.dbTotalAfterFetch,
                sources,
                warnings: result.report.warnings,
                chunks: result.report.chunkReports
            }
        })
    } catch (error) {
        console.error("Market Data Route Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
