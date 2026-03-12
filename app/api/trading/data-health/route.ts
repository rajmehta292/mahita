import { NextRequest, NextResponse } from "next/server"
import { DataHealthManager } from "@/app/services/market-data/health"
import { requireRouteAccess } from "@/lib/security/platform-security"

export async function GET(req: NextRequest) {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
        return access.response
    }

    try {
        const { searchParams } = new URL(req.url)
        const vault = searchParams.get('vault') || 'schwab'
        const symbol = searchParams.get('symbol')

        if (symbol) {
            const report = await DataHealthManager.getMultiIntervalHealth(symbol, vault)
            return NextResponse.json(report)
        }

        const reports = await DataHealthManager.getAllHealth(vault)
        return NextResponse.json(reports)
    } catch (error) {
        console.error("Data Health Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
