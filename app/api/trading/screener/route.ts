import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { vaultManager } from "@/app/services/market-data/vault-manager"
import { DataHealthManager } from "@/app/services/market-data/health"

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
        const vaultClient = await vaultManager.getClient('schwab')

        const rows = await vaultClient.$queryRaw<ScreenerQueryRow[]>`
            WITH ranked AS (
                SELECT
                    symbol,
                    close AS price,
                    open,
                    volume,
                    source,
                    CAST(strftime('%s', time) AS INTEGER) AS lastBarTime,
                    ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY time DESC) AS rn
                FROM MarketData
                WHERE timeframe = '1d'
            )
            SELECT
                curr.symbol AS symbol,
                curr.price AS price,
                curr.open AS open,
                curr.volume AS volume,
                curr.source AS source,
                curr.lastBarTime AS lastBarTime,
                prev.price AS previousClose
            FROM ranked curr
            LEFT JOIN ranked prev
                ON prev.symbol = curr.symbol
                AND prev.rn = 2
            WHERE curr.rn = 1
            ORDER BY curr.symbol ASC
        `

        // Health arrays are now calculated on the fly as inventory isn't stored centrally
        const healthReports = await Promise.all(
            rows.map(row => DataHealthManager.getHealth(row.symbol, '1d', 'schwab'))
        )

        const inventoryBySymbol = new Map(
            healthReports.map((item) => [item.symbol, item])
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
