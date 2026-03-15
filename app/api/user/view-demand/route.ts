import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { upsertViewDemand } from "@/app/services/market-data/view-demand"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  if (typeof body.surface !== "string" || !body.surface.trim()) {
    return NextResponse.json({ error: "surface is required" }, { status: 400 })
  }

  const demand = await upsertViewDemand({
    userId: session.user.id,
    surface: body.surface,
    symbol: typeof body.symbol === "string" ? body.symbol : null,
    timeframe: typeof body.timeframe === "string" ? body.timeframe : null,
    providerPreference: typeof body.providerPreference === "string" ? body.providerPreference : null,
    priorityScore: typeof body.priorityScore === "number" ? body.priorityScore : 1,
    refreshIntervalSeconds: typeof body.refreshIntervalSeconds === "number" ? body.refreshIntervalSeconds : 13,
    ttlSeconds: typeof body.ttlSeconds === "number" ? body.ttlSeconds : undefined,
  })

  return NextResponse.json({ success: true, demand })
}
