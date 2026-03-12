import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { DataHealthManager } from "@/app/services/market-data/health"
import { Timeframe } from "@/app/services/market-data/types"
import {
    allowInsecureUserBrokeragePlatformFallback,
    getPlatformCredentialIsolationError,
} from "@/lib/security/platform-security"
import { getRuntimeSchwabProviderMembers } from "@/lib/provider-credentials"

export async function GET(req: NextRequest) {
    // Basic Cron Security (assuming Vercel or custom header)
    const authHeader = req.headers.get("authorization")
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        console.log("[CRON] Starting background data health sync...")

        // 1. Refresh global inventory fast counts
        await DataHealthManager.refreshInventory()

        // 2. Find symbols that need syncing (Health < 95%)
        const needsSync = await prisma.dataInventory.findMany({
            where: {
                healthScore: {
                    lt: 95
                }
            },
            take: 5 // Process in small batches to avoid timeouts
        })

        if (needsSync.length === 0) {
            return NextResponse.json({ success: true, message: "All tracked data is fully synced (Health >= 95%)." })
        }

        if (!allowInsecureUserBrokeragePlatformFallback() && process.env.USE_MOCK_DATA !== 'true') {
            return NextResponse.json({ error: getPlatformCredentialIsolationError() }, { status: 503 })
        }

        const providerMembers = await getRuntimeSchwabProviderMembers()
        if (
            providerMembers.length === 0 &&
            !allowInsecureUserBrokeragePlatformFallback() &&
            process.env.USE_MOCK_DATA !== 'true'
        ) {
            return NextResponse.json({ error: getPlatformCredentialIsolationError() }, { status: 503 })
        }

        let totalGapsFixed = 0
        let totalBarsAdded = 0
        const syncedItems = []

        // 5. Sync the gaps
        for (const item of needsSync) {
            console.log(`[CRON] Syncing gaps for ${item.symbol} ${item.timeframe}...`)
            const result = await DataHealthManager.syncGaps(item.symbol, item.timeframe as Timeframe)
            totalGapsFixed += result.gapsFixed
            totalBarsAdded += result.barsAdded
            syncedItems.push(item.symbol)
        }

        return NextResponse.json({
            success: true,
            message: `Background sync completed. Fixed ${totalGapsFixed} gaps, added ${totalBarsAdded} bars.`,
            syncedItems
        })

    } catch (error: unknown) {
        console.error("[CRON] Sync Error:", error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : "Internal Server Error"
        }, { status: 500 })
    }
}
