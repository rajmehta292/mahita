import { NextRequest, NextResponse } from "next/server"
import { DataHealthManager } from "@/app/services/market-data/health"
import { Timeframe } from "@/app/services/market-data/types"
import { requireRouteAccess, writeAdminAuditEvent } from "@/lib/security/platform-security"

export async function POST(req: NextRequest) {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
        return access.response
    }

    try {
        const { symbol, timeframe } = await req.json()

        if (!symbol || !timeframe) {
            return NextResponse.json({ error: "Symbol and timeframe required" }, { status: 400 })
        }

        const result = await DataHealthManager.syncGaps(symbol, timeframe as Timeframe)

        await writeAdminAuditEvent({
            actorUserId: access.userId,
            action: "DATA_GAP_SYNC",
            metadata: JSON.stringify({ symbol, timeframe }),
        })

        return NextResponse.json({
            success: true,
            message: `Fixed ${result.gapsFixed} gaps, added ${result.barsAdded} bars.`,
            ...result
        })
    } catch (error) {
        console.error("Sync Gaps Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
