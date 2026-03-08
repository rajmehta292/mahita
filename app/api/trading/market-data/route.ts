import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import prisma from "@/lib/prisma"
import { getSchwabClient } from "@/app/services/schwab/client"

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get("symbol")
    const timeframe = searchParams.get("timeframe") || "1d"
    const forceRefresh = searchParams.get("refresh") === "true"

    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required" }, { status: 400 })
    }

    try {
        // 1. Try to get data from local database first
        let data = await (prisma.marketData as any).findMany({
            where: { symbol, timeframe },
            orderBy: { time: "asc" },
        })

        // 2. If no data or force refresh, try to fetch from Schwab
        if (data.length === 0 || forceRefresh) {
            try {
                const user = await (prisma.user as any).findUnique({
                    where: { email: session.user.email },
                    include: { schwabConfig: true }
                })

                if (user?.schwabConfig?.accessToken) {
                    const client = getSchwabClient({
                        clientId: user.schwabConfig.clientId,
                        callbackUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/schwab/callback`,
                        accessToken: user.schwabConfig.accessToken,
                        refreshToken: user.schwabConfig.refreshToken || undefined
                    })

                    const schwabParams = mapTimeframeToSchwab(timeframe)
                    const response = await client.getPriceHistory(symbol, {
                        ...schwabParams,
                        frequencyType: schwabParams.frequencyType as any,
                        periodType: timeframe === '1d' ? 'year' : 'day',
                        period: 1
                    })

                    const candles = response.data?.candles || []

                    if (candles.length > 0) {
                        // Save new candles to database
                        await prisma.$transaction(
                            candles.map((c: any) =>
                                (prisma.marketData as any).upsert({
                                    where: {
                                        symbol_timeframe_time: {
                                            symbol,
                                            timeframe,
                                            time: new Date(c.datetime)
                                        }
                                    },
                                    update: {
                                        open: c.open,
                                        high: c.high,
                                        low: c.low,
                                        close: c.close,
                                        volume: c.volume,
                                        source: 'schwab'
                                    },
                                    create: {
                                        symbol,
                                        timeframe,
                                        time: new Date(c.datetime),
                                        open: c.open,
                                        high: c.high,
                                        low: c.low,
                                        close: c.close,
                                        volume: c.volume,
                                        source: 'schwab'
                                    }
                                })
                            )
                        )

                        // Re-fetch from database to get the combined/updated set
                        data = await (prisma.marketData as any).findMany({
                            where: { symbol, timeframe },
                            orderBy: { time: "asc" },
                        })
                    }
                }
            } catch (schwabError) {
                console.error("Schwab Fetch Error:", schwabError)
                // Continue with whatever data we have (could be empty)
            }
        }

        // Map DateTime objects to unix timestamps (seconds) for TradingView
        const formattedData = data.map((d: any) => ({
            id: d.id,
            time: Math.floor(new Date(d.time).getTime() / 1000),
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume,
            source: d.source || 'unknown'
        }))

        return NextResponse.json(formattedData)
    } catch (error) {
        console.error("Market Data Route Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

function mapTimeframeToSchwab(timeframe: string) {
    switch (timeframe) {
        case '1m': return { frequencyType: 'minute', frequency: 1 };
        case '5m': return { frequencyType: 'minute', frequency: 5 };
        case '15m': return { frequencyType: 'minute', frequency: 15 };
        case '30m': return { frequencyType: 'minute', frequency: 30 };
        case '1h': return { frequencyType: 'minute', frequency: 60 };
        case '1d': return { frequencyType: 'daily', frequency: 1 };
        case '1w': return { frequencyType: 'weekly', frequency: 1 };
        case '1M': return { frequencyType: 'monthly', frequency: 1 };
        default: return { frequencyType: 'daily', frequency: 1 };
    }
}
