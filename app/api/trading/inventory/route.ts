import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        // Get unique symbols and their date ranges
        const inventory = await prisma.marketData.groupBy({
            by: ['symbol', 'timeframe'],
            _min: {
                time: true
            },
            _max: {
                time: true
            },
            _count: {
                _all: true
            }
        })

        return NextResponse.json(inventory)
    } catch (error) {
        console.error("Inventory Fetch Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
