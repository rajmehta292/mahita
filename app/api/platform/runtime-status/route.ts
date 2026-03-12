import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getAppServerSession } from "@/lib/server-session"
import { marketDataStore } from "@/app/services/market-data/store"
import { continuousIngestController } from "@/app/services/market-data/continuous-ingest"
import { buildCustomerRuntimeStatus } from "@/lib/platform/customer-read-models"

export async function GET() {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [symbolCount, timeframeCount, latestInventory] = await Promise.all([
        prisma.dataInventory.findMany({
            distinct: ["symbol"],
            select: { symbol: true },
        }).then((rows) => rows.length),
        prisma.dataInventory.findMany({
            distinct: ["timeframe"],
            select: { timeframe: true },
        }).then((rows) => rows.length),
        prisma.dataInventory.aggregate({
            _max: { lastSynced: true },
        }),
    ])

    return NextResponse.json({
        success: true,
        runtime: buildCustomerRuntimeStatus(
            continuousIngestController.getStatus(),
            marketDataStore.getAvailableProviders(),
            {
                symbolCount,
                timeframeCount,
                latestSyncAt: latestInventory._max.lastSynced ?? null,
            }
        ),
    })
}
