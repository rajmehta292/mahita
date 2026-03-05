import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const symbol = searchParams.get("symbol")
    const timeframe = searchParams.get("timeframe") || "1d"

    if (!symbol) {
        return NextResponse.json({ error: "Symbol is required" }, { status: 400 })
    }

    try {
        const data = await prisma.marketData.findMany({
            where: {
                symbol,
                timeframe,
            },
            orderBy: {
                time: "asc",
            },
        })

        // Map DateTime objects to unix timestamps (seconds) for TradingView
        const formattedData = data.map(d => ({
            ...d,
            time: Math.floor(new Date(d.time).getTime() / 1000)
        }))

        return NextResponse.json(formattedData)
    } catch (error) {
        console.error("Market Data Fetch Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
