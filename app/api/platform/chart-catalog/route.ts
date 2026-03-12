import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAppServerSession } from "@/lib/server-session"
import { buildCustomerChartCatalog } from "@/lib/platform/customer-read-models"

export async function GET() {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let rows = await prisma.dataInventory.findMany({
        select: {
            symbol: true,
            timeframe: true,
            lastSynced: true,
            lastBar: true,
            barCount: true,
        },
        orderBy: [
            { symbol: "asc" },
            { timeframe: "asc" },
        ],
    })

    if (rows.length === 0) {
        const marketRows = await prisma.marketData.findMany({
            distinct: ["symbol", "timeframe"],
            select: {
                symbol: true,
                timeframe: true,
                time: true,
            },
            orderBy: [
                { symbol: "asc" },
                { timeframe: "asc" },
                { time: "desc" },
            ],
        })

        rows = marketRows.map((row) => ({
            symbol: row.symbol,
            timeframe: row.timeframe,
            lastSynced: row.time,
            lastBar: row.time,
            barCount: 0,
        }))
    }

    const catalog = buildCustomerChartCatalog(rows)

    return NextResponse.json({
        success: true,
        symbols: catalog.map((entry) => entry.symbol),
        catalog,
    })
}
