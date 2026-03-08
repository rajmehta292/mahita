import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import prisma from "@/lib/prisma"
import { DataHealthManager } from "@/app/services/market-data/health"
import { getSchwabClient } from "@/app/services/schwab/client"
import { Timeframe } from "@/app/services/market-data/types"

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { symbol, timeframe } = await req.json()

        if (!symbol || !timeframe) {
            return NextResponse.json({ error: "Symbol and timeframe required" }, { status: 400 })
        }

        // 1. Get user and schwab config
        const user = await (prisma.user as any).findUnique({
            where: { email: session.user.email },
            include: { schwabConfig: true }
        })

        if (!user?.schwabConfig?.accessToken) {
            return NextResponse.json({ error: "Schwab not connected" }, { status: 400 })
        }

        // 2. Initialize Schwab client
        const client = getSchwabClient({
            clientId: user.schwabConfig.clientId,
            callbackUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/schwab/callback`,
            accessToken: user.schwabConfig.accessToken,
            refreshToken: user.schwabConfig.refreshToken || undefined
        })

        // 3. Trigger sync
        const result = await DataHealthManager.syncGaps(symbol, timeframe as Timeframe)

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
