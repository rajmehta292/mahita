import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireRouteAccess } from "@/lib/security/platform-security"

export async function GET() {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
        return access.response
    }

    try {
        const vaults = await prisma.vault.findMany({
            orderBy: { name: 'asc' }
        })
        return NextResponse.json(vaults)
    } catch (error) {
        console.error("Vaults Fetch Error:", error)
        if (error instanceof Error) {
            console.error("Error Message:", error.message)
            console.error("Error Stack:", error.stack)
        }
        return NextResponse.json({
            error: "Internal Server Error",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
