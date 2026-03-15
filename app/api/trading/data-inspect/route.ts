import { NextRequest, NextResponse } from "next/server"
import { DataHealthManager } from "@/app/services/market-data/health"
import { readVaultBarsPage } from "@/app/services/market-data/read-service"
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
        const vault = searchParams.get('vault') || 'schwab'
        const page = parseInt(searchParams.get('page') || '1')
        const pageSize = parseInt(searchParams.get('pageSize') || '100')

        if (!symbol || !timeframe) {
            return NextResponse.json({ error: "Missing symbol or timeframe" }, { status: 400 })
        }

        const [pageResult, health] = await Promise.all([
            readVaultBarsPage({
                symbol,
                timeframe,
                page,
                pageSize,
                vaultName: vault,
            }),
            DataHealthManager.getHealth(symbol, timeframe, vault)
        ])

        return NextResponse.json({
            data: pageResult.bars.map(d => ({
                id: d.id,
                time: d.time,
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
                totalCount: pageResult.totalCount,
                totalPages: Math.ceil(pageResult.totalCount / pageSize)
            },
            health,
            vaultName: vault,
        })
    } catch (error) {
        console.error("Data Inspect Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
