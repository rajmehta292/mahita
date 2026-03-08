import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { DataHealthManager } from "@/app/services/market-data/health"
import { getSchwabClient } from "@/app/services/schwab/client"
import { Timeframe } from "@/app/services/market-data/types"

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
        const needsSync = await (prisma as any).dataInventory.findMany({
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

        // 3. Find a user with valid Schwab configs to act as the global data provider
        // In a production multi-tenant app, you'd decouple system data fetching from user accounts.
        // For this MVP, we use the first available valid config.
        const providerConfig = await (prisma as any).schwabConfig.findFirst({
            where: {
                accessToken: { not: null },
                refreshToken: { not: null }
            }
        })

        if (!providerConfig && process.env.USE_MOCK_DATA !== 'true') {
            return NextResponse.json({ error: "No system Schwab connection available to fetch data." }, { status: 400 })
        }

        // 4. Initialize Client
        // We provide the provider's config. If USE_MOCK_DATA=true, the factory handles returning the mock.
        const client = getSchwabClient(providerConfig ? {
            clientId: providerConfig.clientId,
            callbackUrl: `${process.env.NEXTAUTH_URL || 'https://mahita.ai'}/schwab/callback`,
            accessToken: providerConfig.accessToken,
            refreshToken: providerConfig.refreshToken || undefined
        } : { clientId: 'mock', callbackUrl: 'mock' })

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

    } catch (error: any) {
        console.error("[CRON] Sync Error:", error)
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
    }
}
