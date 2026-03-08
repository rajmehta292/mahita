import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

interface ScreenerQueryRow {
    symbol: string
    price: number
    open: number
    volume: number
    source: string
    lastBarTime: number
    previousClose: number | null
}

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const [rows, inventory] = await Promise.all([
            prisma.$queryRaw<ScreenerQueryRow[]>`
                WITH ranked AS (
                    SELECT
                        symbol,
                        close,
                        open,
                        volume,
                        source,
                        CAST(strftime('%s', time) AS INTEGER) AS unix_time,
                        ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY time DESC) AS rn
                    FROM MarketData
                    WHERE timeframe = '1d'
                )
                SELECT
                    curr.symbol AS symbol,
                    curr.close AS price,
                    curr.open AS open,
                    curr.volume AS volume,
                    curr.source AS source,
                    curr.unix_time AS lastBarTime,
                    prev.close AS previousClose
                FROM ranked curr
                LEFT JOIN ranked prev
                    ON prev.symbol = curr.symbol
                    AND prev.rn = 2
                WHERE curr.rn = 1
                ORDER BY curr.symbol ASC
            `,
            prisma.dataInventory.findMany({
                where: { timeframe: '1d' },
                select: {
                    symbol: true,
                    healthScore: true,
                    targetCoveragePercent: true
                }
            })
        ])

        const inventoryBySymbol = new Map(
            inventory.map((item) => [item.symbol, item])
        )

        return NextResponse.json({
            rows: rows.map((row) => {
                const previousClose = row.previousClose ?? row.open
                const change = row.price - previousClose
                const changePercent = previousClose === 0 ? 0 : (change / previousClose) * 100
                const health = inventoryBySymbol.get(row.symbol)

                return {
                    symbol: row.symbol,
                    name: row.symbol,
                    price: row.price,
                    change,
                    changePercent,
                    volume: row.volume,
                    source: row.source,
                    lastBarTime: row.lastBarTime,
                    healthScore: health?.healthScore ?? 0,
                    targetCoveragePercent: health?.targetCoveragePercent ?? 0
                }
            })
        })
    } catch (error) {
        console.error("Screener Route Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
