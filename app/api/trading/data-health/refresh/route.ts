import { NextResponse } from "next/server"
import { DataHealthManager } from "@/app/services/market-data/health"
import { requireRouteAccess, writeAdminAuditEvent } from "@/lib/security/platform-security"

export async function POST() {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
        return access.response
    }

    try {
        await DataHealthManager.refreshInventory()
        await writeAdminAuditEvent({
            actorUserId: access.userId,
            action: "DATA_HEALTH_REFRESH",
            metadata: JSON.stringify({ route: "/api/trading/data-health/refresh" }),
        })
        return NextResponse.json({ success: true, message: "Inventory refreshed successfully" })
    } catch (error) {
        console.error("Data Refresh Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
