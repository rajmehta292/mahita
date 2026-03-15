import { NextResponse } from "next/server"
import { getAppServerSession } from "@/lib/server-session"
import { getCanonicalChartCatalogRows } from "@/app/services/market-data/read-service"
import { buildCustomerChartCatalog } from "@/lib/platform/customer-read-models"

export async function GET() {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rows = await getCanonicalChartCatalogRows()
    const catalog = buildCustomerChartCatalog(rows)

    return NextResponse.json({
        success: true,
        symbols: catalog.map((entry) => entry.symbol),
        catalog,
        metadata: {
            sourceOfTruth: "vault-sqlite",
            canonicalVault: "schwab",
            parquetStatus: "experimental",
        },
    })
}
