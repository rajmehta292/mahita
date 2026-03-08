import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/lib/auth'
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const vaultName = searchParams.get('vault')

        const where: any = {}
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
