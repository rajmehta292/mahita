import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import { DataHealthManager } from "@/app/services/market-data/health"

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        await DataHealthManager.refreshInventory()
        return NextResponse.json({ success: true, message: "Inventory refreshed successfully" })
    } catch (error) {
        console.error("Data Refresh Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
