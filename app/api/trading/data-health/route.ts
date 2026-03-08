import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import { DataHealthManager } from "@/app/services/market-data/health"

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        // V1 SQLite Deprecation Proxy
        // For MVP V2, we return a mock health array so the Data Command doesn't crash 
        // while we map out actual Parquet metadata parsing.
        const mockReports = [
            { symbol: 'AAPL', timeframe: '1d', healthScore: 100, gaps: [], source: 'yahoo', count: 1255, targetCoveragePercent: 100, startIndex: Date.now() - (5 * 365 * 86400 * 1000), endIndex: Date.now() }
        ]
        return NextResponse.json(mockReports)
    } catch (error) {
        console.error("Data Health Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
