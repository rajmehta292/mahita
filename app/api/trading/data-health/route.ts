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
