import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"
import { getAppServerSession, isSuperuserSession } from "@/lib/server-session"

export async function GET(req: NextRequest) {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isSuperuserSession(session)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const vaultName = searchParams.get('vault')

        const where: Prisma.DataInventoryWhereInput = {}
        if (vaultName) {
            const vault = await prisma.vault.findUnique({ where: { name: vaultName } })
            if (vault) {
                where.vaultId = vault.id
            }
        }

        const inventory = await prisma.dataInventory.findMany({
            where,
            include: {
                vault: {
                    select: {
                        name: true,
                        type: true
                    }
                }
            },
            orderBy: [
                { symbol: 'asc' },
                { timeframe: 'asc' }
            ]
        })

        return NextResponse.json(inventory)
    } catch (error) {
        console.error("Inventory Fetch Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
