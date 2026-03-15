import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserPreferences, upsertUserPreferences } from "@/lib/user-preferences"

export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const preferences = await getUserPreferences(session.user.id)

    return NextResponse.json({
        success: true,
        preferences
    })
}

export async function PATCH(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const preferences = await upsertUserPreferences(session.user.id, {
        selectedAccountId: body.selectedAccountId ?? undefined,
        portfolioColumns: body.portfolioColumns ?? undefined,
        portfolioSortKey: body.portfolioSortKey ?? undefined,
        portfolioSortDirection: body.portfolioSortDirection ?? undefined,
        dashboardLayout: body.dashboardLayout ?? undefined,
        watchlistSymbols: body.watchlistSymbols ?? undefined,
        indicatorFavorites: body.indicatorFavorites ?? undefined,
        trendingStrategyIds: body.trendingStrategyIds ?? undefined,
        viewRefreshIntervalSeconds: typeof body.viewRefreshIntervalSeconds === 'number'
            ? Math.max(3, Math.floor(body.viewRefreshIntervalSeconds))
            : undefined,
    })

    return NextResponse.json({
        success: true,
        preferences
    })
}
