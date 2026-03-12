import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { DataHealthManager } from "@/app/services/market-data/health"
import { Timeframe } from "@/app/services/market-data/types"
import { requireRouteAccess } from "@/lib/security/platform-security"

export async function GET(req: NextRequest) {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
        return access.response
    }

    try {
        const { searchParams } = new URL(req.url)
        const symbol = searchParams.get('symbol')
        const timeframe = searchParams.get('timeframe') as Timeframe
        const page = parseInt(searchParams.get('page') || '1')
        const pageSize = parseInt(searchParams.get('pageSize') || '100')

        if (!symbol || !timeframe) {
            return NextResponse.json({ error: "Missing symbol or timeframe" }, { status: 400 })
        }

        const [data, totalCount, health] = await Promise.all([
            prisma.marketData.findMany({
                where: { symbol, timeframe },
                orderBy: { time: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize
            }),
            prisma.marketData.count({
                where: { symbol, timeframe }
            }),
            DataHealthManager.getHealth(symbol, timeframe)
        ])

        return NextResponse.json({
            data: data.map(d => ({
                id: d.id,
                time: Math.floor(d.time.getTime() / 1000),
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                volume: d.volume,
                source: d.source
            })),
            pagination: {
                page,
                pageSize,
                totalCount,
                totalPages: Math.ceil(totalCount / pageSize)
            },
            health
        })
    } catch (error) {
        console.error("Data Inspect Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
