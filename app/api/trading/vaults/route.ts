import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
    /*
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    */

    try {
        console.log("[API] Prisma keys:", Object.keys(prisma))
        console.log("[API] Fetching vaults...")
        const vaults = await prisma.vault.findMany({
            orderBy: { name: 'asc' }
        })
        console.log(`[API] Found ${vaults.length} vaults`)
        return NextResponse.json(vaults)
    } catch (error) {
        console.error("Vaults Fetch Error:", error)
        if (error instanceof Error) {
            console.error("Error Message:", error.message)
            console.error("Error Stack:", error.stack)
        }
        return NextResponse.json({
            error: "Internal Server Error",
            details: error instanceof Error ? error.message : String(error),
            availableModels: Object.keys(prisma)
        }, { status: 500 })
    }
}
