import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { parquetStore } from "@/app/services/market-data/parquet-store"
import { Timeframe } from "@/app/services/market-data/timeframe-math"

/**
 * Validates timeframe string
 */
function isValidTimeframe(tf: string): tf is Timeframe {
    const valid = ['1s', '5s', '15s', '30s', '1m', '3m', '5m', '10m', '15m', '30m', '45m', '1h', '2h', '3h', '4h', '1d', '1w', '1M']
    return valid.includes(tf)
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const symbol = searchParams.get("symbol")
        const timeframe = searchParams.get("timeframe")
        const limit = parseInt(searchParams.get("limit") || "1000") // UI default fallback

        if (!symbol || !timeframe) {
            return new NextResponse("Missing required parameters (symbol, timeframe)", { status: 400 })
        }

        if (!isValidTimeframe(timeframe)) {
            return new NextResponse(`Invalid timeframe.`, { status: 400 })
        }

        const assetClass = 'equity' // Fixed for MVP

        // Fetch overlapping data partitions requested by the UI bounds. 
        // For MVP, we will construct the past 5 years of partitions directly 
        // until the Metadata Database query logic is stitched into the API layer.

        let targetPartitionsToRead: Date[] = []
        const now = new Date()

        if (timeframe === '1d' || timeframe === '1w' || timeframe === '1M') {
            // For daily+, partitions might be yearly or monthly. For now, the MVP worker truncates them daily.
            // We'll walk backward 5 years dynamically hitting the local file structure.
            for (let i = 0; i < 1825; i++) { // 5 years backward
                const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
                targetPartitionsToRead.push(d)
            }
        } else {
            // For Intraday, just pull the last 30 days of partitions
            for (let i = 0; i < 30; i++) {
                const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i))
                targetPartitionsToRead.push(d)
            }
        }

        // Parallelize reading physical files from disk
        const rawBars = []
        for (const date of targetPartitionsToRead) {
            const filePath = parquetStore.getPartitionPath(assetClass, symbol, timeframe, date)
            const partitionBars = await parquetStore.readPartition(filePath)
            if (partitionBars.length > 0) {
                rawBars.push(...partitionBars)
            }
        }

        if (rawBars.length === 0) {
            // No data currently in Parquet Lake for this symbol/timeframe.
            return NextResponse.json({
                symbol,
                timeframe,
                data: [],
                metadata: {
                    source: "parquet",
                    count: 0
                }
            })
        }

        // Ensure chronological order
        rawBars.sort((a, b) => a.time - b.time)

        // Apply strict UI limit (take newest 'limit' bars exclusively from the tail)
        const trimmedBars = rawBars.slice(-limit)

        return NextResponse.json({
            symbol,
            timeframe,
            data: trimmedBars,
            metadata: {
                source: "parquet",
                count: trimmedBars.length,
                firstBar: trimmedBars[0]?.time,
                lastBar: trimmedBars[trimmedBars.length - 1]?.time
            }
        })
    } catch (error) {
        console.error(`[MarketData V2] API Error:`, error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
